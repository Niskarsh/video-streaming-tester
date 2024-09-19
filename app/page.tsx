"use client";

import { useState } from "react";
import ScreenRecorder from "@/components/screen-recorder";
import WebcamRecorder from "@/components/webcam-recorder";
import UploadManager from "@/components/upload-manager";

export default function LiveScreenStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  const startStreaming = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });

      let webcam;
      try {
        webcam = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (webcamError) {
        console.error("Error accessing webcam:", webcamError);
        alert("Failed to access webcam. The screen will still be recorded.");
      }

      const combinedScreenStream = new MediaStream([
        ...screen.getTracks(),
        ...audio.getTracks(),
      ]);

      setScreenStream(combinedScreenStream);
      setWebcamStream(webcam || null);
      setIsStreaming(true);
    } catch (error) {
      console.error("Error starting streams:", error);
      alert(
        "Failed to start streaming. Please check your permissions and try again."
      );
    }
  };

  const stopStreaming = () => {
    [screenStream, webcamStream].forEach((stream) => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    });
    setScreenStream(null);
    setWebcamStream(null);
    setIsStreaming(false);
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">
        Live Screen and Webcam Streaming
      </h1>
      <div className="text-center mb-6">
        <p>
          Click &quot;Start Streaming&quot; to begin recording your screen and
          webcam.
        </p>
        <p>
          Your screen will be displayed here, and your webcam will appear below
          or in Picture-in-Picture mode if supported.
        </p>
        <p>
          The streams will be automatically uploaded to the cloud as you record.
        </p>
      </div>
      <div className="flex-grow flex flex-col justify-center w-full max-w-4xl">
        <div className="aspect-video w-full mb-4">
          <ScreenRecorder stream={screenStream} />
        </div>
        {isStreaming && webcamStream && (
          <div className="mt-4">
            <WebcamRecorder stream={webcamStream} />
          </div>
        )}
        {isStreaming && !webcamStream && (
          <p className="text-yellow-500 mt-4">
            Webcam not available. Only screen is being recorded.
          </p>
        )}
      </div>
      <UploadManager
        screenStream={screenStream}
        webcamStream={webcamStream}
        isStreaming={isStreaming}
      />
      <div className="flex justify-center space-x-4 mt-6">
        <button
          type="button"
          className={`rounded-md bg-green-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-green-300 ${
            isStreaming ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={startStreaming}
          disabled={isStreaming}
        >
          Start Streaming
        </button>
        <button
          type="button"
          className={`rounded-md bg-red-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-300 ${
            !isStreaming ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={stopStreaming}
          disabled={!isStreaming}
        >
          Stop Streaming
        </button>
      </div>
    </div>
  );
}
