import assert from "node:assert/strict";
import { renderPortfolio } from "../src/components/portfolio";
import type { PortfolioModel } from "../src/data/project-management";

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
    for (const listener of this.listeners.get("click") ?? []) listener({ stopPropagation() {} } as unknown as Event);
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

const populatedPortfolio: PortfolioModel = {
  focusWeek: {
    week: "2026-W23",
    confirmationStatus: "confirmed",
    focusLimit: 3,
    focusProjects: [{ id: "kora", role: "main", reason: "P0 main" }],
    offFocusPolicy: "allow_today_with_reason",
    offFocusEvents: [],
  },
  summary: {
    totalManaged: 1,
    activeCount: 1,
    watchCount: 0,
    focusLimit: 3,
    focusUsed: 1,
    riskCount: 1,
    attentionCount: 0,
    staleCount: 0,
    noNextStepCount: 0,
    deliveryGateGapCount: 1,
  },
  projects: [
    {
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
    },
  ],
};

const opened: string[] = [];
let confirmedFocus = 0;
const parent = new FakeElement();
renderPortfolio(
  parent as unknown as HTMLElement,
  populatedPortfolio,
  {
    openFile: path => opened.push(path),
    confirmWeeklyFocus: () => { confirmedFocus += 1; },
  },
);

const text = parent.textContent();
assert.match(text, /项目组合健康/);
assert.match(text, /本周焦点/);
assert.match(text, /确认下周焦点/);
assert.match(text, /Kora/);
assert.match(text, /P0/);
assert.match(text, /交付/);
assert.match(text, /active/);
assert.match(text, /风险/);
assert.match(text, /存在未处理风险/);
assert.match(text, /M2 Portfolio/);
assert.match(text, /完成只读 Portfolio/);
assert.match(text, /发布门禁未关闭/);
assert.match(text, /确认首屏密度/);
assert.match(text, /npm run build/);
assert.doesNotMatch(text, /SYSTEM SIGNALS/);
assert.doesNotMatch(text, /PROJECT DETAIL/);

parent.findByClass("ts-focus-confirm-btn")?.click();
assert.equal(confirmedFocus, 1);

parent.findByClass("ts-project-card")?.click();
assert.deepEqual(opened, ["04-项目/产品系统/Kora/Kora项目状态.md"]);

const fallbackOpened: string[] = [];
const fallbackParent = new FakeElement();
renderPortfolio(
  fallbackParent as unknown as HTMLElement,
  {
    ...populatedPortfolio,
    projects: [
      {
        ...populatedPortfolio.projects[0],
        statusNote: "",
        projectHome: "04-项目/产品系统/Kora/首页.md",
      },
    ],
  },
  { openFile: path => fallbackOpened.push(path) },
);
fallbackParent.findByClass("ts-project-card")?.click();
assert.deepEqual(fallbackOpened, ["04-项目/产品系统/Kora/首页.md"]);

const emptyParent = new FakeElement();
renderPortfolio(
  emptyParent as unknown as HTMLElement,
  {
    focusWeek: { week: "2026-W23", confirmationStatus: "confirmed", focusLimit: 3, focusProjects: [], offFocusPolicy: "allow_today_with_reason", offFocusEvents: [] },
    summary: {
      totalManaged: 0,
      activeCount: 0,
      watchCount: 0,
      focusLimit: 3,
      focusUsed: 0,
      riskCount: 0,
      attentionCount: 0,
      staleCount: 0,
      noNextStepCount: 0,
      deliveryGateGapCount: 0,
    },
    projects: [],
  },
  { openFile: () => undefined },
);

assert.match(emptyParent.textContent(), /暂无托管项目/);

const pendingFocusParent = new FakeElement();
renderPortfolio(
  pendingFocusParent as unknown as HTMLElement,
  {
    ...populatedPortfolio,
    focusWeek: {
      ...populatedPortfolio.focusWeek,
      confirmationStatus: "pending",
      focusProjects: [],
    },
    projects: populatedPortfolio.projects.map(project => ({ ...project, focusRole: null })),
    summary: {
      ...populatedPortfolio.summary,
      focusUsed: 0,
    },
  },
  { openFile: () => undefined },
);

assert.match(pendingFocusParent.textContent(), /本周焦点待确认/);

const openedDetail: string[] = [];
const routeOpened: string[] = [];
const detailParent = new FakeElement();
renderPortfolio(
  detailParent as unknown as HTMLElement,
  populatedPortfolio,
  {
    openProjectDetail: id => openedDetail.push(id),
    openFile: path => routeOpened.push(path),
  },
);

const detailText = detailParent.textContent();
assert.doesNotMatch(detailText, /PROJECT DETAIL/);
assert.doesNotMatch(detailText, /项目详情/);
assert.match(detailText, /Kora/);

detailParent.findByClass("ts-project-card")?.click();
assert.deepEqual(openedDetail, ["kora"]);
assert.deepEqual(routeOpened, []);
