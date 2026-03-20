#!/usr/bin/env python3
"""
scan_agent_risks_v3.py

Purpose:
- Scan agent folders under a root directory.
- Read IDENTITY.md, SOUL.md, and skills/SKILL.md.
- Optionally merge Cisco skill-scanner output.
- Produce front-end-friendly JSON risk reports.

v3 changes:
- Downgrade workflow/demo bash fenced blocks unless nearby context implies real command execution.
- Split network detection into:
  - descriptive API/domain language (non-risk-driving)
  - actual network action language (risk-driving)
- Keep scanner INFO findings from driving user-facing risk.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SEVERITY_ORDER = {
    "INFO": 0,
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "CRITICAL": 4,
}


@dataclass
class Finding:
    code: str
    severity: str
    category: str
    title: str
    description: str
    file_path: str | None = None
    evidence: str | None = None
    remediation: str | None = None
    source: str = "local"
    risk_driving: bool = True


@dataclass
class AgentReport:
    agent_slug: str
    display_name: str
    agent_path: str
    risk_level: str
    capability_flags: dict[str, bool]
    summary: str
    findings: list[dict[str, Any]]
    scanner_findings_count: int
    scanner_max_severity: str | None
    scanner_safe: bool | None
    scanner_error: str | None
    generated_at: str


RULES = [
    {
        "code": "SHELL_EXECUTION",
        "severity": "MEDIUM",
        "category": "capability",
        "title": "Shell or command execution behavior detected",
        "description": "The agent text contains strong signals that it may execute terminal or shell commands.",
        "flag": "shell",
        "remediation": "Require explicit user confirmation before command execution and disclose command scope clearly.",
        "patterns": [
            r"\b(run|execute)\s+(?:the\s+)?(?:following\s+)?(?:shell|bash|terminal|command)\b",
            r"\b(os\.system|subprocess\.(?:run|Popen|call)|child_process\.|exec\()",
            r"\b(?:curl|wget)\b[^\n]{0,80}\|\s*(?:bash|sh|zsh)\b",
            r"\bchmod\s+\+x\b",
            r"\b(?:rm|mv|cp|sed|awk|grep)\s+-",
        ],
    },
    {
        "code": "NETWORK_ACTION",
        "severity": "MEDIUM",
        "category": "capability",
        "title": "External network action detected",
        "description": "The agent text contains strong signals that it may browse, fetch, call APIs, or contact external services.",
        "flag": "network_action",
        "remediation": "Disclose outbound calls clearly and limit external requests to user-approved targets.",
        "patterns": [
            r"https?://[^\s)\]]+",
            r"\b(?:fetch|send|make|issue|perform|call|invoke)\s+(?:an\s+|a\s+)?(?:http|https|web|api|rest|graphql|network)\s+(?:request|call)\b",
            r"\b(?:browse|visit|open|search)\s+(?:the\s+)?web\b",
            r"\bwebhook\b[^\n]{0,50}\b(?:post|send|call|deliver|invoke)\b",
            r"\brequests\.(?:get|post|put|patch|delete)\b",
            r"\bfetch\s*\(",
            r"\baxios\.(?:get|post|put|patch|delete)\b",
            r"\b(?:GET|POST|PUT|PATCH|DELETE)\s+https?://",
        ],
    },
    {
        "code": "NETWORK_DESCRIPTION",
        "severity": "INFO",
        "category": "descriptive_capability",
        "title": "API or integration domain language detected",
        "description": "The agent text discusses APIs, webhooks, or integrations, but does not clearly indicate direct outbound action.",
        "flag": "network_description",
        "remediation": "No direct action needed; verify whether the agent actually performs outbound requests.",
        "patterns": [
            r"\bREST\b",
            r"\bGraphQL\b",
            r"\bwebhook(?:s)?\b",
            r"\bAPI(?:s)?\b",
            r"\bintegration(?:s)?\b",
            r"\bcallback(?:s)?\b",
            r"\bendpoint(?:s)?\b",
        ],
        "risk_driving": False,
    },
    {
        "code": "FILE_WRITE",
        "severity": "MEDIUM",
        "category": "capability",
        "title": "File or code modification behavior detected",
        "description": "The agent text contains strong signals that it may create, edit, patch, overwrite, or delete files or code.",
        "flag": "file_write",
        "remediation": "Make file modification intent visible before changes are applied.",
        "patterns": [
            r"\b(?:write|edit|modify|update|patch|overwrite|delete|remove|create)\s+(?:the\s+)?(?:file|files|code|source|repo|repository|config|configuration|document|documentation|yaml|json|markdown)\b",
            r"\b(save|apply)\s+(?:the\s+)?changes\b",
            r"\bcreate\s+(?:a\s+)?(?:new\s+)?file\b",
            r"\bdelete\s+(?:a\s+)?file\b",
            r"\bmodify\s+(?:the\s+)?codebase\b",
            r"\bedit\s+(?:the\s+)?repository\b",
        ],
    },
    {
        "code": "SECRET_HANDLING",
        "severity": "HIGH",
        "category": "sensitive_access",
        "title": "Credential or secret handling behavior detected",
        "description": "The agent text contains strong signals that it may read, use, inject, or transmit secrets or credentials.",
        "flag": "secrets",
        "remediation": "Never embed secrets in prompts or source files; require secure secret injection and scoped access.",
        "patterns": [
            r"\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|bearer\s+[a-z0-9._-]+|password|client[_ -]?secret|webhook[_ -]?secret)\b",
            r"\b(?:read|load|store|save|use|inject|pass|forward|send|transmit|retrieve)\s+(?:the\s+)?(?:secret|secrets|credential|credentials|token|api[_ -]?key|password)\b",
            r"\b\.env\b",
            r"\bsecret manager\b",
        ],
    },
    {
        "code": "HIDDEN_BEHAVIOR",
        "severity": "HIGH",
        "category": "safety",
        "title": "Hidden or bypass-style behavior detected",
        "description": "The agent text suggests silent actions, concealment, or bypassing user-visible safeguards.",
        "flag": "hidden_behavior",
        "remediation": "Remove hidden-action language and require explicit disclosure before sensitive steps.",
        "patterns": [
            r"\bwithout\s+(?:asking|user\s+confirmation|informing\s+the\s+user|telling\s+the\s+user)\b",
            r"\bsilently\s+(?:modify|change|edit|update|delete|send|run|execute)\b",
            r"\bdo\s+not\s+(?:mention|tell|inform)\s+(?:the\s+)?user\b",
            r"\bconceal\s+(?:the\s+)?(?:change|changes|action|actions|behavior)\b",
            r"\bbypass\s+(?:the\s+)?(?:policy|policies|guardrails|safeguards|security\s+checks)\b",
            r"\bignore\s+(?:the\s+)?(?:policy|policies|guardrails|safety\s+rules|security\s+rules)\b",
        ],
    },
]

BASH_FENCE_PATTERN = re.compile(r"```(?:bash|sh|shell|zsh)\b([\s\S]{0,500}?)```", re.IGNORECASE)
BASH_EXEC_CONTEXT = re.compile(
    r"\b(run|execute|terminal|command|script|subprocess|os\.system|install|copy\s+and\s+run|paste\s+into\s+your\s+terminal)\b",
    re.IGNORECASE,
)
BASH_DEMO_CONTEXT = re.compile(
    r"\b(step\s*\d+|workflow|analysis|assessment|plan|strategy|phase|example|demo|illustrative|pseudocode)\b",
    re.IGNORECASE,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate risk reports for agent folders.")
    parser.add_argument("root", type=Path, help="Root directory containing agent folders")
    parser.add_argument("--output", type=Path, default=Path("agent-risk-report.json"))
    parser.add_argument("--per-agent-dir", type=Path, default=None)
    parser.add_argument("--with-skill-scanner", action="store_true")
    parser.add_argument("--skill-scanner-bin", default="skill-scanner")
    parser.add_argument("--lenient", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    return parser.parse_args()


def load_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def extract_snippet(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        return None
    start = max(0, match.start() - 60)
    end = min(len(text), match.end() + 100)
    return text[start:end].replace("\n", " ").strip()[:240]


def first_bash_fence(text: str) -> str | None:
    match = BASH_FENCE_PATTERN.search(text)
    if not match:
        return None
    snippet = match.group(0).replace("\n", " ").strip()
    return snippet[:240]


def bash_fence_is_risk_driving(text: str) -> bool:
    match = BASH_FENCE_PATTERN.search(text)
    if not match:
        return False
    full_block = match.group(0)
    start = max(0, match.start() - 180)
    end = min(len(text), match.end() + 180)
    context = text[start:end]

    has_exec_context = bool(BASH_EXEC_CONTEXT.search(context) or BASH_EXEC_CONTEXT.search(full_block))
    has_demo_context = bool(BASH_DEMO_CONTEXT.search(context))
    if has_exec_context:
        return True
    if has_demo_context:
        return False
    return False


def normalize_display_name(agent_slug: str, skill_name: str | None) -> str:
    if skill_name:
        return skill_name
    return agent_slug.replace("-", " ").replace("_", " ").title()


def max_severity(findings: list[Finding] | list[dict[str, Any]]) -> str | None:
    if not findings:
        return None
    highest = "INFO"
    for finding in findings:
        sev = finding.severity if isinstance(finding, Finding) else str(finding.get("severity", "INFO"))
        if SEVERITY_ORDER.get(sev, -1) > SEVERITY_ORDER.get(highest, -1):
            highest = sev
    return highest


def risk_level_from_findings(findings: list[Finding]) -> str:
    highest = max_severity(findings) or "INFO"
    if highest in {"CRITICAL", "HIGH"}:
        return "high"
    if highest == "MEDIUM":
        return "medium"
    if highest == "LOW":
        return "low"
    return "info"


def analyze_local_files(file_texts: dict[str, str]) -> tuple[list[Finding], dict[str, bool]]:
    findings: list[Finding] = []
    flags = {
        "shell": False,
        "network": False,
        "network_description": False,
        "file_write": False,
        "secrets": False,
        "hidden_behavior": False,
    }
    seen: set[tuple[str, str]] = set()

    for file_path, text in file_texts.items():
        # Special handling for bash fenced blocks.
        if BASH_FENCE_PATTERN.search(text):
            if bash_fence_is_risk_driving(text):
                key = ("SHELL_EXECUTION", file_path)
                if key not in seen:
                    seen.add(key)
                    flags["shell"] = True
                    findings.append(
                        Finding(
                            code="SHELL_EXECUTION",
                            severity="MEDIUM",
                            category="capability",
                            title="Shell or command execution behavior detected",
                            description="The agent text includes a bash-style command block with nearby context suggesting real execution.",
                            file_path=file_path,
                            evidence=first_bash_fence(text),
                            remediation="Require explicit user confirmation before command execution and disclose command scope clearly.",
                            source="local",
                            risk_driving=True,
                        )
                    )
            else:
                key = ("BASH_WORKFLOW_EXAMPLE", file_path)
                if key not in seen:
                    seen.add(key)
                    findings.append(
                        Finding(
                            code="BASH_WORKFLOW_EXAMPLE",
                            severity="INFO",
                            category="descriptive_capability",
                            title="Bash-style workflow example detected",
                            description="The agent text includes a bash fenced block, but nearby context suggests it is illustrative rather than executable agent behavior.",
                            file_path=file_path,
                            evidence=first_bash_fence(text),
                            remediation="No direct action needed unless the agent actually executes these commands.",
                            source="local",
                            risk_driving=False,
                        )
                    )

        for rule in RULES:
            for pattern in rule["patterns"]:
                if re.search(pattern, text, flags=re.IGNORECASE):
                    key = (rule["code"], file_path)
                    if key in seen:
                        break
                    seen.add(key)
                    flags[rule["flag"]] = True
                    findings.append(
                        Finding(
                            code=rule["code"],
                            severity=rule["severity"],
                            category=rule["category"],
                            title=rule["title"],
                            description=rule["description"],
                            file_path=file_path,
                            evidence=extract_snippet(text, pattern),
                            remediation=rule["remediation"],
                            source="local",
                            risk_driving=rule.get("risk_driving", True),
                        )
                    )
                    break

    # Derived user-facing network flag should only reflect actual network action.
    if "network_action" in flags:
        flags["network"] = flags["network_action"]
        del flags["network_action"]

    # Compound high risk only when underlying findings are high-confidence and risk-driving.
    if flags["shell"] and flags["network"]:
        findings.append(
            Finding(
                code="COMBINED_SHELL_NETWORK",
                severity="HIGH",
                category="compound_risk",
                title="Shell execution plus external network access",
                description="The agent appears capable of both command execution and external network access.",
                remediation="Gate this agent behind explicit approval and narrow execution scope.",
                source="local",
                risk_driving=True,
            )
        )

    if flags["secrets"] and flags["network"]:
        findings.append(
            Finding(
                code="COMBINED_SECRET_NETWORK",
                severity="HIGH",
                category="compound_risk",
                title="Credential handling plus external network access",
                description="The agent appears capable of handling credentials while also contacting external services.",
                remediation="Require scoped secret access and strict outbound controls.",
                source="local",
                risk_driving=True,
            )
        )

    return findings, flags


def run_skill_scanner(skill_scanner_bin: str, skill_dir: Path, lenient: bool) -> tuple[dict[str, Any] | None, str | None]:
    cmd = [skill_scanner_bin, "scan", str(skill_dir), "--format", "json"]
    if lenient:
        cmd.append("--lenient")

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return None, f"skill-scanner binary not found: {skill_scanner_bin}"
    except Exception as exc:
        return None, f"failed to execute skill-scanner: {exc}"

    if proc.returncode != 0:
        return None, (proc.stderr or proc.stdout or f"skill-scanner exited with code {proc.returncode}").strip()

    raw = (proc.stdout or "").strip()
    if not raw:
        return None, "skill-scanner returned empty output"

    try:
        return json.loads(raw), None
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(raw[start : end + 1]), None
            except json.JSONDecodeError:
                pass
        return None, "skill-scanner output was not valid JSON"


def convert_scanner_findings(scanner_result: dict[str, Any] | None) -> list[Finding]:
    if not scanner_result:
        return []
    converted: list[Finding] = []
    for item in scanner_result.get("findings", []):
        converted.append(
            Finding(
                code=item.get("rule_id") or item.get("id") or "SCANNER_FINDING",
                severity=str(item.get("severity") or "INFO").upper(),
                category=item.get("category") or "scanner",
                title=item.get("title") or "Scanner finding",
                description=item.get("description") or "",
                file_path=item.get("file_path"),
                evidence=item.get("snippet"),
                remediation=item.get("remediation"),
                source="skill-scanner",
                risk_driving=str(item.get("severity") or "INFO").upper() not in {"INFO"},
            )
        )
    return converted


def make_summary(display_name: str, risk_level: str, flags: dict[str, bool], total_findings: int) -> str:
    enabled = [k for k, v in flags.items() if v and k != "network_description"]
    if not enabled:
        if flags.get("network_description"):
            return f"{display_name} mainly describes APIs or integrations, but no high-confidence outbound behavior was detected. {total_findings} total findings were recorded."
        return f"{display_name} shows no high-confidence risky behavior phrases in the local agent files. {total_findings} total findings were recorded."
    label = ", ".join(enabled)
    if risk_level == "high":
        return f"{display_name} shows higher-confidence risk signals related to: {label}. Review before broad exposure."
    if risk_level == "medium":
        return f"{display_name} shows caution-level signals related to: {label}. Display a warning badge in the UI."
    return f"{display_name} shows limited risk signals related to: {label}. {total_findings} total findings were recorded."


def analyze_agent(agent_dir: Path, args: argparse.Namespace) -> AgentReport:
    agent_slug = agent_dir.name
    relevant_paths = [
        agent_dir / "IDENTITY.md",
        agent_dir / "SOUL.md",
        agent_dir / "skills" / "SKILL.md",
    ]

    file_texts: dict[str, str] = {}
    for path in relevant_paths:
        if path.exists() and path.is_file():
            file_texts[str(path.relative_to(agent_dir))] = load_text(path)

    local_findings, flags = analyze_local_files(file_texts)

    scanner_result = None
    scanner_error = None
    skill_dir = agent_dir / "skills"
    if args.with_skill_scanner and skill_dir.exists():
        scanner_result, scanner_error = run_skill_scanner(args.skill_scanner_bin, skill_dir, args.lenient)

    scanner_findings = convert_scanner_findings(scanner_result)

    risk_driving_findings = [f for f in local_findings + scanner_findings if f.risk_driving]
    risk_level = risk_level_from_findings(risk_driving_findings)

    all_findings = local_findings + scanner_findings
    display_name = normalize_display_name(agent_slug, scanner_result.get("skill_name") if scanner_result else None)
    summary = make_summary(display_name, risk_level, flags, len(all_findings))

    return AgentReport(
        agent_slug=agent_slug,
        display_name=display_name,
        agent_path=str(agent_dir),
        risk_level=risk_level,
        capability_flags=flags,
        summary=summary,
        findings=[asdict(f) for f in all_findings],
        scanner_findings_count=len(scanner_findings),
        scanner_max_severity=max_severity(scanner_findings),
        scanner_safe=scanner_result.get("is_safe") if scanner_result else None,
        scanner_error=scanner_error,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def write_json(path: Path, payload: Any, pretty: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        if pretty:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        else:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")


def main() -> int:
    args = parse_args()
    root = args.root
    if not root.exists() or not root.is_dir():
        print(f"error: invalid root directory: {root}", file=sys.stderr)
        return 2

    reports: list[AgentReport] = []
    for agent_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        reports.append(analyze_agent(agent_dir, args))

    aggregate = {
        "root": str(root),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "agents_count": len(reports),
        "reports": [asdict(r) for r in reports],
    }

    write_json(args.output, aggregate, args.pretty)
    if args.per_agent_dir:
        args.per_agent_dir.mkdir(parents=True, exist_ok=True)
        for report in reports:
            write_json(args.per_agent_dir / f"{report.agent_slug}.json", asdict(report), args.pretty)

    print(f"Wrote aggregate report: {args.output}")
    if args.per_agent_dir:
        print(f"Wrote per-agent reports: {args.per_agent_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
