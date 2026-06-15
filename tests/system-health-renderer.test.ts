import assert from "node:assert/strict";
import { renderSystemHealth } from "../src/components/system-health";

class FakeElement {
  cls = "";
  text = "";
  children: FakeElement[] = [];

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

  textContent(): string {
    return [this.text, ...this.children.map(child => child.textContent())].filter(Boolean).join(" ");
  }

  findByClass(cls: string): FakeElement | undefined {
    if (this.cls.split(/\s+/).includes(cls)) return this;
    for (const child of this.children) {
      const found = child.findByClass(cls);
      if (found) return found;
    }
    return undefined;
  }

  findAllByClass(cls: string): FakeElement[] {
    const current = this.cls.split(/\s+/).includes(cls) ? [this] : [];
    return [...current, ...this.children.flatMap(child => child.findAllByClass(cls))];
  }

  private append(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }
}

const parent = new FakeElement();

renderSystemHealth(parent as unknown as HTMLElement, {
  discoveryPending: 2,
  onboardingPending: 1,
  materialsPending: 3,
  recentCount: 4,
  workspaceCount: 8,
  gitRepoCount: 2,
  writeConsistencyIssues: [
    { label: "焦点 YAML 与周计划不一致", detail: "2026-W25 缺周计划镜像" },
    { label: "周计划缺复盘", detail: "2026-W24" },
    { label: "项目状态缺标准 section", detail: "Kora 缺 ## 待决策" },
  ],
});

const text = parent.textContent();
assert.match(text, /数据健康/);
assert.match(text, /9 个维护信号/);
assert.match(text, /2 候选/);
assert.match(text, /1 接入/);
assert.match(text, /3 资料/);
assert.match(text, /3 写入/);
assert.equal(parent.findAllByClass("ts-system-health-metric").length, 4);
assert.ok(parent.findByClass("ts-system-health-issue-panel"), "issue panel exists");
assert.ok(parent.findByClass("ts-system-health-context"), "context footer exists");
assert.doesNotMatch(text, /4 最近/);
assert.doesNotMatch(text, /8 工作区/);
assert.doesNotMatch(text, /2 Git仓库/);
assert.match(text, /最近 4/);
assert.match(text, /工作区 8/);
assert.match(text, /仓库 2/);
assert.match(text, /焦点 YAML 与周计划不一致/);
assert.match(text, /周计划缺复盘/);
assert.doesNotMatch(text, /项目状态缺标准 section/);
assert.match(text, /\+1 条未显示/);
