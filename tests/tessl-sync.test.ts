import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getRepoRef,
  getRepoUrl,
  normalizeLocalSkillReview,
  normalizeTesslSnapshotPayload,
} from '@/server/services/tessl-sync'

test('getRepoRef and getRepoUrl normalize GitHub URLs and tree paths', () => {
  assert.equal(
    getRepoRef('https://github.com/OpenRoster-ai/awesome-openroster/tree/main'),
    'OpenRoster-ai/awesome-openroster',
  )
  assert.equal(
    getRepoUrl('https://github.com/OpenRoster-ai/awesome-openroster/tree/main'),
    'https://github.com/OpenRoster-ai/awesome-openroster',
  )
})

test('normalizeTesslSnapshotPayload extracts skill evaluations from CLI-shaped payloads', () => {
  const snapshot = normalizeTesslSnapshotPayload(
    {
      runs: [
        {
          results: [
            {
              type: 'skill',
              attributes: {
                name: 'Mobile App Builder',
                description: 'Build mobile apps.',
                sourceUrl: 'https://github.com/OpenRoster-ai/awesome-openroster',
                path: 'mobile-app-builder/skills/SKILL.md',
                createdAt: '2026-03-30T12:00:00.000Z',
                updatedAt: '2026-03-30T12:30:00.000Z',
                validationPassed: false,
                scores: {
                  version: 'v1',
                  aggregate: 0.42,
                  quality: 0.5,
                  impact: 0.33,
                  security: 'LOW',
                  evalAvg: 0.38,
                  evalBaseline: 0.3,
                  evalImprovement: 0.08,
                  evalImprovementMultiplier: 1.27,
                  evalCount: 12,
                  validationErrors: ['missing-example'],
                  lastScoredAt: '2026-03-30T12:31:00.000Z',
                },
              },
            },
          ],
        },
      ],
    },
    {
      generatedAt: '2026-03-30T13:00:00.000Z',
      repo: 'https://github.com/OpenRoster-ai/awesome-openroster/tree/main',
    },
  )

  assert.equal(snapshot.count, 1)
  assert.equal(snapshot.sourceUrl, 'https://github.com/OpenRoster-ai/awesome-openroster')
  assert.equal(snapshot.generatedAt, '2026-03-30T13:00:00.000Z')
  assert.deepEqual(snapshot.items[0], {
    slug: 'mobile-app-builder',
    registrySkillName: 'Mobile App Builder',
    title: 'Mobile App Builder',
    description: 'Build mobile apps.',
    sourceUrl: 'https://github.com/OpenRoster-ai/awesome-openroster',
    path: 'mobile-app-builder/skills/SKILL.md',
    createdAt: '2026-03-30T12:00:00.000Z',
    updatedAt: '2026-03-30T12:30:00.000Z',
    validationPassed: false,
    registryUrl: 'https://tessl.io/registry/skills/github/OpenRoster-ai/awesome-agents',
    scores: {
      version: 'v1',
      aggregate: 0.42,
      quality: 0.5,
      impact: 0.33,
      security: 'LOW',
      evalAvg: 0.38,
      evalBaseline: 0.3,
      evalImprovement: 0.08,
      evalImprovementMultiplier: 1.27,
      evalCount: 12,
      lastScoredAt: '2026-03-30T12:31:00.000Z',
    },
  })
})

test('normalizeLocalSkillReview converts tessl skill review json into website snapshot shape', () => {
  const review = normalizeLocalSkillReview(
    {
      review: {
        reviewScore: 90,
      },
      validation: {
        overallPassed: true,
        skillDescription: 'Build mobile apps.',
        skillName: 'mobile-app-builder',
      },
      descriptionJudge: {
        normalizedScore: 1,
      },
      contentJudge: {
        normalizedScore: 0.775,
      },
    },
    {
      generatedAt: '2026-03-31T12:00:00.000Z',
      repo: 'OpenRoster-ai/awesome-openroster',
      slug: 'mobile-app-builder',
      title: 'Mobile App Builder',
    },
  )

  assert.deepEqual(review, {
    slug: 'mobile-app-builder',
    registrySkillName: 'mobile-app-builder',
    title: 'Mobile App Builder',
    description: 'Build mobile apps.',
    sourceUrl: 'https://github.com/OpenRoster-ai/awesome-openroster',
    path: 'mobile-app-builder/skills/SKILL.md',
    createdAt: '2026-03-31T12:00:00.000Z',
    updatedAt: '2026-03-31T12:00:00.000Z',
    validationPassed: true,
    registryUrl: 'https://tessl.io/registry/skills/github/OpenRoster-ai/awesome-agents',
    scores: {
      version: 'local-review',
      aggregate: 0.9,
      quality: 0.8875,
      impact: 1,
      security: 'MEDIUM',
      evalAvg: null,
      evalBaseline: null,
      evalImprovement: null,
      evalImprovementMultiplier: null,
      evalCount: null,
      lastScoredAt: '2026-03-31T12:00:00.000Z',
    },
  })
})
