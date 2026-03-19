import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { and, desc, eq, like } from 'drizzle-orm'

import type { AgentCategory, RiskLevel } from '@/lib/types'

import { createDb, type DbClient } from '../db'
import { agents, agentVersions, riskProfiles } from '../db/schema'

export type LocalAgentRuntimeSource = {
  avatarRelativePath: string | null
  kind: 'local-folder'
  openClawConfigRelativePath: string | null
  slug: string
  sourceRootRelativePath: string
  stagingRelativePath: string
}

type LocalAgentDefinition = {
  agentRow: typeof agents.$inferInsert
  riskRow: typeof riskProfiles.$inferInsert
  runtimeSource: LocalAgentRuntimeSource
  versionRow: typeof agentVersions.$inferInsert
}

type RuntimeAssetBundle = {
  config: Record<string, unknown>
  workspaceFiles: Array<{
    contents: Buffer
    relativePath: string
    targetWorkspaceDir: string | null
  }>
}

const LOCAL_AGENTS_ROOT = path.resolve(process.cwd(), 'agents_file')
const execFile = promisify(execFileCallback)

let dbClient: DbClient | null = null
let lastSyncedFingerprint: string | null = null
let localAgentsRootOverride: string | null = null

function getLocalAgentsRoot(rootDir = LOCAL_AGENTS_ROOT) {
  return localAgentsRootOverride ?? rootDir
}

function resolveTrustedSourceRoot(sourceRootRelativePath: string) {
  const sourceRoot = path.resolve(process.cwd(), sourceRootRelativePath)
  const localAgentsRoot = getLocalAgentsRoot()
  const normalizedRoot = localAgentsRoot.endsWith(path.sep)
    ? localAgentsRoot
    : `${localAgentsRoot}${path.sep}`

  if (sourceRoot !== localAgentsRoot && !sourceRoot.startsWith(normalizedRoot)) {
    throw new Error('Local agent source must stay inside agents_file.')
  }

  return sourceRoot
}

function getDb() {
  dbClient ??= createDb()
  return dbClient
}

function stripQuotes(value: string) {
  const trimmed = value.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function normalizeOptionalRelativePath(value: string | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed || trimmed.startsWith('[') || trimmed.toLowerCase() === 'n/a') {
    return null
  }

  return trimmed
}

function extractIdentityField(contents: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = contents.match(new RegExp(`^- \\*\\*${escaped}:\\*\\*\\s+(.+)$`, 'mi'))
  return match?.[1]?.trim() ?? null
}

function extractYamlField(contents: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = contents.match(new RegExp(`^${escaped}:\\s+(.+)$`, 'mi'))
  return match ? stripQuotes(match[1]) : null
}

function extractMarkdownSection(contents: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = contents.match(new RegExp(`^## ${escaped}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, 'm'))
  return match?.[1]?.trim() ?? null
}

function extractBulletLines(section: string | null) {
  if (!section) {
    return []
  }

  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^- /, '').trim())
}

function titleFromSlug(slug: string) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function inferCategory(source: string): AgentCategory {
  const value = source.toLowerCase()

  if (value.includes('email') || value.includes('inbox')) {
    return 'inbox'
  }

  if (value.includes('calendar') || value.includes('schedule')) {
    return 'calendar'
  }

  if (
    value.includes('document') ||
    value.includes('docs') ||
    value.includes('writer') ||
    value.includes('writing')
  ) {
    return 'docs'
  }

  if (value.includes('analytics') || value.includes('metric') || value.includes('report')) {
    return 'analytics'
  }

  return 'automation'
}

function inferRiskLevel(profile: {
  network: boolean
  readFiles: boolean
  shell: boolean
  writeFiles: boolean
}): RiskLevel {
  if (profile.shell || profile.writeFiles) {
    return 'high'
  }

  if (profile.readFiles || profile.network) {
    return 'medium'
  }

  return 'low'
}

function parseBoolFlag(source: string, patterns: string[]) {
  const value = source.toLowerCase()
  return patterns.some((pattern) => value.includes(pattern))
}

function relativePathFromRepoRoot(fullPath: string) {
  return path.relative(process.cwd(), fullPath).split(path.sep).join('/')
}

function buildDescriptionMarkdown(input: {
  capabilities: string[]
  name: string
  role: string | null
  rules: string[]
}) {
  const sections = [
    '## What this agent does',
    '',
    ...(input.capabilities.length > 0
      ? input.capabilities.map((capability) => `- ${capability}`)
      : [`- ${input.name} helps with ${input.role ?? 'specialized tasks'}.`]),
  ]

  if (input.rules.length > 0) {
    sections.push('', '## What this agent does NOT do', '', ...input.rules.map((rule) => `- ${rule}`))
  }

  return sections.join('\n')
}

async function readOptionalJsonFile(filePath: string) {
  try {
    const contents = await fs.readFile(filePath, 'utf8')
    return JSON.parse(contents) as Record<string, unknown>
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

function isIgnoredWorkspaceEntry(name: string) {
  return name === '.DS_Store' || name === '.git'
}

async function collectWorkspaceFiles(
  rootDir: string,
  currentDir: string,
  ignoredAbsolutePaths: Set<string>,
): Promise<RuntimeAssetBundle['workspaceFiles']> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  const files: RuntimeAssetBundle['workspaceFiles'] = []

  for (const entry of entries) {
    if (isIgnoredWorkspaceEntry(entry.name)) {
      continue
    }

    const fullPath = path.join(currentDir, entry.name)

    if (ignoredAbsolutePaths.has(fullPath)) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...(await collectWorkspaceFiles(rootDir, fullPath, ignoredAbsolutePaths)))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/')
    files.push({
      contents: await fs.readFile(fullPath),
      relativePath,
      targetWorkspaceDir: null,
    })
  }

  return files
}

async function buildLocalAgentDefinition(agentDir: string): Promise<LocalAgentDefinition | null> {
  const slug = path.basename(agentDir)
  const identityPath = path.join(agentDir, 'IDENTITY.md')
  const soulPath = path.join(agentDir, 'SOUL.md')

  let identityContents = ''
  let soulContents = ''

  try {
    identityContents = await fs.readFile(identityPath, 'utf8')
    soulContents = await fs.readFile(soulPath, 'utf8')
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code === 'ENOENT') {
      return null
    }

    throw error
  }

  const openClawConfigPath = path.join(agentDir, 'openclaw.json')
  let openClawConfigRelativePath: string | null = null

  try {
    await fs.access(openClawConfigPath)
    openClawConfigRelativePath = 'openclaw.json'
  } catch {}

  const avatarRelativePath = normalizeOptionalRelativePath(
    extractIdentityField(identityContents, 'Avatar'),
  )
  const name =
    extractYamlField(soulContents, 'name') ??
    extractIdentityField(identityContents, 'Name') ??
    titleFromSlug(slug)
  const role = extractYamlField(soulContents, 'role')
  const version = extractYamlField(soulContents, 'version') ?? '1.0.0'
  const capabilities = extractBulletLines(extractMarkdownSection(soulContents, 'Capabilities'))
  const rules = extractBulletLines(extractMarkdownSection(soulContents, 'Rules'))
  const descriptionMarkdown = buildDescriptionMarkdown({
    capabilities,
    name,
    role,
    rules,
  })
  const sourceSummary = [name, role, capabilities.join(' '), rules.join(' ')].join(' ')
  const category = inferCategory(sourceSummary)
  const profile = {
    chatOnly: false,
    network: parseBoolFlag(sourceSummary, ['github', 'telegram', 'api', 'integration']) || false,
    readFiles: true,
    shell: false,
    writeFiles: false,
  }
  const runtimeSource: LocalAgentRuntimeSource = {
    avatarRelativePath,
    kind: 'local-folder',
    openClawConfigRelativePath,
    slug,
    sourceRootRelativePath: relativePathFromRepoRoot(agentDir),
    stagingRelativePath: slug,
  }
  const riskLevel = inferRiskLevel(profile)
  const agentId = `agent-local-${slug}`
  const versionId = `agent-version-local-${slug}`
  const riskId = `risk-local-${slug}`
  const summary =
    role ??
    capabilities[0] ??
    `Imported local agent from ${runtimeSource.sourceRootRelativePath}.`
  const createdAt = new Date()

  return {
    agentRow: {
      category,
      createdAt,
      currency: 'USD',
      descriptionMarkdown,
      id: agentId,
      priceCents: 0,
      slug,
      status: 'active',
      summary,
      title: name,
      updatedAt: createdAt,
    },
    riskRow: {
      agentVersionId: versionId,
      chatOnly: profile.chatOnly,
      createdAt,
      id: riskId,
      network: profile.network,
      readFiles: profile.readFiles,
      riskLevel,
      scanSummary:
        'Imported local agent source. Files are staged into the managed runtime workspace from the catalog source pointer.',
      shell: profile.shell,
      writeFiles: profile.writeFiles,
    },
    runtimeSource,
    versionRow: {
      agentId,
      changelogMarkdown: `- Imported from \`${runtimeSource.sourceRootRelativePath}\``,
      createdAt,
      id: versionId,
      installPackageUrl: `/api/agents/${slug}/download`,
      installScriptMarkdown:
        'This agent is sourced from a managed catalog package and staged into the runtime workspace during launch.',
      previewPromptSnapshot: [
        `Agent name: ${name}`,
        role ? `Role: ${role}` : null,
        capabilities.length > 0 ? `Capabilities: ${capabilities.join('; ')}` : null,
        rules.length > 0 ? `Rules: ${rules.join('; ')}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      releaseNotes: `Imported from local source folder \`${runtimeSource.sourceRootRelativePath}\`.`,
      runConfigSnapshot: JSON.stringify({
        source: runtimeSource,
      }),
      version,
    },
  }
}

async function listLocalAgentDirectories(rootDir: string) {
  try {
    const entries = await fs.readdir(rootDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && !isIgnoredWorkspaceEntry(entry.name))
      .map((entry) => path.join(rootDir, entry.name))
      .sort((left, right) => left.localeCompare(right))
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function buildLocalAgentsFingerprint(rootDir: string) {
  const directories = await listLocalAgentDirectories(rootDir)
  const hash = createHash('sha1')

  for (const directory of directories) {
    const stack = [directory]

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) {
        continue
      }

      const entries = await fs.readdir(current, { withFileTypes: true })
      entries.sort((left, right) => left.name.localeCompare(right.name))

      for (const entry of entries) {
        if (isIgnoredWorkspaceEntry(entry.name)) {
          continue
        }

        const fullPath = path.join(current, entry.name)
        const stats = await fs.stat(fullPath)
        hash.update(relativePathFromRepoRoot(fullPath))
        hash.update(String(stats.size))
        hash.update(String(stats.mtimeMs))

        if (entry.isDirectory()) {
          stack.push(fullPath)
        }
      }
    }
  }

  return hash.digest('hex')
}

export function parseLocalAgentRuntimeSource(snapshot: string): LocalAgentRuntimeSource | null {
  try {
    const parsed = JSON.parse(snapshot) as {
      source?: Partial<LocalAgentRuntimeSource>
    }

    if (parsed.source?.kind !== 'local-folder' || !parsed.source.sourceRootRelativePath) {
      return null
    }

    return {
      avatarRelativePath: parsed.source.avatarRelativePath ?? null,
      kind: 'local-folder',
      openClawConfigRelativePath: parsed.source.openClawConfigRelativePath ?? null,
      slug: parsed.source.slug ?? '',
      sourceRootRelativePath: parsed.source.sourceRootRelativePath,
      stagingRelativePath: parsed.source.stagingRelativePath ?? `agents/${parsed.source.slug ?? 'agent'}`,
    }
  } catch {
    return null
  }
}

export function buildLocalAgentThumbnailUrl(snapshot: string, slug: string) {
  const source = parseLocalAgentRuntimeSource(snapshot)

  if (!source?.avatarRelativePath) {
    return null
  }

  return `/api/agents/${slug}/thumbnail`
}

export async function loadLocalAgentDefinitions(rootDir = LOCAL_AGENTS_ROOT) {
  const resolvedRootDir = getLocalAgentsRoot(rootDir)
  const directories = await listLocalAgentDirectories(resolvedRootDir)
  const definitions = await Promise.all(directories.map((directory) => buildLocalAgentDefinition(directory)))
  return definitions.filter((definition): definition is LocalAgentDefinition => Boolean(definition))
}

export async function syncLocalAgentsToDb(rootDir = LOCAL_AGENTS_ROOT, db = getDb()) {
  const resolvedRootDir = getLocalAgentsRoot(rootDir)
  const fingerprint = await buildLocalAgentsFingerprint(resolvedRootDir)

  if (fingerprint === lastSyncedFingerprint) {
    return
  }

  const definitions = await loadLocalAgentDefinitions(resolvedRootDir)
  const activeLocalAgentIds = new Set(definitions.map((definition) => definition.agentRow.id))
  const existingLocalAgents = await db
    .select({
      id: agents.id,
    })
    .from(agents)
    .where(and(eq(agents.status, 'active'), like(agents.id, 'agent-local-%')))

  for (const existingAgent of existingLocalAgents) {
    if (activeLocalAgentIds.has(existingAgent.id)) {
      continue
    }

    await db
      .update(agents)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(agents.id, existingAgent.id))
  }

  for (const definition of definitions) {
    await db
      .insert(agents)
      .values(definition.agentRow)
      .onConflictDoUpdate({
        set: {
          category: definition.agentRow.category,
          currency: definition.agentRow.currency,
          descriptionMarkdown: definition.agentRow.descriptionMarkdown,
          priceCents: definition.agentRow.priceCents,
          status: definition.agentRow.status,
          summary: definition.agentRow.summary,
          title: definition.agentRow.title,
          updatedAt: new Date(),
        },
        target: agents.id,
      })

    await db
      .insert(agentVersions)
      .values(definition.versionRow)
      .onConflictDoUpdate({
        set: {
          changelogMarkdown: definition.versionRow.changelogMarkdown,
          installPackageUrl: definition.versionRow.installPackageUrl,
          installScriptMarkdown: definition.versionRow.installScriptMarkdown,
          previewPromptSnapshot: definition.versionRow.previewPromptSnapshot,
          releaseNotes: definition.versionRow.releaseNotes,
          runConfigSnapshot: definition.versionRow.runConfigSnapshot,
          version: definition.versionRow.version,
        },
        target: agentVersions.id,
      })

    await db
      .insert(riskProfiles)
      .values(definition.riskRow)
      .onConflictDoUpdate({
        set: {
          chatOnly: definition.riskRow.chatOnly,
          network: definition.riskRow.network,
          readFiles: definition.riskRow.readFiles,
          riskLevel: definition.riskRow.riskLevel,
          scanSummary: definition.riskRow.scanSummary,
          shell: definition.riskRow.shell,
          writeFiles: definition.riskRow.writeFiles,
        },
        target: riskProfiles.id,
      })
  }

  lastSyncedFingerprint = fingerprint
}

export async function getLocalAgentRuntimeSourceBySlug(slug: string, db = getDb()) {
  await syncLocalAgentsToDb(getLocalAgentsRoot(), db)

  const [row] = await db
    .select({
      runConfigSnapshot: agentVersions.runConfigSnapshot,
    })
    .from(agentVersions)
    .innerJoin(agents, eq(agentVersions.agentId, agents.id))
    .where(and(eq(agents.slug, slug), eq(agents.status, 'active')))
    .orderBy(desc(agentVersions.createdAt))
    .limit(1)

  return row ? parseLocalAgentRuntimeSource(row.runConfigSnapshot) : null
}

export async function readLocalAgentThumbnailFromSource(source: LocalAgentRuntimeSource | null) {
  if (!source?.avatarRelativePath) {
    return null
  }

  const absolutePath = path.resolve(
    resolveTrustedSourceRoot(source.sourceRootRelativePath),
    source.avatarRelativePath,
  )
  let contents: Buffer

  try {
    contents = await fs.readFile(absolutePath)
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code === 'ENOENT') {
      return null
    }

    throw error
  }

  return {
    absolutePath,
    contents,
  }
}

export async function getLocalAgentThumbnail(slug: string) {
  const source = await getLocalAgentRuntimeSourceBySlug(slug)
  return readLocalAgentThumbnailFromSource(source)
}

export async function buildLocalAgentArchiveFromSnapshot(snapshot: string) {
  const source = parseLocalAgentRuntimeSource(snapshot)

  if (!source) {
    return null
  }

  const sourceRoot = resolveTrustedSourceRoot(source.sourceRootRelativePath)

  try {
    await fs.access(sourceRoot)
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code === 'ENOENT') {
      return null
    }

    throw error
  }

  const workspaceFiles = await collectWorkspaceFiles(sourceRoot, sourceRoot, new Set<string>())
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-download-stage-'))

  try {
    for (const file of workspaceFiles) {
      const destination = path.join(stagingRoot, file.relativePath)
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(destination, file.contents)
    }

    const { stdout } = await execFile('tar', ['-czf', '-', '-C', stagingRoot, '.'], {
      encoding: 'buffer',
      maxBuffer: 32 * 1024 * 1024,
    })

    return {
      contents: stdout,
      fileName: `${source.slug || 'agent'}.tar.gz`,
    }
  } finally {
    await fs.rm(stagingRoot, { force: true, recursive: true })
  }
}

export async function getLocalAgentArchive(slug: string, db = getDb()) {
  const source = await getLocalAgentRuntimeSourceBySlug(slug, db)

  if (!source) {
    return null
  }

  return buildLocalAgentArchiveFromSnapshot(JSON.stringify({ source }))
}

export function setLocalAgentsRootForTesting(rootDir: string | null) {
  localAgentsRootOverride = rootDir ? path.resolve(rootDir) : null
  lastSyncedFingerprint = null
}

export async function loadRuntimeAssetsFromSnapshot(
  snapshot: string,
  targetWorkspaceDir: string | null = null,
): Promise<RuntimeAssetBundle> {
  const source = parseLocalAgentRuntimeSource(snapshot)

  if (!source) {
    return {
      config: {},
      workspaceFiles: [],
    }
  }

  const sourceRoot = resolveTrustedSourceRoot(source.sourceRootRelativePath)
  const configPath = source.openClawConfigRelativePath
    ? path.resolve(sourceRoot, source.openClawConfigRelativePath)
    : null
  const config = configPath ? await readOptionalJsonFile(configPath) : {}
  let workspaceFiles: RuntimeAssetBundle['workspaceFiles'] = []

  try {
    await fs.access(sourceRoot)
    workspaceFiles = await collectWorkspaceFiles(
      sourceRoot,
      sourceRoot,
      new Set<string>(),
    )
    workspaceFiles = workspaceFiles.map((file) => ({
      ...file,
      targetWorkspaceDir,
    }))
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException
    if (candidate.code !== 'ENOENT') {
      throw error
    }
  }

  return {
    config,
    workspaceFiles,
  }
}
