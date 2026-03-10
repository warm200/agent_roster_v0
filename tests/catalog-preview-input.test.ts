import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildPreviewResponsesInput } from '@/server/services/catalog.service'

test('preview input maps assistant history to output_text for OpenAI responses', () => {
  const input = buildPreviewResponsesInput('Prompt snapshot', [
    { role: 'assistant', content: 'Hello from the preview.' },
    { role: 'user', content: 'How would you help me?' },
  ])

  assert.equal(input[0]?.role, 'system')
  assert.equal(input[1]?.role, 'developer')
  assert.deepEqual(input[2], {
    role: 'assistant',
    content: [{ type: 'output_text', text: 'Hello from the preview.' }],
  })
  assert.deepEqual(input[3], {
    role: 'user',
    content: [{ type: 'input_text', text: 'How would you help me?' }],
  })
})
