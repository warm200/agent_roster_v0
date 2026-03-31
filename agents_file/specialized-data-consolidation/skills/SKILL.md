---
name: data-consolidation-agent
description: Aggregates sales data into dashboards, generates territory breakdowns, tracks rep performance, and visualizes pipeline stages. Use when the user asks to build sales dashboards, generate pipeline or revenue reports, summarize sales performance by territory or rep, track quota attainment, analyze deal pipeline, review CRM data, or produce sales analytics and forecasts.
color: "#38a169"
---

# Data Consolidation Agent

## Critical Rules

1. **Always use latest data**: queries pull the most recent `metric_date` per type
2. **Calculate attainment accurately**: use `ytd_revenue / quota * 100`; surface reps/territories with unset quotas as `"quota_not_set": true` rather than silently dropping them
3. **Aggregate by territory**: group metrics for regional visibility
4. **Include pipeline data**: merge lead pipeline with sales metrics for full picture
5. **Support multiple views**: MTD, YTD, and Year End summaries available on demand

## Workflow Process

### Step 1 — Fetch Territory Summary

```sql
SELECT
  territory,
  COUNT(DISTINCT rep_id)               AS rep_count,
  SUM(ytd_revenue)                     AS ytd_revenue,
  SUM(mtd_revenue)                     AS mtd_revenue,
  SUM(quota)                           AS quota,
  CASE
    WHEN SUM(quota) = 0 THEN NULL
    ELSE ROUND(SUM(ytd_revenue) / SUM(quota) * 100, 2)
  END                                  AS attainment_pct
FROM sales_metrics
WHERE metric_date = (SELECT MAX(metric_date) FROM sales_metrics)
GROUP BY territory
ORDER BY ytd_revenue DESC;
```

### Step 2 — Fetch Individual Rep Performance

```sql
SELECT
  rep_id,
  rep_name,
  territory,
  ytd_revenue,
  mtd_revenue,
  quota,
  CASE
    WHEN quota = 0 THEN NULL
    ELSE ROUND(ytd_revenue / quota * 100, 2)
  END AS attainment_pct,
  metric_date
FROM sales_metrics
WHERE metric_date = (SELECT MAX(metric_date) FROM sales_metrics)
ORDER BY ytd_revenue DESC;
```

### Step 3 — Fetch Pipeline Snapshot

```sql
SELECT
  stage,
  COUNT(*)                             AS deal_count,
  SUM(deal_value)                      AS total_value,
  SUM(deal_value * probability)        AS weighted_value
FROM lead_pipeline
WHERE is_active = TRUE
GROUP BY stage
ORDER BY weighted_value DESC;
```

### Step 4 — Fetch 6-Month Trend

```sql
SELECT
  DATE_TRUNC('month', metric_date)    AS month,
  territory,
  SUM(mtd_revenue)                    AS monthly_revenue
FROM sales_metrics
WHERE metric_date >= NOW() - INTERVAL '6 months'
GROUP BY 1, 2
ORDER BY 1, 2;
```

### Step 5 — Validate Aggregates

Before returning results, verify:
- Sum of per-rep `ytd_revenue` within each territory equals the territory-level `ytd_revenue`.
- Any `attainment_pct` of NULL indicates a zero quota — surface those reps/territories explicitly as `"quota_not_set": true`.
- Pipeline weighted values sum to a non-zero total; if zero, flag as `"pipeline_empty": true`.

### Step 6 — Structure Dashboard JSON

Combine all query results into the following schema:

```json
{
  "generated_at": "<ISO-8601 timestamp>",
  "territories": [
    {
      "territory": "West",
      "rep_count": 8,
      "ytd_revenue": 4200000,
      "mtd_revenue": 380000,
      "quota": 5000000,
      "attainment_pct": 84.0,
      "quota_not_set": false
    }
  ],
  "reps": [
    {
      "rep_id": "R001",
      "rep_name": "Jane Smith",
      "territory": "West",
      "ytd_revenue": 620000,
      "mtd_revenue": 55000,
      "quota": 700000,
      "attainment_pct": 88.57,
      "quota_not_set": false
    }
  ],
  "pipeline": [
    {
      "stage": "Proposal",
      "deal_count": 14,
      "total_value": 1800000,
      "weighted_value": 900000
    }
  ],
  "trend": [
    {
      "month": "2024-01-01",
      "territory": "West",
      "monthly_revenue": 310000
    }
  ],
  "top_performers": [
    { "rep_id": "R001", "rep_name": "Jane Smith", "ytd_revenue": 620000 }
  ],
  "pipeline_empty": false
}
```

`top_performers` is the top 5 reps sorted by `ytd_revenue` descending, derived from the `reps` array.

## Territory Deep Dive

For territory-specific requests, fetch all reps within the territory plus their recent metric history (last 50 entries):

```sql
SELECT *
FROM sales_metrics
WHERE territory = :territory
ORDER BY metric_date DESC
LIMIT 50;
```
