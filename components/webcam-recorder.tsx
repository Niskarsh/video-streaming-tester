import { useRef, useEffect } from "react";

interface WebcamRecorderProps {
  stream: MediaStream | null;
}

export default function WebcamRecorder({ stream }: WebcamRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const enablePiP = async () => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if ("documentPictureInPicture" in window) {
          try {
            const pipWindow = await (
              window as any
            ).documentPictureInPicture.requestWindow();
            pipWindow.document.body.append(videoRef.current);
          } catch (error) {
            console.error("Failed to enter Picture-in-Picture mode:", error);
          }
        } else {
          console.warn(
            "Picture-in-Picture mode is not supported in this browser."
          );
        }
      }
    };

    enablePiP();

    return () => {
      if (videoRef.current && videoRef.current.parentNode !== document.body) {
        document.body.appendChild(videoRef.current);
      }
    };
  }, [stream]);

  return (
    <div id="playerContainer">
      <div id="player">
        <video
          ref={videoRef}
          autoPlay
          muted
          className="w-full h-full object-cover rounded-lg shadow-lg"
        ></video>
      </div>
    </div>
  );
}
