'use client';
import { useState, useRef } from 'react';
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';

export default function LiveScreenStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamOpenRef = useRef<boolean>(true);
  const s3 = new S3Client({
    region: '****',
    credentials: {
      accessKeyId: '****',
      secretAccessKey: '***',
    },
    useAccelerateEndpoint: true,
  });

  const startStreaming = async () => {
    // const combinedStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    // const audioTracks = combinedStream.getAudioTracks();

    // if (audioTracks.length === 0) {
    //   console.warn('No audio track detected');
    // } else {
    //   console.log('Audio track is present');
    // }

    // Capture screen video
    const displayMediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    
    // Capture microphone audio
    const audioMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioTracks = audioMediaStream.getAudioTracks();

    if (audioTracks.length === 0) {
      console.warn('No audio track detected');
    } else {
      console.log('Audio track is present');
    }

    // Combine video and audio tracks
    const combinedStream = new MediaStream([
      ...displayMediaStream.getVideoTracks(),
      ...audioMediaStream.getAudioTracks()
    ]);
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = combinedStream;
    }

    const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' });
    mediaRecorderRef.current = mediaRecorder;

    const readableStream = new ReadableStream({
      start(controller) {

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && streamOpenRef.current) {
            let data = event.data;
            const chunkSize = 64 * 1024;  // 64 KB chunks
            for (let i = 0; i < data.size; i += chunkSize) {
              const chunk = data.slice(i, i + chunkSize);
              let buffer = Buffer.from(new Uint8Array(await chunk.arrayBuffer()));
              controller.enqueue(buffer);
            }
          }
        };
        mediaRecorder.onstop = () => {
          streamOpenRef.current = false;
          controller.close(); // Close the stream when recording stops
        };
      }
    });
    const bucketName = 'posk-content-dev';
    const key = `live-stream-${uuidv4()}.webm`;

    const upload = new Upload({
      client: s3,
      params: { Bucket: bucketName, Key: key, Body: readableStream },

      // optional tags
      tags: [
        /*...*/
      ],

      // additional optional fields show default values below:

      // (optional) concurrency configuration
      queueSize: 8,

      // (optional) size of each part, in bytes, at least 5MB
      partSize: 1024 * 1024 * 5,

      // (optional) when true, do not automatically call AbortMultipartUpload when
      // a multipart upload fails to complete. You should then manually handle
      // the leftover parts.
      leavePartsOnError: false,
    });

    upload.on("httpUploadProgress", (progress) => {
      console.log(`Uploaded part: ${progress.loaded}/${progress.total}`, progress);
    });





    mediaRecorder.start(100); // Capture in small chunks for low latency
    setIsStreaming(true);
    try {
      await upload.done();
      console.log('Upload completed');
    } catch (err) {
      console.error('Error uploading to S3:', err);
    }
  };

  const stopStreaming = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsStreaming(false);
  };

  return (
    <div>
      <h1>Live Screen Streaming</h1>
      <video id="screenVideo" ref={screenVideoRef} autoPlay muted></video>
      <button id="startButton" className='bg-red-300 p-4 mr-4' onClick={startStreaming} disabled={isStreaming}>
        Start Streaming
      </button>
      <button id="stopButton" className='bg-red-300 p-4' onClick={stopStreaming} disabled={!isStreaming}>
        Stop Streaming
      </button>
    </div>
  );
}