# Resolved Blocker Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop resolved blocker text from driving `NEXT ACTION`, while preserving blocker records in the timeline.

**Architecture:** Keep all data loading and timeline parsing unchanged. Add one view-layer helper in `src/view.ts` that detects resolved blocker text, and make active blocker collection require blocked text without resolved markers. `TODAY` metrics, `NEXT ACTION`, and risk chips already use `blockedTextsFromToday()`, so they inherit the rule.

**Tech Stack:** TypeScript, Obsidian plugin API, esbuild.

---

### Task 1: Filter Resolved Blockers In View Logic

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/view.ts`

- [ ] **Step 1: Update `blockedTextsFromToday()`**

Replace:

```ts
return values.filter(text => this.isBlockedText(text));
```

with:

```ts
return values.filter(text => this.isActiveBlockedText(text));
```

- [ ] **Step 2: Add `isActiveBlockedText()`**

Add near `isBlockedText()`:

```ts
private isActiveBlockedText(text: string): boolean {
  return this.isBlockedText(text) && !this.isResolvedBlockedText(text);
}
```

- [ ] **Step 3: Add `isResolvedBlockedText()`**

Add near `isBlockedText()`:

```ts
private isResolvedBlockedText(text: string): boolean {
  return /已解决|已解除|已处理|完成|✅/i.test(text);
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: build completes successfully.

### Task 2: Deploy, Log, Commit, Push

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/view.ts`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/rain/02-日记/工作日志/20260605_工作日志_周五.md`

- [ ] **Step 1: Deploy JS bundle to Rain**

Run:

```bash
cp /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js
cmp -s /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js
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

Record that resolved blocker text still appears in timeline but no longer counts as active blocker. Include build 1真实/1总数 and deployment 1真实/1总数.

- [ ] **Step 4: Commit and push**

Run:

```bash
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard add src/view.ts main.js docs/superpowers/plans/2026-06-05-resolved-blocker-filter.md
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard commit -m "fix: ignore resolved blockers"
git -C /Volumes/资料/projects/thirdspace/rain add .obsidian/plugins/thirdspace-dashboard/main.js 02-日记/工作日志/20260605_工作日志_周五.md
git -C /Volumes/资料/projects/thirdspace/rain commit -m "fix: deploy resolved blocker filter"
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard push
git -C /Volumes/资料/projects/thirdspace/rain push
```

If Rain hook appends a Git commit entry, add and commit it with hooks disabled.
