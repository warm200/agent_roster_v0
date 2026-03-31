#!/usr/bin/env tsx

import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { Command } from 'commander'

import {
  extractRegistryHtmlReview,
  getRepoRef,
  getRepoUrl,
  loadRegistrySeedAgents,
  normalizeLocalSkillReview,
  normalizeTesslSnapshotPayload,
  type AgentTesslSnapshotFile,
} from '@/server/services/tessl-sync'

const execFileAsync = promisify(execFile)

const program = new Command()

program
  .name('tessl-sync')
  .description('Refresh agents_file/tessl-evals.json from Tessl eval output, with public registry fallback.')
  .option('--repo <repo>', 'GitHub repo, owner/name or full URL.', 'OpenRoster-ai/awesome-openroster')
  .option('--output <path>', 'Where to write the normalized snapshot.', 'agents_file/tessl-evals.json')
  .option('--eval-id <id>', 'Use a specific Tessl eval run id.')
  .option('--last', 'Use the most recent Tessl eval run.')
  .option('--local-review-dir <path>', 'Import local tessl skill review JSON files from a directory.')
  .option('--public-only', 'Skip Tessl CLI and use the public registry fallback only.')

program.parse(process.argv)

const options = program.opts<{
  evalId?: string
  last?: boolean
  localReviewDir?: string
  output: string
  publicOnly?: boolean
  repo: string
}>()

async function fetchCliPayload(evalId?: string, useLast?: boolean) {
  const args = ['eval', 'view', '--json']

  if (evalId) {
    args.push(evalId)
  } else if (useLast) {
    args.push('--last')
  } else {
    throw new Error('No Tessl eval selected. Pass --eval-id <id>, --last, or --public-only.')
  }

  const { stdout } = await execFileAsync('tessl', args, {
    maxBuffer: 20 * 1024 * 1024,
  })

  return JSON.parse(stdout)
}

async function fetchRegistryHtml(query: string) {
  const url = new URL('https://tessl.io/registry')
  url.searchParams.set('q', query)
  url.searchParams.set('filter[includeInvalid]', 'true')

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OpenRoster Tessl Sync',
    },
  })

  if (!response.ok) {
    throw new Error(`Tessl registry request failed: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

async function buildFallbackSnapshot(repo: string): Promise<AgentTesslSnapshotFile> {
  const repoUrl = getRepoUrl(repo)
  const seeds = await loadRegistrySeedAgents()
  const items = []

  for (const seed of seeds) {
    const html = await fetchRegistryHtml(`${seed.title} ${repoUrl}`)
    const review = extractRegistryHtmlReview(html, { repo, slug: seed.slug })
    if (review) {
      items.push(review)
    }
  }

  return {
    sourceUrl: repoUrl,
    generatedAt: new Date().toISOString(),
    count: items.length,
    items: items.sort((left, right) => left.slug.localeCompare(right.slug)),
  }
}

async function buildLocalReviewSnapshot(
  repo: string,
  localReviewDir: string,
): Promise<AgentTesslSnapshotFile> {
  const repoUrl = getRepoUrl(repo)
  const seeds = await loadRegistrySeedAgents()
  const seedMap = new Map(seeds.map((seed) => [seed.slug, seed.title]))
  const directory = path.resolve(process.cwd(), localReviewDir)
  const entries = await readdir(directory, { withFileTypes: true })
  const items = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue
    }

    const slug = entry.name.replace(/\.json$/, '')
    const filePath = path.join(directory, entry.name)
    let payload: unknown
    let fileStats

    try {
      ;[payload, fileStats] = await Promise.all([
        readFile(filePath, 'utf8').then((text) => JSON.parse(text)),
        stat(filePath),
      ])
    } catch (error) {
      console.warn(
        `[tessl-sync] Skipping ${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
      continue
    }

    const review = normalizeLocalSkillReview(payload, {
      generatedAt: fileStats.mtime.toISOString(),
      repo,
      slug,
      title: seedMap.get(slug),
    })

    if (review) {
      items.push(review)
    }
  }

  items.sort((left, right) => left.slug.localeCompare(right.slug))

  return {
    sourceUrl: repoUrl,
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  }
}

async function main() {
  let snapshot: AgentTesslSnapshotFile | null = null

  if (options.localReviewDir) {
    snapshot = await buildLocalReviewSnapshot(options.repo, options.localReviewDir)
  } else if (!options.publicOnly) {
    try {
      const payload = await fetchCliPayload(options.evalId, options.last)
      snapshot = normalizeTesslSnapshotPayload(payload, {
        generatedAt: new Date().toISOString(),
        repo: options.repo,
      })

      if (snapshot.count === 0) {
        throw new Error('Tessl CLI returned JSON, but no skill evaluations could be normalized.')
      }
    } catch (error) {
      console.warn(
        `[tessl-sync] CLI path unavailable: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (!snapshot) {
    snapshot = await buildFallbackSnapshot(options.repo)
  }

  const outputPath = path.resolve(process.cwd(), options.output)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  console.log(
    JSON.stringify(
      {
        count: snapshot.count,
        outputPath,
        repo: snapshot.sourceUrl,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
