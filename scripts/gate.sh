#!/usr/bin/env bash
# gate.sh — quality gate for the agent-roster monorepo
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

step() { printf "\n${BOLD}▸ %s${RESET}\n" "$1"; }
pass() { printf "${GREEN}  ✓ %s${RESET}\n" "$1"; }
fail() { printf "${RED}  ✗ %s${RESET}\n" "$1"; exit 1; }
skip() { printf "${YELLOW}  ⊘ %s${RESET}\n" "$1"; }

usage() {
  printf "Usage: gate.sh [--no-build]\n"
  exit 1
}

NO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --no-build) NO_BUILD=1 ;;
    *) usage ;;
  esac
done

PROJECT_DIR="${PROJECT_DIR:-.}"

if [[ ! -d "$PROJECT_DIR" ]] || [[ ! -f "$PROJECT_DIR/package.json" ]]; then
  fail "invalid PROJECT_DIR: $PROJECT_DIR"
fi

PACKAGE_MANAGER_FIELD="$(cd "$PROJECT_DIR" && node -p "require('./package.json').packageManager ?? ''")"

if [[ "$PACKAGE_MANAGER_FIELD" == npm* ]]; then
  PACKAGE_MANAGER="npm"
elif [[ "$PACKAGE_MANAGER_FIELD" == pnpm* ]]; then
  PACKAGE_MANAGER="pnpm"
elif [[ "$PACKAGE_MANAGER_FIELD" == yarn* ]]; then
  PACKAGE_MANAGER="yarn"
elif [[ "$PACKAGE_MANAGER_FIELD" == bun* ]]; then
  PACKAGE_MANAGER="bun"
elif [[ -f "$PROJECT_DIR/pnpm-lock.yaml" ]]; then
  PACKAGE_MANAGER="pnpm"
elif [[ -f "$PROJECT_DIR/bun.lockb" || -f "$PROJECT_DIR/bun.lock" ]]; then
  PACKAGE_MANAGER="bun"
elif [[ -f "$PROJECT_DIR/yarn.lock" ]]; then
  PACKAGE_MANAGER="yarn"
else
  PACKAGE_MANAGER="npm"
fi

install_deps() {
  case "$PACKAGE_MANAGER" in
    pnpm) (cd "$PROJECT_DIR" && pnpm install --frozen-lockfile) ;;
    bun) (cd "$PROJECT_DIR" && bun install --frozen-lockfile) ;;
    yarn) (cd "$PROJECT_DIR" && yarn install --immutable) ;;
    npm) (cd "$PROJECT_DIR" && npm install --silent) ;;
    *) fail "unsupported package manager: $PACKAGE_MANAGER" ;;
  esac
}

has_script() {
  local script_name="$1"
  (
    cd "$PROJECT_DIR" &&
      node -e "const pkg = require('./package.json'); process.exit(pkg.scripts && pkg.scripts['$script_name'] ? 0 : 1)"
  )
}

run_script() {
  local script_name="$1"
  case "$PACKAGE_MANAGER" in
    pnpm) (cd "$PROJECT_DIR" && pnpm run "$script_name") ;;
    bun) (cd "$PROJECT_DIR" && bun run "$script_name") ;;
    yarn) (cd "$PROJECT_DIR" && yarn "$script_name") ;;
    npm) (cd "$PROJECT_DIR" && npm run "$script_name" --silent) ;;
    *) fail "unsupported package manager: $PACKAGE_MANAGER" ;;
  esac
}

BIN_DIR="$PROJECT_DIR/node_modules/.bin"

CHANGED_FILES=()
while IFS= read -r rel_path; do
  if [[ -n "$rel_path" ]]; then
    CHANGED_FILES+=("$rel_path")
  fi
done < <(
  (
    cd "$PROJECT_DIR" &&
      {
        git diff --name-only --diff-filter=ACMR HEAD
        git ls-files --others --exclude-standard
      } | sort -u
  )
)

is_matching_ext() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css|*.scss|*.html) return 0 ;;
    *) return 1 ;;
  esac
}

has_project_prefix() {
  case "$1" in
    app/*|components/*|hooks/*|lib/*|server/*|docs/*|scripts/*|package.json|tsconfig.json|next.config.mjs|.env.example) return 0 ;;
    *) return 1 ;;
  esac
}

step "project"
pass "using $PROJECT_DIR ($PACKAGE_MANAGER)"

step "dependencies"
if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
  printf "  installing dependencies…\n"
  install_deps
  pass "dependencies installed"
else
  pass "node_modules present"
fi

step "debug statements"
debug_matches=()
for rel_path in "${CHANGED_FILES[@]}"; do
  if ! has_project_prefix "$rel_path"; then
    continue
  fi
  case "$rel_path" in
    app/*|components/*|hooks/*|lib/*|server/*) ;;
    *) continue ;;
  esac
  case "$rel_path" in
    *.ts|*.tsx|*.js|*.jsx) ;;
    *) continue ;;
  esac
  case "$rel_path" in
    server/db/seed.ts) continue ;;
  esac
  if [[ -f "$PROJECT_DIR/$rel_path" ]]; then
    while IFS= read -r match; do
      debug_matches+=("$match")
    done < <(grep -nE '^\s*(console\.(log|debug|warn)|debugger\b)' "$PROJECT_DIR/$rel_path" | sed "s#^#$rel_path:#")
  fi
done
if [[ "${#debug_matches[@]}" -gt 0 ]]; then
  printf '%s\n' "${debug_matches[@]}"
  fail "debug statements found"
else
  pass "no debug statements"
fi

step "trailing whitespace"
trailing_matches=()
for rel_path in "${CHANGED_FILES[@]}"; do
  if ! has_project_prefix "$rel_path" || ! is_matching_ext "$rel_path"; then
    continue
  fi
  if [[ -f "$PROJECT_DIR/$rel_path" ]]; then
    while IFS= read -r match; do
      trailing_matches+=("$match")
    done < <(grep -n ' $' "$PROJECT_DIR/$rel_path" | sed "s#^#$rel_path:#")
  fi
done
if [[ "${#trailing_matches[@]}" -gt 0 ]]; then
  printf '%s\n' "${trailing_matches[@]}"
  fail "trailing whitespace found"
else
  pass "no trailing whitespace"
fi

step "docs"
if has_script docs:list && run_script docs:list >/dev/null; then
  pass "docs listed"
else
  skip "no docs:list script"
fi

step "biome (lint + format + imports)"
if has_script lint && [[ -x "$BIN_DIR/eslint" ]] && compgen -G "$PROJECT_DIR/.eslintrc*" >/dev/null; then
  if run_script lint; then
    pass "lint"
  else
    fail "lint found issues"
  fi
elif has_script lint && [[ -f "$PROJECT_DIR/eslint.config.js" || -f "$PROJECT_DIR/eslint.config.mjs" || -f "$PROJECT_DIR/eslint.config.cjs" || -f "$PROJECT_DIR/eslint.config.ts" ]]; then
  if run_script lint; then
    pass "lint"
  else
    fail "lint found issues"
  fi
else
  skip "lint tooling not configured"
fi

step "TypeScript typecheck"
if has_script typecheck; then
  if run_script typecheck; then
    pass "typecheck"
  else
    fail "typecheck failed"
  fi
else
  skip "no typecheck script"
fi

if [[ "$NO_BUILD" -eq 1 ]]; then
  step "build"
  skip "skipped via --no-build"
elif has_script build; then
  step "build"
  if run_script build; then
    pass "build"
  else
    fail "build failed"
  fi
else
  step "build"
  skip "no build script"
fi

step "tests"
if has_script test; then
  if run_script test; then
    pass "tests"
  else
    fail "tests failed"
  fi
else
  skip "no test script"
fi

printf "\n${GREEN}${BOLD}Gate passed ✓${RESET}\n"
