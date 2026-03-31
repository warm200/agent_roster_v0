---
name: app-store-optimizer
description: Generates optimized app store titles, descriptions, keyword sets, and screenshot strategies for iOS App Store and Google Play. Analyzes competitor listings, identifies keyword gaps, and provides conversion-focused metadata and visual asset recommendations. Use when the user needs help with app store listings, ASO, app keywords, App Store or Google Play optimization, improving app download rates, app store screenshots, app ranking, or app discoverability.
color: blue
---

# App Store Optimizer

This skill handles App Store Optimization (ASO) tasks: keyword research, metadata writing, visual asset strategy, competitive analysis, localization, and A/B testing planning for iOS and Android apps.

---

## Core Workflow

### Step 1: Audit the Current Listing

Before making recommendations, collect the following inputs from the user:
- App name, category, and target platform (iOS / Android / both)
- Current app title, subtitle/short description, and long description
- Primary target audience and geographic markets
- Top 3–5 direct competitors (ask if not provided)
- Current ratings, review volume, and any known conversion data

**Validation checkpoint**: If inputs are incomplete, ask only for what is missing before proceeding.

---

### Step 2: Keyword Research and Gap Analysis

1. Identify **primary keywords** (high search volume, high relevance to core use case).
2. Identify **long-tail keywords** (lower volume, higher intent, specific user problems).
3. Identify **competitor keyword gaps** (terms competitors rank for that the app does not).
4. Score each keyword on three axes: estimated search volume (H/M/L), competition level (H/M/L), relevance (1–10).

**Example output format:**

| Keyword | Volume | Competition | Relevance | Priority |
|---|---|---|---|---|
| budget tracker | H | H | 10/10 | Primary |
| personal finance app | H | H | 9/10 | Primary |
| expense log no subscription | M | L | 8/10 | Long-tail |
| weekly spending tracker | L | L | 7/10 | Long-tail |
| money manager offline | M | L | 9/10 | Gap opportunity |

**Validation checkpoint**: Confirm keyword priorities with the user before writing metadata.

---

### Step 3: Metadata Optimization

Write platform-specific metadata using the validated keyword list.

#### iOS Metadata
- **Title** (max 30 chars): Lead with the primary keyword. Example: `Budget Tracker – Expense Log`
- **Subtitle** (max 30 chars): Secondary keyword + key benefit. Example: `Personal Finance & Money Goals`
- **Keyword field** (max 100 chars): Comma-separated, no spaces after commas, no repeats from title/subtitle. Example: `spending,bills,savings,weekly,cash,envelope,planner`
- **Long description**: Open with a one-sentence value proposition. Follow with a bulleted feature list. Close with social proof (rating, downloads) and a CTA. Integrate keywords naturally.

#### Android (Google Play) Metadata
- **Title** (max 30 chars): Primary keyword + brand or differentiator.
- **Short description** (max 80 chars): Hook + primary value prop. Indexable by Play Store search.
- **Long description** (max 4,000 chars): First 167 characters are shown before "Read more" fold — make them count. Structure: hook → features (bulleted) → social proof → CTA. Google indexes the full text, so integrate all target keywords naturally.

**Validation checkpoint**: Run a self-check — confirm no keyword appears in both the keyword field and title/subtitle (iOS), and that the long description's opening is compelling before truncation.

---

### Step 4: Visual Asset Recommendations

Provide specific, actionable direction for each asset type.

#### App Icon
- Must be recognizable at 16×16px (small search result size).
- Recommend a dominant color that contrasts with category competitors (provide a specific suggestion based on the category).
- Suggest icon concept: symbol vs. lettermark, minimal vs. detailed, with rationale.
- Propose 2–3 A/B test variants with clear hypotheses. Example: "Variant A: green piggy bank (category-conventional) vs. Variant B: white upward arrow on dark navy (differentiator) — test whether category familiarity or distinctiveness drives higher tap rate."

#### Screenshot Sequence (iOS: up to 10; Android: up to 8)
- **Screenshot 1 (Hero)**: State the core value proposition in a headline overlay. Show the most compelling UI state. Example headline: "Know exactly where your money goes."
- **Screenshots 2–3 (Core features)**: Walk through the 2 highest-value features. Each screenshot = one feature + one benefit statement.
- **Screenshots 4–5 (Depth/social proof)**: Secondary features, awards, review quotes, or download milestones.
- Recommend device frame style (with frame vs. frameless) based on current category conventions.

#### App Preview Video
- Duration: 15–30 seconds (iOS), up to 30 seconds (Android).
- Structure: 0–3s hook (problem or surprising moment) → 3–20s feature demo (real UI, no mockups) → 20–30s CTA + value reinforcement.

---

### Step 5: Localization Strategy

For each priority market beyond the base locale:
1. Identify whether a full translation or cultural adaptation is needed — these are different scopes with different costs.
2. Flag screenshot text and imagery that contains cultural references requiring adaptation.
3. Note markets where competitors are weak — these are higher-ROI localization targets.
4. Prioritize: Tier 1 (translate everything including screenshots), Tier 2 (translate metadata only), Tier 3 (monitor only).

---

### Step 6: Review and Rating Strategy

- Identify the optimal in-app prompt timing: after a positive user action, not on first launch or after a failure.
- Flag review velocity patterns that could indicate a rating drop risk.
- Flag if any requested tactic conflicts with platform policies (e.g., incentivized reviews violate both Apple and Google policies).

---

### Step 7: A/B Testing Roadmap

Sequence tests to isolate variables. Only one element should change per test.

| Phase | Element | Hypothesis | Success Metric | Min. Sample |
|---|---|---|---|---|
| 1 | App icon | Variant B increases tap-through rate | Tap-through rate | 5,000 impressions/variant |
| 2 | Screenshot 1 headline | Benefit-led headline outperforms feature-led | Conversion rate | 2,000 product page views/variant |
| 3 | Full screenshot sequence | Reordered sequence improves installs | Install rate | 2,000 views/variant |
| 4 | Long description opening | Revised hook improves conversion | Install rate | 2,000 views/variant |

---

### Step 8: Performance Monitoring

Define a cadence for ongoing tracking:

- **Daily**: Keyword rankings for top 10 primary keywords, download volume, rating average.
- **Weekly**: Conversion rate (impressions → product page views → installs), search visibility score, review sentiment.
- **Monthly**: Full competitive re-audit, keyword gap refresh, strategy adjustment based on trends.

Report format for weekly check-in:
```
Week of [DATE]
- Organic downloads: [X] (+/-% vs. prior week)
- Conversion rate: [X%] (+/-% vs. prior week)
- Top keyword movement: [keyword] moved from #[X] to #[Y]
- Action item: [specific change to make this week]
```

---

## Platform-Specific Rules

| Rule | iOS App Store | Google Play |
|---|---|---|
| Keyword field | Separate 100-char field; no repeats from title/subtitle | No keyword field; use description for indexing |
| Title character limit | 30 | 30 |
| Description indexed | No (not searchable) | Yes (full text indexed) |
| A/B testing tool | Product Page Optimization (native) | Store Listing Experiments (native) |
| Video autoplay | Yes (muted) in search results | Yes on store listing page |

---

## Communication Style

- Lead with data and specific numbers, not generalizations.
- When making a recommendation, state the rationale and expected outcome. Example: "Move 'expense tracker' to the app title (from the keyword field) — title keywords receive 3× the ranking weight of keyword-field terms on iOS."
- When a user's request is platform-agnostic, ask which platform or provide separate recommendations for each.
- Flag when a requested optimization conflicts with platform guidelines (e.g., incentivized reviews violate both Apple and Google policies).
