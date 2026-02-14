import { useState } from "react";
import CameraTile from "./CameraTile";
import "../assets/allCss/MultiCamera.css";

export default function MultiCameraView({ socket }) {
  const [ip, setIp] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [cameras, setCameras] = useState([]);

  const addCamera = async () => {
    if (!ip || !username || !password) {
      alert("Enter IP, username and password");
      return;
    }

    try {
      setStatus("🔍 Checking camera...");

      const checkRes = await fetch("http://localhost:5000/check-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });

      const checkData = await checkRes.json();

      if (!checkData.online) {
        setStatus("❌ Camera offline");
        return;
      }

      setStatus("▶ Starting stream...");

      const res = await fetch("http://localhost:5000/start-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(`❌ ${data.error || "Stream failed"}`);
        return;
      }

      setCameras((prev) => [
        ...prev,
        {
          id: data.streamId,
          ip,
          streamUrl: data.streamUrl,
          rtsp: data.rtsp,
        },
      ]);

      setIp("");
      setPassword("");
      setStatus("✅ Live & Ready");

    } catch (err) {
      console.error(err);
      setStatus("❌ Error starting camera");
    }
  };

  const removeCamera = async (id) => {
    await fetch(`http://localhost:5000/stop-stream/${id}`, {
      method: "POST",
    });
    setCameras((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="multi-camera-container">
      <h2>Command & Control: Multi-Camera View</h2>

      <div className="camera-controls">
        <input placeholder="Camera IP" value={ip} onChange={(e) => setIp(e.target.value)} />
        <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={addCamera}>Add Camera</button>
        <p>{status}</p>
      </div>

      <div className="camera-grid">
        {cameras.map((cam) => (
          <CameraTile
            key={cam.id}
            cam={cam}
            socket={socket}
            onClose={() => removeCamera(cam.id)}
          />
        ))}
      </div>
    </div>
  );
}
