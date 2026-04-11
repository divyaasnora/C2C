import { useState } from "react";

export default function CameraTile({ cam, onClose }) {
  const [isRecording, setIsRecording] = useState(false);

  const toggleRecording = async () => {
    const res = await fetch(
      `http://localhost:5000/toggle-record/${cam.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtspUrl: cam.rtsp }),
      }
    );

    const data = await res.json();
    setIsRecording(data.recording);
  };

  return (
    <div className="relative bg-black rounded-xl overflow-hidden">

      {/* 🔥 WEBRTC STREAM */}
      <iframe
        src={cam.webrtcUrl}
        className="w-full h-64"
        allow="autoplay; fullscreen; camera; microphone"
      />

      {/* RECORD BUTTON */}
      <button
        onClick={toggleRecording}
        className={`absolute bottom-2 left-2 px-3 py-1 text-white text-xs rounded ${
          isRecording ? "bg-red-600" : "bg-gray-700"
        }`}
      >
        {isRecording ? "⏹ STOP" : "⏺ REC"}
      </button>

      {/* CLOSE */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 text-xs rounded"
      >
        ✖
      </button>
    </div>
  );
}