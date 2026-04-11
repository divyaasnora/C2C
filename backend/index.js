const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/recordings", express.static(path.join(__dirname, "recordings")));

if (!fs.existsSync("recordings")) {
  fs.mkdirSync("recordings");
}

const buildRTSP = (ip, username, password) => {
  return `rtsp://${username}:${password}@${ip}:554/h264/ch1/main/av_stream`;
};

let recordings = {};

const checkMediaMTX = async () => {
  try {
    await axios.get("http://localhost:9997/v3/paths/list");
    return true;
  } catch (err) {
    return false;
  }
};

app.post("/start-stream", async (req, res) => {
  try {
    const { ip, username, password } = req.body;

    if (!ip || !username || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const isRunning = await checkMediaMTX();
    if (!isRunning) {
      return res.status(500).json({
        error: "MediaMTX not running on port 9997",
      });
    }

    const id = Date.now().toString();
    const rtspUrl = buildRTSP(ip, username, password);

    console.log("🎥 RTSP URL:", rtspUrl);

    await axios.post(`http://localhost:9997/v3/config/paths/add/${id}`, {
      source: rtspUrl,
      sourceOnDemand: false,
    });

    res.json({
      streamId: id,
      webrtcUrl: `http://localhost:8889/${id}/`,
    });
  } catch (err) {
    console.error("❌ STREAM ERROR:");
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: err.response?.data || "Failed to start stream",
    });
  }
});

app.post("/stop-stream", async (req, res) => {
  try {
    const { id } = req.body;

    await axios.post(`http://localhost:9997/v3/config/paths/remove/${id}`);

    res.json({ message: "Stream stopped" });
  } catch (err) {
    console.error("❌ STOP ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to stop stream" });
  }
});

app.post("/start-recording", (req, res) => {
  try {
    const { id, ip, username, password } = req.body;

    const rtsp = buildRTSP(ip, username, password);
    const filePath = path.join(__dirname, "recordings", `${id}_${Date.now()}.mp4`);
    console.log("🔴 Recording started:", filePath);

    const ffmpeg = spawn("ffmpeg", [
      "-rtsp_transport",
      "tcp",
      "-i",
      rtsp,

      "-an",

      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",

      "-movflags",
      "+faststart",

      "-y",
      filePath,
    ]);
    ffmpeg.stderr.on("data", (data) => {
      console.log(`FFmpeg: ${data}`);
    });

    ffmpeg.on("close", (code) => {
      console.log(`FFmpeg stopped with code ${code}`);
    });

    recordings[id] = ffmpeg;

    res.json({ message: "Recording started", filePath });
  } catch (err) {
    console.error("❌ RECORD ERROR:", err);
    res.status(500).json({ error: "Recording failed" });
  }
});

app.post("/stop-recording", (req, res) => {
  const { id } = req.body;

  if (recordings[id]) {
    recordings[id].kill("SIGINT");
    delete recordings[id];
    console.log("🛑 Recording stopped:", id);
  }

  res.json({ message: "Recording stopped" });
});

app.get("/recordings-list", (req, res) => {
  const files = fs.readdirSync("recordings");

  const result = files.map((file) => ({
    file,
    url: `http://localhost:5001/recordings/${file}`,
  }));

  res.json(result);
});

app.listen(5001, () => {
  console.log("🚀 Server running on http://localhost:5001");
});
