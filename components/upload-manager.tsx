import { useRef, useEffect } from "react";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { env } from "@/lib/env";

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    console.log("UploadManager: Effect triggered");
    console.log("isStreaming:", isStreaming);
    console.log("screenStream:", screenStream);
    console.log("webcamStream:", webcamStream);

    const s3 = new S3Client({
      region: env.NEXT_PUBLIC_AWS_REGION,
      credentials: {
        accessKeyId: env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
      },
      useAccelerateEndpoint: true,
    });

    if (isStreaming && screenStream && webcamStream) {
      console.log("UploadManager: Starting upload");
      startUploading(s3);
    } else {
      console.log("UploadManager: Stopping upload");
      stopUploading();
    }

    return () => {
      console.log("UploadManager: Cleanup");
      stopUploading();
    };
  }, [isStreaming, screenStream, webcamStream]);

  const startUploading = (s3: S3Client) => {
    if (!screenStream || !webcamStream) {
      console.error("UploadManager: Missing stream(s)");
      return;
    }

    console.log("UploadManager: Setting up MediaRecorder");
    let options: MediaRecorderOptions = { mimeType: "video/webm" };

    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
      options = { mimeType: "video/webm;codecs=vp9,opus" };
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      options = { mimeType: "video/webm;codecs=vp8,opus" };
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
      options = { mimeType: "video/webm;codecs=vp9" };
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
      options = { mimeType: "video/webm;codecs=vp8" };
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      options = { mimeType: "video/webm" };
    } else {
      console.error(
        "UploadManager: No supported video format found for recording."
      );
      return;
    }

    console.log("UploadManager: Selected MIME type:", options.mimeType);

    const screenMediaRecorder = new MediaRecorder(screenStream, options);
    screenMediaRecorderRef.current = screenMediaRecorder;

    const webcamMediaRecorder = new MediaRecorder(webcamStream, options);
    webcamMediaRecorderRef.current = webcamMediaRecorder;

    console.log("UploadManager: Creating readable streams");
    const screenReadableStream = createReadableStream(
      screenMediaRecorder,
      screenStreamOpenRef,
      "screen"
    );
    const webcamReadableStream = createReadableStream(
      webcamMediaRecorder,
      webcamStreamOpenRef,
      "webcam"
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

    console.log("UploadManager: Creating S3 uploads");
    const screenUpload = createUpload(s3, screenKey, screenReadableStream);
    const webcamUpload = createUpload(s3, webcamKey, webcamReadableStream);

    console.log("UploadManager: Starting MediaRecorders");
    screenMediaRecorder.start(1000);
    webcamMediaRecorder.start(1000);

    Promise.all([screenUpload.done(), webcamUpload.done()])
      .then(() => console.log("UploadManager: Upload completed"))
      .catch((err) =>
        console.error("UploadManager: Error uploading to S3:", err)
      );
  };

  const stopUploading = () => {
    console.log("UploadManager: Stopping uploads");
    if (screenMediaRecorderRef.current) {
      screenMediaRecorderRef.current.stop();
    }
    if (webcamMediaRecorderRef.current) {
      webcamMediaRecorderRef.current.stop();
    }
    screenStreamOpenRef.current = false;
    webcamStreamOpenRef.current = false;
  };

  return null;
}

function createReadableStream(
  mediaRecorder: MediaRecorder,
  streamOpenRef: React.MutableRefObject<boolean>,
  streamType: string
) {
  console.log(`UploadManager: Creating ReadableStream for ${streamType}`);
  return new ReadableStream({
    start(controller) {
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && streamOpenRef.current) {
          console.log(
            `UploadManager: Data available for ${streamType}, size: ${event.data.size}`
          );
          const chunk = event.data;
          const buffer = Buffer.from(await chunk.arrayBuffer());
          if (streamOpenRef.current) {
            controller.enqueue(buffer);
          }
        } else {
          console.log(
            `UploadManager: No data available for ${streamType} or stream closed`
          );
        }
      };

      mediaRecorder.onstop = () => {
        console.log(`UploadManager: MediaRecorder stopped for ${streamType}`);
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
  console.log(`UploadManager: Creating S3 upload for ${key}`);
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: env.NEXT_PUBLIC_AWS_BUCKET_NAME,
      Key: key,
      Body: readableStream,
    },
    tags: [],
    queueSize: 4,
    partSize: 1024 * 1024 * 5,
    leavePartsOnError: false,
  });

  upload.on("httpUploadProgress", (progress) => {
    console.log(
      `UploadManager: Uploaded part for ${key}: ${progress.loaded}${
        progress.total ? `/${progress.total}` : ""
      }`,
      progress
    );
  });

  return upload;
}
