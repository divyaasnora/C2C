import { useEffect, useState } from "react";

export default function Recordings() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5001/recordings")
      .then((res) => res.json())
      .then((data) => setVideos(data));
  }, []);

  return (
    <div className="p-5">
      <h2>🎬 Recordings</h2>

      <div className="grid grid-cols-2 gap-4">
        {videos.map((vid, i) => (
          <div key={i}>
            <p>{vid.cameraId}</p>

            <video src={vid.url} controls className="w-full" />

            <a href={vid.url} download>Download</a>
          </div>
        ))}
      </div>
    </div>
  );
}