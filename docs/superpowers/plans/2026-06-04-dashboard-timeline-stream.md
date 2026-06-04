# Dashboard Timeline Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified, filterable, de-duplicated timeline stream for ThirdSpace Dashboard's `时间线 / 产出` card.

**Architecture:** Keep the existing data loader boundary in `vault-reader.ts`, adding a `TimelineItem` model and timeline builders there. Keep rendering in `view.ts`, with local filter state and target-aware click handling. Keep visual changes scoped to timeline classes in `styles.css`.

**Tech Stack:** Obsidian plugin API, TypeScript, CSS, esbuild, Rain vault adapter files.

---

### Task 1: Timeline Data Model

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/data/vault-reader.ts`

- [ ] **Step 1: Add exported timeline types**

Add `TimelineKind` and `TimelineItem` next to the existing worklog interfaces.

- [ ] **Step 2: Extend `TodayWorklog`**

Add `timeline: TimelineItem[]` while keeping legacy `entries`, `outputs`, and `events` for compatibility.

- [ ] **Step 3: Build worklog timeline items**

Convert `## 重点记录`, `## 今日产出`, `## Agent 产出`, and `## Git 提交` into `TimelineItem` objects with stable ids.

### Task 2: Structured Event Merge

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/data/vault-reader.ts`

- [ ] **Step 1: Read `.thirdspace/events/YYYYMMDD.ndjson`**

Parse valid JSON lines and convert `git_commit` rows into `TimelineItem` objects.

- [ ] **Step 2: Read `.thirdspace/git/commits.json`**

Flatten repo commits from the current branch history and keep commits from the current local date.

- [ ] **Step 3: Merge and sort**

Deduplicate by kind, commit hash or normalized title, then sort by timestamp descending with untimed items last.

### Task 3: Timeline UI

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/view.ts`

- [ ] **Step 1: Add timeline filter state**

Add `timelineFilter` with values `all`, `record`, `output`, `agent`, `git`.

- [ ] **Step 2: Render segmented filter buttons**

Show counts per filter and re-render on click.

- [ ] **Step 3: Render unified item rows**

Use badge, time, title, subtitle, and limited body lines for each `TimelineItem`.

- [ ] **Step 4: Open accurate targets**

Open `targetPath` when present and existing; otherwise open the today worklog.

### Task 4: Timeline Styling

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/styles.css`

- [ ] **Step 1: Style filter buttons**

Use compact segmented controls that fit inside the Today card.

- [ ] **Step 2: Style rows and badges**

Add distinct but restrained badges for record, output, agent, and git.

- [ ] **Step 3: Preserve scroll behavior**

Keep the flow card internally scrollable without resizing sibling cards.

### Task 5: Build, Deploy, Commit

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/02-日记/工作日志/20260604_工作日志_周四.md`

- [ ] **Step 1: Build**

Run `npm run build` in `/Volumes/资料/projects/thirdspace/thirdspace-dashboard`; expected result is successful TypeScript and esbuild output.

- [ ] **Step 2: Deploy**

Copy `main.js` and `main.css` to the Rain Obsidian plugin directory as `main.js` and `styles.css`.

- [ ] **Step 3: Verify**

Compare source and deployed artifacts with `cmp -s`; expected result is `2真实/2总数` matches.

- [ ] **Step 4: Update Obsidian log**

Append an Agent output entry describing the `7真实/7总数` timeline stream improvement.

- [ ] **Step 5: Commit**

Commit dashboard source/build/doc changes, then commit Rain plugin deployment and worklog updates path-specifically.
