# Next Action Visibility Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `NEXT ACTION` card fully visible in the today-page first row.

**Architecture:** Keep the existing card and recommendation logic unchanged. Fix only CSS layout: increase the first row height and allow the action title/reason to wrap to two lines with bounded line clamps. Build, deploy to Rain, restart Obsidian, and record the result.

**Tech Stack:** CSS grid, Obsidian plugin bundle, esbuild.

---

### Task 1: Adjust Dashboard CSS

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/styles.css`

- [ ] **Step 1: Increase today-page desktop first row height**

Change:

```css
.ts-board--today {
  grid-template-rows: 78px minmax(0, 1fr);
```

to:

```css
.ts-board--today {
  grid-template-rows: 104px minmax(0, 1fr);
```

- [ ] **Step 2: Increase mobile/container first row height**

Change both mobile/container occurrences:

```css
grid-template-rows: 72px minmax(0, 1fr) 118px;
```

to:

```css
grid-template-rows: 110px minmax(0, 1fr) 118px;
```

- [ ] **Step 3: Allow title and reason to show two lines**

Update `.ts-next-action-title` and `.ts-next-action-reason`:

```css
display: -webkit-box;
-webkit-box-orient: vertical;
-webkit-line-clamp: 2;
white-space: normal;
```

Keep `overflow: hidden` so long text cannot resize the card.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: build completes successfully.

### Task 2: Deploy And Verify

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/02-日记/工作日志/20260605_工作日志_周五.md`

- [ ] **Step 1: Deploy CSS bundle to Rain**

Run:

```bash
cp /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css
cmp -s /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css
```

Expected: `cmp -s` exits 0.

- [ ] **Step 2: Restart Obsidian**

Run:

```bash
osascript -e 'tell application id "md.obsidian" to quit' >/dev/null 2>&1 || true
for i in {1..20}; do
  if ! pgrep -x Obsidian >/dev/null 2>&1; then break; fi
  sleep 0.5
done
open -b md.obsidian
```

Expected: Obsidian restarts.

- [ ] **Step 3: Update Rain worklog**

Add one `重点记录`, one `今日产出`, and one `Agent 产出` entry for the visibility fix, including build 1真实/1总数 and deployment 1真实/1总数 verification.

- [ ] **Step 4: Commit and push**

Run:

```bash
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard add src/styles.css main.css docs/superpowers/plans/2026-06-05-next-action-visibility-fix.md
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard commit -m "fix: show full next action card"
git -C /Volumes/资料/projects/thirdspace/rain add .obsidian/plugins/thirdspace-dashboard/styles.css 02-日记/工作日志/20260605_工作日志_周五.md
git -C /Volumes/资料/projects/thirdspace/rain commit -m "fix: deploy next action visibility fix"
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard push
git -C /Volumes/资料/projects/thirdspace/rain push
```

If Rain hook appends a Git commit entry, add and commit it with hooks disabled:

```bash
git -C /Volumes/资料/projects/thirdspace/rain add 02-日记/工作日志/20260605_工作日志_周五.md
git -C /Volumes/资料/projects/thirdspace/rain -c core.hooksPath=/dev/null commit -m "docs: record next action visibility fix commit"
```
