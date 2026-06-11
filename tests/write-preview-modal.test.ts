import assert from "node:assert/strict";
import { renderWritePreviewModalContent } from "../src/components/write-preview-modal";
import type { ControlledWritePreview } from "../src/data/controlled-write";

class FakeElement {
  cls = "";
  text = "";
  children: FakeElement[] = [];
  listeners = new Map<string, Array<() => void>>();

  constructor(cls = "", text = "") {
    this.cls = cls;
    this.text = text;
  }

  empty(): void {
    this.children = [];
    this.text = "";
  }

  addClass(cls: string): void {
    this.cls = [this.cls, cls].filter(Boolean).join(" ");
  }

  createDiv(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(new FakeElement(options.cls ?? "", options.text ?? ""));
  }

  createSpan(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(new FakeElement(options.cls ?? "", options.text ?? ""));
  }

  createEl(tag: string, options: { cls?: string; text?: string; attr?: Record<string, string> } = {}): FakeElement {
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

  private append(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }
}

const preview: ControlledWritePreview = {
  path: "02-日记/周计划/2026-W24_周计划.md",
  title: "写入周复盘",
  summary: "更新 ## 复盘 中的 Dashboard managed block",
  before: "旧内容",
  after: "新内容",
  writeContent: "### Dashboard 周复盘\n\n- Kora 有产出。",
  diff: "-旧内容\n+新内容",
  warnings: ["只会替换 Dashboard managed block，不覆盖手写复盘。"],
};

let confirmed = 0;
let cancelled = 0;
const parent = new FakeElement();
renderWritePreviewModalContent(parent as unknown as HTMLElement, preview, {
  onConfirm: () => { confirmed += 1; },
  onCancel: () => { cancelled += 1; },
});

const text = parent.textContent();
assert.match(text, /写入周复盘/);
assert.match(text, /02-日记\/周计划\/2026-W24_周计划\.md/);
assert.match(text, /更新 ## 复盘/);
assert.match(text, /只会替换 Dashboard managed block/);
assert.match(text, /### Dashboard 周复盘/);
assert.match(text, /-旧内容/);
assert.match(text, /\+新内容/);

parent.findByClass("ts-write-preview-cancel")?.click();
assert.equal(cancelled, 1);
assert.equal(confirmed, 0);

parent.findByClass("ts-write-preview-confirm")?.click();
assert.equal(confirmed, 1);
