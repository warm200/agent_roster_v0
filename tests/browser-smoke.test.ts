import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { existsSync } from 'node:fs'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import path from 'node:path'

import { encode } from 'next-auth/jwt'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const PORT = 3101
const BASE_URL = `http://127.0.0.1:${PORT}`
const NEXT_BIN = path.join(process.cwd(), 'node_modules/.bin/next')
const BUILD_ID_PATH = path.join(process.cwd(), '.next/BUILD_ID')
const chromePath =
  process.env.CHROME_BIN ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ].find((candidate) => existsSync(candidate))

let serverProcess: ChildProcessWithoutNullStreams | null = null
let browser: Browser | null = null

async function runCommand(args: string[], label: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(NEXT_BIN, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: 'pipe',
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${label} failed with code ${code ?? 'unknown'}\n${stderr}`))
    })
  })
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
    (expectedHref) => Boolean(document.querySelector(`a[href="${expectedHref}"]`)),
    {},
    href,
  )

  const clicked = await page.evaluate((expectedHref) => {
    const candidate = document.querySelector<HTMLElement>(`a[href="${expectedHref}"]`)
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
      await runCommand(['build'], 'next build')
    }

    serverProcess = spawn(
      NEXT_BIN,
      ['start', '--hostname', '127.0.0.1', '--port', String(PORT)],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret',
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
  })

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
}
