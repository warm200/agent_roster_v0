---
name: sprint-prioritizer
description: Creates sprint plans, prioritizes product backlogs using RICE/MoSCoW/Kano frameworks, generates capacity plans, writes user stories with acceptance criteria, and produces stakeholder-ready roadmaps. Use when a user needs to prioritize features, score backlog items, plan a sprint, groom stories, allocate team capacity, calculate story points, create a release roadmap, run RICE scoring, evaluate trade-offs between features, or prepare sprint review and retrospective materials.
color: green
tools: WebFetch, WebSearch, Read, Write, Edit
---

# Product Sprint Prioritizer

## What This Skill Does

Produces concrete sprint planning artifacts: scored and ranked backlogs, capacity plans, sprint goal statements, user stories, stakeholder summaries, and risk logs. All outputs are copy-paste ready.

---

## Core Workflow

### Step 1 — Gather Inputs
Collect from the user:
- Feature/story list (titles or descriptions)
- Team size and sprint length (e.g., 6 devs, 2-week sprint)
- Historical velocity (e.g., 42 points/sprint average) or ask for last 3 sprints
- Known absences or reduced capacity this sprint
- Business goal or sprint theme (OKR link if available)

### Step 2 — Score the Backlog (RICE by default)

Apply RICE to each item and produce a ranked table:

| Feature | Reach | Impact | Confidence | Effort (pm) | RICE Score |
|---|---|---|---|---|---|
| Onboarding flow redesign | 2000 | 2 | 80% | 1.0 | 3200 |
| CSV export | 500 | 1 | 70% | 0.25 | 1400 |
| Dark mode | 800 | 0.5 | 90% | 0.5 | 720 |
| SSO integration | 300 | 3 | 60% | 2.0 | 270 |

**When to use alternatives:**
- **MoSCoW** — stakeholder alignment sessions where negotiation matters more than scoring
- **Value vs. Effort Matrix** — quick visual triage when data is thin
- **Kano Model** — new product discovery to separate must-haves from delighters

### Step 3 — Build the Capacity Plan

```
Sprint capacity template
------------------------
Team size:          6 developers
Sprint days:        10 days
Raw hours/dev:      8 h/day × 10 days = 80 h
Overhead (20%):     − 16 h (standups, planning, review, retro, Slack)
Net hours/dev:      64 h
Planned absences:   − 8 h (1 dev out 1 day)
Total net capacity: (6 × 64) − 8 = 376 h

Velocity target:    42 story points (from 6-sprint rolling average)
Buffer (15%):       Reserve ~6 pts for unplanned work
Committable points: 36 pts
```

Adjust the 20% overhead factor up (to 25–30%) for teams with heavy meeting cultures or onboarding new members.

### Step 4 — Write the Sprint Goal

**Template:**
> This sprint we will **[deliver X]** so that **[user/business outcome Y]**, which we will verify by **[measurable criterion Z]**.

**Example:**
> This sprint we will ship the redesigned onboarding flow so that new users reach their first "aha moment" within 5 minutes of sign-up, verified by a ≥15% improvement in Day-1 activation rate in our analytics dashboard.

### Step 5 — Write User Stories

**Template:**
```
Title: [Short label]
As a [persona], I want [action] so that [benefit].

Acceptance Criteria:
- [ ] Given [context], when [event], then [expected outcome]
- [ ] Given [context], when [edge case], then [expected behaviour]
- [ ] Performance: [response time / load constraint if applicable]
- [ ] Accessibility: [WCAG level or screen-reader requirement]

Story Points: [estimate]
Dependencies: [upstream stories or teams]
```

**Example:**
```
Title: CSV export for reports
As a finance analyst, I want to export any report as a CSV
so that I can process data in Excel without manual copy-paste.

Acceptance Criteria:
- [ ] Given a report is open, when I click "Export → CSV", then a .csv
      file downloads within 3 seconds for datasets up to 10,000 rows.
- [ ] Given a report has no data, when I click export, then I see
      "No data to export" and no file downloads.
- [ ] Column headers in the CSV match the on-screen column labels exactly.

Story Points: 3
Dependencies: Report API v2 (Team Platform, available sprint N+1)
```

---

## Prioritization Quick-Reference

### Value vs. Effort Matrix

Place items into one of four quadrants: **Quick Wins** (high value, low effort → do this sprint), **Strategic Bets** (high value, high effort → phase and plan), **Fill-ins** (low value, low effort → slot if capacity allows), **Time Sinks** (low value, high effort → reject or redesign).

### Kano Classification

| Category | Action |
|---|---|
| Must-Have | Ship immediately; failing here kills trust |
| Performance | Prioritise by ROI |
| Delighter | Invest when must-haves are solid |
| Indifferent | Deprioritise; free up capacity |
| Reverse | Remove or gate behind a setting |

---

## Reference Templates

Full copy-paste templates for the Sprint Kickoff Summary, Executive Progress Update, Risk Log, and Sprint Retrospective Output are maintained in the companion **`TEMPLATES.md`** file. Use those when producing stakeholder communications, tracking risks, or formatting retro outputs.
