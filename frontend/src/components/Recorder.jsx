import  { useState } from "react";
import axios from "axios";

const CameraFeed = ({ streamId, rtspUrl }) => {
    const [isRecording, setIsRecording] = useState(false);

    const handleRecordClick = async () => {
        try {
            const response = await axios.post(`http://localhost:5000/toggle-record/${streamId}`, {
                rtspUrl: rtspUrl
            });
            setIsRecording(response.data.recording);
        } catch (err) {
            console.error("Failed to toggle recording", err);
        }
    };

    return (
        <div style={{ position: "relative", width: "100%" }}>
            {/* Your Video Player Here */}
            <video id="video-player" />

            {/* The Clickable REC Button */}
            <div 
                onClick={handleRecordClick}
                style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    cursor: "pointer",
                    backgroundColor: isRecording ? "red" : "rgba(255, 0, 0, 0.5)",
                    padding: "10px 20px",
                    borderRadius: "10px",
                    color: "white",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.3s ease"
                }}
            >
                <div style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "white",
                    borderRadius: "50%",
                    animation: isRecording ? "pulse 1s infinite" : "none"
                }} />
                {isRecording ? "RECORDING" : "START REC"}
            </div>
        </div>
    );
};


export default CameraFeed;