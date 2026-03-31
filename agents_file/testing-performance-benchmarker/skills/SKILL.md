---
name: performance-benchmarker
description: Runs load tests, profiles application bottlenecks, analyzes response time metrics, and generates performance optimization recommendations. Use when you need to benchmark a system, run load or stress tests, measure latency or throughput, identify performance bottlenecks, optimize Core Web Vitals (LCP, FID, CLS), plan capacity, enforce performance budgets in CI/CD pipelines, or investigate slow API response times, database query performance, or frontend rendering delays.
color: orange
---

# Performance Benchmarker

Measures, analyzes, and optimizes system performance through concrete testing, profiling, and data-driven recommendations. Covers load testing, web performance, database tuning, infrastructure scaling, and CI/CD quality gates.

---

## Workflow

### Step 1: Establish Baseline and Requirements
1. Identify critical user journeys and target endpoints.
2. Run an initial baseline test at low load (e.g., 1–5 VUs) and record p50, p95, p99 response times, error rate, and throughput.
3. Confirm SLA targets with stakeholders (e.g., p95 < 500ms, error rate < 1%).
4. Set up monitoring/data collection before any optimization work begins.

### Step 2: Design and Execute Test Scenarios
Choose the appropriate test type and run it:

| Test Type | Purpose | Key Signal |
|-----------|---------|-----------|
| Load | Validate normal + peak traffic | p95 response time, error rate |
| Stress | Find breaking point | Error spike, latency cliff |
| Spike | Sudden traffic surge recovery | Recovery time after spike |
| Endurance | Memory leaks, long-run drift | Resource growth over time |
| Scalability | Horizontal/vertical scaling limits | Perf degradation per added node |

**Run with k6:**
```bash
k6 run --out json=results.json script.js
```

**Validation checkpoint**: If error rate exceeds 1% during ramp-up, reduce VU count by 50% and re-run to isolate the failing endpoint before proceeding.

### Step 3: Analyze Results and Identify Bottlenecks
After each run:
1. Check thresholds: `p(95) < 500`, `http_req_failed rate < 0.01`.
2. If thresholds fail, triage by layer:
   - **Database**: Check slow query logs; run `EXPLAIN ANALYZE` on top offenders.
   - **Application**: Profile with language-specific tools (e.g., `py-spy`, `async-profiler`, Chrome DevTools).
   - **Network/CDN**: Compare TTFB with and without CDN; check cache hit ratio.
   - **Frontend**: Run Lighthouse or WebPageTest; check LCP, FID/INP, CLS against thresholds.
3. Reproduce the bottleneck in isolation before recommending a fix.

### Step 4: Apply Optimizations and Validate
For each optimization:
1. Apply one change at a time to isolate impact.
2. Re-run the same test scenario used in baseline.
3. Compare before/after: p95 response time, error rate, throughput, resource utilization.
4. **Accept the change only if improvement is statistically significant** (run 3 iterations; variance < 10%).

### Step 5: Monitoring and CI/CD Integration
- Add performance thresholds as quality gates in the deployment pipeline.
- Fail builds when p95 exceeds budget or error rate climbs above 1%.
- Set up alerting on p95 response time trends and error rate spikes in production.

---

## k6 Load Test Script

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Warm-up
    { duration: '5m', target: 50 },   // Normal load
    { duration: '2m', target: 100 },  // Peak load
    { duration: '5m', target: 100 },  // Sustained peak
    { duration: '2m', target: 200 },  // Stress
    { duration: '3m', target: 0 },    // Cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';

  // Authenticate and test a critical user journey
  const loginRes = http.post(`${baseUrl}/api/auth/login`, {
    email: 'test@example.com',
    password: 'password123',
  });
  check(loginRes, { 'login 200': (r) => r.status === 200 });

  if (loginRes.status === 200) {
    const token = loginRes.json('token');
    const apiRes = http.get(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check(apiRes, {
      'dashboard 200': (r) => r.status === 200,
      'dashboard < 300ms': (r) => r.timings.duration < 300,
    });
  }

  sleep(1); // Realistic think time
}

export function handleSummary(data) {
  return { 'performance-report.json': JSON.stringify(data) };
}
```

**If error rate > 1% at any stage**: stop the test, check application logs for the failing endpoint, fix the issue, and restart from Step 2.

---

## Core Web Vitals Fixes

**Common fixes by metric:**
- **LCP slow**: Preload hero image (`<link rel="preload">`), serve via CDN, compress with WebP/AVIF.
- **FID/INP high**: Break up long tasks (`setTimeout` chunking), defer non-critical JS, reduce main-thread blocking.
- **CLS high**: Reserve space for images/ads (`width`/`height` attributes or `aspect-ratio`), avoid injecting content above fold.

Measure with: `Lighthouse`, `WebPageTest`, or field data via `web-vitals` JS library + RUM pipeline.

---

## Performance Report Template

See [REPORT_TEMPLATE.md](./REPORT_TEMPLATE.md) for the full structured report template covering test configuration, results summary (p50/p95/p99, error rate, throughput), bottleneck findings, optimizations applied, SLA pass/fail status, and next steps.

---

## Capacity Planning Quick Reference

See [CAPACITY_PLANNING.md](./CAPACITY_PLANNING.md) for horizontal/vertical scaling tests, auto-scaling validation steps, and growth forecasting guidance.
