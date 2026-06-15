# Dashboard Live Git Log Data Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ThirdSpace Dashboard prefer realtime `git log` data for Git activity and Today timeline while retaining hook/worklog/cache fallback.

**Architecture:** Add a focused `src/data/live-git.ts` module that builds a strict Rain-controlled repo whitelist, runs fixed `git` commands through `execFile`, parses machine-readable log output, and returns repo snapshots plus degraded repo reasons. Update `src/data/vault-reader.ts` to consume live snapshots first and fallback to `.thirdspace/git/commits.json` and worklog/structured events when live reads fail.

**Tech Stack:** TypeScript, Obsidian plugin API, Node `child_process.execFile`, Node `path`, esbuild bundled unit tests.

---

## Files

- Create: `src/data/live-git.ts`
  - Whitelist builder, fixed git command execution, parser, live repo snapshots, degraded reasons.
- Modify: `src/data/vault-reader.ts`
  - Use live Git snapshots in `getGitActivity()` and `loadStructuredTimelineItems()`.
- Create: `tests/live-git.test.ts`
  - Unit tests for whitelist, parser, exec args, failure isolation, and fallback-shaped snapshots.
- Modify: `tests/run-tests.ts`
  - Import `live-git.test.ts`.
- Create: `docs/superpowers/plans/2026-06-15-dashboard-live-git-log-data-source.md`
  - This plan.

## Task 1: Live Git Core Tests

**Files:**
- Create: `tests/live-git.test.ts`
- Create: `src/data/live-git.ts`
- Modify: `tests/run-tests.ts`

- [ ] **Step 1: Write failing tests for whitelist and parser**

Add tests that expect `buildLiveGitRepoSources()` to include the Rain vault root and non-archived `repo_path` values, exclude archived projects, and deduplicate repo paths. Add a parser fixture using `\x1e` commit separators and `\x1f` field separators.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`

Expected: FAIL because `src/data/live-git.ts` does not exist.

- [ ] **Step 3: Implement minimal live-git types, whitelist builder, and parser**

Create `src/data/live-git.ts` with:

```ts
export interface LiveGitRepoSource { id: string; name: string; path: string; }
export interface LiveGitCommit { hash: string; short_hash: string; time: string; author_name: string; subject: string; branch: string; files: string[]; repo: LiveGitRepoSource; }
export interface LiveGitRepoSnapshot { id: string; name: string; path: string; branch: string; commits: LiveGitCommit[]; }
export interface LiveGitDegradedRepo { id: string; name: string; path: string; reason: string; }
export interface LiveGitSnapshot { repos: LiveGitRepoSnapshot[]; degraded: LiveGitDegradedRepo[]; }
```

Implement:

```ts
export function buildLiveGitRepoSources(vaultRoot: string, projects: ProjectIndexEntry[]): LiveGitRepoSource[]
export function parseGitLogOutput(output: string, repo: LiveGitRepoSource, branch: string): LiveGitCommit[]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`

Expected: PASS for new whitelist/parser tests and existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/live-git.ts tests/live-git.test.ts tests/run-tests.ts docs/superpowers/plans/2026-06-15-dashboard-live-git-log-data-source.md
git commit -m "feat: add live git log parser"
```

## Task 2: Live Git Reader Tests

**Files:**
- Modify: `src/data/live-git.ts`
- Modify: `tests/live-git.test.ts`

- [ ] **Step 1: Write failing tests for fixed execFile arguments and repo failure isolation**

Inject a fake executor and assert it receives only:

```ts
["-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD"]
["-C", repoPath, "log", "--max-count=200", "--date=iso-strict", "--name-only", "--pretty=format:%x1e%H%x1f%h%x1f%cI%x1f%an%x1f%s"]
```

Also assert one rejected repo returns a degraded entry while the working repo remains in `snapshot.repos`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`

Expected: FAIL because `readLiveGitSnapshot()` is not implemented.

- [ ] **Step 3: Implement live reader**

Implement:

```ts
export type LiveGitExecutor = (command: string, args: string[], options: { encoding: "utf8"; timeout: number; maxBuffer: number }) => Promise<{ stdout: string }>;
export async function readLiveGitSnapshot(sources: LiveGitRepoSource[], options?: { executor?: LiveGitExecutor; maxCount?: number; timeoutMs?: number }): Promise<LiveGitSnapshot>
```

Use default `execFile("git", args, { encoding: "utf8", timeout, maxBuffer })` via `promisify`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/live-git.ts tests/live-git.test.ts
git commit -m "feat: read live git log snapshots"
```

## Task 3: Dashboard Data Integration Tests

**Files:**
- Modify: `src/data/vault-reader.ts`
- Modify: `tests/vault-reader.test.ts`

- [ ] **Step 1: Write failing tests for live Git activity and fallback**

Extend `tests/vault-reader.test.ts` with a fake app whose adapter has `basePath`, `.thirdspace/project-index.yaml`, and `.thirdspace/git/commits.json`. Inject live snapshots through exported helper functions so the test can verify:

- Live commits are counted by `getGitActivity()`.
- Archived repos are not included.
- Cached commits are still counted when live data is unavailable.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`

Expected: FAIL because `vault-reader.ts` still reads only `.thirdspace/git/commits.json`.

- [ ] **Step 3: Integrate live Git into `getGitActivity()`**

Add small helpers in `vault-reader.ts`:

```ts
async function loadLiveGitSnapshotForApp(app: App): Promise<LiveGitSnapshot>
function gitActivityFromSnapshots(live: LiveGitSnapshot, cached: GitIndexFile | null, days: number): GitActivitySummary
```

Keep the existing cached path as fallback.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/vault-reader.ts tests/vault-reader.test.ts
git commit -m "feat: prefer live git activity"
```

## Task 4: Today Timeline Integration

**Files:**
- Modify: `src/data/vault-reader.ts`
- Modify: `tests/vault-reader.test.ts`

- [ ] **Step 1: Write failing tests for Today timeline live Git rows**

Create a fake today worklog and live snapshot with today's commit. Assert `loadTodayWorklog()` includes a `timeline` item with `kind === "git"` and title from the live commit.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`

Expected: FAIL because live commits are not in `loadStructuredTimelineItems()`.

- [ ] **Step 3: Add live Git timeline items before cached fallback**

Convert live commits into the same `StructuredGitEvent` shape used by `gitEventToTimelineItem()`. Merge with `.thirdspace/events/YYYYMMDD.ndjson`, cached `.thirdspace/git/commits.json`, and worklog section rows through `mergeTimelineItems()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/vault-reader.ts tests/vault-reader.test.ts
git commit -m "feat: show live git commits in today timeline"
```

## Task 5: Docs, Build, Deployment Prep

**Files:**
- Modify: `README.md`
- Modify: generated `main.js` and `main.css` after build

- [ ] **Step 1: Update README data-source mapping**

Document that Git display now prefers realtime `git log` from Rain root plus non-archived `project-index.yaml` repos, then falls back to events/cache/worklog.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run test:unit
npm run build
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add README.md main.js main.css
git commit -m "docs: record live git data source"
```

## Task 6: Merge, Deploy, and Rain Ledger

**Files:**
- Dashboard main repo generated bundle.
- Rain plugin files: `.obsidian/plugins/thirdspace-dashboard/main.js`, `.obsidian/plugins/thirdspace-dashboard/styles.css`
- Rain worklog: `02-日记/工作日志/20260615_工作日志_周一.md`
- Rain Dashboard project docs if needed.

- [ ] **Step 1: Merge feature branch to Dashboard main**

Run:

```bash
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard checkout main
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard merge live-git-log-data-source
```

- [ ] **Step 2: Verify on main**

Run:

```bash
npm run test:unit
npm run build
git diff --check
```

- [ ] **Step 3: Deploy generated plugin into Rain**

Copy `main.js` and `main.css` from Dashboard main to Rain plugin directory and compare with `cmp -s`.

- [ ] **Step 4: Update Rain worklog and project ledger**

Record completed Todo, output, verification, Dashboard commit hashes, and deployment artifacts.

- [ ] **Step 5: Commit and push both repos**

Push Dashboard main and Rain main. If Rain hook appends a worklog tail, commit that tail with hooks disabled.

## Self-Review

- Spec coverage: whitelist, parser, fixed exec args, fallback, Today timeline, activity panel, verification and deployment are all covered.
- Placeholder scan: no `TBD`, `TODO`, or open implementation placeholders.
- Type consistency: `LiveGitRepoSource`, `LiveGitCommit`, `LiveGitRepoSnapshot`, and `LiveGitSnapshot` are defined once in Task 1 and reused in later tasks.
