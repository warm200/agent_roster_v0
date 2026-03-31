---
summary: How to refresh OpenRoster's local Tessl evaluation snapshot from a Tessl eval run or the public registry.
read_when:
  - Refreshing agents_file/tessl-evals.json after running Tessl against the OpenRoster agent repo.
  - Debugging why Tessl badges in the catalog do not match the latest remote evaluation.
---

# Tessl Sync

OpenRoster does not read Tessl live at request time.

The app reads a local snapshot file:

- `agents_file/tessl-evals.json`

That file is what powers the Tessl badge/panel in the catalog UI.
To refresh it, use:

```bash
pnpm tessl:sync --public-only
```

If you already ran local `tessl skill review --json` sweeps and saved the outputs to a folder, import those directly:

```bash
pnpm tsx scripts/tessl-sync.ts --local-review-dir tmp/tessl-reviews
```

## Recommended Flow

### If you already ran an eval in Tessl

1. Find the run id:

```bash
tessl eval list --json --limit 10
```

2. Inspect the run if needed:

```bash
tessl eval view <run-id> --json
```

3. Sync that run into the local OpenRoster snapshot:

```bash
pnpm tsx scripts/tessl-sync.ts --eval-id <run-id>
```

### If you just want the latest eval run

```bash
pnpm tsx scripts/tessl-sync.ts --last
```

### If you want to skip Tessl CLI entirely

This uses the public Tessl registry and is the safest fallback when the CLI result format or auth state is unavailable:

```bash
pnpm tessl:sync --public-only
```

### If you evaluated every local agent skill already

Example sweep:

```bash
mkdir -p tmp/tessl-reviews

for dir in agents_file/*/skills; do
  slug="$(basename "$(dirname "$dir")")"
  tessl skill review --json "$dir" > "tmp/tessl-reviews/$slug.json"
done
```

Then convert those review files into the website snapshot:

```bash
pnpm tsx scripts/tessl-sync.ts --local-review-dir tmp/tessl-reviews
```

## Repo Selection

By default the sync command assumes:

```bash
OpenRoster-ai/awesome-openroster
```

You can override it:

```bash
pnpm tsx scripts/tessl-sync.ts --last --repo OpenRoster-ai/awesome-openroster
pnpm tsx scripts/tessl-sync.ts --last --repo https://github.com/OpenRoster-ai/awesome-openroster/tree/main
```

The command normalizes GitHub URLs automatically.

## Output Path

Default output:

```bash
agents_file/tessl-evals.json
```

Custom output:

```bash
pnpm tsx scripts/tessl-sync.ts --public-only --output /tmp/tessl-evals.json
```

## Important Caveat

If your local agent files differ from the remote GitHub repo, Tessl results may be stale for your local checkout.

That means:

- local app UI can still show Tessl data
- but that data reflects the evaluated remote repo, not unpublished local edits

Best practice:

1. push the latest agent changes
2. rerun Tessl
3. sync the snapshot
4. refresh the app
