import assert from 'node:assert/strict'
import test from 'node:test'

import { buildGoogleAnalyticsInlineScript } from '@/lib/google-analytics'

test('buildGoogleAnalyticsInlineScript matches the stock gtag bootstrap shape', () => {
  const snippet = buildGoogleAnalyticsInlineScript('G-3Z8KFC9W22')

  assert.match(snippet, /window\.dataLayer = window\.dataLayer \|\| \[\];/)
  assert.match(snippet, /function gtag\(\)\{dataLayer\.push\(arguments\);\}/)
  assert.match(snippet, /window\.__openRosterGaMeasurementId = "G-3Z8KFC9W22";/)
  assert.match(snippet, /gtag\('config', "G-3Z8KFC9W22", \{ send_page_view: false \}\);/)
  assert.doesNotMatch(snippet, /push\(e\)/)
})
