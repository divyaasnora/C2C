import { useState, useEffect } from "react";

export default function Camera() {
  const [ip, setIp] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cameras, setCameras] = useState([]);
  const [recordings, setRecordings] = useState([]);

  // 🔥 FETCH RECORDINGS
  const fetchRecordings = async () => {
    try {
      const res = await fetch("http://localhost:5001/recordings-list");
      const data = await res.json();
      setRecordings(data);
    } catch (err) {
      console.error("Error fetching recordings", err);
    }
  };

  // AUTO LOAD RECORDINGS
  useEffect(() => {
    fetchRecordings();
  }, []);

  // ▶️ START STREAM
  const startStream = async () => {
    try {
      const res = await fetch("http://localhost:5001/start-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ip, username, password }),
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();

      setCameras((prev) => [
        ...prev,
        {
          id: data.streamId,
          url: data.webrtcUrl,
          ip,
          username,
          password,
          recording: false,
        },
      ]);
    } catch (err) {
      alert("❌ Failed to start stream");
      console.error(err);
    }
  };

  // ❌ REMOVE CAMERA
  const removeCamera = async (id) => {
    await fetch("http://localhost:5001/stop-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    setCameras((prev) => prev.filter((cam) => cam.id !== id));
  };

  // 🎥 START RECORDING
  const startRecording = async (cam) => {
    await fetch("http://localhost:5001/start-recording", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cam),
    });

    setCameras((prev) =>
      prev.map((c) =>
        c.id === cam.id ? { ...c, recording: true } : c
      )
    );
  };

  // 🛑 STOP RECORDING
  const stopRecording = async (id) => {
  await fetch("http://localhost:5001/stop-recording", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });

  setCameras((prev) =>
    prev.map((c) =>
      c.id === id ? { ...c, recording: false } : c
    )
  );

  // 🔥 WAIT before fetching
  setTimeout(() => {
    fetchRecordings();
  }, 1500);
};

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* 🔹 HEADER */}
      <h1 className="text-3xl font-bold text-center mb-6">
        📷 Multi Camera Dashboard
      </h1>

      {/* 🔹 INPUT PANEL */}
      <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-md mb-6">
        <div className="flex flex-col gap-4">
          <input
            className="border p-3 rounded-lg"
            placeholder="IP Address"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
          />
          <input
            className="border p-3 rounded-lg"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="border p-3 rounded-lg"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={startStream}
            className="bg-blue-500 text-white py-3 rounded-lg"
          >
            ➕ Add Camera
          </button>
        </div>
      </div>

      {/* 🔥 CAMERA GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cameras.map((cam, index) => (
          <div
            key={`${cam.id}-${index}`}
            className="relative bg-black rounded-xl overflow-hidden shadow-lg"
          >
            {/* ❌ REMOVE */}
            <button
              onClick={() => removeCamera(cam.id)}
              className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 text-xs rounded z-10"
            >
              ✖
            </button>

            {/* 🎥 RECORD BUTTON */}
            <div className="absolute bottom-2 left-2 z-10">
              {!cam.recording ? (
                <button
                  onClick={() => startRecording(cam)}
                  className="bg-red-500 text-white px-3 py-1 text-xs rounded"
                >
                  ⏺ Start
                </button>
              ) : (
                <button
                  onClick={() => stopRecording(cam.id)}
                  className="bg-gray-700 text-white px-3 py-1 text-xs rounded"
                >
                  ⏹ Stop
                </button>
              )}
            </div>

            {/* 🔴 REC INDICATOR */}
            {cam.recording && (
              <div className="absolute bottom-2 right-2 text-red-500 text-xs animate-pulse z-10">
                ● REC
              </div>
            )}

            {/* 🎥 STREAM */}
            <iframe
              src={cam.url}
              className="w-full h-56"
              allow="autoplay; fullscreen"
            />
          </div>
        ))}
      </div>

      {/* 🔄 REFRESH BUTTON */}
      <div className="text-center mt-10">
        <button
          onClick={fetchRecordings}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          🔄 Refresh Recordings
        </button>
      </div>

      

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {recordings.map((rec, index) => (
          <div
            key={index}
            className="bg-black rounded-xl overflow-hidden shadow-lg p-2"
          >
            <video
              src={rec.url}
              controls
              className="w-full h-56"
            />
            <p className="text-xs text-white mt-1 truncate">
              {rec.file}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}