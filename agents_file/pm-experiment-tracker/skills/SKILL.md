---
name: experiment-tracker
description: Designs and tracks scientific experiments, A/B tests, and feature rollouts for product and engineering teams. Defines experiment hypotheses, calculates required sample sizes, tracks variant performance metrics, analyzes statistical significance, and delivers ship/no-ship recommendations. Use when the user asks about designing A/B tests or split tests, setting up control vs. treatment groups, tracking experiment results, calculating statistical significance or confidence intervals, managing feature flag rollouts, or deciding whether to ship a feature based on experiment data.
color: purple
---

# Experiment Tracker

Manages the full experiment lifecycle: hypothesis definition, statistical design, execution monitoring, results analysis, and ship/no-ship decisions.

---

## Workflow

### Step 1 — Hypothesis & Design
- Define a clear, testable hypothesis with a measurable primary KPI and success threshold.
- Identify the target population and exclusion criteria.
- Calculate required sample size (see [STATISTICAL_METHODS.md](STATISTICAL_METHODS.md)).
- Document control and variant descriptions.
- Assign guardrail metrics to detect degradation.

**Validation checkpoint**: If calculated sample size exceeds available daily traffic × planned duration, reduce scope, extend duration, or narrow the hypothesis before proceeding.

### Step 2 — Implementation & Launch Prep
- Confirm instrumentation: verify event tracking fires correctly for both control and variant before launch.
- Set up monitoring dashboards with alert thresholds (e.g., error rate +2 pp, latency +50 ms).
- Document rollback procedure: who owns it, how long it takes, and the trigger condition.
- Perform a soft launch to 1–5% of traffic to validate instrumentation and data pipeline integrity.

**Validation checkpoint**: If data collection rate in soft launch is < 95% of expected, halt and fix instrumentation before full launch.

### Step 3 — Execution & Monitoring
- Track daily: sample accumulation per variant, imbalance ratio, primary metric trend.
- Do not stop the experiment early unless a pre-registered early stopping rule is met (e.g., O'Brien-Fleming boundaries for sequential testing).
- Apply multiple comparison corrections (Bonferroni or Benjamini-Hochberg) when testing more than one variant or primary metric simultaneously.

**Validation checkpoint**: If variant/control split deviates by > 5% from the planned ratio (e.g., 50/50 target but observing 55/45), investigate for assignment bugs before continuing.

### Step 4 — Analysis & Decision
- Run the appropriate significance test (see [STATISTICAL_METHODS.md](STATISTICAL_METHODS.md)).
- Report p-value, confidence interval, and practical effect size (relative and absolute).
- Apply the go/no-go criteria defined in the design document.
- Document learnings regardless of outcome.

---

## Templates

Full copy-paste templates are in [TEMPLATES.md](TEMPLATES.md). Key documents:

- **Experiment Design Document** — captures hypothesis, primary/guardrail metrics, population, sample size, variant descriptions, and rollback plan.
- **Experiment Results Document** — records the SHIP / NO-SHIP / ITERATE decision, a results table (control vs. variant with Δ absolute, Δ relative, p-value, 95% CI), key findings, and next steps.

---

## Statistical Methods

Full Python implementations are in [STATISTICAL_METHODS.md](STATISTICAL_METHODS.md). Available functions:

- **`sample_size(baseline_rate, mde, alpha, power)`** — two-proportion z-test sample size per variant (e.g., 10% baseline + 2 pp MDE → ~3,842 per variant at 80% power, α = 0.05).
- **`test_proportions(...)`** — chi-squared test for conversion rates; returns p-value, absolute lift, and relative lift.
- **`test_means(...)`** — Welch's t-test for continuous metrics (e.g., revenue per user).
- **`proportion_ci(conversions, n, alpha)`** — Wilson score confidence interval for proportions.

### Choosing the Right Test

| Data type | Recommended test |
|-----------|-----------------|
| Conversion rate (binary) | Two-proportion z-test / chi-squared |
| Continuous metric (revenue, time) | Welch's t-test |
| Non-normal continuous metric | Mann-Whitney U |
| Multiple variants (> 2) | ANOVA + Bonferroni correction |
| Sequential / always-on testing | O'Brien-Fleming or mSPRT |

---

## Project-Specific Decision Rules

- **Minimum runtime**: run for at least 1–2 full business cycles (usually 1–2 weeks) regardless of when significance is reached, to avoid novelty effects.
- **Practical significance**: a statistically significant result with a negligible effect size (e.g., +0.1 pp on a 10% baseline) may not justify the engineering cost — always report both statistical and practical significance.
- **Inconclusive null results**: if observed power at experiment end is < 80%, treat a null result as inconclusive, not a no-ship signal.
