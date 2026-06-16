import assert from "node:assert/strict";
import {
  createDiscoveryCandidateOperationPreview,
  createMaterialsOperationPreview,
  createNewNoteOperationPreview,
  createOnboardingOperationPreview,
  createProjectDetailTodayOperationPreview,
  createPromoteBacklogOperationPreview,
  createTodayWorklogOperationPreview,
  createTodoAddOperationPreview,
  createTodoRenameOperationPreview,
  createTodoToggleOperationPreview,
} from "../src/data/dashboard-operation-preview";

const addPreview = createTodoAddOperationPreview("Kora：完成收口");
assert.equal(addPreview.title, "新增今日 Todo");
assert.match(addPreview.path, /02-日记\/工作日志\/\d{8}_工作日志_周.+\.md/);
assert.match(addPreview.writeContent, /目标 section：## 今日Todo/);
assert.match(addPreview.writeContent, /- \[ \] Kora：完成收口/);

const togglePreview = createTodoToggleOperationPreview({ text: "Kora：完成收口", done: false }, true);
assert.equal(togglePreview.title, "完成今日 Todo");
assert.match(togglePreview.writeContent, /目标 section：## 今日产出/);
assert.match(togglePreview.writeContent, /Kora：完成收口/);

const renamePreview = createTodoRenameOperationPreview({ text: "旧任务", done: false }, "新任务");
assert.equal(renamePreview.title, "重命名今日 Todo");
assert.match(renamePreview.writeContent, /原内容：旧任务/);
assert.match(renamePreview.writeContent, /新内容：新任务/);

const promotePreview = createPromoteBacklogOperationPreview({
  text: "完成受控写入",
  project: "Kora",
  path: "04-项目/产品系统/Kora/未完成事项.md",
  source: "04-项目/产品系统/Kora/未完成事项.md",
});
assert.equal(promotePreview.title, "加入今日 Todo");
assert.match(promotePreview.path, /04-项目\/产品系统\/Kora\/未完成事项\.md/);
assert.match(promotePreview.writeContent, /从项目池移出/);

const projectDetailTodayPreview = createProjectDetailTodayOperationPreview("Kora", "完成只读 Portfolio");
assert.equal(projectDetailTodayPreview.title, "从项目详情加入今日");
assert.match(projectDetailTodayPreview.path, /02-日记\/工作日志\/\d{8}_工作日志_周.+\.md/);
assert.match(projectDetailTodayPreview.writeContent, /项目：Kora/);
assert.match(projectDetailTodayPreview.writeContent, /写入内容：- \[ \] Kora：完成只读 Portfolio/);
assert.match(projectDetailTodayPreview.warnings.join(" "), /不会修改项目状态笔记/);

const newNotePreview = createNewNoteOperationPreview("01-收件箱/20260612_untitled.md", "---\ntitle: Untitled\n---\n");
assert.equal(newNotePreview.title, "创建新笔记");
assert.match(newNotePreview.writeContent, /01-收件箱\/20260612_untitled\.md/);

const todayPreview = createTodayWorklogOperationPreview("02-日记/工作日志/20260612_工作日志_周五.md");
assert.equal(todayPreview.title, "创建今日工作日志");
assert.match(todayPreview.writeContent, /工作日志骨架/);

const discoveryPreview = createDiscoveryCandidateOperationPreview({
  id: "kora",
  name: "Kora",
  path: "/Volumes/资料/projects/Kora",
  markers: ["git"],
  reason: "检测到 git",
  status: "pending",
  detected_at: "2026-06-12 03:00:00",
  last_seen_at: "2026-06-12 03:00:00",
  suggested_category: "产品系统",
  suggested_workspace: "04-项目/产品系统/Kora",
}, "accept");
assert.equal(discoveryPreview.title, "纳入项目候选");
assert.match(discoveryPreview.writeContent, /\.thirdspace\/project-index\.yaml/);
assert.match(discoveryPreview.writeContent, /04-项目\/产品系统\/Kora\/首页.md/);

const onboardingPreview = createOnboardingOperationPreview({
  id: "kora",
  name: "Kora",
  repoPath: "/Volumes/资料/projects/Kora",
  lifecycle: "active",
  hookInstalled: false,
  historyIndexed: false,
  needsOnboarding: true,
  reason: "缺少 repo hook / Git history",
});
assert.equal(onboardingPreview.title, "接入项目运行记录");
assert.match(onboardingPreview.writeContent, /repo post-commit hook/);
assert.match(onboardingPreview.warnings.join(" "), /确认后才会安装或更新项目级 hook/);

const materialsPreview = createMaterialsOperationPreview({
  id: "kora",
  name: "Kora",
  repoPath: "/Volumes/资料/projects/Kora",
  workspace: "04-项目/产品系统/Kora",
  indexPath: "04-项目/产品系统/Kora/资料索引.md",
  snapshotDir: "04-项目/产品系统/Kora/资料快照",
  candidateCount: 3,
  importedCount: 1,
  syncedCount: 1,
  newCount: 2,
  changedCount: 0,
  staleCount: 0,
  indexExists: true,
  selfVault: false,
  needsImport: true,
  reason: "新增 2 / 变更 0 / 移除 0",
});
assert.equal(materialsPreview.title, "更新项目资料索引");
assert.match(materialsPreview.writeContent, /资料索引.md/);
assert.match(materialsPreview.writeContent, /\.thirdspace\/material-imports\.json/);
