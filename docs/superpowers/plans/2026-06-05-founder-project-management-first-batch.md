# Founder Project Management First Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first testable batch of the single-founder project management system: project-status parsing, weekly Focus parsing, portfolio health derivation, and a read-only Portfolio page replacing the current project-system page's primary surface.

**Architecture:** Keep Obsidian integration thin and move project-management rules into pure TypeScript modules that can be unit tested without Obsidian. The first batch is read-only for PM state: it reads `.thirdspace/project-index.yaml`, optional `.thirdspace/focus-week.yaml`, and standardized project status notes, then renders Portfolio cards in the existing Dashboard view. Existing activity/materials/discovery behavior remains available in secondary/system sections but stops being the primary PM surface.

**Tech Stack:** TypeScript, Obsidian API, esbuild, Node `assert`, existing DOM helper APIs from Obsidian, existing CSS pipeline bundled through `src/styles.css`.

---

## Scope

In scope:

- Add a lightweight unit test runner.
- Add pure project-management parsing and derivation functions.
- Add Obsidian reader functions that load project status notes and Focus state.
- Replace the Projects page primary content with a read-only Portfolio view.
- Keep current maintenance data available in a secondary System/Maintenance card.
- Run unit tests and `npm run build`.

Out of scope for this batch:

- Migrating Rain vault project status notes.
- Writing `.thirdspace/focus-week.yaml`.
- Implementing controlled writes.
- Implementing Project Detail drawer.
- Modifying archived projects.
- Deploying to Rain plugin directory unless the user explicitly approves after the build.

## File Structure

- Create `scripts/run-tests.mjs`  
  Bundles and runs TypeScript unit tests using the existing `esbuild` dependency.

- Create `tests/run-tests.ts`  
  Imports test modules and prints a small pass/fail summary.

- Create `tests/project-management.test.ts`  
  Covers project status parsing, Focus parsing, health derivation, and portfolio summary rules.

- Modify `package.json`  
  Add `test:unit` script.

- Create `src/data/project-management.ts`  
  Pure types and functions: parse project status markdown, parse Focus YAML, derive managed projects, derive health status, derive portfolio summary.

- Create `src/data/project-management-reader.ts`  
  Obsidian integration: read project index, read project status notes, read Focus YAML, build the Portfolio model.

- Create `src/components/portfolio.ts`  
  DOM renderer for Portfolio cards and maintenance summary, with click handlers passed from `DashboardView`.

- Modify `src/view.ts`  
  Load Portfolio model, call the new renderer on the `projects` page, keep current maintenance cards secondary.

- Modify `src/styles.css`  
  Add Portfolio layout, status chips, Focus cards, risk/decision queues, and responsive constraints.

## Task 1: Add Unit Test Harness

**Files:**

- Create: `scripts/run-tests.mjs`
- Create: `tests/run-tests.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the test runner script**

Create `scripts/run-tests.mjs`:

```js
import esbuild from "esbuild";
import { mkdir, rm } from "fs/promises";
import { pathToFileURL } from "url";

const outdir = ".tmp/tests";
const outfile = `${outdir}/run-tests.mjs`;

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await esbuild.build({
  entryPoints: ["tests/run-tests.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile,
  external: ["obsidian"],
  sourcemap: "inline",
});

await import(pathToFileURL(outfile).href);
```

- [ ] **Step 2: Add the test entrypoint**

Create `tests/run-tests.ts`:

```ts
import "./project-management.test";

console.log("unit tests passed");
```

- [ ] **Step 3: Add a temporary failing smoke test**

Create `tests/project-management.test.ts` with a deliberately failing assertion so the runner is proven to execute tests:

```ts
import assert from "node:assert/strict";

assert.equal("runner", "not-runner");
```

- [ ] **Step 4: Add the npm script**

Modify `package.json` scripts to include `test:unit`:

```json
{
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc --noEmit --skipLibCheck && node esbuild.config.mjs production",
    "deploy": "npm run build && cp main.js ../vault/.obsidian/plugins/thirdspace-dashboard/main.js && cp main.css ../vault/.obsidian/plugins/thirdspace-dashboard/styles.css && echo '✅ deployed to vault'",
    "test:unit": "node scripts/run-tests.mjs"
  }
}
```

- [ ] **Step 5: Verify the runner fails**

Run:

```bash
npm run test:unit
```

Expected: command fails with an assertion error containing:

```text
Expected values to be strictly equal
```

- [ ] **Step 6: Replace the smoke test with an empty passing scaffold**

Modify `tests/project-management.test.ts`:

```ts
import assert from "node:assert/strict";

assert.equal("runner", "runner");
```

- [ ] **Step 7: Verify the runner passes**

Run:

```bash
npm run test:unit
```

Expected:

```text
unit tests passed
```

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/run-tests.mjs tests/run-tests.ts tests/project-management.test.ts
git commit -m "test: add unit test harness"
```

## Task 2: Add Project Status Parser

**Files:**

- Create: `src/data/project-management.ts`
- Modify: `tests/project-management.test.ts`

- [ ] **Step 1: Write failing parser tests**

Replace `tests/project-management.test.ts` with:

```ts
import assert from "node:assert/strict";
import {
  parseProjectStatusMarkdown,
  STANDARD_PROJECT_STATUS_SECTIONS,
} from "../src/data/project-management";

const standardMarkdown = `---
type: "project-status"
project: "kora"
priority: "P0"
stage: "构建"
lifecycle: "active"
updated: "2026-06-05"
---

# Kora 项目状态

## 项目摘要
Kora 是本地优先知识成长 App。

## 目标
- 构建一个可以管理 Rain vault 的本地工作台。

## 成功标准
- 用户能从 Dashboard 判断今日应该推进什么。

## 当前阶段
构建

## 当前里程碑
M2-A Vault scanner

## 本周 Focus
主项目

## 下一步
- [ ] 完成 Portfolio 只读版

## 风险与阻塞
- [ ] 状态模板尚未统一

## 待决策
- [ ] Portfolio 首屏密度

## 决策记录
- 2026-06-05 采用本周 Focus

## 交付门禁
- [ ] npm run build

## 最近状态
2026-06-05 更新设计文档

## 复盘记录
- 本周验证 Portfolio 方向

## 关联资源
- [[Kora-Codex上下文]]

## 历史备注
旧内容保留在这里
`;

const parsed = parseProjectStatusMarkdown(standardMarkdown, "04-项目/产品系统/Kora/Kora项目状态.md");

assert.equal(parsed.projectId, "kora");
assert.equal(parsed.priority, "P0");
assert.equal(parsed.stage, "构建");
assert.equal(parsed.lifecycle, "active");
assert.equal(parsed.updated, "2026-06-05");
assert.equal(parsed.sections.goal.includes("本地工作台"), true);
assert.equal(parsed.sections.nextStep.includes("完成 Portfolio 只读版"), true);
assert.deepEqual(parsed.missingSections, []);

const missing = parseProjectStatusMarkdown("# Legacy\n\n## 下一步\n- [ ] old", "legacy.md");
assert.equal(missing.projectId, "");
assert.equal(missing.priority, "P2");
assert.equal(missing.stage, "孵化");
assert.equal(missing.lifecycle, "watch");
assert.ok(missing.missingSections.includes("目标"));
assert.equal(STANDARD_PROJECT_STATUS_SECTIONS.includes("交付门禁"), true);
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm run test:unit
```

Expected: FAIL with an error that `../src/data/project-management` cannot be resolved.

- [ ] **Step 3: Implement the parser**

Create `src/data/project-management.ts`:

```ts
export const STANDARD_PROJECT_STATUS_SECTIONS = [
  "项目摘要",
  "目标",
  "成功标准",
  "当前阶段",
  "当前里程碑",
  "本周 Focus",
  "下一步",
  "风险与阻塞",
  "待决策",
  "决策记录",
  "交付门禁",
  "最近状态",
  "复盘记录",
  "关联资源",
  "历史备注",
] as const;

export type ProjectPriority = "P0" | "P1" | "P2" | "P3";
export type ProjectStage = "孵化" | "聚焦" | "构建" | "交付" | "增长" | "维护" | "暂停";
export type ManagedLifecycle = "active" | "watch" | "paused" | "archived";
export type FocusRole = "main" | "support" | "maintenance";
export type ProjectHealthStatus = "健康" | "注意" | "风险";
export type ProjectStatusSection = typeof STANDARD_PROJECT_STATUS_SECTIONS[number];

export interface ParsedProjectStatus {
  path: string;
  projectId: string;
  priority: ProjectPriority;
  stage: ProjectStage;
  lifecycle: ManagedLifecycle;
  updated: string;
  title: string;
  sections: Record<ProjectStatusSection, string>;
  missingSections: ProjectStatusSection[];
}

const PRIORITIES = new Set<ProjectPriority>(["P0", "P1", "P2", "P3"]);
const STAGES = new Set<ProjectStage>(["孵化", "聚焦", "构建", "交付", "增长", "维护", "暂停"]);
const LIFECYCLES = new Set<ManagedLifecycle>(["active", "watch", "paused", "archived"]);

export function parseProjectStatusMarkdown(markdown: string, path: string): ParsedProjectStatus {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const sections = emptySections();
  const title = firstHeading(body) || basenameWithoutMd(path);
  const parsedSections = parseSections(body);

  for (const section of STANDARD_PROJECT_STATUS_SECTIONS) {
    sections[section] = parsedSections.get(section)?.trim() ?? "";
  }

  return {
    path,
    projectId: scalar(frontmatter.project),
    priority: normalizePriority(frontmatter.priority),
    stage: normalizeStage(frontmatter.stage),
    lifecycle: normalizeLifecycle(frontmatter.lifecycle),
    updated: scalar(frontmatter.updated),
    title,
    sections,
    missingSections: STANDARD_PROJECT_STATUS_SECTIONS.filter(section => sections[section].trim().length === 0),
  };
}

function splitFrontmatter(markdown: string): { frontmatter: Record<string, string>; body: string } {
  const lines = markdown.split("\n");
  if (lines[0]?.trim() !== "---") return { frontmatter: {}, body: markdown };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return { frontmatter: {}, body: markdown };
  const frontmatter: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    frontmatter[match[1]] = stripQuotes(match[2].trim());
  }
  return { frontmatter, body: lines.slice(end + 1).join("\n") };
}

function parseSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current = "";
  let buffer: string[] = [];
  const flush = () => {
    if (current) sections.set(current, buffer.join("\n").trim());
  };

  for (const line of markdown.split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flush();
      current = heading[1].trim();
      buffer = [];
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();
  return sections;
}

function emptySections(): Record<ProjectStatusSection, string> {
  return Object.fromEntries(STANDARD_PROJECT_STATUS_SECTIONS.map(section => [section, ""])) as Record<ProjectStatusSection, string>;
}

function firstHeading(markdown: string): string {
  return markdown.split("\n").find(line => line.startsWith("# "))?.replace(/^#\s+/, "").trim() ?? "";
}

function basenameWithoutMd(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

function normalizePriority(value: string | undefined): ProjectPriority {
  return PRIORITIES.has(value as ProjectPriority) ? value as ProjectPriority : "P2";
}

function normalizeStage(value: string | undefined): ProjectStage {
  return STAGES.has(value as ProjectStage) ? value as ProjectStage : "孵化";
}

function normalizeLifecycle(value: string | undefined): ManagedLifecycle {
  return LIFECYCLES.has(value as ManagedLifecycle) ? value as ManagedLifecycle : "watch";
}

function scalar(value: string | undefined): string {
  return value?.trim() ?? "";
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}
```

- [ ] **Step 4: Verify parser tests pass**

Run:

```bash
npm run test:unit
```

Expected:

```text
unit tests passed
```

- [ ] **Step 5: Commit**

```bash
git add src/data/project-management.ts tests/project-management.test.ts
git commit -m "feat: parse project status notes"
```

## Task 3: Add Focus Week Parser

**Files:**

- Modify: `src/data/project-management.ts`
- Modify: `tests/project-management.test.ts`

- [ ] **Step 1: Add failing Focus parser tests**

Append to `tests/project-management.test.ts`:

```ts
import {
  parseFocusWeekYaml,
  currentIsoWeek,
} from "../src/data/project-management";

const focus = parseFocusWeekYaml(`week: "2026-W23"
focus_limit: 3
focus_projects:
  - id: "kora"
    role: "main"
    reason: "P0 · 当前主产品"
  - id: "pilot"
    role: "support"
    reason: "发布门禁未关闭"
  - id: "comic-drama"
    role: "maintenance"
    reason: "保持管线连续性"
off_focus_policy: "allow_today_with_reason"
off_focus_events:
  - date: "2026-06-05"
    project_id: "aidv"
    reason: "临时机会"
    target: "today"
`);

assert.equal(focus.week, "2026-W23");
assert.equal(focus.focusLimit, 3);
assert.equal(focus.focusProjects[0].id, "kora");
assert.equal(focus.focusProjects[0].role, "main");
assert.equal(focus.offFocusEvents[0].projectId, "aidv");
assert.equal(focus.offFocusEvents[0].reason, "临时机会");

const fallbackFocus = parseFocusWeekYaml("");
assert.equal(fallbackFocus.focusLimit, 3);
assert.equal(fallbackFocus.focusProjects.length, 0);
assert.match(currentIsoWeek(new Date("2026-06-05T12:00:00+08:00")), /^2026-W23$/);
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm run test:unit
```

Expected: FAIL with missing export `parseFocusWeekYaml`.

- [ ] **Step 3: Implement Focus parser**

Append these exports and helpers to `src/data/project-management.ts`:

```ts
export interface FocusProject {
  id: string;
  role: FocusRole;
  reason: string;
}

export interface OffFocusEvent {
  date: string;
  projectId: string;
  reason: string;
  target: string;
}

export interface FocusWeek {
  week: string;
  focusLimit: number;
  focusProjects: FocusProject[];
  offFocusPolicy: string;
  offFocusEvents: OffFocusEvent[];
}

export function parseFocusWeekYaml(content: string, now = new Date()): FocusWeek {
  if (!content.trim()) return emptyFocusWeek(now);
  const lines = content.split("\n");
  const focusProjects: FocusProject[] = [];
  const offFocusEvents: OffFocusEvent[] = [];
  let week = "";
  let focusLimit = 3;
  let offFocusPolicy = "allow_today_with_reason";
  let list: "focus" | "off-focus" | "" = "";
  let currentFocus: Partial<FocusProject> | null = null;
  let currentOffFocus: Partial<OffFocusEvent> | null = null;

  const flushFocus = () => {
    if (currentFocus?.id && currentFocus.role) {
      focusProjects.push({
        id: currentFocus.id,
        role: currentFocus.role,
        reason: currentFocus.reason ?? "",
      });
    }
    currentFocus = null;
  };
  const flushOffFocus = () => {
    if (currentOffFocus?.date && currentOffFocus.projectId) {
      offFocusEvents.push({
        date: currentOffFocus.date,
        projectId: currentOffFocus.projectId,
        reason: currentOffFocus.reason ?? "",
        target: currentOffFocus.target ?? "",
      });
    }
    currentOffFocus = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("week:")) week = yamlScalar(line.replace("week:", ""));
    else if (line.startsWith("focus_limit:")) focusLimit = Number(yamlScalar(line.replace("focus_limit:", ""))) || 3;
    else if (line.startsWith("off_focus_policy:")) offFocusPolicy = yamlScalar(line.replace("off_focus_policy:", ""));
    else if (line === "focus_projects:") { flushOffFocus(); list = "focus"; }
    else if (line === "off_focus_events:") { flushFocus(); list = "off-focus"; }
    else if (line.startsWith("- id:") && list === "focus") {
      flushFocus();
      currentFocus = { id: yamlScalar(line.replace("- id:", "")) };
    } else if (line.startsWith("- date:") && list === "off-focus") {
      flushOffFocus();
      currentOffFocus = { date: yamlScalar(line.replace("- date:", "")) };
    } else if (list === "focus" && currentFocus) {
      if (line.startsWith("role:")) currentFocus.role = normalizeFocusRole(yamlScalar(line.replace("role:", "")));
      if (line.startsWith("reason:")) currentFocus.reason = yamlScalar(line.replace("reason:", ""));
    } else if (list === "off-focus" && currentOffFocus) {
      if (line.startsWith("project_id:")) currentOffFocus.projectId = yamlScalar(line.replace("project_id:", ""));
      if (line.startsWith("reason:")) currentOffFocus.reason = yamlScalar(line.replace("reason:", ""));
      if (line.startsWith("target:")) currentOffFocus.target = yamlScalar(line.replace("target:", ""));
    }
  }
  flushFocus();
  flushOffFocus();

  return {
    week: week || currentIsoWeek(now),
    focusLimit,
    focusProjects,
    offFocusPolicy,
    offFocusEvents,
  };
}

export function currentIsoWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function emptyFocusWeek(now: Date): FocusWeek {
  return {
    week: currentIsoWeek(now),
    focusLimit: 3,
    focusProjects: [],
    offFocusPolicy: "allow_today_with_reason",
    offFocusEvents: [],
  };
}

function normalizeFocusRole(value: string): FocusRole {
  if (value === "main" || value === "support" || value === "maintenance") return value;
  return "support";
}

function yamlScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}
```

- [ ] **Step 4: Verify Focus tests pass**

Run:

```bash
npm run test:unit
```

Expected:

```text
unit tests passed
```

- [ ] **Step 5: Commit**

```bash
git add src/data/project-management.ts tests/project-management.test.ts
git commit -m "feat: parse weekly focus state"
```

## Task 4: Add Portfolio Derivation and Health Rules

**Files:**

- Modify: `src/data/project-management.ts`
- Modify: `tests/project-management.test.ts`

- [ ] **Step 1: Add failing portfolio derivation tests**

Append to `tests/project-management.test.ts`:

```ts
import {
  deriveManagedProjects,
  derivePortfolioSummary,
  type ProjectIndexLike,
} from "../src/data/project-management";

const indexProjects: ProjectIndexLike[] = [
  {
    id: "kora",
    name: "Kora",
    category: "产品系统",
    lifecycle: "active",
    workspace: "04-项目/产品系统/Kora",
    repo_path: "/Volumes/资料/projects/Kora",
    project_home: "04-项目/产品系统/Kora/首页.md",
    status_note: "04-项目/产品系统/Kora/Kora项目状态.md",
    codex_context: "04-项目/产品系统/Kora/Kora-Codex上下文.md",
  },
  {
    id: "pilot",
    name: "Pilot",
    category: "产品系统",
    lifecycle: "watch",
    workspace: "04-项目/产品系统/Pilot",
    status_note: "04-项目/产品系统/Pilot/Pilot项目状态.md",
  },
  {
    id: "xiaohuanzi",
    name: "小桓子",
    category: "产品系统",
    lifecycle: "archived",
    workspace: "99-归档/完结项目/小桓子",
    status_note: "99-归档/完结项目/小桓子/小桓子项目状态.md",
  },
];

const staleMarkdown = standardMarkdown.replace('updated: "2026-06-05"', 'updated: "2026-05-20"');
const noNextStepMarkdown = standardMarkdown
  .replace('project: "kora"', 'project: "pilot"')
  .replace('priority: "P0"', 'priority: "P1"')
  .replace('stage: "构建"', 'stage: "交付"')
  .replace('updated: "2026-06-05"', 'updated: "2026-06-01"')
  .replace("- [ ] 完成 Portfolio 只读版", "");

const managed = deriveManagedProjects({
  projects: indexProjects,
  statuses: new Map([
    ["kora", parseProjectStatusMarkdown(staleMarkdown, "kora.md")],
    ["pilot", parseProjectStatusMarkdown(noNextStepMarkdown, "pilot.md")],
  ]),
  focusWeek: focus,
  now: new Date("2026-06-05T12:00:00+08:00"),
});

assert.equal(managed.length, 2);
assert.equal(managed[0].id, "kora");
assert.equal(managed[0].focusRole, "main");
assert.equal(managed[0].health.status, "风险");
assert.ok(managed[0].health.reasons.includes("状态超过 7 天未更新"));
assert.equal(managed[1].id, "pilot");
assert.equal(managed[1].focusRole, "support");
assert.ok(managed[1].health.reasons.includes("缺下一步"));

const summary = derivePortfolioSummary(managed, focus);
assert.equal(summary.totalManaged, 2);
assert.equal(summary.focusUsed, 2);
assert.equal(summary.riskCount, 1);
assert.equal(summary.noNextStepCount, 1);
assert.equal(summary.staleCount, 1);
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm run test:unit
```

Expected: FAIL with missing exports `deriveManagedProjects` and `derivePortfolioSummary`.

- [ ] **Step 3: Implement portfolio derivation**

Append to `src/data/project-management.ts`:

```ts
export interface ProjectIndexLike {
  id: string;
  name: string;
  workspace: string;
  lifecycle?: string;
  repo_path?: string;
  category?: string;
  project_home?: string;
  status_note?: string;
  codex_context?: string;
}

export interface ProjectHealth {
  status: ProjectHealthStatus;
  reasons: string[];
}

export interface ManagedProject {
  id: string;
  name: string;
  category: string;
  lifecycle: ManagedLifecycle;
  priority: ProjectPriority;
  stage: ProjectStage;
  workspace: string;
  repoPath: string;
  projectHome: string;
  statusNote: string;
  codexContext: string;
  goal: string;
  successCriteria: string;
  milestone: string;
  nextStep: string;
  risks: string;
  pendingDecisions: string;
  deliveryGates: string;
  recentStatus: string;
  updated: string;
  focusRole: FocusRole | null;
  focusReason: string;
  health: ProjectHealth;
}

export interface PortfolioSummary {
  totalManaged: number;
  activeCount: number;
  watchCount: number;
  focusLimit: number;
  focusUsed: number;
  riskCount: number;
  attentionCount: number;
  staleCount: number;
  noNextStepCount: number;
  deliveryGateGapCount: number;
}

export interface DeriveManagedProjectsInput {
  projects: ProjectIndexLike[];
  statuses: Map<string, ParsedProjectStatus>;
  focusWeek: FocusWeek;
  now: Date;
}

export function deriveManagedProjects(input: DeriveManagedProjectsInput): ManagedProject[] {
  const focusById = new Map(input.focusWeek.focusProjects.map(item => [item.id, item]));
  return input.projects
    .filter(project => normalizeLifecycle(project.lifecycle) !== "archived")
    .map(project => {
      const status = input.statuses.get(project.id);
      const lifecycle = status?.lifecycle ?? normalizeLifecycle(project.lifecycle);
      const focus = focusById.get(project.id);
      const managed: ManagedProject = {
        id: project.id,
        name: project.name,
        category: project.category ?? "未分类",
        lifecycle,
        priority: status?.priority ?? "P2",
        stage: status?.stage ?? "孵化",
        workspace: project.workspace,
        repoPath: project.repo_path ?? "",
        projectHome: project.project_home ?? "",
        statusNote: project.status_note ?? status?.path ?? "",
        codexContext: project.codex_context ?? "",
        goal: status?.sections["目标"] ?? "",
        successCriteria: status?.sections["成功标准"] ?? "",
        milestone: status?.sections["当前里程碑"] ?? "",
        nextStep: status?.sections["下一步"] ?? "",
        risks: status?.sections["风险与阻塞"] ?? "",
        pendingDecisions: status?.sections["待决策"] ?? "",
        deliveryGates: status?.sections["交付门禁"] ?? "",
        recentStatus: status?.sections["最近状态"] ?? "",
        updated: status?.updated ?? "",
        focusRole: focus?.role ?? null,
        focusReason: focus?.reason ?? "",
        health: { status: "健康", reasons: [] },
      };
      managed.health = deriveProjectHealth(managed, input.now);
      return managed;
    })
    .sort(compareManagedProjects);
}

export function derivePortfolioSummary(projects: ManagedProject[], focusWeek: FocusWeek): PortfolioSummary {
  return {
    totalManaged: projects.length,
    activeCount: projects.filter(project => project.lifecycle === "active").length,
    watchCount: projects.filter(project => project.lifecycle === "watch").length,
    focusLimit: focusWeek.focusLimit,
    focusUsed: projects.filter(project => project.focusRole).length,
    riskCount: projects.filter(project => project.health.status === "风险").length,
    attentionCount: projects.filter(project => project.health.status === "注意").length,
    staleCount: projects.filter(project => project.health.reasons.includes("状态超过 7 天未更新")).length,
    noNextStepCount: projects.filter(project => project.health.reasons.includes("缺下一步")).length,
    deliveryGateGapCount: projects.filter(project => project.health.reasons.includes("交付阶段缺交付门禁")).length,
  };
}

function deriveProjectHealth(project: ManagedProject, now: Date): ProjectHealth {
  const reasons: string[] = [];
  const updatedAge = daysSince(project.updated, now);
  if (!project.goal.trim()) reasons.push("缺目标");
  if (!project.successCriteria.trim()) reasons.push("缺成功标准");
  if (!project.nextStep.trim()) reasons.push("缺下一步");
  if (updatedAge !== null && updatedAge > 7) reasons.push("状态超过 7 天未更新");
  if (project.stage === "交付" && !project.deliveryGates.trim()) reasons.push("交付阶段缺交付门禁");
  if (hasOpenRisk(project.risks)) reasons.push("存在未处理风险");
  if (project.pendingDecisions.trim()) reasons.push("存在待决策");

  const riskReasons = new Set(["缺下一步", "状态超过 7 天未更新", "存在未处理风险", "交付阶段缺交付门禁"]);
  const isRisk = project.priority === "P0" && reasons.some(reason => riskReasons.has(reason))
    || Boolean(project.focusRole && reasons.includes("缺下一步"))
    || hasBlockingText(project.risks)
    || (project.stage === "交付" && reasons.includes("交付阶段缺交付门禁"));

  return {
    status: isRisk ? "风险" : reasons.length > 0 ? "注意" : "健康",
    reasons,
  };
}

function compareManagedProjects(a: ManagedProject, b: ManagedProject): number {
  const focusOrder = focusRank(a.focusRole) - focusRank(b.focusRole);
  if (focusOrder !== 0) return focusOrder;
  const priorityOrder = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityOrder !== 0) return priorityOrder;
  return a.name.localeCompare(b.name);
}

function focusRank(role: FocusRole | null): number {
  if (role === "main") return 0;
  if (role === "support") return 1;
  if (role === "maintenance") return 2;
  return 3;
}

function priorityRank(priority: ProjectPriority): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority];
}

function daysSince(date: string, now: Date): number | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((now.getTime() - parsed.getTime()) / 86400000);
}

function hasOpenRisk(text: string): boolean {
  return text.split("\n").some(line => /^\s*[-*]\s+\[ \]\s+/.test(line));
}

function hasBlockingText(text: string): boolean {
  return /阻塞|blocked|卡住|等待/.test(text) && !/已解决|已解除|✅/.test(text);
}
```

- [ ] **Step 4: Verify derivation tests pass**

Run:

```bash
npm run test:unit
```

Expected:

```text
unit tests passed
```

- [ ] **Step 5: Commit**

```bash
git add src/data/project-management.ts tests/project-management.test.ts
git commit -m "feat: derive portfolio health"
```

## Task 5: Add Obsidian Portfolio Reader

**Files:**

- Create: `src/data/project-management-reader.ts`
- Modify: `src/data/project-management.ts`
- Modify: `src/view.ts`

- [ ] **Step 1: Export the focus file path and portfolio model type**

Append to `src/data/project-management.ts`:

```ts
export const FOCUS_WEEK_PATH = ".thirdspace/focus-week.yaml";

export interface PortfolioModel {
  focusWeek: FocusWeek;
  projects: ManagedProject[];
  summary: PortfolioSummary;
}
```

- [ ] **Step 2: Create the Obsidian reader**

Create `src/data/project-management-reader.ts`:

```ts
import type { App } from "obsidian";
import { loadProjectIndex } from "./vault-reader";
import {
  FOCUS_WEEK_PATH,
  deriveManagedProjects,
  derivePortfolioSummary,
  parseFocusWeekYaml,
  parseProjectStatusMarkdown,
  type ParsedProjectStatus,
  type PortfolioModel,
  type ProjectIndexLike,
} from "./project-management";

export async function loadPortfolioModel(app: App, now = new Date()): Promise<PortfolioModel> {
  const [projects, focusContent] = await Promise.all([
    loadProjectIndex(app),
    readOptional(app, FOCUS_WEEK_PATH),
  ]);
  const focusWeek = parseFocusWeekYaml(focusContent ?? "", now);
  const statuses = await loadProjectStatuses(app, projects);
  const managedProjects = deriveManagedProjects({
    projects,
    statuses,
    focusWeek,
    now,
  });

  return {
    focusWeek,
    projects: managedProjects,
    summary: derivePortfolioSummary(managedProjects, focusWeek),
  };
}

async function loadProjectStatuses(app: App, projects: ProjectIndexLike[]): Promise<Map<string, ParsedProjectStatus>> {
  const entries = await Promise.all(projects.map(async project => {
    if (!project.status_note) return null;
    const markdown = await readOptional(app, project.status_note);
    if (!markdown) return null;
    const status = parseProjectStatusMarkdown(markdown, project.status_note);
    return [project.id, status] as const;
  }));

  return new Map(entries.filter((entry): entry is readonly [string, ParsedProjectStatus] => entry !== null));
}

async function readOptional(app: App, path: string): Promise<string | null> {
  try {
    return await app.vault.adapter.read(path);
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Import the reader in `src/view.ts`**

Add near the existing imports in `src/view.ts`:

```ts
import { loadPortfolioModel } from "./data/project-management-reader";
import type { PortfolioModel } from "./data/project-management";
```

- [ ] **Step 4: Load the Portfolio model in `render()`**

In `src/view.ts`, update the first `Promise.all` in `render()` so it also loads `portfolio`:

```ts
const [wsIndex, productMd, activity, projectActivity, gitActivity, todos, projectBacklog, todayWorklog, discovery, onboarding, materials, portfolio] = await Promise.all([
  loadWorkspaceIndex(this.app),
  loadProductStatus(this.app),
  getDailyActivity(this.app, 365),
  getProjectActivity(this.app, 90),
  getGitActivity(this.app, 90),
  loadTodos(this.app),
  loadProjectBacklog(this.app),
  loadTodayWorklog(this.app),
  refreshProjectDiscovery(this.app),
  loadProjectOnboarding(this.app),
  loadProjectMaterials(this.app),
  loadPortfolioModel(this.app),
]);
```

- [ ] **Step 5: Pass Portfolio into `renderProjectsPage()`**

Update the call site:

```ts
this.activePage === "today"
  ? this.renderTodayPage(board, todos, projectBacklog, todayWorklog)
  : this.renderProjectsPage(board, portfolio, activity, projectActivity, gitActivity, wsStats, recent, products, discovery, onboarding, materials);
```

Update the method signature:

```ts
private renderProjectsPage(
  board: HTMLElement,
  portfolio: PortfolioModel,
  activity: DailyActivity[],
  projectActivity: ProjectActivity[],
  gitActivity: GitActivitySummary,
  wsStats: WorkspaceStats[],
  recent: RecentFile[],
  products: ReturnType<typeof parseProducts>,
  discovery: ProjectDiscoverySummary,
  onboarding: ProjectOnboardingItem[],
  materials: ProjectMaterialsItem[],
) {
```

The `portfolio` argument is intentionally unused until Task 6; TypeScript allows unused parameters because `noUnusedParameters` is false.

- [ ] **Step 6: Verify build still passes**

Run:

```bash
npm run test:unit
npm run build
```

Expected:

```text
unit tests passed
```

and esbuild output similar to:

```text
main.js  ...
```

- [ ] **Step 7: Commit**

```bash
git add src/data/project-management.ts src/data/project-management-reader.ts src/view.ts
git commit -m "feat: load portfolio model"
```

## Task 6: Add Portfolio Renderer

**Files:**

- Create: `src/components/portfolio.ts`
- Modify: `src/view.ts`

- [ ] **Step 1: Create the renderer component**

Create `src/components/portfolio.ts`:

```ts
import type { ManagedProject, PortfolioModel, ProjectHealthStatus } from "../data/project-management";

export interface PortfolioActions {
  openFile(path: string): void;
}

export interface MaintenanceCounts {
  discoveryPending: number;
  onboardingPending: number;
  materialsPending: number;
  recentCount: number;
}

export function renderPortfolio(
  parent: HTMLElement,
  model: PortfolioModel,
  maintenance: MaintenanceCounts,
  actions: PortfolioActions,
): void {
  const shell = parent.createDiv({ cls: "ts-portfolio" });
  renderPortfolioHealth(shell, model);
  renderWeeklyFocus(shell, model, actions);
  renderFocusSuggestions(shell, model, actions);
  renderRiskDecisionQueue(shell, model, actions);
  renderPriorityProjects(shell, model, actions);
  renderMaintenanceStrip(shell, maintenance);
}

function renderPortfolioHealth(parent: HTMLElement, model: PortfolioModel): void {
  const card = parent.createDiv({ cls: "ts-card ts-portfolio-health-card" });
  card.createDiv({ cls: "ts-card-label", text: "PORTFOLIO HEALTH" });
  const grid = card.createDiv({ cls: "ts-portfolio-metrics" });
  metric(grid, String(model.summary.totalManaged), "managed");
  metric(grid, `${model.summary.focusUsed}/${model.summary.focusLimit}`, "focus");
  metric(grid, String(model.summary.riskCount), "risk");
  metric(grid, String(model.summary.staleCount), "stale");
  metric(grid, String(model.summary.noNextStepCount), "no next");
  metric(grid, String(model.summary.deliveryGateGapCount), "gate gaps");
}

function renderWeeklyFocus(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-weekly-focus-card" });
  const head = card.createDiv({ cls: "ts-card-head" });
  head.createSpan({ cls: "ts-card-label", text: "WEEKLY FOCUS" });
  head.createSpan({ cls: "ts-card-meta", text: model.focusWeek.week });

  const focusProjects = model.projects.filter(project => project.focusRole);
  if (focusProjects.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "No weekly Focus set" });
    return;
  }

  const list = card.createDiv({ cls: "ts-focus-list" });
  for (const project of focusProjects) renderProjectCard(list, project, actions, true);
}

function renderFocusSuggestions(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-focus-suggestions-card" });
  card.createDiv({ cls: "ts-card-label", text: "FOCUS SUGGESTIONS" });
  const suggestions = model.projects
    .filter(project => !project.focusRole && project.lifecycle !== "paused")
    .filter(project => project.priority === "P0" || project.priority === "P1" || project.health.status !== "健康")
    .slice(0, 4);

  if (suggestions.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "No Focus suggestions" });
    return;
  }

  const list = card.createDiv({ cls: "ts-suggestion-list" });
  for (const project of suggestions) renderProjectCard(list, project, actions, false);
}

function renderRiskDecisionQueue(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-risk-queue-card" });
  card.createDiv({ cls: "ts-card-label", text: "RISK / DECISIONS" });
  const items = model.projects
    .filter(project => project.health.status === "风险" || project.pendingDecisions.trim())
    .slice(0, 6);

  if (items.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "No active risk or decision queue" });
    return;
  }

  const list = card.createDiv({ cls: "ts-risk-list" });
  for (const project of items) {
    const row = list.createDiv({ cls: `ts-risk-row ts-health--${healthClass(project.health.status)}` });
    row.addEventListener("click", () => actions.openFile(project.statusNote));
    row.createDiv({ cls: "ts-risk-project", text: project.name });
    row.createDiv({ cls: "ts-risk-reasons", text: project.health.reasons.slice(0, 3).join(" · ") || "待决策" });
  }
}

function renderPriorityProjects(parent: HTMLElement, model: PortfolioModel, actions: PortfolioActions): void {
  const card = parent.createDiv({ cls: "ts-card ts-priority-card" });
  card.createDiv({ cls: "ts-card-label", text: "PRIORITY PROJECTS" });
  const items = model.projects.filter(project => project.priority === "P0" || project.priority === "P1").slice(0, 6);
  if (items.length === 0) {
    card.createDiv({ cls: "ts-empty", text: "No P0 / P1 projects" });
    return;
  }
  const list = card.createDiv({ cls: "ts-priority-list" });
  for (const project of items) renderProjectCard(list, project, actions, false);
}

function renderMaintenanceStrip(parent: HTMLElement, counts: MaintenanceCounts): void {
  const card = parent.createDiv({ cls: "ts-card ts-maintenance-strip" });
  card.createDiv({ cls: "ts-card-label", text: "SYSTEM SIGNALS" });
  const row = card.createDiv({ cls: "ts-maintenance-row" });
  metric(row, String(counts.discoveryPending), "candidates");
  metric(row, String(counts.onboardingPending), "onboarding");
  metric(row, String(counts.materialsPending), "materials");
  metric(row, String(counts.recentCount), "recent");
}

function renderProjectCard(parent: HTMLElement, project: ManagedProject, actions: PortfolioActions, focusCard: boolean): void {
  const row = parent.createDiv({
    cls: `ts-project-card ts-health--${healthClass(project.health.status)}${focusCard ? " ts-project-card--focus" : ""}`,
  });
  row.addEventListener("click", () => actions.openFile(project.statusNote || project.projectHome));
  const top = row.createDiv({ cls: "ts-project-card-top" });
  top.createSpan({ cls: "ts-project-name", text: project.name });
  top.createSpan({ cls: "ts-project-meta", text: [project.priority, project.stage, project.focusRole ?? ""].filter(Boolean).join(" · ") });
  row.createDiv({ cls: "ts-project-milestone", text: project.milestone || "缺当前里程碑" });
  row.createDiv({ cls: "ts-project-next", text: compact(project.nextStep) || "缺下一步" });
  const reasons = project.health.reasons.slice(0, 3);
  const chips = row.createDiv({ cls: "ts-project-chips" });
  chips.createSpan({ cls: "ts-project-chip", text: project.health.status });
  for (const reason of reasons) chips.createSpan({ cls: "ts-project-chip", text: reason });
}

function metric(parent: HTMLElement, value: string, label: string): void {
  const item = parent.createDiv({ cls: "ts-portfolio-metric" });
  item.createDiv({ cls: "ts-portfolio-metric-value", text: value });
  item.createDiv({ cls: "ts-portfolio-metric-label", text: label });
}

function compact(markdown: string): string {
  return markdown
    .split("\n")
    .map(line => line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, "").replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean)[0] ?? "";
}

function healthClass(status: ProjectHealthStatus): string {
  if (status === "风险") return "risk";
  if (status === "注意") return "attention";
  return "healthy";
}
```

- [ ] **Step 2: Import the renderer in `src/view.ts`**

Add near other component imports:

```ts
import { renderPortfolio } from "./components/portfolio";
```

- [ ] **Step 3: Render Portfolio at the top of Projects page**

At the start of `renderProjectsPage()` body, before existing activity/workspace cards, add:

```ts
const portfolioCol = board.createDiv({ cls: "ts-board-col ts-portfolio-col" });
renderPortfolio(
  portfolioCol,
  portfolio,
  {
    discoveryPending: discovery.pending.length,
    onboardingPending: onboarding.filter(item => item.needsOnboarding).length,
    materialsPending: materials.filter(item => item.needsImport).length,
    recentCount: recent.length,
  },
  {
    openFile: path => this.openFile(path),
  },
);
```

- [ ] **Step 4: Keep old maintenance cards secondary**

Wrap existing activity/workspace/recent/materials/products columns in a maintenance column so the primary surface is Portfolio. Replace the existing body of `renderProjectsPage()` after the Portfolio block with:

```ts
const maintenanceCol = board.createDiv({ cls: "ts-board-col ts-maintenance-col" });
const heatSec = maintenanceCol.createDiv({ cls: "ts-card ts-compact-card ts-heatmap-card" });
if (this.snakeReplayTimer) { clearTimeout(this.snakeReplayTimer); this.snakeReplayTimer = null; }
this.renderActivityDashboard(heatSec, activity, projectActivity, gitActivity);

const compactGrid = maintenanceCol.createDiv({ cls: "ts-maintenance-grid" });
const wsCard = compactGrid.createDiv({ cls: "ts-card ts-compact-card ts-workspaces-card" });
wsCard.createDiv({ cls: "ts-card-label", text: "WORKSPACES" });
this.renderWorkspaces(wsCard, wsStats);

const recCard = compactGrid.createDiv({ cls: "ts-card ts-compact-card ts-recent-card" });
recCard.createDiv({ cls: "ts-card-label", text: "RECENT" });
this.renderRecent(recCard, recent);

const materialsCard = compactGrid.createDiv({ cls: "ts-card ts-compact-card ts-materials-card" });
materialsCard.createDiv({ cls: "ts-card-label", text: "MATERIALS" });
this.renderProjectMaterialsCard(materialsCard, materials);

const prodCard = compactGrid.createDiv({ cls: "ts-card ts-compact-card ts-products-card" });
prodCard.createDiv({ cls: "ts-card-label", text: "SYSTEM / INBOX" });
this.renderProducts(prodCard, products, discovery, onboarding);
```

- [ ] **Step 5: Verify TypeScript catches no renderer errors**

Run:

```bash
npm run test:unit
npm run build
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/portfolio.ts src/view.ts
git commit -m "feat: render readonly portfolio"
```

## Task 7: Add Portfolio CSS

**Files:**

- Modify: `src/styles.css`

- [ ] **Step 1: Add layout CSS**

Append to `src/styles.css` before the dark-theme and media-query section:

```css
.ts-board--projects {
  grid-template-rows: minmax(0, 1fr);
  grid-template-areas: "portfolio portfolio portfolio portfolio portfolio portfolio portfolio portfolio maintenance maintenance maintenance maintenance";
}

.ts-portfolio-col {
  grid-area: portfolio;
}

.ts-maintenance-col {
  grid-area: maintenance;
}

.ts-portfolio {
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas:
    "health health health health health health"
    "focus focus focus suggestions suggestions suggestions"
    "risk risk priority priority system system";
  gap: 8px;
  overflow: hidden;
}

.ts-portfolio-health-card { grid-area: health; }
.ts-weekly-focus-card { grid-area: focus; }
.ts-focus-suggestions-card { grid-area: suggestions; }
.ts-risk-queue-card { grid-area: risk; }
.ts-priority-card { grid-area: priority; }
.ts-maintenance-strip { grid-area: system; }

.ts-portfolio-metrics,
.ts-maintenance-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}

.ts-maintenance-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ts-portfolio-metric {
  min-width: 0;
  padding: 6px 7px;
  border: 1px solid var(--ts-border);
  border-radius: var(--ts-radius-sm);
  background: color-mix(in srgb, var(--background-primary) 82%, var(--ts-panel) 18%);
}

.ts-portfolio-metric-value {
  color: var(--ts-text);
  font-family: var(--ts-mono);
  font-size: 15px;
  line-height: 1;
  font-weight: 800;
}

.ts-portfolio-metric-label {
  margin-top: 3px;
  color: var(--ts-text-3);
  font-size: 8.5px;
  line-height: 1.1;
  font-weight: 700;
  text-transform: uppercase;
}

.ts-focus-list,
.ts-suggestion-list,
.ts-risk-list,
.ts-priority-list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ts-project-card,
.ts-risk-row {
  min-width: 0;
  padding: 7px;
  border: 1px solid var(--ts-border);
  border-radius: var(--ts-radius-sm);
  background: color-mix(in srgb, var(--background-primary) 80%, var(--ts-panel) 20%);
  cursor: pointer;
  transition: background .14s ease, border-color .14s ease, transform .14s ease;
}

.ts-project-card:hover,
.ts-risk-row:hover {
  transform: translateY(-1px);
  border-color: var(--ts-border-strong);
  background: color-mix(in srgb, var(--ts-accent) 8%, var(--ts-panel) 92%);
}

.ts-project-card-top {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ts-project-name,
.ts-risk-project {
  min-width: 0;
  overflow: hidden;
  color: var(--ts-text);
  font-size: 11px;
  line-height: 1.18;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-project-meta {
  flex: 0 0 auto;
  color: var(--ts-text-3);
  font-family: var(--ts-mono);
  font-size: 8.5px;
  font-weight: 750;
}

.ts-project-milestone,
.ts-project-next,
.ts-risk-reasons {
  min-width: 0;
  overflow: hidden;
  margin-top: 4px;
  color: var(--ts-text-2);
  font-size: 9.5px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-project-next {
  color: var(--ts-text);
}

.ts-project-chips {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.ts-project-chip {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  padding: 2px 5px;
  border: 1px solid var(--ts-border);
  border-radius: 999px;
  color: var(--ts-text-3);
  font-size: 8px;
  line-height: 1.1;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-health--risk {
  border-color: color-mix(in srgb, var(--ts-red) 34%, var(--ts-border) 66%);
}

.ts-health--risk .ts-project-chip:first-child,
.ts-health--risk .ts-risk-project {
  color: color-mix(in srgb, var(--ts-red) 82%, var(--ts-text) 18%);
}

.ts-health--attention {
  border-color: color-mix(in srgb, var(--ts-yellow) 34%, var(--ts-border) 66%);
}

.ts-health--attention .ts-project-chip:first-child {
  color: color-mix(in srgb, var(--ts-yellow) 78%, var(--ts-text) 22%);
}

.ts-health--healthy .ts-project-chip:first-child {
  color: color-mix(in srgb, var(--ts-green) 76%, var(--ts-text) 24%);
}

.ts-maintenance-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  grid-auto-rows: minmax(96px, 1fr);
  gap: 8px;
  overflow: hidden;
}
```

- [ ] **Step 2: Add responsive CSS**

Append this near the existing `@container (max-width: 520px)` block:

```css
@container (max-width: 720px) {
  .ts-board--projects {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-template-areas:
      "portfolio portfolio portfolio portfolio portfolio portfolio"
      "maintenance maintenance maintenance maintenance maintenance maintenance";
    grid-template-rows: minmax(0, 1fr) 180px;
  }

  .ts-portfolio {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      "health health"
      "focus focus"
      "suggestions suggestions"
      "risk priority"
      "system system";
    overflow-y: auto;
  }

  .ts-portfolio-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ts-maintenance-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: minmax(100px, 1fr);
  }
}
```

- [ ] **Step 3: Verify CSS and build**

Run:

```bash
npm run build
```

Expected: build passes and generates `main.js`.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "style: add portfolio layout"
```

## Task 8: Validate and Prepare Deployment

**Files:**

- Modify: `README.md` if the new Portfolio behavior needs a short data-source note.
- Generated: `main.js`
- Generated: `main.css`

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm run test:unit
```

Expected:

```text
unit tests passed
```

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript passes and esbuild writes `main.js`.

- [ ] **Step 3: Inspect changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected changed source files:

```text
M package.json
M src/view.ts
M src/styles.css
A scripts/run-tests.mjs
A tests/run-tests.ts
A tests/project-management.test.ts
A src/data/project-management.ts
A src/data/project-management-reader.ts
A src/components/portfolio.ts
M main.js
M main.css
```

`package-lock.json` may also change if npm mutates it during script edits; include it only if it actually changes.

- [ ] **Step 4: Manually inspect generated bundle size**

Run:

```bash
ls -lh main.js main.css
```

Expected: files exist and sizes are reasonable for the existing plugin bundle. If `main.js` grows by more than 30%, inspect whether a Node-only dependency was accidentally bundled.

- [ ] **Step 5: Commit generated bundle and source**

```bash
git add package.json package-lock.json scripts/run-tests.mjs tests/run-tests.ts tests/project-management.test.ts src/data/project-management.ts src/data/project-management-reader.ts src/components/portfolio.ts src/view.ts src/styles.css main.js main.css
git commit -m "feat: add readonly founder portfolio"
```

- [ ] **Step 6: Do not deploy automatically**

Stop after the commit and ask the user whether to deploy to Rain vault:

```text
Build is ready. Deploy generated main.js/main.css to Rain vault plugin directory?
```

Deployment command, only after user approval:

```bash
cp main.js /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js
cp main.css /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css
cmp -s main.js /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/main.js
cmp -s main.css /Volumes/资料/projects/thirdspace/rain/.obsidian/plugins/thirdspace-dashboard/styles.css
```

Expected: both `cmp` commands exit 0.

## Self-Review Checklist

- [ ] The first batch implements only read-only Portfolio and parser/derivation foundations.
- [ ] No task migrates Rain project status notes.
- [ ] No task writes `.thirdspace/focus-week.yaml`.
- [ ] Unit tests cover parser, Focus, health, and summary rules.
- [ ] Portfolio no longer depends on `04-项目/product-status.md` as the primary project source.
- [ ] Existing maintenance features remain accessible.
- [ ] `npm run build` remains the final source validation.
- [ ] Deployment to Rain vault requires explicit user approval.

