
import MultiCamera from "./components/MultiCamera";
import CameraFeed from "./components/Recorder";

export default function App() {
  return (
    <div style={{ padding: "20px" }}>
      
      <MultiCamera />
      <CameraFeed/>
    </div>
  );
}
