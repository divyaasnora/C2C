import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

export default function Alarms() {
  const [alarms, setAlarms] = useState([]);

  useEffect(() => {
    socket.on("alarm", data => {
      setAlarms(prev => [data, ...prev]);
      new Audio("/alarm.mp3").play();
    });
  }, []);

  return (
    <div>
      <h3> Motion Alerts</h3>

      {alarms.map((a, i) => (
        <div key={i}>
          <p>Camera: {a.ip}</p>
          <video src={a.video} controls width="280" />
        </div>
      ))}
    </div>
  );
}
