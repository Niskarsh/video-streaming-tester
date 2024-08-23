import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  client: {
    NEXT_PUBLIC_AWS_REGION: z.string().min(1),
    NEXT_PUBLIC_AWS_ACCESS_KEY_ID: z.string().min(1),
    NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY: z.string().min(1),
    NEXT_PUBLIC_AWS_BUCKET_NAME: z.string().min(1),
  },
  runtimeEnv: {
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    NEXT_PUBLIC_AWS_ACCESS_KEY_ID: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
    NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY:
      process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    NEXT_PUBLIC_AWS_BUCKET_NAME: process.env.NEXT_PUBLIC_AWS_BUCKET_NAME,
  },
})
