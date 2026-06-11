import assert from "node:assert/strict";
import { filterManagedProjectIndexEntries, loadWeeklyWorklogs } from "../src/data/vault-reader";

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
