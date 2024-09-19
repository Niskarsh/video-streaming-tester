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
      const webcam = await navigator.mediaDevices.getUserMedia({ video: true });

      const combinedScreenStream = new MediaStream([
        ...screen.getTracks(),
        ...audio.getTracks(),
      ]);

      setScreenStream(combinedScreenStream);
      setWebcamStream(webcam);
      setIsStreaming(true);
    } catch (error) {
      console.error("Error starting streams:", error);
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
    <div className="flex flex-col items-center space-y-4 p-4">
      <h1 className="text-2xl font-bold">Live Screen and Webcam Streaming</h1>
      <div className="text-center mb-4">
        <p>
          Click &quot;Start Streaming&quot; to begin recording your screen and
          webcam.
        </p>
        <p>
          Your screen will be displayed here, and your webcam will appear in a
          separate Picture-in-Picture window.
        </p>
        <p>
          The streams will be automatically uploaded to the cloud as you record.
        </p>
      </div>
      <div className="w-full max-w-3xl">
        <ScreenRecorder stream={screenStream} />
        {isStreaming && <WebcamRecorder stream={webcamStream} />}
      </div>
      <UploadManager
        screenStream={screenStream}
        webcamStream={webcamStream}
        isStreaming={isStreaming}
      />
      <div className="flex justify-center space-x-4">
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
