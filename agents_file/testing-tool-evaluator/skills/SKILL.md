---
name: tool-evaluator
description: Creates structured software and platform evaluation reports with weighted scoring matrices, TCO analysis, and adoption recommendations. Use when asked to compare tools, recommend software, evaluate platforms, choose between apps, or answer questions like "which tool should I use", "best software for X", "tool comparison", "software recommendation", "pros and cons of [tool]", or "help me pick between [A] and [B]". Produces comparison matrices, financial analyses, risk assessments, and phased implementation plans for business tool decisions.
color: teal
---

# Tool Evaluator

Evaluates and recommends tools, software, and platforms through structured analysis, competitive comparison, and financial assessment.

## Core Evaluation Criteria

Score each criterion 0–10, then multiply by its weight to produce the weighted contribution. The weighted scores sum to a final score out of 10.

| Criterion | Weight | Scoring Rules |
|---|---|---|
| Functionality | 25% | Required features avg × 0.8 + optional features avg × 0.2 |
| Usability | 20% | UX quality, learning curve, role-based fit (manual review) |
| Performance | 15% | Avg response < 0.1 s → 10; < 0.5 s → 8; < 1 s → 6; < 2 s → 4; else → 2 |
| Security | 15% | 5 boolean checks × 2 pts each: encryption at rest, encryption in transit, SSO, compliance certs, pen-tested |
| Integration | 10% | (Required integrations covered ÷ total required) × 10 |
| Support | 8% | 4 boolean checks × 2.5 pts each: documentation, SLA, live support, community forum |
| Cost | 7% | `min(10, max(0, 10 × (1 − 3yr_TCO ÷ budget)))`; default 5 if no budget given |

**Non-negotiable**: every evaluation must include security, integration, and cost components.

## TCO Formula (3-Year Default)

```
Total = (annual_license + annual_maintenance + annual_support) × 3
      + implementation + training + integration + migration

Cost per user/year = Total ÷ (users × years)
```

Report cost breakdown by category (licensing, implementation, training, maintenance, integration, migration, support), total cost, and cost per user/year. Extend to 5 years only when explicitly requested.

## Workflow

### Step 1 — Requirements & Discovery
- Identify must-have vs. nice-to-have features and key pain points
- Adjust criterion weights above to reflect business priorities (document any changes)
- Identify 2–5 candidate tools from market research and stakeholder input
- Set evaluation timeline and success metrics

### Step 2 — Structured Testing
- Score each tool against the criteria table using a shared test scenario set
- Conduct user acceptance testing with representative roles
- **Decision gate**: If a tool fails any security check, flag immediately; do not rank until remediation is confirmed

### Step 3 — Financial & Risk Analysis
- Calculate 3-year TCO for each tool using the formula above
- Assess vendor stability: funding, customer base, roadmap
- Score implementation risk: complexity × change management burden
- **Decision gate**: If the weighted scores of the top two tools differ by < 5%, run targeted differentiation testing on the closest-call criterion before finalising

### Step 4 — Recommendation & Implementation Plan
- Rank tools by weighted score; produce the recommendation with clear rationale
- Ensure contract terms cover data rights, exit clauses, and SLA minimums
- Develop phased rollout: pilot group → feedback loop → full deployment
- Define KPIs to measure post-implementation success at 30/90/180 days

## Deliverable

Use **TEMPLATE.md** for the full report structure. At minimum every report must contain:

1. **Executive Summary** — recommended solution, 3-yr TCO, implementation timeline, quantified business impact
2. **Evaluation Results** — scored comparison matrix with weighted totals and per-criterion category leaders
3. **Financial Analysis** — per-tool TCO breakdown, cost per user/year, ROI projection at 50/75/100% adoption
4. **Risk Assessment** — implementation, security, and vendor risks with specific mitigations
5. **Implementation Strategy** — phased rollout plan, change management approach, integration dependencies, KPIs at 30/90/180 days

> See `TEMPLATE.md` for the full section-by-section report template.
