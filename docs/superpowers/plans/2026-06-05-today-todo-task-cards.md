# Today Todo Task Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `TODAY'S TODOS` as readable task-card rows with project tags while preserving all existing todo behavior.

**Architecture:** Keep todo persistence and interaction functions unchanged. Update `renderTodoRow()` in `src/view.ts` to split project-prefixed text for display only, and add focused CSS in `src/styles.css` for the task-card layout. The original `TodoItem.text` remains the source of truth for toggle and edit operations.

**Tech Stack:** TypeScript, Obsidian plugin API, CSS, esbuild.

---

### Task 1: Render Project-Aware Todo Rows

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/view.ts`

- [ ] **Step 1: Add display parsing helper**

Add near `renderTodoRow()`:

```ts
private todoDisplayParts(text: string): { project: string | null; body: string } {
  const match = text.match(/^([A-Za-z0-9_\-\u4e00-\u9fa5]{2,32})[：:]\s*(.+)$/);
  if (!match) return { project: null, body: text };
  return { project: match[1], body: match[2] };
}
```

- [ ] **Step 2: Replace single text span with structured content**

Inside `renderTodoRow()`, replace:

```ts
const txt = row.createSpan({ cls: "ts-todo-txt", text: item.text });
```

with:

```ts
const display = this.todoDisplayParts(item.text);
const content = row.createDiv({ cls: "ts-todo-content" });
if (display.project) content.createSpan({ cls: "ts-todo-project", text: display.project });
const txt = content.createSpan({ cls: "ts-todo-txt", text: display.body });
```

- [ ] **Step 3: Preserve edit restore behavior**

In both places that recreate the span after inline editing, replace:

```ts
const span = createEl("span", { cls: "ts-todo-txt", text: item.text });
input.replaceWith(span);
```

with:

```ts
const display = this.todoDisplayParts(item.text);
content.empty();
if (display.project) content.createSpan({ cls: "ts-todo-project", text: display.project });
content.createSpan({ cls: "ts-todo-txt", text: display.body });
input.remove();
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: build completes successfully.

### Task 2: Style Task Cards And Deploy

**Files:**
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/src/styles.css`
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js`
- Modify: `/Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css`
- Modify: `/Volumes/资料/projects/thirdspace/rain/02-日记/工作日志/20260605_工作日志_周五.md`

- [ ] **Step 1: Update todo CSS**

Add card-like row styling for `.ts-todo-row`, `.ts-todo-content`, and `.ts-todo-project`; keep `.ts-todo-list` scrollable.

- [ ] **Step 2: Build**

Run:

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 3: Deploy JS and CSS**

Run:

```bash
cp /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js
cp /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css
cmp -s /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.js /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js
cmp -s /Volumes/资料/projects/thirdspace/thirdspace-dashboard/main.css /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css
```

Expected: both `cmp -s` checks exit 0.

- [ ] **Step 4: Restart Obsidian**

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

- [ ] **Step 5: Commit and push**

Commit Dashboard implementation and Rain deployment separately, then push both repos.
