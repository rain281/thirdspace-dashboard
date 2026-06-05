# Timeline Event Summary Cards Design

## Background

The `时间线 / 产出` section currently renders timeline items with one shared dense row format: kind badge, time, title, subtitle, and up to 2 body lines. This preserves facts, but Git, Agent, record, and output items all compete at the same visual weight.

The result is hard to scan during daily work. Users need to know what happened, what changed, and whether it matters without reading full log text.

## Goal

Make each timeline item easier to scan while keeping the section's role unchanged: it remains the factual stream for today's work.

## Selected Approach

Use event summary cards for each timeline item.

Each row keeps the same source item and click target, but renders with clearer hierarchy:

1. A narrow colored kind rail on the left.
2. A compact meta line with kind badge and time.
3. A title that is the primary reading target.
4. A short summary line derived from subtitle or first body line.
5. Up to 2 small chips for high-signal facts such as repo, file count, verification, project, or target path.

## Item Rules

1. Git items emphasize repo, branch or commit, and changed files.
2. Agent items emphasize completed action and verification/result.
3. Output items emphasize the delivered result.
4. Record items emphasize the short human note, not the full explanation block.
5. Items without enough structured data still render as a readable title plus one summary line.

## Behavior

1. Existing timeline filters stay unchanged: all, record, output, agent, git.
2. Clicking an item still calls the existing `openTimelineItem()` flow.
3. No new data files or timeline protocol fields are required.
4. The card still reads from `TimelineItem.title`, `subtitle`, `body`, `badge`, `time`, and target fields.
5. Empty and no-filter states remain unchanged.

## Visual Rules

1. Cards are compact rows, not large nested cards.
2. The left rail carries kind identity; badges become supporting metadata.
3. Title can wrap to 2 lines.
4. Summary line is clamped to 1 line on normal density.
5. Chips are optional and wrap safely without overlapping text.
6. Styling must use Obsidian theme variables and existing `--ts-*` tokens.
7. Dark theme and light theme must both remain readable.

## Non Goals

1. Do not change how timeline entries are parsed from worklogs, Git, or Agent output.
2. Do not add expand/collapse behavior in this iteration.
3. Do not change `TODAY`, `TODAY'S TODOS`, `PROJECT POOL`, or `NEXT ACTION`.
4. Do not create a separate detail drawer or modal.
5. Do not remove historical body text from the underlying worklog.

## Acceptance Criteria

1. Git rows show a clearer repo/commit/file summary than the current dense body text.
2. Agent rows show completed action and verification/result as scan-friendly text.
3. Record rows do not let `为什么做` / `怎么做` / `改了什么` blocks dominate the card.
4. Each row remains clickable and opens the same target as before.
5. Timeline filters still show correct item counts.
6. Long titles and paths do not overlap adjacent UI at dashboard density.
7. Light and dark theme colors use theme-safe variables.
8. `npm run build` passes 1真实/1总数.
