import type { ProjectCandidate } from "./project-discovery";
import type { ProjectMaterialsItem } from "./project-materials";
import type { ProjectOnboardingItem } from "./project-onboarding";
import { createOperationPreview, type ControlledWritePreview } from "./controlled-write";
import { getTodayWorklogPath, localDateStr, type ProjectBacklogItem, type TodoItem } from "./vault-reader";

export function createTodoAddOperationPreview(text: string): ControlledWritePreview {
  return createOperationPreview({
    path: getTodayWorklogPath(),
    title: "新增今日 Todo",
    summary: "确认后追加到今日工作日志 ## 今日Todo。",
    content: [
      `目标文件：${getTodayWorklogPath()}`,
      "目标 section：## 今日Todo",
      `写入内容：- [ ] ${text}`,
    ].join("\n"),
    warnings: ["取消预览不会修改今日工作日志。"],
  });
}

export function createTodoToggleOperationPreview(item: TodoItem, nextDone: boolean): ControlledWritePreview {
  return createOperationPreview({
    path: getTodayWorklogPath(),
    title: nextDone ? "完成今日 Todo" : "恢复今日 Todo",
    summary: nextDone
      ? "确认后从 ## 今日Todo 移出，并追加到 ## 今日产出。"
      : "确认后把 Todo 恢复为未完成状态。",
    content: [
      `目标文件：${getTodayWorklogPath()}`,
      `目标 section：${nextDone ? "## 今日产出" : "## 今日Todo"}`,
      nextDone ? `写入内容：- ${item.text} ✅ ${localDateStr(new Date())}` : `写入内容：- [ ] ${item.text}`,
    ].join("\n"),
    warnings: nextDone
      ? ["确认后会移动今日 Todo，并同步项目完成事项 ledger。"]
      : ["确认后只恢复今日 Todo 状态。"],
  });
}

export function createTodoRenameOperationPreview(item: TodoItem, newText: string): ControlledWritePreview {
  return createOperationPreview({
    path: getTodayWorklogPath(),
    title: "重命名今日 Todo",
    summary: "确认后更新今日工作日志 ## 今日Todo 中的任务文本。",
    content: [
      `目标文件：${getTodayWorklogPath()}`,
      "目标 section：## 今日Todo",
      `原内容：${item.text}`,
      `新内容：${newText}`,
    ].join("\n"),
    warnings: ["取消预览会保留原 Todo 文本。"],
  });
}

export function createPromoteBacklogOperationPreview(item: ProjectBacklogItem): ControlledWritePreview {
  return createOperationPreview({
    path: `${getTodayWorklogPath()} + ${item.path}`,
    title: "加入今日 Todo",
    summary: "确认后把项目池事项加入今日工作日志，并从项目未完成事项中移出。",
    content: [
      `今日目标：${getTodayWorklogPath()} ## 今日Todo`,
      `项目池来源：${item.path}`,
      `写入内容：- [ ] ${item.project}：${item.text}`,
      "附带动作：从项目池移出该事项，避免重复推进。",
    ].join("\n"),
    warnings: ["这是多文件操作；确认前不会修改今日工作日志或项目事项池。"],
  });
}

export function createProjectDetailTodayOperationPreview(projectName: string, itemText: string): ControlledWritePreview {
  const text = projectDetailTodayTodoText(projectName, itemText);
  return createOperationPreview({
    path: getTodayWorklogPath(),
    title: "从项目详情加入今日",
    summary: "确认后追加到今日工作日志 ## 今日Todo。",
    content: [
      `目标文件：${getTodayWorklogPath()}`,
      "目标 section：## 今日Todo",
      `项目：${projectName}`,
      `来源条目：${itemText}`,
      `写入内容：- [ ] ${text}`,
    ].join("\n"),
    warnings: [
      "确认后只会写入今日工作日志，不会修改项目状态笔记。",
      "如今日 Todo 已存在相同内容，写入函数会保持幂等不重复追加。",
    ],
  });
}

export function createNewNoteOperationPreview(path: string, content: string): ControlledWritePreview {
  return createOperationPreview({
    path,
    title: "创建新笔记",
    summary: "确认后在收件箱创建一条新笔记。",
    content: [
      `目标文件：${path}`,
      "写入内容：",
      content.trimEnd(),
    ].join("\n"),
    warnings: ["取消预览不会创建新笔记。"],
  });
}

export function projectDetailTodayTodoText(projectName: string, itemText: string): string {
  const project = projectName.trim();
  const text = itemText.trim();
  if (!project) return text;
  const normalized = text.toLowerCase();
  const prefix = project.toLowerCase();
  if (normalized.startsWith(`${prefix}:`) || normalized.startsWith(`${prefix}：`)) return text;
  return `${project}：${text}`;
}

export function createTodayWorklogOperationPreview(path: string): ControlledWritePreview {
  return createOperationPreview({
    path,
    title: "创建今日工作日志",
    summary: "确认后创建今日工作日志骨架并打开。",
    content: [
      `目标文件：${path}`,
      "写入内容：标准工作日志骨架，包含 今日重点 / 今日Todo / 重点记录 / 今日产出 / Agent 产出 等 section。",
    ].join("\n"),
    warnings: ["仅当今日工作日志不存在时才会写入。"],
  });
}

export function createDiscoveryCandidateOperationPreview(
  candidate: ProjectCandidate,
  action: "accept" | "ignore",
): ControlledWritePreview {
  if (action === "ignore") {
    return createOperationPreview({
      path: ".thirdspace/queues/project-candidates.json + 01-收件箱/待整理/项目发现确认.md",
      title: "忽略项目候选",
      summary: "确认后把候选项目标记为 ignored，并更新发现确认单。",
      content: [
        `候选项目：${candidate.name}`,
        `仓库路径：${candidate.path}`,
        "目标文件：.thirdspace/queues/project-candidates.json",
        "目标文件：01-收件箱/待整理/项目发现确认.md",
      ].join("\n"),
      warnings: ["确认后候选项目后续不会重复提醒。"],
    });
  }

  return createOperationPreview({
    path: ".thirdspace/project-index.yaml + .thirdspace/queues/project-candidates.json + 项目首页",
    title: "纳入项目候选",
    summary: "确认后把候选项目加入项目索引，创建项目首页，并更新发现队列。",
    content: [
      `候选项目：${candidate.name}`,
      `仓库路径：${candidate.path}`,
      "目标文件：.thirdspace/project-index.yaml",
      "目标文件：.thirdspace/queues/project-candidates.json",
      "目标文件：01-收件箱/待整理/项目发现确认.md",
      `目标文件：${candidate.suggested_workspace}/首页.md`,
    ].join("\n"),
    warnings: ["确认前不会写入项目索引、项目首页或发现队列。"],
  });
}

export function createOnboardingOperationPreview(item: ProjectOnboardingItem): ControlledWritePreview {
  return createOperationPreview({
    path: `${item.repoPath}/.git/hooks/post-commit + .thirdspace/git/commits.json + ${getTodayWorklogPath()}`,
    title: "接入项目运行记录",
    summary: "确认后安装或更新项目级 repo hook，索引 Git history，并记录到今日工作日志。",
    content: [
      `项目：${item.name}`,
      `仓库：${item.repoPath}`,
      "目标：repo post-commit hook",
      "目标文件：.thirdspace/git/commits.json",
      `目标 section：${getTodayWorklogPath()} ## Agent 产出`,
      `当前状态：${item.reason}`,
    ].join("\n"),
    warnings: [
      "确认后才会安装或更新项目级 hook；不会启用全局 hook 或 launch agent。",
      "确认后会读取 Git 提交元数据，但不读取 diff 正文或密钥值。",
    ],
  });
}

export function createMaterialsOperationPreview(item: ProjectMaterialsItem): ControlledWritePreview {
  return createOperationPreview({
    path: `${item.indexPath} + .thirdspace/material-imports.json + ${getTodayWorklogPath()}`,
    title: item.needsImport ? "更新项目资料索引" : "重扫项目资料索引",
    summary: "确认后重扫项目资料文档，更新索引、manifest，并记录到今日工作日志。",
    content: [
      `项目：${item.name}`,
      `仓库：${item.repoPath}`,
      `目标文件：${item.indexPath}`,
      "目标文件：.thirdspace/material-imports.json",
      `目标 section：${getTodayWorklogPath()} ## Agent 产出`,
      `候选资料：${item.candidateCount}`,
      `当前状态：${item.reason}`,
    ].join("\n"),
    warnings: ["当前模式为 index-only；确认后不会导入源码、密钥文件或全文快照。"],
  });
}
