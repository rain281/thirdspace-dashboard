import assert from "node:assert/strict";
import { buildGitActivityCardModel } from "../src/components/git-activity-summary";
import type { GitActivitySummary } from "../src/data/vault-reader";

const activity: GitActivitySummary = {
  total: 12,
  days: [
    { date: "2026-06-13", count: 1 },
    { date: "2026-06-14", count: 3 },
    { date: "2026-06-15", count: 8 },
  ],
  repos: [
    { id: "kora", name: "Kora", branch: "main", count: 7, lastCommit: Date.parse("2026-06-15T12:20:00+08:00") },
    { id: "rain", name: "rain", branch: "main", count: 5, lastCommit: Date.parse("2026-06-15T11:10:00+08:00") },
  ],
};

const model = buildGitActivityCardModel(activity);

assert.equal(model.totalLabel, "12");
assert.equal(model.todayLabel, "8");
assert.equal(model.topRepoLabel, "Kora");
assert.equal(model.topRepoMeta, "7 commits");
assert.equal(model.latestRepoLabel, "Kora");
assert.equal(model.latestRepoMeta, "main");
assert.deepEqual(model.repoRows.map(row => [row.name, row.countLabel, row.branch]), [
  ["Kora", "7", "main"],
  ["rain", "5", "main"],
]);

const empty = buildGitActivityCardModel({ total: 0, days: [], repos: [] });
assert.equal(empty.totalLabel, "0");
assert.equal(empty.todayLabel, "0");
assert.equal(empty.topRepoLabel, "-");
assert.equal(empty.topRepoMeta, "no commits");
assert.equal(empty.latestRepoLabel, "-");
assert.equal(empty.latestRepoMeta, "no commits");
assert.deepEqual(empty.repoRows, []);
