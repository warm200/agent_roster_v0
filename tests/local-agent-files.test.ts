import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'

import {
  buildLocalAgentArchiveFromSnapshot,
  buildLocalAgentThumbnailUrl,
  loadLocalAgentDefinitions,
  loadRuntimeAssetsFromSnapshot,
  parseLocalAgentRuntimeSource,
  readLocalAgentThumbnailFromSource,
  setLocalAgentsRootForTesting,
} from '@/server/services/local-agent-files'

const tempDirs: string[] = []

afterEach(async () => {
  setLocalAgentsRootForTesting(null)
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
  assert.equal(source.thumbnailRelativePath, 'avatars/avatar.png')
  assert.equal(
    buildLocalAgentThumbnailUrl(definitions[0].versionRow.runConfigSnapshot, 'test-writer'),
    '/api/agents/test-writer/thumbnail',
  )
  assert.equal(
    buildLocalAgentThumbnailUrl(
      definitions[0].versionRow.runConfigSnapshot,
      'test-writer',
      '2026-03-21T00:00:00.000Z',
    ),
    '/api/agents/test-writer/thumbnail?v=2026-03-21T00%3A00%3A00.000Z',
  )
})

test('loadLocalAgentDefinitions prefers thumbnail avatar gif for catalog thumbnails', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'local-agent-gif-thumb-'))
  tempDirs.push(rootDir)

  const agentDir = path.join(rootDir, 'animated-helper')
  await mkdir(path.join(agentDir, 'avatars'), { recursive: true })
  await mkdir(path.join(agentDir, 'thumbnail'), { recursive: true })

  await writeFile(
    path.join(agentDir, 'IDENTITY.md'),
    ['# IDENTITY', '', '- **Name:** Animated Helper', '- **Avatar:** avatars/avatar.png'].join('\n'),
  )
  await writeFile(
    path.join(agentDir, 'SOUL.md'),
    ['# SOUL', '', '## Identity', 'name: "Animated Helper"', 'version: "1.0.0"'].join('\n'),
  )
  await writeFile(path.join(agentDir, 'avatars', 'avatar.png'), 'png')
  await writeFile(path.join(agentDir, 'thumbnail', 'avatar.gif'), 'gif')

  const [definition] = await loadLocalAgentDefinitions(rootDir)
  const source = parseLocalAgentRuntimeSource(definition.versionRow.runConfigSnapshot)

  assert.equal(source?.avatarRelativePath, 'avatars/avatar.png')
  assert.equal(source?.thumbnailRelativePath, 'thumbnail/avatar.gif')
  assert.equal(
    buildLocalAgentThumbnailUrl(definition.versionRow.runConfigSnapshot, 'animated-helper'),
    '/api/agents/animated-helper/thumbnail',
  )
})

test('loadLocalAgentDefinitions ignores placeholder avatar paths', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'local-agent-avatar-placeholder-'))
  tempDirs.push(rootDir)

  const agentDir = path.join(rootDir, 'rapid-prototyper')
  await mkdir(agentDir, { recursive: true })
  await writeFile(
    path.join(agentDir, 'IDENTITY.md'),
    ['# IDENTITY', '', '- **Name:** Rapid Prototyper', '- **Avatar:** [To be generated]'].join('\n'),
  )
  await writeFile(
    path.join(agentDir, 'SOUL.md'),
    ['# SOUL', '', '## Identity', 'name: "Rapid Prototyper"', 'version: "1.0.0"'].join('\n'),
  )

  const [definition] = await loadLocalAgentDefinitions(rootDir)
  const source = parseLocalAgentRuntimeSource(definition.versionRow.runConfigSnapshot)

  assert.equal(source?.avatarRelativePath, null)
  assert.equal(buildLocalAgentThumbnailUrl(definition.versionRow.runConfigSnapshot, 'rapid-prototyper'), null)
})

test('loadRuntimeAssetsFromSnapshot reads optional config and workspace files from the stored source pointer', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'local-agent-assets-'))
  tempDirs.push(rootDir)
  setLocalAgentsRootForTesting(rootDir)

  const agentDir = path.join(rootDir, 'test-writer')
  await mkdir(path.join(agentDir, 'avatars'), { recursive: true })
  await mkdir(path.join(agentDir, 'workspace'), { recursive: true })
  await writeFile(path.join(agentDir, 'IDENTITY.md'), '# identity')
  await writeFile(path.join(agentDir, 'SOUL.md'), '# soul')
  await writeFile(path.join(agentDir, 'avatars', 'avatar.png'), 'png')
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
      stagingRelativePath: 'agents/test-writer',
      avatarRelativePath: null,
      thumbnailRelativePath: null,
    },
  })

  const assets = await loadRuntimeAssetsFromSnapshot(snapshot, '/home/daytona/.openclaw/workspace-test-writer')

  const parsedConfig = assets.config as {
    agents?: {
      defaults?: {
        timeFormat?: string
      }
    }
  }

  assert.equal(parsedConfig.agents?.defaults?.timeFormat, '24')
  assert.deepEqual(
    assets.workspaceFiles.map((file) => file.relativePath).sort(),
    ['IDENTITY.md', 'SOUL.md', 'avatars/avatar.png', 'openclaw.json', 'workspace/README.md'],
  )
  assert.equal(
    assets.workspaceFiles.find((file) => file.relativePath === 'IDENTITY.md')?.contents.toString('utf8'),
    '# identity',
  )
  assert.equal(
    assets.workspaceFiles.find((file) => file.relativePath === 'workspace/README.md')?.contents.toString('utf8'),
    '# staged',
  )
  assert.equal(
    assets.workspaceFiles[0]?.targetWorkspaceDir,
    '/home/daytona/.openclaw/workspace-test-writer',
  )
})

test('buildLocalAgentArchiveFromSnapshot packages the whole agent folder', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'local-agent-archive-'))
  tempDirs.push(rootDir)
  setLocalAgentsRootForTesting(rootDir)

  const agentDir = path.join(rootDir, 'test-writer')
  await mkdir(path.join(agentDir, 'avatars'), { recursive: true })
  await mkdir(path.join(agentDir, 'workspace'), { recursive: true })
  await writeFile(path.join(agentDir, 'IDENTITY.md'), '# identity')
  await writeFile(path.join(agentDir, 'SOUL.md'), '# soul')
  await writeFile(path.join(agentDir, 'avatars', 'avatar.png'), 'png')
  await writeFile(path.join(agentDir, 'workspace', 'README.md'), '# staged')

  const snapshot = JSON.stringify({
    source: {
      kind: 'local-folder',
      slug: 'test-writer',
      sourceRootRelativePath: path.relative(process.cwd(), agentDir).split(path.sep).join('/'),
      openClawConfigRelativePath: null,
      stagingRelativePath: 'agents/test-writer',
      avatarRelativePath: null,
      thumbnailRelativePath: null,
    },
  })

  const archive = await buildLocalAgentArchiveFromSnapshot(snapshot)

  assert.ok(archive)
  assert.equal(archive.fileName, 'test-writer.tar.gz')
  assert.ok(archive.contents.length > 0)
})

test('readLocalAgentThumbnailFromSource returns null when the avatar file is missing', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'local-agent-missing-avatar-'))
  tempDirs.push(rootDir)
  setLocalAgentsRootForTesting(rootDir)

  const agentDir = path.join(rootDir, 'rapid-prototyper')
  await mkdir(agentDir, { recursive: true })
  await writeFile(
    path.join(agentDir, 'IDENTITY.md'),
    ['# IDENTITY', '', '- **Name:** Rapid Prototyper', '- **Avatar:** avatars/missing.png'].join('\n'),
  )
  await writeFile(
    path.join(agentDir, 'SOUL.md'),
    ['# SOUL', '', '## Identity', 'name: "Rapid Prototyper"', 'version: "1.0.0"'].join('\n'),
  )

  const thumbnail = await readLocalAgentThumbnailFromSource({
    avatarRelativePath: 'avatars/missing.png',
    kind: 'local-folder',
    openClawConfigRelativePath: null,
    slug: 'rapid-prototyper',
    sourceRootRelativePath: path.relative(process.cwd(), agentDir).split(path.sep).join('/'),
    stagingRelativePath: 'rapid-prototyper',
    thumbnailRelativePath: 'avatars/missing.png',
  })

  assert.equal(thumbnail, null)
})

test('readLocalAgentThumbnailFromSource prefers thumbnail gif without changing sandbox avatar', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'local-agent-read-gif-thumb-'))
  tempDirs.push(rootDir)
  setLocalAgentsRootForTesting(rootDir)

  const agentDir = path.join(rootDir, 'animated-helper')
  await mkdir(path.join(agentDir, 'avatars'), { recursive: true })
  await mkdir(path.join(agentDir, 'thumbnail'), { recursive: true })
  await writeFile(path.join(agentDir, 'IDENTITY.md'), '# identity')
  await writeFile(path.join(agentDir, 'SOUL.md'), '# soul')
  await writeFile(path.join(agentDir, 'avatars', 'avatar.png'), 'png')
  await writeFile(path.join(agentDir, 'thumbnail', 'avatar.gif'), 'gif')

  const thumbnail = await readLocalAgentThumbnailFromSource({
    avatarRelativePath: 'avatars/avatar.png',
    kind: 'local-folder',
    openClawConfigRelativePath: null,
    slug: 'animated-helper',
    sourceRootRelativePath: path.relative(process.cwd(), agentDir).split(path.sep).join('/'),
    stagingRelativePath: 'animated-helper',
    thumbnailRelativePath: 'thumbnail/avatar.gif',
  })

  assert.equal(thumbnail?.absolutePath.endsWith('thumbnail/avatar.gif'), true)
  assert.equal(thumbnail?.contents.toString('utf8'), 'gif')
})

test('buildLocalAgentArchiveFromSnapshot rejects source roots outside agents_file', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'local-agent-archive-root-'))
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'local-agent-outside-'))
  tempDirs.push(rootDir, outsideRoot)
  setLocalAgentsRootForTesting(rootDir)

  const agentDir = path.join(outsideRoot, 'test-writer')
  await mkdir(agentDir, { recursive: true })
  await writeFile(path.join(agentDir, 'IDENTITY.md'), '# identity')
  await writeFile(path.join(agentDir, 'SOUL.md'), '# soul')

  const snapshot = JSON.stringify({
    source: {
      kind: 'local-folder',
      slug: 'test-writer',
      sourceRootRelativePath: path.relative(process.cwd(), agentDir).split(path.sep).join('/'),
      openClawConfigRelativePath: null,
      stagingRelativePath: 'agents/test-writer',
      avatarRelativePath: null,
      thumbnailRelativePath: null,
    },
  })

  await assert.rejects(
    () => buildLocalAgentArchiveFromSnapshot(snapshot),
    /Local agent source must stay inside agents_file\./,
  )
})
