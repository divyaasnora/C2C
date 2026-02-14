import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import axios from "axios";

export default function CameraTile({ cam, socket, onClose }) {
  const videoRef = useRef(null);
  const [detectionStatus, setDetectionStatus] = useState("CLEAR");
  const [isRecording, setIsRecording] = useState(false);

  // ================= HLS INIT =================
  useEffect(() => {
    if (videoRef.current && cam.streamUrl) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(cam.streamUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current.play();
        });
        return () => hls.destroy();
      } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = cam.streamUrl;
        videoRef.current.play();
      }
    }
  }, [cam.streamUrl]);

  // ================= SOCKET DETECTION =================
  useEffect(() => {
  if (!socket) return;

  const handler = (data) => {
    if (String(data.cameraId) === String(cam.id)) {
      setDetectionStatus(data.status);
    }
  };

  socket.on("detection", handler);
  return () => socket.off("detection", handler);
}, [socket, cam]);

  // ================= RECORDING =================
  const toggleRecording = async () => {
    const res = await axios.post(
      `http://localhost:5000/toggle-record/${cam.id}`,
      {
        rtspUrl: cam.rtsp,
      

      }
    );
    setIsRecording(res.data.recording);
  };
    console.log("RTSP being sent:", cam.rtsp);
  // ================= UI =================
  return (
    <div
      style={{
        position: "relative",
        border: "2px solid #0a010be5",
        background: "#0a010be5",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        controls
        style={{ width: "100%", display: "block" }}
      />

      {/* 🔴 RED OVERLAY WHEN ALARM */}
      {detectionStatus === "ALARM" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,0,0,0.45)",
            border: "4px solid red",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "white",
            fontSize: "28px",
            fontWeight: "bold",
            zIndex: 5,
          }}
        >
          🚨 MOTION DETECTED 🚨
        </div>
      )}

      <button
        onClick={toggleRecording}
        style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}
      >
        {isRecording ? "STOP REC" : "REC"}
      </button>

      <button
        onClick={onClose}
        style={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}
      >
        X
      </button>
    </div>
  );
}
