# Today Work Metrics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `TODAY` card into a metrics dashboard so it no longer duplicates `TODAY'S TODOS`.

**Architecture:** Keep data loading unchanged because `TodayWorklog` already exposes highlights, todos, and timeline items. Add small view-layer helpers in `src/view.ts` to calculate metrics, current focus, blocked count, and project count. Replace the inner `今日Todo` subcard with a metrics/focus subcard, and add compact styles in `src/styles.css`.

**Tech Stack:** Obsidian plugin API, TypeScript, CSS, esbuild.

---

### Task 1: Implement Metrics Helpers

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/view.ts`

- [ ] **Step 1: Add `TodayMetrics` interface near the dashboard view types**

```ts
interface TodayMetrics {
  total: number;
  pending: number;
  done: number;
  outputs: number;
  git: number;
  agent: number;
  projects: number;
  blocked: number;
  focus?: TodoItem;
}
```

- [ ] **Step 2: Add `calculateTodayMetrics(today: TodayWorklog): TodayMetrics`**

Use `today.todos` for total/pending/done/focus, `today.timeline` for output/git/agent counts, `extractProjectNames()` for project count, and `isBlockedText()` for blocked items.

- [ ] **Step 3: Add helper functions**

Add `extractProjectNames(today)`, `projectNameFromText(text)`, and `isBlockedText(text)` to keep the renderer readable.

### Task 2: Replace TODAY Todo Subcard

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/view.ts`

- [ ] **Step 1: Rename comment for TODAY card**

Change the comment from `## 今日重点 + ## 今日Todo + ## 重点记录 + event stream` to `## 今日重点 + metrics + event stream`.

- [ ] **Step 2: Replace the `ts-today-subcard--todo` block**

Remove the full Todo list inside `renderTodayWorklog()`. Insert a `ts-today-subcard--metrics` block that calls `renderTodayMetrics()`.

- [ ] **Step 3: Add `renderTodayMetrics(parent, today, missingLog)`**

Render metric tiles for total, pending, done, outputs, git, agent, projects, and blocked. Render current focus below the metric grid.

- [ ] **Step 4: Preserve click behavior**

Metric and focus rows open the today worklog, while `TODAY'S TODOS` remains the only place for checkbox/edit actions.

### Task 3: Style Metrics Dashboard

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/styles.css`

- [ ] **Step 1: Replace todo subcard styling**

Add `.ts-today-subcard--metrics` with the existing green accent border.

- [ ] **Step 2: Add metric grid styles**

Add `.ts-today-metric-grid`, `.ts-today-metric`, `.ts-today-metric-value`, and `.ts-today-metric-label`.

- [ ] **Step 3: Add focus and blocked styles**

Add `.ts-today-focus`, `.ts-today-focus-label`, `.ts-today-focus-text`, and blocked warning modifier styles.

### Task 4: Build, Deploy, Log, Push

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/02-日记/工作日志/20260605_工作日志_周五.md`

- [ ] **Step 1: Build dashboard**

Run:

```bash
npm run build
```

Expected: TypeScript and esbuild complete successfully.

- [ ] **Step 2: Deploy Rain plugin files**

Copy `main.js` and `main.css` into Rain plugin as `main.js` and `styles.css`, then compare both files with `cmp -s`.

- [ ] **Step 3: Update Rain worklog**

Append one `## Agent 产出` entry and one `## 今日产出` item describing the metrics dashboard implementation.

- [ ] **Step 4: Commit and push**

Commit dashboard source/build changes, commit Rain plugin/worklog changes, handle any hook-added worklog entry with a hook-disabled follow-up commit, then push both repositories.
