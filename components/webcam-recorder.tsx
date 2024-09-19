import React, { useRef, useEffect, useState } from "react";

interface WebcamRecorderProps {
  stream: MediaStream | null;
}

export default function WebcamRecorder({ stream }: WebcamRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("WebcamRecorder: Effect triggered");
    console.log("WebcamRecorder: Stream received:", stream);

    let playAttempts = 0;
    const maxPlayAttempts = 3;

    const attemptPlay = async () => {
      if (videoRef.current && stream) {
        try {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log("WebcamRecorder: Video playing successfully");
          setError(null);
        } catch (error) {
          console.error("WebcamRecorder: Error playing video:", error);
          if (playAttempts < maxPlayAttempts) {
            playAttempts++;
            console.log(
              `WebcamRecorder: Retrying play (attempt ${playAttempts})`
            );
            setTimeout(attemptPlay, 1000); // Wait 1 second before retrying
          } else {
            setError("Failed to play webcam stream after multiple attempts");
          }
        }
      } else if (!stream) {
        console.log("WebcamRecorder: No stream received");
        setError("No webcam stream available");
      }
    };

    attemptPlay();

    return () => {
      console.log("WebcamRecorder: Cleanup");
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full max-w-lg"
        onLoadedMetadata={() =>
          console.log("WebcamRecorder: Video metadata loaded")
        }
      ></video>
      {error && (
        <p className="text-red-500 mt-2">
          Error: {error}. Please check your webcam permissions and try again.
        </p>
      )}
    </div>
  );
}
