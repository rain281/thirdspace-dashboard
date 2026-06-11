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
    { label: "Focus YAML 与周计划不一致", detail: "2026-W25 缺周计划镜像" },
    { label: "周计划缺复盘", detail: "2026-W24" },
    { label: "项目状态缺标准 section", detail: "Kora 缺 ## 待决策" },
  ],
});

const text = parent.textContent();
assert.match(text, /DATA HEALTH/);
assert.match(text, /2 candidates/);
assert.match(text, /1 onboarding/);
assert.match(text, /3 materials/);
assert.match(text, /4 recent/);
assert.match(text, /8 workspaces/);
assert.match(text, /2 git repos/);
assert.match(text, /3 write consistency/);
assert.match(text, /Focus YAML 与周计划不一致/);
assert.match(text, /周计划缺复盘/);
assert.match(text, /项目状态缺标准 section/);
