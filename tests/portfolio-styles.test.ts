import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync("src/styles.css", "utf8");

assert.match(styles, /\.ts-portfolio-col\s*\{\s*grid-area:\s*portfolio;/);
assert.match(styles, /\.ts-maintenance-col\s*\{\s*grid-area:\s*maintenance;/);
assert.match(styles, /\.ts-board--projects\s*\{[\s\S]*portfolio[\s\S]*maintenance/);
assert.match(styles, /\.ts-portfolio\s*\{[\s\S]*grid-template-areas:[\s\S]*health[\s\S]*focus[\s\S]*risk/);
assert.match(styles, /\.ts-maintenance-grid\s*\{[\s\S]*display:\s*grid;/);
assert.match(styles, /@container\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.ts-board--projects[\s\S]*portfolio[\s\S]*maintenance/);
