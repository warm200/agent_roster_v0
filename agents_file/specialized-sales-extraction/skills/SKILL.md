---
name: sales-data-extraction-agent
description: Monitors Excel spreadsheets (.xlsx/.xls) and extracts key sales metrics (MTD, YTD, Year End) to generate internal live reports. Use when the user needs to parse sales reports, track revenue figures, pull MTD/YTD data from a spreadsheet, build a sales dashboard, or automate extraction of sales performance data from Excel files into a database.
color: "#2b6cb0"
---

# Sales Data Extraction Agent

## Quick Start

This agent watches a directory for Excel workbooks, parses sales metrics from named sheets (MTD, YTD, Year End), maps flexible column schemas via fuzzy matching, validates rows, bulk-inserts results into PostgreSQL, and logs every import. It emits a completion event for downstream agents and dashboards.

## Critical Rules

1. **Never overwrite** existing metrics without a clear update signal (new file version)
2. **Always log** every import: file name, rows processed, rows failed, timestamps
3. **Match representatives** by email or full name; skip unmatched rows with a warning
4. **Handle flexible schemas**: use fuzzy column name matching for revenue, units, deals, quota
5. **Detect metric type** from sheet names (MTD, YTD, Year End) with sensible defaults
6. **Ignore** temporary Excel lock files (`~$`) and wait for write completion before processing

## Excel Input Structure (Expected)

Workbooks typically contain one or more sheets named after the metric type. Example:

```
Sheet: "MTD"
| rep_email             | rep_name     | revenue   | units | quota     | deals |
|-----------------------|--------------|-----------|-------|-----------|-------|
| alice@example.com     | Alice Smith  | $124,500  | 83    | $100,000  | 12    |
| bob@example.com       | Bob Jones    | $98,200   | 61    | $120,000  | 9     |

Sheet: "YTD"
| rep_email             | rep_name     | total_sales | qty | annual_quota |
|-----------------------|--------------|-------------|-----|--------------|
| alice@example.com     | Alice Smith  | $1,340,000  | 890 | $1,200,000   |
```

Column names vary — use fuzzy matching (see below).

## Technical Specifications

### 1. File Monitoring

Use `watchdog` (`Observer` + `FileSystemEventHandler`) to watch `WATCH_DIR` for `.xlsx`/`.xls` creates and modifications. Before processing, poll file size at 1-second intervals (up to 10 retries) and proceed only when size stabilises. Skip filenames starting with `~$`.

```python
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

WATCH_DIR = "/data/sales_imports"
STABLE_RETRIES = 10
STABLE_INTERVAL = 1  # seconds

class SalesFileHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            self._handle(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._handle(event.src_path)

    def _handle(self, path):
        if not path.endswith((".xlsx", ".xls")):
            return
        if os.path.basename(path).startswith("~$"):
            return
        if self._wait_until_stable(path):
            process_workbook(path)

    def _wait_until_stable(self, path):
        prev_size = -1
        for _ in range(STABLE_RETRIES):
            size = os.path.getsize(path)
            if size == prev_size:
                return True
            prev_size = size
            time.sleep(STABLE_INTERVAL)
        return False  # never stabilised; skip

observer = Observer()
observer.schedule(SalesFileHandler(), WATCH_DIR, recursive=False)
observer.start()
```

### 2. Fuzzy Column Mapping

Use `rapidfuzz` with `fuzz.token_sort_ratio` at threshold ≥ 80. Iterate all aliases per canonical name and keep the highest-scoring match.

Canonical → alias list:
- `revenue` → `["revenue", "sales", "total_sales", "amount", "gross_sales"]`
- `units` → `["units", "qty", "quantity", "volume"]`
- `quota` → `["quota", "target", "annual_quota", "monthly_quota"]`
- `deals` → `["deals", "opportunities", "closed_won"]`
- `rep_email` → `["rep_email", "email", "email_address"]`
- `rep_name` → `["rep_name", "name", "full_name", "salesperson"]`

```python
from rapidfuzz import fuzz

COLUMN_ALIASES = {
    "revenue":   ["revenue", "sales", "total_sales", "amount", "gross_sales"],
    "units":     ["units", "qty", "quantity", "volume"],
    "quota":     ["quota", "target", "annual_quota", "monthly_quota"],
    "deals":     ["deals", "opportunities", "closed_won"],
    "rep_email": ["rep_email", "email", "email_address"],
    "rep_name":  ["rep_name", "name", "full_name", "salesperson"],
}
FUZZY_THRESHOLD = 80

def map_columns(actual_columns: list[str]) -> dict[str, str]:
    """Return {canonical_name: actual_column} for all matched columns."""
    mapping = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        best_score, best_col = 0, None
        for col in actual_columns:
            score = max(fuzz.token_sort_ratio(col.lower(), alias) for alias in aliases)
            if score > best_score:
                best_score, best_col = score, col
        if best_score >= FUZZY_THRESHOLD:
            mapping[canonical] = best_col
    return mapping
```

### 3. Metric Type Detection

Match sheet name (lowercased) against keyword groups:
- `MTD` → `["mtd", "month to date", "monthly"]`
- `YTD` → `["ytd", "year to date", "annual"]`
- `YEAR_END` → `["year end", "yearend", "projection", "forecast"]`
- Fallback: `"UNKNOWN"`

```python
METRIC_KEYWORDS = {
    "MTD":      ["mtd", "month to date", "monthly"],
    "YTD":      ["ytd", "year to date", "annual"],
    "YEAR_END": ["year end", "yearend", "projection", "forecast"],
}

def detect_metric_type(sheet_name: str) -> str:
    lower = sheet_name.lower()
    for metric, keywords in METRIC_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return metric
    return "UNKNOWN"
```

### 4. Row Extraction & Validation

For each row:
- Strip `$` and commas from currency fields, cast to `float`; return `None` on failure
- Require at least one of `rep_email` / `rep_name`; log a warning and skip otherwise
- Compute `quota_attainment = round(revenue / quota, 4)` when both are non-null
- Normalise `rep_email` to lowercase, stripped

```python
import logging

def parse_currency(value) -> float | None:
    try:
        return float(str(value).replace("$", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return None

def extract_row(raw: dict, col_map: dict, metric_type: str, source_file: str) -> dict | None:
    get = lambda key: raw.get(col_map[key]) if key in col_map else None

    rep_email = (get("rep_email") or "").strip().lower() or None
    rep_name  = (get("rep_name")  or "").strip()         or None

    if not rep_email and not rep_name:
        logging.warning("Skipping row — no rep_email or rep_name: %s", raw)
        return None

    revenue = parse_currency(get("revenue"))
    quota   = parse_currency(get("quota"))
    quota_attainment = round(revenue / quota, 4) if revenue and quota else None

    return {
        "rep_email": rep_email,
        "rep_name":  rep_name,
        "metric_type": metric_type,
        "revenue":  revenue,
        "units":    get("units"),
        "quota":    quota,
        "deals":    get("deals"),
        "quota_attainment": quota_attainment,
        "source_file": source_file,
    }
```

### 5. PostgreSQL Schema

```sql
CREATE TABLE sales_metrics (
    id               SERIAL PRIMARY KEY,
    rep_email        TEXT,
    rep_name         TEXT,
    metric_type      TEXT NOT NULL,       -- MTD | YTD | YEAR_END
    revenue          NUMERIC(14,2),
    units            INTEGER,
    quota            NUMERIC(14,2),
    deals            INTEGER,
    quota_attainment NUMERIC(6,4),
    source_file      TEXT NOT NULL,
    imported_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE import_log (
    id             SERIAL PRIMARY KEY,
    source_file    TEXT NOT NULL,
    status         TEXT NOT NULL,         -- processing | success | failed
    rows_processed INTEGER,
    rows_failed    INTEGER,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    error_message  TEXT
);
```

### 6. Bulk Insert & Post-Insert Verification

Use `psycopg2.extras.execute_values` for bulk inserts within a single transaction. After the insert, verify the row count matches and rollback on mismatch.

```python
import psycopg2
import psycopg2.extras

INSERT_SQL = """
INSERT INTO sales_metrics
    (rep_email, rep_name, metric_type, revenue, units, quota, deals,
     quota_attainment, source_file)
VALUES %s
"""

def bulk_insert(conn, records: list[dict], source_file: str):
    tuples = [
        (r["rep_email"], r["rep_name"], r["metric_type"], r["revenue"],
         r["units"], r["quota"], r["deals"], r["quota_attainment"], r["source_file"])
        for r in records
    ]
    with conn:  # auto-commit / rollback context
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(cur, INSERT_SQL, tuples)
            # Post-insert verification
            cur.execute(
                "SELECT COUNT(*) FROM sales_metrics WHERE source_file = %s",
                (source_file,)
            )
            inserted = cur.fetchone()[0]
            if inserted != len(records):
                raise ValueError(
                    f"Count mismatch: expected {len(records)}, found {inserted}"
                )
```

## Workflow

```
1. File detected in watch directory
       │
       ▼
2. Log import as "processing" in import_log (record started_at)
       │
       ▼
3. Read workbook with openpyxl/pandas; iterate sheets
       │
       ▼
4. Detect metric type per sheet name
       │
       ▼
5. Map columns via fuzzy matching; parse & clean each row
       │
       ▼ [VALIDATION CHECKPOINT]
       │  - Confirm at least one of rep_email / rep_name present
       │  - Confirm revenue is numeric after currency stripping
       │  - Log & skip invalid rows; track rows_failed count
       ▼
6. Bulk insert validated records in a single transaction
       │
       ▼ [POST-INSERT VERIFICATION]
       │  - SELECT COUNT(*) WHERE source_file = <this file>
       │  - Confirm inserted count == len(valid_records)
       │  - ROLLBACK and raise alert if counts mismatch
       ▼
7. Update import_log: status="success", rows_processed, rows_failed, completed_at
       │
       ▼
8. Emit completion event for downstream agents / dashboards
```

## Error Recovery

On any exception during `process_workbook`:
- Log the error message with `logging.error`
- Update `import_log` with `status="failed"`, partial counts, and `error_message`
- The `psycopg2` context manager automatically rolls back the transaction on exception
- Unprocessed rows remain uninserted; the import is safe to retry on a corrected file
