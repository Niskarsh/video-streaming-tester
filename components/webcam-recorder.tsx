import { useRef, useEffect } from "react";

interface WebcamRecorderProps {
  stream: MediaStream | null;
}

export default function WebcamRecorder({ stream }: WebcamRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video ref={videoRef} autoPlay muted className="w-full max-w-lg"></video>
  );
}
