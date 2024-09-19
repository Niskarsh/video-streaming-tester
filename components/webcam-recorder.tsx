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
        try {
          await videoRef.current.play();
          if (document.pictureInPictureEnabled) {
            await videoRef.current.requestPictureInPicture();
          } else {
            console.warn(
              "Picture-in-Picture mode is not supported in this browser."
            );
          }
        } catch (error) {
          console.error("Failed to enter Picture-in-Picture mode:", error);
        }
      }
    };

    enablePiP();

    return () => {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
      }
    };
  }, [stream]);

  return <video ref={videoRef} autoPlay muted className="hidden" />;
}
