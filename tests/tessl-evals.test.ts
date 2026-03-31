import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { loadAgentTesslReviewMap } from '@/server/services/tessl-evals'

const snapshotPath = path.resolve(process.cwd(), 'agents_file', 'tessl-evals.json')

test('loadAgentTesslReviewMap exposes Tessl snapshot data by slug', async () => {
  const original = await fs.readFile(snapshotPath, 'utf8').catch(() => null)

  try {
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true })
    await fs.writeFile(
      snapshotPath,
      JSON.stringify(
        {
          count: 1,
          generatedAt: '2026-03-30T13:00:00.000Z',
          sourceUrl: 'https://github.com/OpenRoster-ai/awesome-openroster',
          items: [
            {
              slug: 'mobile-app-builder',
              registrySkillName: 'mobile-app-builder',
              title: 'Mobile App Builder',
              description: 'Build mobile apps.',
              sourceUrl: 'https://github.com/OpenRoster-ai/awesome-openroster',
              path: 'mobile-app-builder/skills/SKILL.md',
              createdAt: '2026-03-30T12:00:00.000Z',
              updatedAt: '2026-03-30T12:30:00.000Z',
              validationPassed: true,
              registryUrl:
                'https://tessl.io/registry?q=https%3A%2F%2Fgithub.com%2FOpenRoster-ai%2Fawesome-openroster',
              scores: {
                version: 'v1',
                aggregate: 0.17,
                quality: 0,
                impact: null,
                security: 'LOW',
                evalAvg: null,
                evalBaseline: null,
                evalImprovement: null,
                evalImprovementMultiplier: null,
                evalCount: null,
                lastScoredAt: '2026-03-30T12:31:00.000Z',
              },
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    )

    const reviews = await loadAgentTesslReviewMap()
    const mobileAppBuilder = reviews.get('mobile-app-builder')

    assert.equal(reviews.size, 1)
    assert.ok(mobileAppBuilder)
    assert.equal(mobileAppBuilder.title, 'Mobile App Builder')
    assert.equal(mobileAppBuilder.validationPassed, true)
    assert.equal(mobileAppBuilder.scores.aggregate, 0.17)
    assert.equal(mobileAppBuilder.scores.security, 'LOW')
  } finally {
    if (original == null) {
      await fs.rm(snapshotPath, { force: true })
    } else {
      await fs.writeFile(snapshotPath, original, 'utf8')
    }
  }
})
