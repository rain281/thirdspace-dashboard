# Today Todo Copy Actions Design

## Background

`TODAY'S TODOS` now renders each task as a readable task-card row. This improves scanning, but the row still uses click to open today's worklog and double-click to edit. Selecting text directly inside the row is therefore awkward when the user wants to copy a task into Codex for iteration.

## Goal

Make Today Todo content easy to copy without changing the existing task workflow.

## Selected Approach

Add explicit copy actions:

1. A header copy button copies all pending Today Todos.
2. A row copy button copies one todo's original full text.

The copied content should be Markdown-friendly:

1. Header copy uses checklist lines such as `- [ ] Kora：...`.
2. Row copy uses the original full todo text such as `Kora：...`.
3. Done items are not included in the header copy by default.

## Behavior

1. Click row copy button: copy `item.text`.
2. Click header copy button: copy all pending todos in visible order.
3. Copy buttons stop event propagation so they do not open the worklog or trigger inline edit.
4. Existing checkbox toggle, row click, double-click edit, done archive, and pending count behavior stay unchanged.
5. Copy success shows an Obsidian `Notice`.
6. Copy failure shows an Obsidian `Notice` explaining that copying failed.

## Visual Rules

1. Use compact icon buttons, not text-heavy buttons.
2. Header copy action should sit near the pending count without crowding the card title.
3. Row copy action should be visually secondary and not compete with the checkbox.
4. Buttons must use theme-safe colors and existing `--ts-*` tokens.
5. Text in task rows must not overlap the copy button.

## Non Goals

1. Do not change Markdown todo storage format.
2. Do not add drag-and-drop, priority, dates, grouping, or batch edit.
3. Do not change `PROJECT POOL`, `NEXT ACTION`, or `时间线 / 产出`.
4. Do not change completed-todo archive behavior.
5. Do not add a settings panel.

## Acceptance Criteria

1. Each todo row has a copy icon button.
2. Clicking the row copy button copies the original full `item.text`.
3. The card header has a copy icon button for pending todos.
4. Header copy produces Markdown checklist lines for pending todos only.
5. Copy buttons do not open the worklog.
6. Copy buttons do not trigger double-click inline edit.
7. Pending count still updates after checkbox toggle.
8. `npm run build` passes 1真实/1总数.
