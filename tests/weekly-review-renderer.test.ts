import assert from "node:assert/strict";
import { renderWeeklyReview } from "../src/components/weekly-review";
import type { WeeklyReviewModel } from "../src/data/weekly-review";

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

  findAllByClass(cls: string): FakeElement[] {
    return [
      ...(this.cls.split(/\s+/).includes(cls) ? [this] : []),
      ...this.children.flatMap(child => child.findAllByClass(cls)),
    ];
  }

  findByClass(cls: string): FakeElement | null {
    if (this.cls.split(/\s+/).includes(cls)) return this;
    for (const child of this.children) {
      const found = child.findByClass(cls);
      if (found) return found;
    }
    return null;
  }

  private append(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }
}

const model: WeeklyReviewModel = {
  week: "2026-W24",
  worklogCount: 2,
  focusItems: [
    {
      projectId: "kora",
      name: "Kora",
      role: "main",
      roleLabel: "主项目",
      hasProgress: true,
      outcomeCount: 2,
      status: "推进",
      summary: "2 个产出",
    },
    {
      projectId: "aidv",
      name: "AIDV",
      role: "maintenance",
      roleLabel: "维护项目",
      hasProgress: false,
      outcomeCount: 0,
      status: "未推进",
      summary: "本周没有产出",
    },
    {
      projectId: "pilot",
      name: "Pilot",
      role: "support",
      roleLabel: "副项目",
      hasProgress: true,
      outcomeCount: 1,
      status: "推进",
      summary: "1 个产出",
    },
  ],
  outcomes: [
    { title: "Kora：完成 Portfolio", projectName: "Kora", sourcePath: "02-日记/工作日志/20260611_工作日志_周四.md", badge: "记录" },
    { title: "ThirdSpace Dashboard：Review 页面计划", projectName: "ThirdSpace Dashboard", sourcePath: "02-日记/工作日志/20260612_工作日志_周五.md", badge: "记录" },
  ],
  offFocus: {
    count: 1,
    events: [
      { date: "2026-06-11", projectId: "comic-drama", projectName: "AI漫剧", reason: "临时机会", target: "today" },
    ],
  },
  risks: {
    open: [{ projectName: "Kora", text: "发布门禁未关闭" }],
    closed: [],
  },
  decisions: {
    pending: [{ projectName: "Pilot", text: "是否先做 Mail.app 权限" }],
    made: [{ projectName: "Kora", text: "采用只读 Review 第一版" }],
  },
  nextWeekProposal: {
    summary: "继续主项目 Kora，并检查未推进 Focus。",
    items: [
      { projectId: "kora", projectName: "Kora", role: "main", action: "continue", reason: "主项目有产出" },
      { projectId: "aidv", projectName: "AIDV", role: "maintenance", action: "reconsider", reason: "本周没有产出，建议暂停或降级" },
    ],
  },
};

const parent = new FakeElement();
let writeClicks = 0;
renderWeeklyReview(parent as unknown as HTMLElement, model, {
  onWriteWeeklyReview: () => { writeClicks += 1; },
});

const text = parent.textContent();
assert.match(text, /周复盘/);
assert.match(text, /写入周复盘/);
assert.match(text, /2026-W24/);
assert.match(text, /焦点复盘/);
assert.match(text, /Kora/);
assert.match(text, /AIDV/);
assert.match(text, /Pilot/);
assert.match(text, /本周产出/);
assert.match(text, /完成 Portfolio/);
assert.match(text, /非焦点/);
assert.match(text, /AI漫剧/);
assert.match(text, /风险 \/ 决策/);
assert.match(text, /发布门禁未关闭/);
assert.match(text, /Mail\.app 权限/);
assert.match(text, /下周建议/);
assert.match(text, /继续主项目 Kora/);
assert.equal(parent.findAllByClass("ts-review-section").length, 5);
assert.equal(parent.findAllByClass("ts-review-focus-grid").length, 1);
assert.equal(parent.findAllByClass("ts-review-focus-cardlet").length, 3);

parent.findByClass("ts-review-write-btn")?.click();
assert.equal(writeClicks, 1);
