import { io } from "socket.io-client";
const socket = io("http://localhost:5000");
import MultiCamera from "./components/MultiCamera";
export default function App(){
  return(
    <>
    <MultiCamera socket={socket}/>

    </>
  )
}



