import assert from "node:assert/strict";
import { renderTodayExecution } from "../src/components/today-execution";
import type { TodayExecutionModel } from "../src/data/project-management";

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

  textContent(): string {
    return [this.text, ...this.children.map(child => child.textContent())].filter(Boolean).join(" ");
  }

  findAllByClass(cls: string): FakeElement[] {
    return [
      ...(this.cls.split(/\s+/).includes(cls) ? [this] : []),
      ...this.children.flatMap(child => child.findAllByClass(cls)),
    ];
  }

  private append(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }
}

const execution: TodayExecutionModel = {
  outcomes: [
    { title: "完成 Phase 6 计划", subtitle: "10:00", badge: "output" },
    { title: "部署 Project Detail", subtitle: "11:00", badge: "output" },
  ],
  focusCoverage: {
    confirmationStatus: "confirmed",
    coveredCount: 1,
    totalFocus: 3,
    focusProjects: [
      { id: "kora", name: "Kora", role: "main", covered: true },
      { id: "pilot", name: "Pilot", role: "support", covered: false },
      { id: "aidv", name: "AIDV", role: "maintenance", covered: false },
    ],
    offFocusProjects: ["AI漫剧"],
  },
  offFocusProjects: ["AI漫剧"],
  commitmentsAtRisk: [
    { kind: "blocked", text: "AIDV：blocked by reviewer", tone: "warn" },
    { kind: "off-focus", text: "Off-focus：AI漫剧", tone: "notice" },
  ],
  decisionsNeeded: [
    { projectId: "pilot", projectName: "Pilot", role: "support", text: "是否先做 Mail.app 权限" },
  ],
  nextActionHints: [],
};

const opened: string[] = [];
const parent = new FakeElement();
renderTodayExecution(parent as unknown as HTMLElement, execution, {
  openToday: () => opened.push("today"),
});

const text = parent.textContent();
assert.match(text, /TODAY OUTCOMES/);
assert.match(text, /完成 Phase 6 计划/);
assert.match(text, /AT RISK/);
assert.match(text, /blocked by reviewer/);
assert.match(text, /DECISION NEEDED/);
assert.match(text, /Pilot/);
assert.match(text, /Mail\.app/);
assert.equal(parent.findAllByClass("ts-today-exec-section").length, 3);

const emptyParent = new FakeElement();
renderTodayExecution(emptyParent as unknown as HTMLElement, {
  ...execution,
  outcomes: [],
  commitmentsAtRisk: [],
  decisionsNeeded: [],
}, {
  openToday: () => opened.push("empty"),
});

const emptyText = emptyParent.textContent();
assert.match(emptyText, /写入 ## 今日产出/);
assert.match(emptyText, /No execution risks/);
assert.match(emptyText, /No pending decisions/);
