import assert from "node:assert/strict";
import { renderTodayFocusStrip } from "../src/components/today-focus-strip";
import type { TodayFocusCoverage } from "../src/data/project-management";

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

const coverage: TodayFocusCoverage = {
  confirmationStatus: "confirmed",
  coveredCount: 1,
  totalFocus: 3,
  focusProjects: [
    { id: "kora", name: "Kora", role: "main", covered: true },
    { id: "pilot", name: "Pilot", role: "support", covered: false },
    { id: "aidv", name: "AIDV", role: "maintenance", covered: false },
  ],
  offFocusProjects: ["AI漫剧"],
};

const parent = new FakeElement();
renderTodayFocusStrip(parent as unknown as HTMLElement, coverage);

const text = parent.textContent();
assert.match(text, /本周焦点/);
assert.match(text, /1\/3/);
assert.match(text, /Kora 已覆盖/);
assert.match(text, /Pilot \/ AIDV 未覆盖/);
assert.match(text, /插队 AI漫剧/);
assert.equal(parent.findAllByClass("ts-today-focus-strip").length, 1);
assert.equal(parent.findAllByClass("ts-focus-coverage-row").length, 0);
assert.equal(parent.findAllByClass("ts-off-focus-row").length, 0);

const pendingParent = new FakeElement();
renderTodayFocusStrip(pendingParent as unknown as HTMLElement, {
  confirmationStatus: "pending",
  coveredCount: 0,
  totalFocus: 0,
  focusProjects: [],
  offFocusProjects: [],
});

assert.match(pendingParent.textContent(), /本周焦点待确认/);
assert.equal(pendingParent.findAllByClass("ts-today-focus-strip").length, 1);
