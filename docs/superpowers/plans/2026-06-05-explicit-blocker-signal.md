# Explicit Blocker Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop explanatory timeline text from being counted as active blockers by requiring explicit blocker signals.

**Architecture:** Keep timeline parsing and rendering unchanged. Narrow `blockedTextsFromToday()` and `isBlockedText()` in `src/view.ts` so only today todos and timeline signal fields with explicit blocker prefixes can enter active blocker calculation. Existing `NEXT ACTION`, `TODAY` metrics, and risk chips will inherit the stricter active blocker list.

**Tech Stack:** TypeScript, Obsidian plugin API, esbuild.

---

### Task 1: Narrow Active Blocker Matching

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/view.ts`

- [ ] **Step 1: Update `blockedTextsFromToday()` signal collection**

Replace the current timeline scan:

```ts
const values = [
  ...today.todos.map(todo => todo.text),
  ...today.timeline.flatMap(item => [item.title, item.subtitle ?? "", item.raw, ...item.body]),
];
return values.filter(text => this.isActiveBlockedText(text));
```

with:

```ts
const values = [
  ...today.todos.map(todo => todo.text),
  ...today.timeline.flatMap(item => [item.title, item.subtitle ?? "", item.raw]),
];
return values.filter(text => this.isActiveBlockedText(text));
```

- [ ] **Step 2: Replace broad blocker word matching**

Replace:

```ts
private isBlockedText(text: string): boolean {
  return /\bblocked\b|阻塞|等待|卡住/i.test(text);
}
```

with:

```ts
private isBlockedText(text: string): boolean {
  return /(^|[\s\-*◆])(?:阻塞|等待|卡住)\s*[：:]|(^|[\s\-*◆])blocked\s*(?::|by\b)/i.test(text);
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: build completes successfully.

### Task 2: Deploy And Record

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/rain/02-日记/工作日志/20260605_工作日志_周五.md`

- [ ] **Step 1: Deploy JS bundle**

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

Record that explanatory `为什么做` / `怎么做` / `改了什么` text no longer counts as active blocker unless it is written as an explicit blocker statement. Include build 1真实/1总数 and deployment 1真实/1总数.

- [ ] **Step 4: Commit and push**

Run:

```bash
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard add src/view.ts main.js docs/superpowers/specs/2026-06-05-explicit-blocker-signal-design.md docs/superpowers/plans/2026-06-05-explicit-blocker-signal.md
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard commit -m "fix: require explicit blocker signals"
git -C /Volumes/资料/projects/thirdspace/rain add .obsidian/plugins/thirdspace-dashboard/main.js 02-日记/工作日志/20260605_工作日志_周五.md
git -C /Volumes/资料/projects/thirdspace/rain commit -m "fix: deploy explicit blocker signals"
git -C /Volumes/资料/projects/thirdspace/thirdspace-dashboard push
git -C /Volumes/资料/projects/thirdspace/rain push
```
