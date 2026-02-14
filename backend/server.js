const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const ping = require("ping");
const http = require("http");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });


const HLS_ROOT = path.join(__dirname, "hls");
if (!fs.existsSync(HLS_ROOT)) fs.mkdirSync(HLS_ROOT);

app.use("/hls", express.static(HLS_ROOT));

const ffmpegStreamMap = {};
const recordingProcesses = {};
const detectionProcesses = {};

/* ================= RTSP TEMPLATES ================= */
const RTSP_TEMPLATES = [
  "rtsp://{user}:{pass}@{ip}:554/cam/realmonitor?channel=1&subtype=0",
  "rtsp://{user}:{pass}@{ip}:554/h264/ch1/main/av_stream",
];

/* ================= HELPERS ================= */
function testRTSP(rtspUrl) {
  return new Promise((resolve) => {
    const ff = spawn("ffmpeg", [
      "-rtsp_transport", "tcp",
      "-i", rtspUrl,
      "-t", "2",
      "-f", "null", "-"
    ]);

    ff.on("exit", (code) => resolve(code === 0));
    ff.on("error", () => resolve(false));
  });
}

async function findWorkingRTSP(ip, user, pass) {
  for (const template of RTSP_TEMPLATES) {
    const rtspUrl = template
      .replace("{ip}", ip)
      .replace("{user}", user)
      .replace("{pass}", pass);

    if (await testRTSP(rtspUrl)) {
      return rtspUrl;
    }
  }
  return null;
}

/* ================= PYTHON DETECTION ================= */
function runDetection(cameraId, rtspUrl) {
  const py = spawn("python", ["./python/detect.py", rtspUrl]);

  detectionProcesses[cameraId] = py;

  py.stdout.on("data", (data) => {
    const msg = data.toString().trim();

    if (msg === "ALARM" || msg === "CLEAR") {
      io.emit("detection", {
        cameraId,
        status: msg,
      });
      console.log("Detection:", cameraId, msg);
    }
  });

  py.stderr.on("data", (err) => {
    console.error("Python error:", err.toString());
  });

  py.on("close", () => {
    delete detectionProcesses[cameraId];
  });
}

/* ================= ROUTES ================= */

// Check IP
app.post("/check-ip", async (req, res) => {
  const { ip } = req.body;
  const result = await ping.promise.probe(ip, { timeout: 3 });
  res.json({ online: result.alive });
});

// Start stream
app.post("/start-stream", async (req, res) => {
  try {
    const { ip, username, password } = req.body;

    const rtspUrl = await findWorkingRTSP(ip, username, password);
    if (!rtspUrl) return res.status(400).json({ error: "RTSP not detected" });

    const streamId = Date.now().toString();
    const streamDir = path.join(HLS_ROOT, streamId);
    fs.mkdirSync(streamDir, { recursive: true });

    const m3u8Path = path.join(streamDir, "stream.m3u8");

    const ffmpeg = spawn("ffmpeg", [
      "-rtsp_transport", "tcp",
      "-i", rtspUrl,
      "-an",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-g", "15",
      "-f", "hls",
      "-hls_time", "2",
"-hls_list_size", "50",
"-hls_flags", "append_list+delete_segments",

      m3u8Path,
    ]);

    ffmpegStreamMap[streamId] = ffmpeg;

    runDetection(streamId, rtspUrl);

    const wait = setInterval(() => {
      if (fs.existsSync(m3u8Path)) {
        clearInterval(wait);
        res.json({
          streamId,
          streamUrl: `http://localhost:${PORT}/hls/${streamId}/stream.m3u8`,
          rtsp: rtspUrl,
        });
      }
    }, 300);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Stop stream
app.post("/stop-stream/:id", (req, res) => {
  const { id } = req.params;

  if (ffmpegStreamMap[id]) {
    ffmpegStreamMap[id].kill("SIGINT");
    delete ffmpegStreamMap[id];
  }

  if (detectionProcesses[id]) {
    detectionProcesses[id].kill("SIGINT");
    delete detectionProcesses[id];
  }

  res.json({ stopped: true });
});

// Recording toggle
app.post("/toggle-record/:id", (req, res) => {
  const { id } = req.params;
  const { rtspUrl } = req.body;

  if (!rtspUrl) {
    return res.status(400).json({ error: "RTSP URL missing" });
  }

  //Stop Recording
  if (recordingProcesses[id]) {
    const recorder = recordingProcesses[id];

    console.log("Stopping recording:", id);

    // Gracefully stop ffmpeg
    recorder.stdin.write("q");
    recorder.stdin.end();

    recorder.on("close", () => {
      console.log("Recording finalized:", id);
      delete recordingProcesses[id];
    });

  return res.json({ recording: false });
  }

  ///Start Recording
  const recordingsDir = path.join(__dirname, "recordings");

  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir);
  }

  const filePath = path.join(
    recordingsDir,
    `record_${id}_${Date.now()}.mp4`
  );

  console.log("Starting recording:", filePath);


 
 const recorder = spawn(
    "ffmpeg",
    [
      "-rtsp_transport", "tcp",
      "-fflags", "+genpts",
      "-avoid_negative_ts", "make_zero",
      "-use_wallclock_as_timestamps", "1",
      "-i", rtspUrl,

      "-map", "0:v:0",        
      "-c:v", "copy",         
      "-an",                 

      "-movflags", "+faststart+frag_keyframe+empty_moov",
      "-flush_packets", "1",
      "-muxdelay", "0",

      filePath
    ],
    {
      stdio: ["pipe", "pipe", "pipe"]
    }
  )


  recordingProcesses[id] = recorder;

  recorder.on("close", (code) => {
    console.log("Recording stopped:", id, "Code:", code);
    delete recordingProcesses[id];
  });

  recorder.on("error", (err) => {
    console.error("FFmpeg error:", err);
    delete recordingProcesses[id];
  });

  res.json({ recording: true });
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
});

server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
