'use client'

import { useState, useRef } from 'react'
import { Upload } from '@aws-sdk/lib-storage'
import { S3Client } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { env } from '@/env'

export default function LiveScreenStreaming() {
  const [isStreaming, setIsStreaming] = useState(false)
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const webcamVideoRef = useRef<HTMLVideoElement>(null)
  const screenMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const webcamMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const screenStreamOpenRef = useRef<boolean>(true)
  const webcamStreamOpenRef = useRef<boolean>(true)
  const screenMediaStreamRef = useRef<MediaStream | null>(null)
  const webcamMediaStreamRef = useRef<MediaStream | null>(null)

  const s3 = new S3Client({
    region: env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
      accessKeyId: env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
      secretAccessKey: env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    },
    useAccelerateEndpoint: true,
  })

  const startStreaming = async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    })
    const webcamStream = await navigator.mediaDevices.getUserMedia({
      video: true,
    })

    screenMediaStreamRef.current = screenStream
    webcamMediaStreamRef.current = webcamStream

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = webcamStream
    }

    const screenMediaRecorder = new MediaRecorder(screenStream, {
      mimeType: 'video/webm; codecs=vp9',
    })
    screenMediaRecorderRef.current = screenMediaRecorder

    const webcamMediaRecorder = new MediaRecorder(webcamStream, {
      mimeType: 'video/webm; codecs=vp9',
    })
    webcamMediaRecorderRef.current = webcamMediaRecorder

    const screenReadableStream = new ReadableStream({
      start(controller) {
        screenMediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && screenStreamOpenRef.current) {
            const chunkSize = 64 * 1024 // 64 KB chunks
            for (let i = 0; i < event.data.size; i += chunkSize) {
              const chunk = event.data.slice(i, i + chunkSize)
              const buffer = Buffer.from(
                new Uint8Array(await chunk.arrayBuffer())
              )
              if (screenStreamOpenRef.current) {
                controller.enqueue(buffer)
              }
            }
          }
        }

        screenMediaRecorder.onstop = () => {
          screenStreamOpenRef.current = false
          controller.close() // Close the stream when recording stops
        }
      },
    })

    const webcamReadableStream = new ReadableStream({
      start(controller) {
        webcamMediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && webcamStreamOpenRef.current) {
            const chunkSize = 64 * 1024 // 64 KB chunks
            for (let i = 0; i < event.data.size; i += chunkSize) {
              const chunk = event.data.slice(i, i + chunkSize)
              const buffer = Buffer.from(
                new Uint8Array(await chunk.arrayBuffer())
              )
              if (webcamStreamOpenRef.current) {
                controller.enqueue(buffer)
              }
            }
          }
        }

        webcamMediaRecorder.onstop = () => {
          webcamStreamOpenRef.current = false
          controller.close() // Close the stream when recording stops
        }
      },
    })

    const screenKey = `screen_recording/SCREEN_RECORDING_${uuidv4()}_${new Date().getTime()}.webm`
    const webcamKey = `camera_recording/CAMERA_RECORDING_${uuidv4()}_${new Date().getTime()}.webm`

    const screenUpload = new Upload({
      client: s3,
      params: {
        Bucket: env.NEXT_PUBLIC_AWS_BUCKET_NAME,
        Key: screenKey,
        Body: screenReadableStream,
      },
      tags: [],
      queueSize: 8,
      partSize: 1024 * 1024 * 5,
      leavePartsOnError: false,
    })

    const webcamUpload = new Upload({
      client: s3,
      params: {
        Bucket: env.NEXT_PUBLIC_AWS_BUCKET_NAME,
        Key: webcamKey,
        Body: webcamReadableStream,
      },
      tags: [],
      queueSize: 8,
      partSize: 1024 * 1024 * 5,
      leavePartsOnError: false,
    })

    screenUpload.on('httpUploadProgress', (progress) => {
      console.log(
        `Uploaded screen part: ${progress.loaded}${
          progress.total ? `/${progress.total}` : ''
        }`,
        progress
      )
    })

    webcamUpload.on('httpUploadProgress', (progress) => {
      console.log(
        `Uploaded webcam part: ${progress.loaded}${
          progress.total ? `/${progress.total}` : ''
        }`,
        progress
      )
    })

    screenMediaRecorder.start(100)
    webcamMediaRecorder.start(100)
    setIsStreaming(true)
    try {
      await Promise.all([screenUpload.done(), webcamUpload.done()])
      console.log('Upload completed')
    } catch (err) {
      console.error('Error uploading to S3:', err)
    }
  }

  const stopStreaming = () => {
    if (screenMediaRecorderRef.current) {
      screenMediaRecorderRef.current.stop()
    }
    if (webcamMediaRecorderRef.current) {
      webcamMediaRecorderRef.current.stop()
    }
    if (screenMediaStreamRef.current) {
      const tracks = screenMediaStreamRef.current.getTracks()
      tracks.forEach((track) => track.stop())
      screenMediaStreamRef.current = null
    }
    if (webcamMediaStreamRef.current) {
      const tracks = webcamMediaStreamRef.current.getTracks()
      tracks.forEach((track) => track.stop())
      webcamMediaStreamRef.current = null
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <h1 className="text-2xl font-bold">Live Screen and Webcam Streaming</h1>
      <video
        id="screenVideo"
        ref={screenVideoRef}
        autoPlay
        muted
        className="w-full max-w-lg"
      ></video>
      <video
        id="webcamVideo"
        ref={webcamVideoRef}
        autoPlay
        muted
        className="w-full max-w-lg"
      ></video>
      <div className="flex justify-center space-x-4">
        <button
          type="button"
          className={`rounded-md bg-green-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-green-300 ${
            isStreaming ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={startStreaming}
          disabled={isStreaming}
        >
          Start Streaming
        </button>
        <button
          type="button"
          className={`rounded-md bg-red-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-300 ${
            !isStreaming ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={stopStreaming}
          disabled={!isStreaming}
        >
          Stop Streaming
        </button>
      </div>
    </div>
  )
}
