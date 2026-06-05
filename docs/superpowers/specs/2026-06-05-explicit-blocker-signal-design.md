# Explicit Blocker Signal Design

## Background

`NEXT ACTION` counts active blockers from today todos and timeline text. The previous filter correctly ignores resolved blocker text, but it still treats explanatory timeline body lines as blocker items when they merely mention words such as `阻塞`.

## Goal

Only explicit blocker statements should drive `NEXT ACTION`, the `TODAY` blocker metric, and risk chips. Explanatory text such as `改了什么：...显示活跃阻塞...` must remain visible in the timeline but must not count as a blocker.

## Rule

Active blocker text must satisfy 2真实/2总数 conditions:

1. It uses an explicit blocker signal.
2. It does not use a resolved signal.

Explicit blocker signals:

- `阻塞：...` / `阻塞: ...`
- `等待：...` / `等待: ...`
- `卡住：...` / `卡住: ...`
- `blocked: ...`
- `blocked by ...`

Resolved signals:

- `已解决`
- `已解除`
- `已处理`
- `✅`
- `完成`, except negated forms such as `未完成` / `没完成` / `没有完成` / `尚未完成`

## Data Flow

1. `blockedTextsFromToday()` reads today todo text and selected timeline signal text.
2. `isActiveBlockedText()` checks explicit blocker signal and resolved signal.
3. Existing consumers remain unchanged: `NEXT ACTION`, `TODAY` metrics, and `nextActionRisks()` read the filtered active blocker list.

Timeline rendering remains unchanged. No historical record is deleted or hidden.

## Non Goals

1. Do not introduce a blocker database or frontmatter state.
2. Do not hide timeline body lines that mention blocker-related words.
3. Do not change todo completion archiving.

## Acceptance Criteria

1. `阻塞：等待接口` counts as an active blocker.
2. `等待: API reply` counts as an active blocker.
3. `blocked by auth` counts as an active blocker.
4. `改了什么：显示活跃阻塞` does not count as an active blocker.
5. `为什么做：阻塞记录完成后...` does not count as an active blocker.
6. `阻塞：等待接口 已解决` does not count as an active blocker.
7. `npm run build` passes 1真实/1总数.
