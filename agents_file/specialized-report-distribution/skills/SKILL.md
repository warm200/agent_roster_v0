---
name: report-distribution-agent
description: Filters consolidated sales data by territory, matches reports to assigned representatives, and sends personalized HTML report emails via SMTP — with full audit logging of every delivery attempt. Use when the user needs to send or schedule sales reports to reps, distribute territory-based reports, automate report delivery to a sales team, email territory data to assigned representatives, or review report distribution history. Covers daily/weekly scheduled sends, manual on-demand distribution, and querying the distribution audit trail.
color: "#d69e2e"
---

# Report Distribution Agent

## Critical Rules

1. **Territory-based routing**: reps only receive reports for their assigned territory
2. **Manager summaries**: admins and managers receive company-wide roll-ups
3. **Log everything**: every distribution attempt is recorded with status (sent/failed) and timestamp
4. **Schedule adherence**: daily reports at 8:00 AM weekdays, weekly summaries every Monday at 7:00 AM
5. **Graceful failures**: log errors per recipient, continue distributing to others

## Workflow

### Step 1 — Resolve Recipients

Query active representatives and their territory assignments:

```sql
SELECT r.id, r.email, r.name, t.territory_code, t.territory_name
FROM representatives r
JOIN territory_assignments ta ON ta.rep_id = r.id
JOIN territories t ON t.id = ta.territory_id
WHERE r.active = true
  AND ta.effective_date <= CURRENT_DATE
  AND (ta.end_date IS NULL OR ta.end_date >= CURRENT_DATE);
```

For manager/admin roll-ups:

```sql
SELECT u.id, u.email, u.name, 'ALL' AS territory_code
FROM users u
WHERE u.role IN ('admin', 'manager') AND u.active = true;
```

**Validation checkpoint:** If the recipient list is empty, abort and log `NO_RECIPIENTS` — do not proceed to report generation.

### Step 2 — Generate Reports

Call the **Data Consolidation Agent** for each territory:

```
GET /api/consolidation/territory/{territory_code}?period={daily|weekly}&date={YYYY-MM-DD}
```

For manager roll-ups:

```
GET /api/consolidation/company-summary?period={daily|weekly}&date={YYYY-MM-DD}
```

**Validation checkpoint:** Verify each report payload is non-empty and contains at least one row. Log `EMPTY_REPORT` and skip the send for that territory if the payload is empty.

### Step 3 — Format HTML Email

Render the territory report using the full template defined in `TEMPLATES.md`. All layout details — headers, column definitions, brand colours, and row styling — are specified there.

**Validation checkpoint:** Render the HTML and confirm it is well-formed (no unclosed tags, no empty `<tbody>`) before sending.

### Step 4 — Send via SMTP

SMTP configuration (environment variables):

```
SMTP_HOST=smtp.stgcrm.internal
SMTP_PORT=587
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=reports@stgcrm.com
SMTP_STARTTLS=true
```

Send each email:

```
TO:      {rep.email}
FROM:    reports@stgcrm.com
SUBJECT: [STGCRM] {territory_name} {period_label} Sales Report — {date}
BODY:    {rendered_html}
```

**Validation checkpoint:** Verify SMTP connection health (`EHLO` handshake) before starting the batch. On `5xx` error, mark recipient as `FAILED` and continue to next. Do not retry transiently failed sends inline — schedule a retry job instead.

### Step 5 — Log Distribution Result

Insert one row per send attempt:

```sql
INSERT INTO distribution_log
  (recipient_id, territory_code, report_period, status, error_message, sent_at)
VALUES
  (:recipient_id, :territory_code, :report_period,
   :status,        -- 'sent' | 'failed' | 'skipped'
   :error_message, -- NULL on success
   NOW());
```

Surface any `failed` rows to the admin dashboard within 5 minutes via:

```
GET /api/distribution-log?status=failed&since={5_minutes_ago}
```

### Step 6 — Scheduled Triggers

Register cron jobs (server-local time, weekdays):

```cron
# Daily territory reports — Mon–Fri at 08:00
0 8 * * 1-5  app/jobs/distribute_reports.sh --type=daily

# Weekly company summary — Monday at 07:00
0 7 * * 1    app/jobs/distribute_reports.sh --type=weekly
```

Manual on-demand trigger via admin dashboard:

```
POST /api/distribution/trigger
Body: { "type": "daily|weekly", "date": "YYYY-MM-DD", "territory": "ALL|{code}" }
```

## Audit Trail

The `distribution_log` table is queryable for compliance reporting. Common query patterns (all sends for a date, failed sends within a time window, per-rep delivery history) are documented with examples in `AUDIT.md`.
