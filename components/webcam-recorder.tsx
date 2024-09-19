import { useRef, useEffect, useState } from "react";

interface WebcamRecorderProps {
  stream: MediaStream | null;
}

export default function WebcamRecorder({ stream }: WebcamRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);

  useEffect(() => {
    setIsPiPSupported("pictureInPictureEnabled" in document);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video
        .play()
        .catch((error) => console.error("Error playing video:", error));
    }

    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  const togglePiP = async () => {
    if (!videoRef.current) return;

    try {
      if (!isPiPActive) {
        await videoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
      } else {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      }
    } catch (error) {
      console.error("Failed to toggle Picture-in-Picture mode:", error);
    }
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        muted
        className={`w-full max-w-xs ${isPiPActive ? "hidden" : ""}`}
      />
      {isPiPSupported && (
        <button
          onClick={togglePiP}
          className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded"
        >
          {isPiPActive ? "Exit PiP" : "Enter PiP"}
        </button>
      )}
    </div>
  );
}
