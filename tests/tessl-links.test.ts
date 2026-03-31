import assert from 'node:assert/strict'
import test from 'node:test'

import { getTesslRegistryUrl } from '@/lib/tessl'

test('getTesslRegistryUrl points Tessl source links at the per-skill registry page', () => {
  assert.equal(
    getTesslRegistryUrl({
      slug: 'ai-engineer',
      registrySkillName: 'ai-engineer',
      registryUrl: 'https://tessl.io/registry/skills/github/OpenRoster-ai/awesome-agents',
    }),
    'https://tessl.io/registry/skills/github/OpenRoster-ai/awesome-agents/ai-engineer',
  )
})

test('getTesslRegistryUrl rewrites old awesome-openroster links to the renamed per-skill registry page', () => {
  assert.equal(
    getTesslRegistryUrl({
      slug: 'frontend-developer',
      registrySkillName: 'frontend-specialist',
      registryUrl:
        'https://tessl.io/registry?q=https%3A%2F%2Fgithub.com%2FOpenRoster-ai%2Fawesome-openroster',
    }),
    'https://tessl.io/registry/skills/github/OpenRoster-ai/awesome-agents/frontend-specialist',
  )
})
