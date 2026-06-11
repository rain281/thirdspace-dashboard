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
});

const text = parent.textContent();
assert.match(text, /DATA HEALTH/);
assert.match(text, /2 candidates/);
assert.match(text, /1 onboarding/);
assert.match(text, /3 materials/);
assert.match(text, /4 recent/);
assert.match(text, /8 workspaces/);
assert.match(text, /2 git repos/);
