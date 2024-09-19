import { useRef, useEffect } from "react";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { env } from "@/env";

interface UploadManagerProps {
  screenStream: MediaStream | null;
  webcamStream: MediaStream | null;
  isStreaming: boolean;
}

export default function UploadManager({
  screenStream,
  webcamStream,
  isStreaming,
}: UploadManagerProps) {
  const screenMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webcamMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamOpenRef = useRef<boolean>(true);
  const webcamStreamOpenRef = useRef<boolean>(true);

  const s3 = new S3Client({
    region: env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
      accessKeyId: env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
      secretAccessKey: env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    },
    useAccelerateEndpoint: true,
  });

  useEffect(() => {
    if (isStreaming && screenStream && webcamStream) {
      startUploading();
    } else {
      stopUploading();
    }
  }, [isStreaming, screenStream, webcamStream]);

  const startUploading = () => {
    if (!screenStream || !webcamStream) return;

    let options;

    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      options = { mimeType: "video/webm;codecs=vp8,opus" };
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
      options = { mimeType: "video/webm;codecs=vp9,opus" };
    } else if (
      MediaRecorder.isTypeSupported('video/mp4;codecs="avc1.42E01E, mp4a.40.2"')
    ) {
      options = { mimeType: 'video/mp4;codecs="avc1.42E01E, mp4a.40.2"' };
    } else if (MediaRecorder.isTypeSupported("video/ogg;codecs=theora,opus")) {
      options = { mimeType: "video/ogg;codecs=theora,opus" };
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=opus")) {
      options = { mimeType: "video/webm;codecs=opus" }; // Fallback to generic webm with opus audio
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      options = { mimeType: "video/webm" }; // Fallback to generic webm
    } else {
      console.error("No supported video format found for recording.");
      return;
    }

    const screenMediaRecorder = new MediaRecorder(screenStream, options);
    screenMediaRecorderRef.current = screenMediaRecorder;

    const webcamMediaRecorder = new MediaRecorder(webcamStream, options);
    webcamMediaRecorderRef.current = webcamMediaRecorder;

    const screenReadableStream = createReadableStream(
      screenMediaRecorder,
      screenStreamOpenRef
    );
    const webcamReadableStream = createReadableStream(
      webcamMediaRecorder,
      webcamStreamOpenRef
    );

    const prefix = {
      screen: "screen_recording/SCREEN_RECORDING_",
      webcam: "camera_recording/CAMERA_RECORDING_",
    };

    const screenKey = `${
      prefix.screen
    }screen-stream-${uuidv4()}-${new Date().getTime()}.webm`;
    const webcamKey = `${
      prefix.webcam
    }webcam-stream-${uuidv4()}-${new Date().getTime()}.webm`;

    const screenUpload = createUpload(s3, screenKey, screenReadableStream);
    const webcamUpload = createUpload(s3, webcamKey, webcamReadableStream);

    screenMediaRecorder.start(100);
    webcamMediaRecorder.start(100);

    Promise.all([screenUpload.done(), webcamUpload.done()])
      .then(() => console.log("Upload completed"))
      .catch((err) => console.error("Error uploading to S3:", err));
  };

  const stopUploading = () => {
    if (screenMediaRecorderRef.current) {
      screenMediaRecorderRef.current.stop();
    }
    if (webcamMediaRecorderRef.current) {
      webcamMediaRecorderRef.current.stop();
    }
    screenStreamOpenRef.current = false;
    webcamStreamOpenRef.current = false;
  };

  return null; // This component doesn't render anything
}

function createReadableStream(
  mediaRecorder: MediaRecorder,
  streamOpenRef: React.MutableRefObject<boolean>
) {
  return new ReadableStream({
    start(controller) {
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && streamOpenRef.current) {
          const chunkSize = 64 * 1024; // 64 KB chunks
          for (let i = 0; i < event.data.size; i += chunkSize) {
            const chunk = event.data.slice(i, i + chunkSize);
            const buffer = Buffer.from(
              new Uint8Array(await chunk.arrayBuffer())
            );
            if (streamOpenRef.current) {
              controller.enqueue(buffer);
            }
          }
        }
      };

      mediaRecorder.onstop = () => {
        streamOpenRef.current = false;
        controller.close();
      };
    },
  });
}

function createUpload(
  s3: S3Client,
  key: string,
  readableStream: ReadableStream
) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: env.NEXT_PUBLIC_AWS_BUCKET_NAME,
      Key: key,
      Body: readableStream,
    },
    tags: [],
    queueSize: 8,
    partSize: 1024 * 1024 * 5,
    leavePartsOnError: false,
  });

  upload.on("httpUploadProgress", (progress) => {
    console.log(
      `Uploaded part: ${progress.loaded}${
        progress.total ? `/${progress.total}` : ""
      }`,
      progress
    );
  });

  return upload;
}
