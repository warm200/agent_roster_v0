import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { existsSync } from 'node:fs'
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process'
import path from 'node:path'

import { encode } from 'next-auth/jwt'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const PORT = 3101
const BASE_URL = `http://127.0.0.1:${PORT}`
const NEXT_BIN = path.join(process.cwd(), 'node_modules/.bin/next')
const BUILD_ID_PATH = path.join(process.cwd(), '.next/BUILD_ID')
const TEST_DATABASE_NAME = 'agent_roster_browser_smoke'
const TEST_DATABASE_URL = `postgres://agent_roster:agent_roster@localhost:5432/${TEST_DATABASE_NAME}`
const chromePath =
  process.env.CHROME_BIN ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ].find((candidate) => existsSync(candidate))
const dockerAvailable = spawnSync('docker', ['version'], { stdio: 'ignore' }).status === 0

let serverProcess: ChildProcessWithoutNullStreams | null = null
let browser: Browser | null = null
let hasSeededBrowserDatabase = false

async function runCommand(
  command: string,
  args: string[],
  label: string,
  envOverrides: Record<string, string> = {},
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
        ...envOverrides,
      },
      stdio: 'pipe',
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(new Error(`${label} failed with code ${code ?? 'unknown'}\n${stderr}`))
    })
  })
}

async function ensureBrowserSmokeDatabase() {
  if (!dockerAvailable) {
    return false
  }

  const inspect = await runCommand(
    'docker',
    ['inspect', '-f', '{{.State.Running}}', 'agent-roster-postgres'],
    'docker inspect',
  ).catch(async () => {
    await runCommand('docker', ['compose', 'up', '-d', 'postgres'], 'docker compose up')
    return runCommand(
      'docker',
      ['inspect', '-f', '{{.State.Running}}', 'agent-roster-postgres'],
      'docker inspect',
    )
  })

  if (!inspect.stdout.includes('true')) {
    await runCommand('docker', ['start', 'agent-roster-postgres'], 'docker start')
  }

  await runCommand(
    'docker',
    [
      'exec',
      'agent-roster-postgres',
      'psql',
      '-U',
      'agent_roster',
      '-d',
      'postgres',
      '-c',
      `DROP DATABASE IF EXISTS ${TEST_DATABASE_NAME} WITH (FORCE);`,
    ],
    'drop test database',
  )

  await runCommand(
    'docker',
    [
      'exec',
      'agent-roster-postgres',
      'psql',
      '-U',
      'agent_roster',
      '-d',
      'postgres',
      '-c',
      `CREATE DATABASE ${TEST_DATABASE_NAME};`,
    ],
    'create test database',
  )

  await runCommand('pnpm', ['db:migrate'], 'pnpm db:migrate', {
    DATABASE_URL: TEST_DATABASE_URL,
  })
  await runCommand('pnpm', ['db:seed'], 'pnpm db:seed', {
    DATABASE_URL: TEST_DATABASE_URL,
  })

  return true
}

async function waitForServer(url: string, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url)

      if (response.ok) {
        return
      }
    } catch {
      // Keep polling until the dev server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for server at ${url}`)
}

async function waitForText(page: Page, text: string) {
  await page.waitForFunction(
    (expected) => document.body.textContent?.includes(expected),
    {},
    text,
  )
}

async function clickByText(page: Page, selector: string, text: string) {
  await page.waitForFunction(
    ({ candidateSelector, expectedText }) =>
      Array.from(document.querySelectorAll<HTMLElement>(candidateSelector)).some((node) =>
        node.innerText.trim().includes(expectedText),
      ),
    {},
    { candidateSelector: selector, expectedText: text },
  )

  const clicked = await page.evaluate(
    ({ candidateSelector, expectedText }) => {
      const candidate = Array.from(document.querySelectorAll<HTMLElement>(candidateSelector)).find(
        (node) => node.innerText.trim().includes(expectedText),
      )

      candidate?.click()
      return Boolean(candidate)
    },
    { candidateSelector: selector, expectedText: text },
  )

  assert.equal(clicked, true, `Could not find ${selector} with text "${text}"`)
}

async function clickByHref(page: Page, href: string) {
  await page.waitForFunction(
    (expectedHref) =>
      Array.from(document.querySelectorAll<HTMLElement>(`a[href="${expectedHref}"]`)).some(
        (node) => node.offsetParent !== null,
      ),
    {},
    href,
  )

  const clicked = await page.evaluate((expectedHref) => {
    const candidate = Array.from(
      document.querySelectorAll<HTMLElement>(`a[href="${expectedHref}"]`),
    ).find((node) => node.offsetParent !== null)
    candidate?.click()
    return Boolean(candidate)
  }, href)

  assert.equal(clicked, true, `Could not find link with href "${href}"`)
}

async function createSessionToken(overrides: Record<string, string> = {}) {
  return encode({
    secret: process.env.AUTH_SECRET || 'test-auth-secret',
    token: {
      sub: 'browser-user',
      email: 'browser-user@example.com',
      name: 'Browser User',
      ...overrides,
    },
  })
}

async function authenticatePage(page: Page, overrides: Record<string, string> = {}) {
  const token = await createSessionToken(overrides)

  await page.setCookie({
    name: 'next-auth.session-token',
    value: token,
    url: BASE_URL,
    httpOnly: true,
    sameSite: 'Lax',
  })
}

if (!chromePath) {
  test('browser smoke', { skip: 'Chrome executable not found' }, () => {})
} else {
  before(async () => {
    if (!existsSync(BUILD_ID_PATH)) {
      await runCommand(NEXT_BIN, ['build'], 'next build')
    }

    hasSeededBrowserDatabase = await ensureBrowserSmokeDatabase()

    serverProcess = spawn(
      NEXT_BIN,
      ['start', '--hostname', '127.0.0.1', '--port', String(PORT)],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret',
          DATABASE_URL: hasSeededBrowserDatabase ? TEST_DATABASE_URL : '',
          GITHUB_CLIENT_ID: 'github-client',
          GITHUB_CLIENT_SECRET: 'github-secret',
          NEXT_TELEMETRY_DISABLED: '1',
        },
        stdio: 'pipe',
      },
    )

    serverProcess.stdout.on('data', () => {})
    serverProcess.stderr.on('data', () => {})

    await waitForServer(`${BASE_URL}/agents`)

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
    })
  }, { timeout: 120_000 })

  after(async () => {
    await browser?.close()

    if (serverProcess) {
      serverProcess.kill('SIGTERM')
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    if (hasSeededBrowserDatabase) {
      await runCommand(
        'docker',
        [
          'exec',
          'agent-roster-postgres',
          'psql',
          '-U',
          'agent_roster',
          '-d',
          'postgres',
          '-c',
          `DROP DATABASE IF EXISTS ${TEST_DATABASE_NAME} WITH (FORCE);`,
        ],
        'drop test database',
      ).catch(() => {})
    }
  })

  test(
    'browser smoke covers pricing navigation',
    { timeout: 120_000 },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      const page = await browser.newPage()

      try {
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
        await waitForText(page, 'Build focused work bundles')
        await clickByHref(page, '/pricing')
        await waitForText(page, 'Choose the runtime tier')
        await waitForText(page, 'Warm Standby')
        assert.equal(page.url(), `${BASE_URL}/pricing`)
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke covers catalog to cart flow',
    { timeout: 120_000 },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      const page = await browser.newPage()

      try {
        await page.goto(`${BASE_URL}/agents`, { waitUntil: 'domcontentloaded' })
        await waitForText(page, 'Agent Catalog')
        await clickByText(page, 'button', 'Add')
        await waitForText(page, 'In Cart')

        await page.goto(`${BASE_URL}/cart`, { waitUntil: 'domcontentloaded' })
        await waitForText(page, 'Shopping Cart')
        await waitForText(page, 'Proceed to Checkout')
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke covers protected app redirect',
    { timeout: 120_000 },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      const page = await browser.newPage()

      try {
        await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' })
        await waitForText(page, 'Sign in to AgentRoster')
        assert.ok(page.url().includes('/login?callbackUrl='), page.url())
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke covers signed-in dashboard access',
    { timeout: 120_000 },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      const page = await browser.newPage()

      try {
        await authenticatePage(page)
        await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' })
        await waitForText(page, 'Dashboard')
        await waitForText(page, 'Recent Bundles')
        assert.equal(page.url(), `${BASE_URL}/app`)
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke covers signed-in bundle and run page access',
    { timeout: 120_000 },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      const page = await browser.newPage()

      try {
        await authenticatePage(page, {
          sub: 'browser-empty-user',
          email: 'browser-empty-user@example.com',
          name: 'Browser Empty User',
        })

        await page.goto(`${BASE_URL}/app/bundles`, { waitUntil: 'domcontentloaded' })
        await waitForText(page, 'My Bundles')
        assert.equal(page.url(), `${BASE_URL}/app/bundles`)

        await page.goto(`${BASE_URL}/app/runs`, { waitUntil: 'domcontentloaded' })
        await waitForText(page, 'Run History')
        assert.equal(page.url(), `${BASE_URL}/app/runs`)
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke covers signed-in app navigation',
    { timeout: 120_000 },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      const page = await browser.newPage()

      try {
        await authenticatePage(page)
        await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' })
        await waitForText(page, 'Dashboard')
        await clickByHref(page, '/app/bundles')
        await waitForText(page, 'My Bundles')
        assert.equal(page.url(), `${BASE_URL}/app/bundles`)

        await clickByHref(page, '/app/runs')
        await waitForText(page, 'Run History')
        assert.equal(page.url(), `${BASE_URL}/app/runs`)
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke covers checkout success handoff',
    { timeout: 120_000 },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      const page = await browser.newPage()

      try {
        await authenticatePage(page, {
          sub: 'user-1',
          email: 'user-1@demo.local',
          name: 'Demo User',
        })

        await page.goto(`${BASE_URL}/checkout/success?orderId=order-1`, {
          waitUntil: 'domcontentloaded',
        })
        await waitForText(page, 'Purchase Complete')
        await page.waitForFunction(
          (expectedHref) => {
            const link = document.querySelector<HTMLAnchorElement>(`a[href="${expectedHref}"]`)
            return link?.textContent?.includes('Set Up Telegram') ?? false
          },
          {},
          '/app/bundles/order-1',
        )
        await clickByHref(page, '/app')
        await waitForText(page, 'Dashboard')
        assert.equal(page.url(), `${BASE_URL}/app`)
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke reconciles checkout before clearing the cart',
    { timeout: 120_000 },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      const page = await browser.newPage()
      const requestOrder: string[] = []

      try {
        await authenticatePage(page, {
          sub: 'user-1',
          email: 'user-1@demo.local',
          name: 'Demo User',
        })
        await page.goto(`${BASE_URL}/agents`, { waitUntil: 'domcontentloaded' })
        await page.evaluate(() => {
          window.localStorage.setItem(
            'agent-roster-cart:v1',
            JSON.stringify([
              {
                id: 'cart-item-checkout-smoke',
                cartId: 'cart-checkout-smoke',
                agent: {
                  category: 'automation',
                  createdAt: new Date().toISOString(),
                  currency: 'USD',
                  currentVersion: {
                    agentId: 'agent-1',
                    changelogMarkdown: '',
                    createdAt: new Date().toISOString(),
                    id: 'agent-version-1',
                    installPackageUrl: 'https://example.com/install.zip',
                    installScriptMarkdown: '',
                    previewPromptSnapshot: 'Preview',
                    releaseNotes: '',
                    riskProfile: {
                      agentVersionId: 'agent-version-1',
                      chatOnly: true,
                      createdAt: new Date().toISOString(),
                      id: 'risk-1',
                      network: false,
                      readFiles: false,
                      riskLevel: 'low',
                      scanSummary: 'Low risk',
                      shell: false,
                      writeFiles: false,
                    },
                    runConfigSnapshot: '{}',
                    version: '1.0.0',
                  },
                  descriptionMarkdown: 'desc',
                  id: 'agent-1',
                  priceCents: 2900,
                  slug: 'checkout-smoke-agent',
                  status: 'active',
                  summary: 'Checkout smoke agent',
                  title: 'Checkout Smoke Agent',
                  updatedAt: new Date().toISOString(),
                },
                agentVersion: {
                  agentId: 'agent-1',
                  changelogMarkdown: '',
                  createdAt: new Date().toISOString(),
                  id: 'agent-version-1',
                  installPackageUrl: 'https://example.com/install.zip',
                  installScriptMarkdown: '',
                  previewPromptSnapshot: 'Preview',
                  releaseNotes: '',
                  riskProfile: {
                    agentVersionId: 'agent-version-1',
                    chatOnly: true,
                    createdAt: new Date().toISOString(),
                    id: 'risk-1',
                    network: false,
                    readFiles: false,
                    riskLevel: 'low',
                    scanSummary: 'Low risk',
                    shell: false,
                    writeFiles: false,
                  },
                  runConfigSnapshot: '{}',
                  version: '1.0.0',
                },
                createdAt: new Date().toISOString(),
              },
            ]),
          )
        })

        await page.setRequestInterception(true)
        page.on('request', (request) => {
          const url = request.url()
          const method = request.method()

          if (url === `${BASE_URL}/api/checkout/session/cs_test_checkout_success` && method === 'POST') {
            requestOrder.push('reconcile')
            void request.respond({
              body: JSON.stringify({ id: 'order-checkout-smoke' }),
              contentType: 'application/json',
              status: 200,
            })
            return
          }

          if (url === `${BASE_URL}/api/cart` && method === 'PUT') {
            const rawBody = request.postData()
            const body = rawBody ? (JSON.parse(rawBody) as { agentIds?: string[] }) : undefined
            requestOrder.push(body?.agentIds?.length ? 'sync-cart' : 'clear-cart')
            void request.respond({
              body: JSON.stringify({
                bundleRisk: {
                  highestRiskDriver: null,
                  level: 'low',
                  summary: 'No agents selected',
                },
                createdAt: new Date().toISOString(),
                currency: 'USD',
                id: 'cart-checkout-smoke',
                items: [],
                status: 'active',
                totalCents: 0,
                updatedAt: new Date().toISOString(),
                userId: 'user-1',
              }),
              contentType: 'application/json',
              status: 200,
            })
            return
          }

          void request.continue()
        })

        await page.goto(`${BASE_URL}/checkout/success?session_id=cs_test_checkout_success`, {
          waitUntil: 'domcontentloaded',
        })
        await waitForText(page, 'Purchase Complete')
        await new Promise((resolve) => setTimeout(resolve, 250))

        const reconcileIndex = requestOrder.indexOf('reconcile')
        const clearCartIndex = requestOrder.indexOf('clear-cart')

        assert.notEqual(reconcileIndex, -1, 'Expected checkout reconcile request')
        assert.ok(
          clearCartIndex === -1 || reconcileIndex < clearCartIndex,
          `Expected cart clear to happen only after reconcile. Saw request order: ${requestOrder.join(', ')}`,
        )
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke covers seeded bundle detail and run launch',
    { timeout: 120_000, skip: !dockerAvailable ? 'Docker not available' : undefined },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      assert.equal(hasSeededBrowserDatabase, true, 'Seeded browser database was not prepared')
      const page = await browser.newPage()

      try {
        await authenticatePage(page, {
          sub: 'user-1',
          email: 'user-1@demo.local',
          name: 'Demo User',
        })

        await page.goto(`${BASE_URL}/app/bundles`, { waitUntil: 'domcontentloaded' })
        await waitForText(page, 'My Bundles')
        await waitForText(page, 'Bundle (2 Agents)')
        await clickByHref(page, '/app/bundles/order-1')
        await waitForText(page, 'Launch Run')
        await waitForText(page, 'Inbox Triage Agent')
        assert.equal(page.url(), `${BASE_URL}/app/bundles/order-1`)

        await clickByText(page, 'button', 'Launch Run')
        await page.waitForFunction(
          (baseUrl) => window.location.href.startsWith(`${baseUrl}/app/runs/`),
          {},
          BASE_URL,
        )
        await waitForText(page, 'Run Information')
        assert.ok(page.url().startsWith(`${BASE_URL}/app/runs/`), page.url())
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke covers seeded run detail content',
    { timeout: 120_000, skip: !dockerAvailable ? 'Docker not available' : undefined },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      assert.equal(hasSeededBrowserDatabase, true, 'Seeded browser database was not prepared')
      const page = await browser.newPage()

      try {
        await authenticatePage(page, {
          sub: 'user-1',
          email: 'user-1@demo.local',
          name: 'Demo User',
        })

        await page.goto(`${BASE_URL}/app/runs/run-1`, {
          waitUntil: 'domcontentloaded',
        })
        await waitForText(page, 'Run Information')
        await waitForText(page, 'Initializing run environment')
        await waitForText(page, 'Successfully processed 47 emails')
        assert.equal(page.url(), `${BASE_URL}/app/runs/run-1`)
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke covers seeded telegram-ready bundle listing',
    { timeout: 120_000, skip: !dockerAvailable ? 'Docker not available' : undefined },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      assert.equal(hasSeededBrowserDatabase, true, 'Seeded browser database was not prepared')
      const page = await browser.newPage()

      try {
        await authenticatePage(page, {
          sub: 'user-1',
          email: 'user-1@demo.local',
          name: 'Demo User',
        })

        await page.goto(`${BASE_URL}/app/bundles`, {
          waitUntil: 'domcontentloaded',
        })
        await waitForText(page, 'Telegram Connected')
        await waitForText(page, 'Bundle (2 Agents)')
        assert.equal(page.url(), `${BASE_URL}/app/bundles`)
      } finally {
        await page.close()
      }
    },
  )

  test(
    'browser smoke fetches seeded signed download grants',
    { timeout: 120_000, skip: !dockerAvailable ? 'Docker not available' : undefined },
    async () => {
      assert.ok(browser, 'Browser failed to launch')
      assert.equal(hasSeededBrowserDatabase, true, 'Seeded browser database was not prepared')
      const page = await browser.newPage()

      try {
        await authenticatePage(page, {
          sub: 'user-1',
          email: 'user-1@demo.local',
          name: 'Demo User',
        })

        await page.goto(`${BASE_URL}/app/bundles/order-1`, {
          waitUntil: 'domcontentloaded',
        })
        await waitForText(page, 'Launch Run')

        const payload = await page.evaluate(async () => {
          const response = await fetch('/api/me/orders/order-1/download')
          return {
            body: await response.json(),
            status: response.status,
          }
        })

        assert.equal(payload.status, 200)
        assert.ok(payload.body.downloads.length >= 1, 'Expected signed download grants')
        assert.ok(
          payload.body.downloads.every((download: { downloadUrl: string }) =>
            download.downloadUrl.includes('/api/downloads/orders/order-1/items/'),
          ),
          'Expected signed order download URLs',
        )
      } finally {
        await page.close()
      }
    },
  )
}
