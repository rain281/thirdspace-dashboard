import assert from "node:assert/strict";
import {
  filterManagedProjectIndexEntries,
  getGitActivity,
  loadProjectBacklog,
  loadTodayWorklog,
  loadWeeklyWorklogs,
  setLiveGitExecutorForTests,
} from "../src/data/vault-reader";
import type { LiveGitExecutor } from "../src/data/live-git";

const activityProjects = filterManagedProjectIndexEntries([
  {
    id: "kora",
    name: "Kora",
    workspace: "04-项目/产品系统/Kora",
    lifecycle: "active",
  },
  {
    id: "xiaohuanzi",
    name: "小桓子",
    workspace: "99-归档/完结项目/小桓子",
    lifecycle: "archived",
  },
  {
    id: "pilot",
    name: "Pilot",
    workspace: "04-项目/产品系统/Pilot",
  },
]);

assert.deepEqual(activityProjects.map(project => project.id), ["kora", "pilot"]);

const files = new Map<string, string>([
  ["02-日记/工作日志/20260609_工作日志_周二.md", [
    "# 20260609 工作日志 周二",
    "",
    "## 今日重点",
    "- Kora Review",
    "",
    "## 今日Todo",
    "- [ ] Kora：完成复盘页",
    "",
    "## 重点记录",
    "",
    "## 今日产出",
    "- Kora：完成 Review 数据模型 ✅ 2026-06-09",
    "",
    "## Agent 产出",
    "",
    "## Git 提交",
    "",
  ].join("\n")],
  ["02-日记/工作日志/20260612_工作日志_周五.md", [
    "# 20260612 工作日志 周五",
    "",
    "## 今日重点",
    "- Pilot 权限",
    "",
    "## 今日Todo",
    "- [ ] Pilot：确认 Mail.app 权限",
    "",
    "## 重点记录",
    "",
    "## 今日产出",
    "- Pilot：完成权限方案 ✅ 2026-06-12",
    "",
    "## Agent 产出",
    "",
    "## Git 提交",
    "",
  ].join("\n")],
  ["02-日记/工作日志/20260615_工作日志_周一.md", [
    "# 20260615 工作日志 周一",
    "",
    "## 今日产出",
    "- 下周事项",
    "",
  ].join("\n")],
]);

const fakeApp = {
  vault: {
    adapter: {
      async list(dir: string) {
        return {
          files: Array.from(files.keys()).filter(path => path.startsWith(`${dir}/`)),
          folders: [],
        };
      },
      async read(path: string) {
        if (files.has(path)) return files.get(path) as string;
        throw new Error(`missing ${path}`);
      },
    },
  },
};

const weekly = await loadWeeklyWorklogs(fakeApp as any, new Date("2026-06-12T12:00:00+08:00"));

assert.deepEqual(weekly.map(item => item.date), ["2026-06-09", "2026-06-12"]);
assert.deepEqual(weekly.map(item => item.worklog.outputs[0]?.title), ["Kora：完成 Review 数据模型", "Pilot：完成权限方案"]);
assert.deepEqual(weekly.flatMap(item => item.worklog.todos.map(todo => todo.text)), ["Kora：完成复盘页", "Pilot：确认 Mail.app 权限"]);

const writeCalls: string[] = [];
const statusFile = {
  path: "04-项目/产品系统/Kora/Kora项目状态.md",
  basename: "Kora项目状态",
  stat: { ctime: 0, mtime: 0, size: 0 },
};
const readOnlyBacklogApp = {
  vault: {
    adapter: {
      async read(path: string) {
        if (path === ".thirdspace/project-index.yaml") return [
          'version: "1.0"',
          "projects:",
          '  - id: "kora"',
          '    name: "Kora"',
          '    workspace: "04-项目/产品系统/Kora"',
          '    lifecycle: "active"',
          '    status_note: "04-项目/产品系统/Kora/Kora项目状态.md"',
          "",
        ].join("\n");
        throw new Error(`missing ${path}`);
      },
      async write(path: string) {
        writeCalls.push(`adapter.write:${path}`);
      },
      async exists() {
        return false;
      },
    },
    getAbstractFileByPath(path: string) {
      if (path === statusFile.path) return statusFile;
      return null;
    },
    getMarkdownFiles() {
      return [statusFile];
    },
    async read(file: { path: string }) {
      if (file.path === statusFile.path) return [
        "# Kora 项目状态",
        "",
        "## 下一步",
        "",
        "- [ ] 完成受控写入收口",
        "",
      ].join("\n");
      throw new Error(`missing file ${file.path}`);
    },
    async create(path: string) {
      writeCalls.push(`vault.create:${path}`);
      return { path, basename: path.split("/").pop()?.replace(/\.md$/i, "") ?? path, stat: { ctime: 0, mtime: 0, size: 0 } };
    },
    async modify(file: { path: string }) {
      writeCalls.push(`vault.modify:${file.path}`);
    },
    async createFolder(path: string) {
      writeCalls.push(`vault.createFolder:${path}`);
    },
  },
  metadataCache: {
    getFileCache() {
      return null;
    },
  },
};

const backlog = await loadProjectBacklog(readOnlyBacklogApp as any);
assert.deepEqual(backlog, []);
assert.deepEqual(writeCalls, []);

const liveGitApp = {
  vault: {
    adapter: {
      basePath: "/Volumes/资料/projects/thirdspace/rain",
      async read(path: string) {
        if (path === ".thirdspace/project-index.yaml") return [
          'version: "1.0"',
          "projects:",
          '  - id: "kora"',
          '    name: "Kora"',
          '    workspace: "04-项目/产品系统/Kora"',
          '    lifecycle: "active"',
          '    repo_path: "/Volumes/资料/projects/Kora"',
          '  - id: "xiaohuanzi"',
          '    name: "小桓子"',
          '    workspace: "99-归档/完结项目/小桓子"',
          '    lifecycle: "archived"',
          '    repo_path: "/Volumes/资料/projects/xiaohuanzi"',
          "",
        ].join("\n");
        if (path === ".thirdspace/git/commits.json") return JSON.stringify({
          repos: [
            {
              id: "cache-only",
              name: "Cache Only",
              path: "/Volumes/资料/projects/cache-only",
              branch: "main",
              commits: [
                {
                  hash: "dddddddddddddddddddddddddddddddddddddddd",
                  short_hash: "ddddddd",
                  time: "2026-06-15T08:00:00+08:00",
                  subject: "docs: cached fallback",
                  files: ["README.md"],
                },
              ],
            },
            {
              id: "kora",
              name: "Kora",
              path: "/Volumes/资料/projects/Kora",
              branch: "main",
              commits: [
                {
                  hash: "abababababababababababababababababababab",
                  short_hash: "abababa",
                  time: "2026-06-15T11:00:00+08:00",
                  subject: "feat: cached kora fallback",
                  files: ["Sources/Kora/Fallback.swift"],
                },
              ],
            },
          ],
        });
        throw new Error(`missing ${path}`);
      },
    },
  },
};

const liveGitCalls: string[] = [];
const liveExecutor: LiveGitExecutor = async (_command, args) => {
  const repoPath = args[1];
  liveGitCalls.push(repoPath);
  if (repoPath === "/Volumes/资料/projects/xiaohuanzi") throw new Error("archived repo should not be read");
  if (args.includes("rev-parse")) return { stdout: repoPath === "/Volumes/资料/projects/Kora" ? "main\n" : "main\n" };
  if (repoPath === "/Volumes/资料/projects/thirdspace/rain") return {
    stdout: [
      "\x1eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\x1feeeeeee\x1f2026-06-15T09:00:00+08:00\x1fRain User\x1fdocs: live rain",
      "02-日记/工作日志/20260615_工作日志_周一.md",
    ].join("\n"),
  };
  return {
    stdout: [
      "\x1effffffffffffffffffffffffffffffffffffffff\x1fffffff\x1f2026-06-15T10:00:00+08:00\x1fRain User\x1ffeat: live kora",
      "Sources/Kora/App.swift",
    ].join("\n"),
  };
};

setLiveGitExecutorForTests(liveExecutor);
const liveActivity = await getGitActivity(liveGitApp as any, 7);
setLiveGitExecutorForTests(null);

assert.equal(liveActivity.total, 2);
assert.deepEqual(liveActivity.repos.map(repo => repo.id), ["kora", "rain"]);
assert.deepEqual(liveActivity.repos.map(repo => repo.name), ["Kora", "rain"]);
assert.deepEqual(liveActivity.repos.map(repo => repo.count), [1, 1]);
assert.equal(liveActivity.days.find(day => day.date === "2026-06-15")?.count, 2);
assert(!liveGitCalls.includes("/Volumes/资料/projects/xiaohuanzi"));

const partialLiveCalls: string[] = [];
const partialLiveExecutor: LiveGitExecutor = async (_command, args) => {
  const repoPath = args[1];
  partialLiveCalls.push(repoPath);
  if (repoPath === "/Volumes/资料/projects/Kora") throw new Error("kora git timeout");
  if (repoPath === "/Volumes/资料/projects/xiaohuanzi") throw new Error("archived repo should not be read");
  if (args.includes("rev-parse")) return { stdout: "main\n" };
  return {
    stdout: [
      "\x1eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\x1feeeeeee\x1f2026-06-15T09:00:00+08:00\x1fRain User\x1fdocs: live rain",
      "02-日记/工作日志/20260615_工作日志_周一.md",
    ].join("\n"),
  };
};

setLiveGitExecutorForTests(partialLiveExecutor);
const partialFallbackActivity = await getGitActivity(liveGitApp as any, 7);
setLiveGitExecutorForTests(null);

assert.equal(partialFallbackActivity.total, 2);
assert.deepEqual(partialFallbackActivity.repos.map(repo => repo.id), ["kora", "rain"]);
assert.deepEqual(partialFallbackActivity.repos.map(repo => repo.count), [1, 1]);
assert.equal(partialFallbackActivity.days.find(day => day.date === "2026-06-15")?.count, 2);
assert(!partialLiveCalls.includes("/Volumes/资料/projects/xiaohuanzi"));

const failingExecutor: LiveGitExecutor = async () => {
  throw new Error("git unavailable");
};

setLiveGitExecutorForTests(failingExecutor);
const fallbackActivity = await getGitActivity(liveGitApp as any, 7);
setLiveGitExecutorForTests(null);

assert.equal(fallbackActivity.total, 2);
assert.deepEqual(fallbackActivity.repos.map(repo => repo.id), ["kora", "cache-only"]);
assert.equal(fallbackActivity.days.find(day => day.date === "2026-06-15")?.count, 2);

const todayWorklogPath = "02-日记/工作日志/20260615_工作日志_周一.md";
const liveTimelineFiles = new Map<string, string>([
  [todayWorklogPath, [
    "# 20260615 工作日志 周一",
    "",
    "## 今日重点",
    "",
    "## 今日Todo",
    "",
    "## 重点记录",
    "",
    "## 今日产出",
    "",
    "## Agent 产出",
    "",
    "## Git 提交",
    "",
  ].join("\n")],
  [".thirdspace/project-index.yaml", [
    'version: "1.0"',
    "projects:",
    '  - id: "kora"',
    '    name: "Kora"',
    '    workspace: "04-项目/产品系统/Kora"',
    '    lifecycle: "active"',
    '    repo_path: "/Volumes/资料/projects/Kora"',
    "",
  ].join("\n")],
]);

const liveTimelineApp = {
  vault: {
    adapter: {
      basePath: "/Volumes/资料/projects/thirdspace/rain",
      async exists(path: string) {
        return liveTimelineFiles.has(path);
      },
      async list(dir: string) {
        return {
          files: Array.from(liveTimelineFiles.keys()).filter(path => path.startsWith(`${dir}/`)),
          folders: [],
        };
      },
      async read(path: string) {
        if (liveTimelineFiles.has(path)) return liveTimelineFiles.get(path) as string;
        throw new Error(`missing ${path}`);
      },
    },
  },
};

const liveTimelineExecutor: LiveGitExecutor = async (_command, args) => {
  const repoPath = args[1];
  if (args.includes("rev-parse")) return { stdout: repoPath === "/Volumes/资料/projects/Kora" ? "main\n" : "main\n" };
  if (repoPath === "/Volumes/资料/projects/thirdspace/rain") return {
    stdout: [
      "\x1e1212121212121212121212121212121212121212\x1f1212121\x1f2026-06-15T13:30:00+08:00\x1fRain User\x1fdocs: live timeline",
      "04-项目/产品系统/ThirdSpace Dashboard/项目管理系统改造/live.md",
    ].join("\n"),
  };
  return { stdout: "" };
};

setLiveGitExecutorForTests(liveTimelineExecutor);
const liveTodayWorklog = await loadTodayWorklog(liveTimelineApp as any);
setLiveGitExecutorForTests(null);

const liveTimelineGitItems = liveTodayWorklog?.timeline.filter(item => item.kind === "git") ?? [];
assert.equal(liveTimelineGitItems.length, 1);
assert.equal(liveTimelineGitItems[0].title, "rain: docs: live timeline");
assert.equal(liveTimelineGitItems[0].targetPath, "04-项目/产品系统/ThirdSpace Dashboard/项目管理系统改造/live.md");
assert.equal(liveTimelineGitItems[0].subtitle, "rain · main · 1212121 · 1 files");
