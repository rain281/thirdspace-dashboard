import assert from "node:assert/strict";
import { renderProjectDetailPage } from "../src/components/project-detail";
import type { ManagedProject } from "../src/data/project-management";

class FakeElement {
  cls = "";
  text = "";
  children: FakeElement[] = [];
  listeners = new Map<string, Array<() => void>>();

  constructor(cls = "", text = "") {
    this.cls = cls;
    this.text = text;
  }

  createDiv(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(new FakeElement(options.cls ?? "", options.text ?? ""));
  }

  createSpan(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(new FakeElement(options.cls ?? "", options.text ?? ""));
  }

  createEl(tag: string, options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(new FakeElement(options.cls ?? tag, options.text ?? ""));
  }

  addEventListener(event: string, listener: () => void): void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  click(): void {
    for (const listener of this.listeners.get("click") ?? []) listener();
  }

  textContent(): string {
    return [this.text, ...this.children.map(child => child.textContent())].filter(Boolean).join(" ");
  }

  findByClass(cls: string): FakeElement | null {
    if (this.cls.split(/\s+/).includes(cls)) return this;
    for (const child of this.children) {
      const found = child.findByClass(cls);
      if (found) return found;
    }
    return null;
  }

  findAllByClass(cls: string): FakeElement[] {
    return [
      ...(this.cls.split(/\s+/).includes(cls) ? [this] : []),
      ...this.children.flatMap(child => child.findAllByClass(cls)),
    ];
  }

  findByText(pattern: RegExp): FakeElement | null {
    if (pattern.test(this.textContent())) return this;
    for (const child of this.children) {
      const found = child.findByText(pattern);
      if (found) return found;
    }
    return null;
  }

  private append(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }
}

const project: ManagedProject = {
  id: "kora",
  name: "Kora",
  category: "产品系统",
  lifecycle: "active",
  priority: "P0",
  stage: "交付",
  workspace: "04-项目/产品系统/Kora",
  repoPath: "/Volumes/资料/projects/Kora",
  projectHome: "04-项目/产品系统/Kora/首页.md",
  statusNote: "04-项目/产品系统/Kora/Kora项目状态.md",
  codexContext: "04-项目/产品系统/Kora/Kora-Codex上下文.md",
  goal: "构建本地工作台",
  successCriteria: "能判断今日推进事项",
  milestone: "M2 Portfolio",
  nextStep: "- [ ] 完成只读 Portfolio",
  risks: "- [ ] 发布门禁未关闭",
  pendingDecisions: "- [ ] 确认首屏密度",
  deliveryGates: "- [ ] npm run build",
  recentStatus: "正在接入 Portfolio",
  updated: "2026-06-05",
  focusRole: "main",
  focusReason: "P0 main",
  health: {
    status: "风险",
    reasons: ["存在未处理风险", "交付阶段缺交付门禁"],
  },
};

const opened: string[] = [];
const workspaces: string[] = [];
const actions: string[] = [];
let backCount = 0;
const parent = new FakeElement();
renderProjectDetailPage(parent as unknown as HTMLElement, project, {
  backToPortfolio: () => { backCount += 1; },
  openFile: path => opened.push(path),
  openWorkspace: path => workspaces.push(path),
  projectDetailAction: (projectId, action) => actions.push(`${projectId}:${action}`),
});

const text = parent.textContent();
assert.match(text, /PROJECT DETAIL/);
assert.match(text, /返回项目组合/);
assert.match(text, /Kora/);
assert.match(text, /Goal/);
assert.match(text, /构建本地工作台/);
assert.match(text, /Success/);
assert.match(text, /能判断今日推进事项/);
assert.match(text, /Milestone/);
assert.match(text, /M2 Portfolio/);
assert.match(text, /Next Step/);
assert.match(text, /完成只读 Portfolio/);
assert.match(text, /Risks/);
assert.match(text, /发布门禁未关闭/);
assert.match(text, /Decisions/);
assert.match(text, /确认首屏密度/);
assert.match(text, /Quick Links/);
assert.match(text, /状态笔记/);
assert.match(text, /首页/);
assert.match(text, /上下文/);
assert.match(text, /仓库/);

parent.findByClass("ts-detail-back-btn")?.click();
assert.equal(backCount, 1);

parent
  .findAllByClass("ts-detail-link-row")
  .find(element => /^状态笔记/.test(element.textContent()))
  ?.click();
assert.deepEqual(opened, ["04-项目/产品系统/Kora/Kora项目状态.md"]);

parent
  .findAllByClass("ts-detail-link-row")
  .find(element => /^工作区/.test(element.textContent()))
  ?.click();
assert.deepEqual(workspaces, ["04-项目/产品系统/Kora"]);

parent.findByClass("ts-detail-action--next-step")?.click();
parent.findByClass("ts-detail-action--risk")?.click();
parent.findByClass("ts-detail-action--decision")?.click();
assert.deepEqual(actions, ["kora:next-step", "kora:risk", "kora:decision"]);

const emptyParent = new FakeElement();
renderProjectDetailPage(emptyParent as unknown as HTMLElement, null, {
  backToPortfolio: () => undefined,
  openFile: () => undefined,
});
assert.match(emptyParent.textContent(), /No project selected/);
