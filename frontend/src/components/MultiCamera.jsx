import { useState, useEffect } from "react";
import CameraTile from "./CameraTile";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

export default function MultiCamera() {
  const [ip, setIp] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [cameras, setCameras] = useState([]);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ Socket Connected:", socket.id);
    });

    socket.on("face-event", (data) => {
  console.log("📡 Face Event:", data);

  if (data.type === "recognized") {
    setPopup(`✅ Recognized: ${data.name}`); 
  } else {
    setPopup("❌ Unknown Person");
  }

  setTimeout(() => setPopup(null), 3000);
});
    return () => {
      socket.off("face-event");
    };
  }, []);

  
  const addCamera = async () => {
    if (!ip || !username || !password) {
      alert("Enter IP, username and password");
      return;
    }

    try {
      setStatus("checking");

      const checkRes = await fetch("http://localhost:5000/check-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });

      const checkData = await checkRes.json();

      if (!checkData.online) {
        setStatus("offline");
        return;
      }

      setStatus("starting");

      const res = await fetch("http://localhost:5000/start-stream", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ ip, username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        return;
      }

      setCameras((prev) => [
        ...prev,
        {
          id: data.streamId,
          ip,
          webrtcUrl: data.webrtcUrl,
          rtsp: data.rtsp,
        },
      ]);

      setIp("");
      setPassword("");
      setStatus("live");

    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const removeCamera = async (id) => {
    await fetch(`http://localhost:5000/stop-stream/${id}`, {
      method: "POST",
    });

    setCameras((prev) => prev.filter((cam) => cam.id !== id));
  };

  const statusColor = {
    checking: "bg-yellow-500",
    starting: "bg-blue-500",
    live: "bg-green-500",
    offline: "bg-red-500",
    error: "bg-red-600",
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">

      {/* 🔥 POPUP */}
      {popup && (
        <div
          className={`fixed top-5 right-5 px-5 py-3 rounded-xl shadow-lg text-lg font-semibold z-50
          ${popup.includes("Recognized") ? "bg-green-600" : "bg-red-600"}`}
        >
          {popup}
        </div>
      )}

      <h1 className="text-3xl font-bold text-center mb-6">
        📷 Multi Camera Dashboard
      </h1>

      {/* INPUT */}
      <div className="bg-gray-800 p-6 rounded-xl mb-8 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-4 gap-4">

          <input
            placeholder="Camera IP"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            className="p-3 rounded bg-gray-700"
          />

          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="p-3 rounded bg-gray-700"
          />

          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 rounded bg-gray-700"
          />

          <button
            onClick={addCamera}
            className="bg-blue-600 hover:bg-blue-700 p-3 rounded"
          >
            ➕ Add Camera
          </button>

        </div>

        {status && (
          <div className="mt-3 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${statusColor[status]}`} />
            <span>{status}</span>
          </div>
        )}
      </div>

      {/* CAMERA GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cameras.map((cam) => (
          <div key={cam.id} className="bg-gray-800 p-3 rounded-xl">

            <div className="flex justify-between mb-2 text-sm">
              <span>{cam.ip}</span>

              <button
                onClick={() => removeCamera(cam.id)}
                className="text-red-400"
              >
                ✖
              </button>
            </div>

            <CameraTile cam={cam} />

          </div>
        ))}
      </div>

    </div>
  );
}