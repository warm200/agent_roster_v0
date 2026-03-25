---
summary: Marketing analytics implementation map for OpenRoster, including GA4 funnel events, UTM conventions, and the manual setup steps that live outside the repo.
read_when:
  - Installing or auditing Google Analytics 4, attribution tracking, or conversion reporting.
  - Setting up F5Bot, Bitly, X/Twitter Analytics, or Looker Studio for OpenRoster growth work.
---

# Marketing Analytics Setup

## What the app now emits

The frontend now emits these Google Analytics 4 events:

- `sign_up`
  - first successful authenticated session per browser identity
  - current implementation treats first OAuth-authenticated session as signup
- `first_collection`
  - first time a browser adds any agent to cart
- `telegram_connection`
  - when bundle Telegram pairing reaches `paired`
- `purchase`
  - after checkout session reconciliation succeeds

The app also persists first-touch and last-touch UTM parameters in browser localStorage and attaches them to tracked events as:

- `first_utm_source`
- `first_utm_medium`
- `first_utm_campaign`
- `first_utm_content`
- `first_utm_term`
- `first_landing_path`
- `last_utm_source`
- `last_utm_medium`
- `last_utm_campaign`
- `last_utm_content`
- `last_utm_term`
- `last_landing_path`

## Required env

Set this in production:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

This is read at runtime through `/api/analytics/config`, so it works in the Docker deployment model without baking the id into the image build.

## GA4 property setup

1. Create or open the OpenRoster GA4 property.
2. Create a Web data stream for `https://openroster.ai`.
3. Copy the Measurement ID into `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
4. In GA4 Admin > Events, verify these event names appear:
   - `sign_up`
   - `first_collection`
   - `telegram_connection`
   - `purchase`
5. Mark these four events as conversions.
6. In Admin > Custom definitions, register these event-scoped dimensions if you want them in standard reports:
   - `first_utm_source`
   - `first_utm_medium`
   - `first_utm_campaign`
   - `last_utm_source`
   - `last_utm_medium`
   - `last_utm_campaign`
   - `first_landing_path`
   - `last_landing_path`

## Funnel definition

Recommended funnel in GA4 Explorations:

1. `sign_up`
2. `first_collection`
3. `telegram_connection`
4. `purchase`

Notes:

- `sign_up` is a pragmatic proxy because the app uses OAuth and does not currently expose a server-side "user created just now" event to the browser.
- `first_collection` is intentionally first-add-to-cart, not checkout start.
- `purchase` is emitted after checkout reconciliation, not on Stripe redirect alone.

## UTM convention

Use the template in [utm_tracking_template.csv](/Users/wallacewang/agent_projects/v0_version/docs/utm_tracking_template.csv).

Recommended naming:

- `utm_source`
  - `twitter`
  - `linkedin`
  - `newsletter`
  - `reddit`
  - `producthunt`
  - `bitly`
- `utm_medium`
  - `organic_social`
  - `paid_social`
  - `community`
  - `email`
  - `partner`
- `utm_campaign`
  - `launch_2026_q1`
  - `agent_bundle_demo`
  - `telegram_runtime_push`
- `utm_content`
  - specific post, creative, CTA, or placement

## F5Bot alerts

Create alerts for:

- `"OpenRoster" OR "OpenRoster.ai"`
- `"AI agents"`
- `"agent marketplace"`
- `"OpenAI agents"`
- `"Lindy"`
- `"Gumloop"`
- `"Relay.app"`
- `"Manus"`
- `"AutoGPT"`

Recommended alert ownership:

- brand alerts: daily
- competitor alerts: daily
- category alerts: daily or hourly during launch weeks

## X / Twitter analytics

Manual setup only. The repo cannot authenticate into X on your behalf.

Track at minimum:

- profile visits
- link clicks
- follows
- post-level engagement rate
- top posts by link clicks

Map campaign links back to the UTM sheet so X posts and GA4 sessions use the same campaign names.

## Bitly

Manual setup only. The repo cannot create a Bitly account or manage its API credentials without your account access.

Recommended pattern:

- create one workspace for OpenRoster
- use Bitly only for campaign links, not sitewide navigation
- record long URL and short URL together in the UTM sheet
- if available, connect a branded short domain later

## Looker Studio baseline dashboard

Build one dashboard with these sections:

1. Acquisition
   - sessions by `source / medium`
   - sessions by campaign
   - landing pages
2. Funnel
   - `sign_up`
   - `first_collection`
   - `telegram_connection`
   - `purchase`
   - step-to-step conversion rates
3. Content / campaign performance
   - purchases by campaign
   - telegram connections by campaign
   - first collections by campaign
4. Social overlay
   - X profile visits
   - X link clicks
   - top posts by link clicks
5. Link operations
   - Bitly short links
   - clicks by short link
   - campaign owner / notes from the UTM sheet

Recommended data sources:

- GA4 property
- X analytics export or manual sheet
- Bitly export or manual sheet
- UTM tracking sheet

## What still requires account access

These tasks are not automatable from this repo alone:

- creating the GA4 property and marking conversions in the Google UI
- creating F5Bot alerts
- connecting X/Twitter Analytics
- creating the Bitly account
- creating the Looker Studio dashboard in Google’s UI

This repo now covers the in-product instrumentation and the operating template around those systems.
