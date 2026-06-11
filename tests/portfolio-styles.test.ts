import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync("src/styles.css", "utf8");
const projectsBlock = cssBlock(".ts-board--projects");
const systemBlock = cssBlock(".ts-board--system");

assert.match(styles, /\.ts-portfolio-col\s*\{\s*grid-area:\s*portfolio;/);
assert.match(styles, /\.ts-system-health-col\s*\{\s*grid-area:\s*health;/);
assert.match(styles, /\.ts-system-activity-col\s*\{\s*grid-area:\s*activity;/);
assert.match(styles, /\.ts-system-grid\s*\{\s*grid-area:\s*maintenance;/);
assert.match(projectsBlock, /grid-template-areas:[\s\S]*"portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio"/);
assert.doesNotMatch(projectsBlock, /maintenance/);
assert.match(systemBlock, /health[\s\S]*activity[\s\S]*maintenance/);
assert.match(styles, /\.ts-portfolio\s*\{[\s\S]*grid-template-areas:[\s\S]*health[\s\S]*focus[\s\S]*risk/);
assert.match(styles, /\.ts-maintenance-grid\s*\{[\s\S]*display:\s*grid;/);
assert.match(styles, /@container\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.ts-board--system[\s\S]*health[\s\S]*activity[\s\S]*maintenance/);

function cssBlock(selector: string): string {
  const start = styles.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} block exists`);
  const end = styles.indexOf("\n}", start);
  assert.notEqual(end, -1, `${selector} block closes`);
  return styles.slice(start, end + 2);
}
