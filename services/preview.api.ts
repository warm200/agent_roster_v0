import type { PreviewMessage } from '@/lib/types'

import { postJson } from './api'

type PreviewInterviewResponse = {
  reply: string
}

export async function sendPreviewInterview(input: {
  slug: string
  messages: PreviewMessage[]
}) {
  return postJson<PreviewInterviewResponse, typeof input>('/api/interviews/preview', input)
}
