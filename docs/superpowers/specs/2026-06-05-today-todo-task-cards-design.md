# Today Todo Task Cards Design

## Background

`TODAY'S TODOS` currently renders each item as a compact checkbox plus one text line. With project-prefixed tasks such as `Kora：...`, the project name, task body, and interaction target blend together, making the list hard to scan.

## Goal

Make `TODAY'S TODOS` easier to read while keeping the existing workflow unchanged.

## Selected Approach

Use a lightweight task-card row for each todo.

Each row has:

1. A checkbox button on the left.
2. A content block on the right.
3. A small project tag when text starts with `Project：` or `Project:`.
4. A task body that can wrap to 2 lines.
5. A done state that fades the row and strikes through the task body.

## Behavior

1. Click checkbox: toggle done, same as today.
2. Click row: open today's worklog, same as today.
3. Double click row: inline edit the original full todo text, same as today.
4. Completing a todo still archives through the existing `archiveCompletedTodosInWorklog()` flow.
5. Empty state remains unchanged.

## Visual Rules

1. Rows use subtle card styling, not nested cards.
2. Project tags use restrained color and compact uppercase-style treatment.
3. Task text is readable at dashboard density and never overlaps adjacent content.
4. The list remains internally scrollable.
5. The existing page grid and card size stay unchanged.

## Non Goals

1. Do not change the Markdown todo format.
2. Do not add drag-and-drop, priority, dates, or grouping.
3. Do not change `PROJECT POOL` behavior.
4. Do not change `NEXT ACTION` ranking.

## Acceptance Criteria

1. `Kora：将第一屏...` shows `Kora` as a project tag and the task body separately.
2. `rain：审读项目...` shows `rain` as a project tag and the task body separately.
3. A todo without a project prefix shows only task body.
4. Pending count still updates after checkbox toggle.
5. Double-click edit preserves the original full todo text.
6. Done items remain visually distinct.
7. `npm run build` passes 1真实/1总数.
