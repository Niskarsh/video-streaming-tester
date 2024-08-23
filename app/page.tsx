'use client'

import { useState, useRef } from 'react'
import { Upload } from '@aws-sdk/lib-storage'
import { S3Client } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { env } from '@/env'

export default function LiveScreenStreaming() {
  const [isStreaming, setIsStreaming] = useState(false)
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamOpenRef = useRef<boolean>(true)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  const s3 = new S3Client({
    region: env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
      accessKeyId: env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
      secretAccessKey: env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    },
    useAccelerateEndpoint: true,
  })

  const startStreaming = async () => {
    const mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    })
    mediaStreamRef.current = mediaStream
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = mediaStream
    }

    const mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: 'video/webm; codecs=vp9',
    })
    mediaRecorderRef.current = mediaRecorder

    const readableStream = new ReadableStream({
      start(controller) {
        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && streamOpenRef.current) {
            const chunkSize = 64 * 1024 // 64 KB chunks
            for (let i = 0; i < event.data.size; i += chunkSize) {
              const chunk = event.data.slice(i, i + chunkSize)
              const buffer = Buffer.from(
                new Uint8Array(await chunk.arrayBuffer())
              )
              if (streamOpenRef.current) {
                controller.enqueue(buffer)
              }
            }
          }
        }

        mediaRecorder.onstop = () => {
          streamOpenRef.current = false
          controller.close() // Close the stream when recording stops
        }
      },
    })

    const key = `live-stream-${uuidv4()}.webm`

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
    })

    upload.on('httpUploadProgress', (progress) => {
      console.log(
        `Uploaded part: ${progress.loaded}${
          progress.total ? `/${progress.total}` : ''
        }`,
        progress
      )
    })

    mediaRecorder.start(100)
    setIsStreaming(true)
    try {
      await upload.done()
      console.log('Upload completed')
    } catch (err) {
      console.error('Error uploading to S3:', err)
    }
  }

  const stopStreaming = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    if (mediaStreamRef.current) {
      const tracks = mediaStreamRef.current.getTracks()
      tracks.forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <h1 className="text-2xl font-bold">Live Screen Streaming</h1>
      <video
        id="screenVideo"
        ref={screenVideoRef}
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
