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
              controller.enqueue(buffer)
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
      tags: [
        // optional tags
      ],
      // (optional) concurrency configuration
      queueSize: 8,
      // (optional) size of each part, in bytes, at least 5MB
      partSize: 1024 * 1024 * 5,
      // (optional) when true, do not automatically call AbortMultipartUpload when
      // a multipart upload fails to complete. You should then manually handle
      // the leftover parts.
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

    mediaRecorder.start(100) // Capture in small chunks for low latency
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
    setIsStreaming(false)
  }

  return (
    <div>
      <h1>Live Screen Streaming</h1>
      <video id="screenVideo" ref={screenVideoRef} autoPlay muted></video>
      <button
        type="button"
        className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        onClick={isStreaming ? stopStreaming : startStreaming}
        disabled={isStreaming}
      >
        {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
      </button>
    </div>
  )
}
