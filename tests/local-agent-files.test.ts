import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'

import {
  buildLocalAgentThumbnailUrl,
  loadLocalAgentDefinitions,
  loadRuntimeAssetsFromSnapshot,
  parseLocalAgentRuntimeSource,
} from '@/server/services/local-agent-files'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

test('loadLocalAgentDefinitions builds DB-ready metadata from a local agent folder', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'local-agent-def-'))
  tempDirs.push(rootDir)

  const agentDir = path.join(rootDir, 'test-writer')
  await mkdir(path.join(agentDir, 'avatars'), { recursive: true })
  await mkdir(path.join(agentDir, 'skills'), { recursive: true })

  await writeFile(
    path.join(agentDir, 'IDENTITY.md'),
    ['# IDENTITY', '', '- **Name:** Tess', '- **Avatar:** avatars/avatar.png'].join('\n'),
  )
  await writeFile(
    path.join(agentDir, 'SOUL.md'),
    [
      '# SOUL',
      '',
      '## Identity',
      'name: "Test Writer"',
      'role: "Automated Test Generation Agent"',
      'version: "1.2.3"',
      '',
      '## Capabilities',
      '- Generate unit tests',
      '- Create end-to-end tests',
      '',
      '## Rules',
      '- Always respond in English',
    ].join('\n'),
  )
  await writeFile(path.join(agentDir, 'avatars', 'avatar.png'), 'png')
  await writeFile(path.join(agentDir, 'skills', 'SKILL.md'), '# skill')

  const definitions = await loadLocalAgentDefinitions(rootDir)

  assert.equal(definitions.length, 1)
  assert.equal(definitions[0].agentRow.slug, 'test-writer')
  assert.equal(definitions[0].agentRow.title, 'Test Writer')
  assert.equal(definitions[0].versionRow.version, '1.2.3')
  assert.match(definitions[0].versionRow.previewPromptSnapshot, /Automated Test Generation Agent/)

  const source = parseLocalAgentRuntimeSource(definitions[0].versionRow.runConfigSnapshot)
  assert.ok(source)
  assert.equal(source.slug, 'test-writer')
  assert.equal(source.avatarRelativePath, 'avatars/avatar.png')
  assert.equal(buildLocalAgentThumbnailUrl(definitions[0].versionRow.runConfigSnapshot, 'test-writer'), '/api/agents/test-writer/thumbnail')
})

test('loadRuntimeAssetsFromSnapshot reads optional config and workspace files from the stored source pointer', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'local-agent-assets-'))
  tempDirs.push(rootDir)

  const agentDir = path.join(rootDir, 'test-writer')
  await mkdir(path.join(agentDir, 'workspace'), { recursive: true })
  await writeFile(
    path.join(agentDir, 'openclaw.json'),
    JSON.stringify({
      agents: {
        defaults: {
          timeFormat: '24',
        },
      },
    }),
  )
  await writeFile(path.join(agentDir, 'workspace', 'README.md'), '# staged')

  const snapshot = JSON.stringify({
    source: {
      kind: 'local-folder',
      slug: 'test-writer',
      sourceRootRelativePath: path.relative(process.cwd(), agentDir).split(path.sep).join('/'),
      openClawConfigRelativePath: 'openclaw.json',
      workspaceRelativePath: 'workspace',
      stagingRelativePath: 'agents/test-writer',
      avatarRelativePath: null,
    },
  })

  const assets = await loadRuntimeAssetsFromSnapshot(snapshot)

  const parsedConfig = assets.config as {
    agents?: {
      defaults?: {
        timeFormat?: string
      }
    }
  }

  assert.equal(parsedConfig.agents?.defaults?.timeFormat, '24')
  assert.equal(assets.workspaceFiles.length, 1)
  assert.equal(assets.workspaceFiles[0].relativePath, 'README.md')
  assert.equal(assets.workspaceFiles[0].contents.toString('utf8'), '# staged')
  assert.equal(assets.workspaceFiles[0].targetWorkspaceDir, null)
})
