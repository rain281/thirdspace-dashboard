import assert from "node:assert/strict";
import {
  buildLiveGitRepoSources,
  parseGitLogOutput,
} from "../src/data/live-git";

const repoSources = buildLiveGitRepoSources("/Volumes/资料/projects/thirdspace/rain", [
  {
    id: "kora",
    name: "Kora",
    workspace: "04-项目/产品系统/Kora",
    lifecycle: "active",
    repo_path: "/Volumes/资料/projects/Kora",
  },
  {
    id: "pilot",
    name: "Pilot",
    workspace: "04-项目/产品系统/Pilot",
    lifecycle: "watch",
    repo_path: "/Volumes/资料/projects/pilot",
  },
  {
    id: "duplicate-kora",
    name: "Kora Duplicate",
    workspace: "04-项目/产品系统/Kora",
    lifecycle: "active",
    repo_path: "/Volumes/资料/projects/Kora/",
  },
  {
    id: "archived",
    name: "Archived",
    workspace: "99-归档/完结项目/Archived",
    lifecycle: "archived",
    repo_path: "/Volumes/资料/projects/archived",
  },
  {
    id: "no-repo",
    name: "No Repo",
    workspace: "04-项目/产品系统/NoRepo",
    lifecycle: "active",
  },
]);

assert.deepEqual(repoSources.map(source => source.id), ["rain", "kora", "pilot"]);
assert.deepEqual(repoSources.map(source => source.name), ["rain", "Kora", "Pilot"]);
assert.deepEqual(repoSources.map(source => source.path), [
  "/Volumes/资料/projects/thirdspace/rain",
  "/Volumes/资料/projects/Kora",
  "/Volumes/资料/projects/pilot",
]);

const parsedCommits = parseGitLogOutput([
  "\x1eaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\x1faaaaaaa\x1f2026-06-15T10:10:00+08:00\x1fRain User\x1fdocs: first commit",
  "README.md",
  "docs/plan.md",
  "\x1ebbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\x1fbbbbbbb\x1f2026-06-15T11:03:44+08:00\x1fRain User\x1ffeat: second commit",
  "src/main.ts",
  "",
].join("\n"), repoSources[0], "main");

assert.equal(parsedCommits.length, 2);
assert.deepEqual(parsedCommits[0], {
  hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  short_hash: "aaaaaaa",
  time: "2026-06-15T10:10:00+08:00",
  author_name: "Rain User",
  subject: "docs: first commit",
  branch: "main",
  files: ["README.md", "docs/plan.md"],
  repo: repoSources[0],
});
assert.deepEqual(parsedCommits[1].files, ["src/main.ts"]);
