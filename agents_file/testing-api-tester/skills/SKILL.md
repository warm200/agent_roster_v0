---
name: api-tester
description: Sends HTTP requests to REST and GraphQL API endpoints, validates response codes, headers, and payloads, measures response times against SLA thresholds, generates structured test suites, and produces test reports covering functional, security, and performance scenarios. Use when the user asks about testing APIs, validating endpoints, checking HTTP status codes or response bodies, load testing, stress testing, debugging REST or GraphQL services, testing authentication flows, checking rate limiting, detecting SQL injection or OWASP API vulnerabilities, or integrating API tests into CI/CD pipelines.
color: purple
---

# API Tester

Applies to REST, GraphQL, and microservice APIs across functional validation, performance testing, security assessment, and CI/CD integration.

## Workflow

### Step 1: Discovery and Analysis
- Enumerate all API endpoints from specs (OpenAPI/Swagger), documentation, or codebase inspection
- Identify authentication mechanisms, data models, and integration dependencies
- Flag high-risk endpoints: unauthenticated routes, file uploads, bulk operations, admin actions

### Step 2: Test Strategy
- Define success criteria and quality gates before writing tests:
  - Response time P95 ≤ 200ms under normal load
  - Error rate < 0.1% under normal load
  - Load tests must sustain 10× normal traffic
  - Zero critical security vulnerabilities
- Choose tooling: Playwright/fetch for functional, k6 for load, OWASP ZAP for security scanning

### Step 3: Test Implementation
Build automated test suites covering all three layers. See `EXAMPLES.md` for the full reference test suite.

**Functional + Security test pattern (Playwright/fetch):**
```javascript
import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.API_BASE_URL;
let authToken: string;

test.beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'secure_password' })
  });
  authToken = (await res.json()).token;
});

// --- Functional ---
test('POST /users — valid data returns 201 with safe payload', async () => {
  const res = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    body: JSON.stringify({ name: 'Test User', email: 'new@example.com', role: 'user' })
  });
  expect(res.status).toBe(201);
  const user = await res.json();
  expect(user.email).toBe('new@example.com');
  expect(user.password).toBeUndefined(); // passwords must never be returned
});

test('POST /users — invalid input returns 400 with error details', async () => {
  const res = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    body: JSON.stringify({ name: '', email: 'invalid-email', role: 'bad_role' })
  });
  expect(res.status).toBe(400);
  expect((await res.json()).errors).toBeDefined();
});

// --- Security ---
test('GET /users — unauthenticated returns 401', async () => {
  expect((await fetch(`${BASE_URL}/users`)).status).toBe(401);
});

test('GET /users — SQL injection in query param does not cause 500', async () => {
  const res = await fetch(`${BASE_URL}/users?search=${encodeURIComponent("'; DROP TABLE users; --")}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  expect(res.status).not.toBe(500);
});

test('GET /users — rate limiting triggers 429 after burst', async () => {
  const responses = await Promise.all(
    Array(100).fill(null).map(() =>
      fetch(`${BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${authToken}` } })
    )
  );
  expect(responses.some(r => r.status === 429)).toBe(true);
});

// --- Performance ---
test('GET /users — P95 response time under 200ms', async () => {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${authToken}` } });
  expect(res.status).toBe(200);
  expect(performance.now() - start).toBeLessThan(200);
});
```

**k6 load test pattern** (save as `load-test.js`, run with `k6 run load-test.js`):
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // ramp to normal load
    { duration: '3m', target: 500 },  // 10× normal load
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // P95 under 200ms
    http_req_failed: ['rate<0.001'],   // error rate under 0.1%
  },
};

export default function () {
  const res = http.get(`${__ENV.API_BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${__ENV.AUTH_TOKEN}` },
  });
  check(res, { 'status 200': r => r.status === 200 });
  sleep(1);
}
```

### Step 4: Validation Checkpoints and Feedback Loops

Execute in this order with explicit gates — **do not proceed if a gate fails**:

1. **Functional gate**: Run functional tests → fix all 4xx/5xx regressions → re-run until 100% pass
2. **Security gate**: Run OWASP ZAP scan (`zap-cli quick-scan --self-contained --start-options '-config api.disablekey=true' $API_BASE_URL`) → triage findings → fix critical/high issues → re-scan before continuing
3. **Performance gate**: Run k6 load test → confirm P95 ≤ 200ms and error rate < 0.1% → identify and fix bottlenecks → re-run until thresholds pass
4. **Integration gate**: Run contract tests against all third-party dependencies → verify fallback handling for dependency failures

### Step 5: Reporting

Use `TEMPLATES.md` for the full test report template. Minimum required fields per report:

```markdown
# [API Name] Test Report — [Date]

## Coverage
- Functional: [N endpoints tested / N total] — [pass/fail counts]
- Security: [OWASP Top 10 items tested] — [critical/high/medium findings]
- Performance: [P95 response time] | [max throughput rps] | [error rate under load]

## Findings
| Severity | Issue | Endpoint | Recommended Fix |
|----------|-------|----------|-----------------|
| Critical | ...   | ...      | ...             |

## Quality Gate Status
| Gate        | Status      | Notes |
|-------------|-------------|-------|
| Functional  | PASS / FAIL | ...   |
| Security    | PASS / FAIL | ...   |
| Performance | PASS / FAIL | ...   |

## Release Recommendation
**Go / No-Go** — [Reason with supporting data]
```

## Security Testing Checklist

For every API under test, verify:
- [ ] All protected endpoints return 401 without valid token
- [ ] Role-based access enforced (user cannot access admin routes)
- [ ] SQL injection payloads handled safely (no 500, no data leak)
- [ ] XSS payloads in string fields reflected safely
- [ ] Rate limiting active on auth and public endpoints
- [ ] Sensitive fields (passwords, secrets) absent from all responses
- [ ] JWT/OAuth tokens validated — reject expired, tampered, and unsigned tokens
- [ ] HTTPS enforced; HTTP redirects or rejects

## Advanced Topics

See `ADVANCED.md` for:
- Consumer-driven contract testing with Pact
- API mocking and service virtualization for isolated environments
- OAuth 2.0 and JWT token manipulation test scenarios
- Microservices and service mesh security testing
- CDN and cache validation strategies
