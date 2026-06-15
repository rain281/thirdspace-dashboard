# Dashboard Live Git Log Data Source Design

Status: approved for implementation planning
Date: 2026-06-15
Scope: ThirdSpace Dashboard Git activity and Today timeline data source

## Context

The current Dashboard Git display is not a direct realtime `git log` view. It combines:

- Today's worklog Markdown sections such as `## Git 提交` and `## Agent 产出`.
- Structured hook output from `.thirdspace/events/YYYYMMDD.ndjson`.
- Cached Git history from `.thirdspace/git/commits.json`.

The requested change is to make the Dashboard read real Git repositories directly at render time, while keeping the existing hook/worklog/cache path as fallback and historical audit trail.

The user selected option B: read realtime Git data from the Rain-controlled project whitelist rather than scanning every repository under `/Volumes/资料/projects`.

## Goals

1. Prefer realtime `git log` data for Dashboard Git activity and Today timeline.
2. Keep the source list bounded to Rain-owned whitelist inputs.
3. Avoid arbitrary shell execution, diff body reads, global hooks, launch agents, background watchers, or cloud upload.
4. Keep the existing hook/worklog/cache pipeline as fallback, not as the primary display source.
5. Preserve current UI behavior where Git timeline items can open a relevant Rain note when the changed file is inside the vault.

## Non-Goals

- No all-disk Git repository scanning.
- No automatic hook installation or global hook changes.
- No reading Git diff contents.
- No reading `.env`, tokens, private keys, cookies, keychain, or secret values.
- No new backend, database, sync, account, or cloud behavior.
- No writeback to source repositories.

## Repository Whitelist

Realtime Git reads will use a strict whitelist:

1. The current Rain vault root, when it is a Git repository.
2. Non-archived project repos from `.thirdspace/project-index.yaml` where `repo_path` exists and `lifecycle !== "archived"`.

Archived projects, missing repo paths, non-Git folders, duplicate paths, and paths outside the configured whitelist are skipped. The default first batch includes active and watch projects because watch projects still contribute context and project activity, while archived projects remain inert.

## Data Flow

Dashboard render flow:

1. Read `.thirdspace/project-index.yaml`.
2. Build the live Git repo list from the Rain vault root plus non-archived project `repo_path` values.
3. For each repo, run `git` through `execFile`, never through a shell.
4. Convert live commits into the existing `GitActivitySummary` and `TimelineItem` shapes.
5. Merge live Git timeline items with worklog records, Agent output, and structured event rows.
6. If live Git fails for one repo, mark that repo as degraded and use existing `.thirdspace/git/commits.json` data for that repo when available.

Priority order:

1. Live `git log`.
2. `.thirdspace/events/YYYYMMDD.ndjson`.
3. `.thirdspace/git/commits.json`.
4. Today's worklog `## Git 提交`.

Structured and worklog sources remain useful because they are the permanent audit trail. Live Git becomes the display truth for current commit state.

## Git Command Boundary

The implementation will use Node `child_process.execFile` with a fixed command and fixed argument templates:

```text
git -C <repoPath> rev-parse --abbrev-ref HEAD
git -C <repoPath> log --max-count=<N> --date=iso-strict --name-only --pretty=<machine-readable-format>
```

Constraints:

- `repoPath` must come from the whitelist builder.
- `<N>` defaults to 200 per repo for the first batch.
- Command timeout defaults to 2 seconds per repo.
- No shell interpolation.
- No `git show --patch`, no `git diff`, no blob reads.
- Captured fields are limited to hash, short hash, ISO time, author name, subject, branch, and file names.

## Error Handling

Realtime Git is best effort per repo:

- Missing repo: skip and record degraded reason.
- Not a Git repo: skip and record degraded reason.
- Timeout: fallback to cache for that repo.
- Malformed output: fallback to cache for that repo.
- Permission error: fallback to cache and surface a short reason.

One failing repository must not blank the whole Dashboard.

## UI Behavior

The visible UI should remain familiar:

- `Git 提交` activity panel reflects realtime Git counts.
- Today timeline Git rows use realtime commits for today.
- Existing timeline filters continue to work.
- A compact degraded status can be shown in System or Git panel when live data fell back to cache.

No new write UI is required for the first batch.

## Testing

Implementation should be TDD:

1. Whitelist builder includes Rain root and non-archived project repos.
2. Whitelist builder excludes archived projects and duplicate paths.
3. Git log parser extracts commits and file names from fixture output.
4. Live reader uses fixed `execFile` argument arrays and never shell strings.
5. Failure on one repo returns degraded status and does not drop other repos.
6. Fallback uses `.thirdspace/git/commits.json` when live data is unavailable.
7. Existing worklog timeline parsing and Git metrics tests continue to pass.

## Acceptance Criteria

- Dashboard can show Git activity from realtime `git log` for Rain and non-archived project repos.
- No source repository is modified.
- No global hook, watcher, launch agent, or background automation is added.
- Existing hook/worklog/cache data remains readable as fallback.
- Unit tests cover whitelist, parser, success, failure, and fallback behavior.
- `npm run test:unit`, `npm run build`, and `git diff --check` pass before deployment.
