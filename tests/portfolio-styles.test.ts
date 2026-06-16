import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync("src/styles.css", "utf8");
const projectsBlock = cssBlock(".ts-board--projects");
const systemBlock = cssBlock(".ts-board--system");
const reviewBlock = cssBlock(".ts-board--review");

assert.match(styles, /\.ts-portfolio-col\s*\{\s*grid-area:\s*portfolio;/);
assert.match(styles, /\.ts-system-health-col\s*\{\s*grid-area:\s*health;/);
assert.match(styles, /\.ts-system-activity-col\s*\{\s*grid-area:\s*activity;/);
assert.match(styles, /\.ts-system-grid\s*\{\s*grid-area:\s*maintenance;/);
assert.match(projectsBlock, /grid-template-areas:[\s\S]*"portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio"/);
assert.doesNotMatch(projectsBlock, /maintenance/);
assert.match(systemBlock, /health[\s\S]*activity[\s\S]*maintenance/);
assert.match(reviewBlock, /summary[\s\S]*focus[\s\S]*outcomes[\s\S]*offfocus[\s\S]*risks[\s\S]*next/);
assertGridAreaIsRectangle(reviewBlock, "risks");
assertGridAreaIsRectangle(reviewBlock, "next");
assert.match(styles, /\.ts-portfolio\s*\{[\s\S]*grid-template-areas:[\s\S]*health[\s\S]*focus[\s\S]*risk/);
assert.match(styles, /\.ts-focus-card-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(styles, /\.ts-focus-cardlet\s*\{/);
assert.doesNotMatch(cssBlock(".ts-focus-card-grid"), /overflow-y:\s*auto/);
assert.match(styles, /\.ts-maintenance-grid\s*\{[\s\S]*display:\s*grid;/);
assert.match(styles, /\.ts-review-summary-col\s*\{\s*grid-area:\s*summary;/);
assert.match(styles, /\.ts-review-focus-col\s*\{\s*grid-area:\s*focus;/);
assert.match(styles, /\.ts-review-next-col\s*\{\s*grid-area:\s*next;/);
assert.match(styles, /\.ts-review-summary-top\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
assert.match(styles, /\.ts-review-write-btn\s*\{[\s\S]*width:\s*auto/);
assert.match(styles, /\.ts-review-metrics\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(72px,\s*1fr\)\)/);
assert.match(styles, /\.ts-review-focus-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(styles, /\.ts-review-focus-cardlet\s*\{/);
assert.match(styles, /\.ts-system-health-issue-action\s*\{[\s\S]*height:\s*20px/);
assert.match(styles, /\.ts-system-health-issue-action:hover\s*\{/);
assert.match(styles, /\.ts-board--projects-detail/);
assert.match(styles, /\.ts-project-detail-page/);
assert.match(styles, /\.ts-detail-back-btn/);
assert.match(styles, /\.ts-detail-identity\s*\{/);
assert.match(styles, /\.ts-detail-chips\s*\{/);
assert.match(styles, /\.ts-detail-chip\s*\{/);
assert.match(styles, /\.ts-detail-main\s*\{/);
assert.match(styles, /\.ts-detail-risk-panel\s*\{/);
assert.match(styles, /\.ts-detail-context-panel\s*\{/);
assert.match(styles, /\.ts-detail-action-panel\s*\{/);
assert.match(styles, /\.ts-detail-summary-list\s*\{/);
assert.match(styles, /\.ts-detail-summary-row\s*\{/);
assert.match(styles, /\.ts-detail-summary-item--pending/);
assert.match(styles, /\.ts-detail-summary-item--done/);
assert.match(styles, /\.ts-detail-inline-action\s*\{/);
assert.match(styles, /\.ts-detail-inline-action--resolve-risk/);
assert.match(styles, /\.ts-detail-inline-action--resolve-decision/);
assert.match(styles, /\.ts-detail-link-row\.is-muted/);
assert.match(styles, /@container\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.ts-detail-grid[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.match(styles, /@container\s*\(max-width:\s*520px\)\s*\{[\s\S]*\.ts-detail-grid[\s\S]*grid-template-columns:\s*1fr/);
assert.match(styles, /@container\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.ts-board--system[\s\S]*health[\s\S]*activity[\s\S]*maintenance/);

function cssBlock(selector: string): string {
  const start = styles.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} block exists`);
  const end = styles.indexOf("\n}", start);
  assert.notEqual(end, -1, `${selector} block closes`);
  return styles.slice(start, end + 2);
}

function assertGridAreaIsRectangle(block: string, area: string): void {
  const rows = Array.from(block.matchAll(/"([^"]+)"/g)).map(match => match[1].trim().split(/\s+/));
  assert.ok(rows.length > 0, "grid template rows exist");
  const occupied = rows.flatMap((row, y) => row.map((cell, x) => ({ cell, x, y })).filter(item => item.cell === area));
  assert.ok(occupied.length > 0, `${area} area exists`);
  const minX = Math.min(...occupied.map(item => item.x));
  const maxX = Math.max(...occupied.map(item => item.x));
  const minY = Math.min(...occupied.map(item => item.y));
  const maxY = Math.max(...occupied.map(item => item.y));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      assert.equal(rows[y][x], area, `${area} must be rectangular at row ${y} col ${x}`);
    }
  }
}
