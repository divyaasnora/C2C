const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const ping = require("ping");
const http = require("http");
const axios = require("axios");

const { recognizeFace } = require("./faceService/faceRecognition");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

/* ================= FOLDERS ================= */

const RECORDINGS_DIR = path.join(__dirname, "recordings");
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR);

/* ================= MEDIAMTX ================= */

const MEDIAMTX_API = "http://localhost:9997";

/* ================= MEMORY ================= */

const recordingProcesses = {};
const faceIntervals = {};

/* ================= RTSP ================= */

const RTSP_TEMPLATES = [
  "rtsp://{user}:{pass}@{ip}:554/cam/realmonitor?channel=1&subtype=0",
  "rtsp://{user}:{pass}@{ip}:554/h264/ch1/main/av_stream",
];

/* ================= TEST RTSP ================= */

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

/* ================= FIND WORKING RTSP ================= */

async function findWorkingRTSP(ip, user, pass) {
  for (const template of RTSP_TEMPLATES) {
    const url = template
      .replace("{ip}", ip)
      .replace("{user}", user)
      .replace("{pass}", pass);

    if (await testRTSP(url)) return url;
  }
  return null;
}

/* ================= FACE DETECTION ================= */

async function detectFace(rtspUrl, cameraId) {
  const snapshot = path.join(__dirname, `snap_${cameraId}.jpg`);

  const ff = spawn("ffmpeg", [
    "-y",
    "-rtsp_transport", "tcp",
    "-i", rtspUrl,
    "-frames:v", "1",
    "-q:v", "2",
    snapshot
  ]);

  ff.on("close", async () => {
    if (!fs.existsSync(snapshot)) return;

    const result = await recognizeFace(snapshot);

    if (!result || !result.result) {
      fs.unlink(snapshot, () => {});
      return;
    }

    const faces = result.result;

    if (faces.length > 0 && faces[0].subjects?.length > 0) {
      const person = faces[0].subjects[0];

      console.log("✅ Recognized:", person.subject);

      io.emit("face-event", {
        cameraId,
        type: "recognized",
        name: person.subject,
        similarity: person.similarity
      });

    } else {
      console.log("❌ Unknown face");

      io.emit("face-event", {
        cameraId,
        type: "unknown"
      });
    }

    fs.unlink(snapshot, () => {});
  });
}

/* ================= CHECK IP ================= */

app.post("/check-ip", async (req, res) => {
  const { ip } = req.body;
  const result = await ping.promise.probe(ip, { timeout: 3 });
  res.json({ online: result.alive });
});

/* ================= START STREAM ================= */

app.post("/start-stream", async (req, res) => {
  try {
    const { ip, username, password } = req.body;

    const rtspUrl = await findWorkingRTSP(ip, username, password);
    if (!rtspUrl) return res.status(400).json({ error: "RTSP failed" });

    const id = Date.now().toString();

    console.log("🎥 RTSP:", rtspUrl);

    // 👉 Add to MediaMTX
    await axios.post(`${MEDIAMTX_API}/v3/config/paths/add/${id}`, {
      source: rtspUrl,
      sourceOnDemand: false,
    });

    // 👉 Start face detection loop
    faceIntervals[id] = setInterval(() => {
      detectFace(rtspUrl, id);
    }, 4000); // every 4 sec

    res.json({
      streamId: id,
      webrtcUrl: `http://localhost:8889/${id}/`,
      rtsp: rtspUrl
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Stream failed" });
  }
});

/* ================= STOP STREAM ================= */

app.post("/stop-stream/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await axios.post(`${MEDIAMTX_API}/v3/config/paths/remove/${id}`);
  } catch {}

  if (faceIntervals[id]) {
    clearInterval(faceIntervals[id]);
    delete faceIntervals[id];
  }

  res.json({ stopped: true });
});

/* ================= RECORD ================= */

app.post("/toggle-record/:id", (req, res) => {
  const { id } = req.params;
  const { rtspUrl } = req.body;

  if (recordingProcesses[id]) {
    recordingProcesses[id].stdin.write("q");
    recordingProcesses[id].stdin.end();
    delete recordingProcesses[id];
    return res.json({ recording: false });
  }

  const file = path.join(RECORDINGS_DIR, `rec_${id}.mp4`);

  const rec = spawn("ffmpeg", [
    "-rtsp_transport", "tcp",
    "-i", rtspUrl,
    "-an",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-movflags", "+faststart",
    "-y",
    file
  ]);

  recordingProcesses[id] = rec;

  res.json({ recording: true });
});

/* ================= RECORDINGS ================= */

app.get("/recordings-list", (req, res) => {
  const files = fs.readdirSync(RECORDINGS_DIR);

  const result = files.map((file) => ({
    file,
    url: `http://localhost:${PORT}/recordings/${file}`
  }));

  res.json(result);
});

app.use("/recordings", express.static(RECORDINGS_DIR));

/* ================= SOCKET ================= */

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
});

/* ================= START SERVER ================= */

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});