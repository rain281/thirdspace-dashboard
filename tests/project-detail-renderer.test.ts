import assert from "node:assert/strict";
import { renderProjectDetailPage } from "../src/components/project-detail";
import type { ManagedProject } from "../src/data/project-management";

class FakeElement {
  cls = "";
  text = "";
  children: FakeElement[] = [];
  attrs: Record<string, string> = {};
  listeners = new Map<string, Array<() => void>>();

  constructor(cls = "", text = "", attrs: Record<string, string> = {}) {
    this.cls = cls;
    this.text = text;
    this.attrs = attrs;
  }

  createDiv(options: { cls?: string; text?: string; attr?: Record<string, string> } = {}): FakeElement {
    return this.append(new FakeElement(options.cls ?? "", options.text ?? "", options.attr));
  }

  createSpan(options: { cls?: string; text?: string; attr?: Record<string, string> } = {}): FakeElement {
    return this.append(new FakeElement(options.cls ?? "", options.text ?? "", options.attr));
  }

  createEl(tag: string, options: { cls?: string; text?: string; attr?: Record<string, string> } = {}): FakeElement {
    return this.append(new FakeElement(options.cls ?? tag, options.text ?? "", options.attr));
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

  hasClass(cls: string): boolean {
    return this.cls.split(/\s+/).includes(cls);
  }

  getAttr(name: string): string | undefined {
    return this.attrs[name];
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
  goal: "- 构建本地工作台\n- 支持 PM 扫描项目状态\n- 这一条不进入 Goal 摘要",
  successCriteria: "- 能判断今日推进事项\n- 能看见风险与门禁\n- 能接续 Codex 上下文\n- 这一条不进入 Success 摘要",
  milestone: "M2 Portfolio",
  nextStep: "- [ ] 完成只读 Portfolio\n- [ ] 抽查 Kora 详情页\n- [x] 保留 preview modal\n- [ ] 这一条不进入 Next Step 摘要",
  risks: "- [ ] 发布门禁未关闭\n- [x] 旧内嵌详情已移除\n- [ ] 长文本可能溢出\n- [ ] 这一条不进入 Risks 摘要",
  pendingDecisions: "- [ ] 确认首屏密度\n- [ ] 是否打开仓库路径\n- [x] 保持四个底部页签\n- [ ] 这一条不进入 Decisions 摘要",
  deliveryGates: "- [ ] npm run build\n- [ ] Obsidian reload\n- [x] unit tests passed\n- [ ] 这一条不进入 Gates 摘要",
  recentStatus: "- 正在接入 Portfolio\n- 已完成实机复查\n- 这一条不进入 Recent Status 摘要",
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
assert.match(text, /项目详情/);
assert.match(text, /返回项目组合/);
assert.match(text, /Kora/);
assert.ok(parent.findByClass("ts-detail-main"), "detail main scan area exists");
assert.ok(parent.findByClass("ts-detail-risk-panel"), "detail risk panel exists");
assert.ok(parent.findByClass("ts-detail-context-panel"), "detail context panel exists");
assert.ok(parent.findByClass("ts-detail-action-panel"), "detail action panel exists");
assert.ok(parent.findByClass("ts-detail-section--goal"), "goal has semantic section class");
assert.ok(parent.findByClass("ts-detail-section--success"), "success has semantic section class");
assert.ok(parent.findByClass("ts-detail-section--next"), "next step has semantic section class");
assert.ok(parent.findByClass("ts-detail-section--risks"), "risks has semantic section class");
assert.ok(parent.findByClass("ts-detail-section--decisions"), "decisions has semantic section class");
assert.ok(parent.findByClass("ts-detail-section--gates"), "gates has semantic section class");
assert.ok(parent.findByClass("ts-detail-chip--priority"), "priority chip exists");
assert.ok(parent.findByClass("ts-detail-chip--stage"), "stage chip exists");
assert.ok(parent.findByClass("ts-detail-chip--lifecycle"), "lifecycle chip exists");
assert.ok(parent.findByClass("ts-detail-chip--health"), "health chip exists");
assert.ok(parent.findByClass("ts-detail-chip--focus"), "focus role chip exists");
assert.ok(parent.findByClass("ts-detail-chip--updated"), "updated chip exists");
assert.match(text, /目标/);
assert.match(text, /构建本地工作台/);
assert.match(text, /支持 PM 扫描项目状态/);
assert.doesNotMatch(text, /这一条不进入 Goal 摘要/);
assert.match(text, /成功标准/);
assert.match(text, /能判断今日推进事项/);
assert.match(text, /能看见风险与门禁/);
assert.match(text, /能接续 Codex 上下文/);
assert.doesNotMatch(text, /这一条不进入 Success 摘要/);
assert.match(text, /里程碑/);
assert.match(text, /M2 Portfolio/);
assert.match(text, /下一步/);
assert.match(text, /完成只读 Portfolio/);
assert.match(text, /抽查 Kora 详情页/);
assert.match(text, /保留 preview modal/);
assert.doesNotMatch(text, /这一条不进入 Next Step 摘要/);
assert.match(text, /风险/);
assert.match(text, /发布门禁未关闭/);
assert.match(text, /旧内嵌详情已移除/);
assert.match(text, /长文本可能溢出/);
assert.doesNotMatch(text, /这一条不进入 Risks 摘要/);
assert.match(text, /待决策/);
assert.match(text, /确认首屏密度/);
assert.match(text, /是否打开仓库路径/);
assert.match(text, /保持四个底部页签/);
assert.doesNotMatch(text, /这一条不进入 Decisions 摘要/);
assert.match(text, /交付门禁/);
assert.match(text, /npm run build/);
assert.match(text, /Obsidian reload/);
assert.match(text, /unit tests passed/);
assert.doesNotMatch(text, /这一条不进入 Gates 摘要/);
assert.match(text, /最近状态/);
assert.match(text, /正在接入 Portfolio/);
assert.match(text, /已完成实机复查/);
assert.doesNotMatch(text, /这一条不进入 Recent Status 摘要/);
assert.match(text, /优先级/);
assert.match(text, /阶段/);
assert.match(text, /周期/);
assert.match(text, /健康/);
assert.match(text, /焦点/);
assert.match(text, /更新/);
assert.match(text, /快速链接/);
assert.match(text, /状态笔记/);
assert.match(text, /首页/);
assert.match(text, /上下文/);
assert.match(text, /仓库/);

const checkedSummaries = parent.findAllByClass("ts-detail-summary-item--done");
const pendingSummaries = parent.findAllByClass("ts-detail-summary-item--pending");
assert.ok(checkedSummaries.length >= 3, "done summary items keep checkbox meaning");
assert.ok(pendingSummaries.length >= 6, "pending summary items keep checkbox meaning");

parent.findByClass("ts-detail-back-btn")?.click();
assert.equal(backCount, 1);

parent
  .findAllByClass("ts-detail-link-row")
  .find(element => /^状态笔记/.test(element.textContent()))
  ?.click();
assert.deepEqual(opened, ["04-项目/产品系统/Kora/Kora项目状态.md"]);
assert.match(
  parent
    .findAllByClass("ts-detail-link-row")
    .find(element => /^状态笔记/.test(element.textContent()))
    ?.getAttr("title") ?? "",
  /04-项目\/产品系统\/Kora\/Kora项目状态\.md/,
);

parent
  .findAllByClass("ts-detail-link-row")
  .find(element => /^工作区/.test(element.textContent()))
  ?.click();
assert.deepEqual(workspaces, ["04-项目/产品系统/Kora"]);

const repoRow = parent
  .findAllByClass("ts-detail-link-row")
  .find(element => /^仓库/.test(element.textContent()));
assert.equal(repoRow?.hasClass("is-muted"), true, "repo path is muted when no open handler exists");
assert.equal(repoRow?.hasClass("is-openable"), false, "repo path is not presented as openable");
assert.match(repoRow?.getAttr("title") ?? "", /只读路径/);

parent.findByClass("ts-detail-action--next-step")?.click();
parent.findByClass("ts-detail-action--risk")?.click();
parent.findByClass("ts-detail-action--decision")?.click();
assert.deepEqual(actions, ["kora:next-step", "kora:risk", "kora:decision"]);

const missingLinkParent = new FakeElement();
renderProjectDetailPage(missingLinkParent as unknown as HTMLElement, { ...project, codexContext: "" }, {
  backToPortfolio: () => undefined,
  openFile: () => undefined,
});
const missingContextRow = missingLinkParent
  .findAllByClass("ts-detail-link-row")
  .find(element => /^上下文/.test(element.textContent()));
assert.equal(missingContextRow?.hasClass("is-muted"), true, "missing link is muted");
assert.match(missingContextRow?.getAttr("title") ?? "", /缺失/);

const emptyParent = new FakeElement();
renderProjectDetailPage(emptyParent as unknown as HTMLElement, null, {
  backToPortfolio: () => undefined,
  openFile: () => undefined,
});
assert.match(emptyParent.textContent(), /未选择项目/);
