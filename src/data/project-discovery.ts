import type { App, TFile } from "obsidian";
import * as fs from "fs/promises";
import * as nodePath from "path";
import { loadProjectIndex, localDateCompact, localTimestamp } from "./vault-reader";

export const PROJECT_DISCOVERY_CONFIG_PATH = ".thirdspace/project-discovery.yaml";
export const PROJECT_DISCOVERY_QUEUE_PATH = ".thirdspace/queues/project-candidates.json";
export const PROJECT_DISCOVERY_INBOX_PATH = "01-收件箱/待整理/项目发现确认.md";
export const PROJECT_DISCOVERY_SYSTEM_PATH = "00-系统/运行时/项目发现机制.md";

type CandidateStatus = "pending" | "accepted" | "ignored";

export interface ProjectCandidate {
  id: string;
  name: string;
  path: string;
  markers: string[];
  reason: string;
  status: CandidateStatus;
  detected_at: string;
  last_seen_at: string;
  suggested_category: string;
  suggested_workspace: string;
  accepted_at?: string;
  ignored_at?: string;
}

export interface ProjectDiscoverySummary {
  roots: string[];
  pending: ProjectCandidate[];
  accepted: ProjectCandidate[];
  ignored: ProjectCandidate[];
  notePath: string;
  queuePath: string;
  generatedAt: string;
  error?: string;
}

interface ProjectDiscoveryConfig {
  roots: string[];
  includePaths: string[];
  ignoreNames: string[];
}

interface ProjectCandidateQueue {
  version: string;
  generated_at: string;
  roots: string[];
  include_paths?: string[];
  candidates: ProjectCandidate[];
}

const DEFAULT_ROOTS = ["/Volumes/资料/projects"];
const DEFAULT_INCLUDE_PATHS = [
  "/Volumes/资料/projects/thirdspace/rain",
  "/Volumes/资料/projects/AIDV",
];
const DEFAULT_IGNORE_NAMES = [
  "thirdspace",
  "codex-knowledge-web",
  ".Trash",
  ".DS_Store",
];

const PROJECT_MARKERS = [
  { path: ".git", label: "git" },
  { path: "AGENTS.md", label: "codex" },
  { path: "CLAUDE.md", label: "claude" },
  { path: "package.json", label: "node" },
  { path: "Cargo.toml", label: "rust" },
  { path: "pyproject.toml", label: "python" },
  { path: "Package.swift", label: "swift" },
  { path: "pnpm-lock.yaml", label: "pnpm" },
  { path: "vite.config.ts", label: "vite" },
  { path: "tauri.conf.json", label: "tauri" },
  { path: "src-tauri", label: "tauri" },
];

export async function refreshProjectDiscovery(app: App): Promise<ProjectDiscoverySummary> {
  const generatedAt = localTimestamp(new Date());
  try {
    const config = await ensureDiscoveryConfig(app);
    const [registeredProjects, queue] = await Promise.all([
      loadProjectIndex(app),
      loadQueue(app),
    ]);

    const registeredPaths = new Set(
      registeredProjects
        .map(project => project.repo_path)
        .filter((value): value is string => !!value)
        .map(normalizeProjectPath),
    );
    const registeredIds = new Set(registeredProjects.map(project => project.id));
    const scanned = await scanConfiguredRoots(config, registeredPaths, registeredIds, generatedAt);
    const merged = mergeQueue(queue, scanned, registeredPaths, generatedAt, config);

    await writeQueueIfChanged(app, merged);
    await writeDiscoveryInbox(app, merged);
    await writeDiscoverySystemNote(app);

    return summarizeQueue(merged);
  } catch (error) {
    return {
      roots: DEFAULT_ROOTS,
      pending: [],
      accepted: [],
      ignored: [],
      notePath: PROJECT_DISCOVERY_INBOX_PATH,
      queuePath: PROJECT_DISCOVERY_QUEUE_PATH,
      generatedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function acceptProjectCandidate(app: App, candidateId: string): Promise<ProjectCandidate | null> {
  const queue = await loadQueue(app);
  const candidate = queue.candidates.find(item => item.id === candidateId && item.status === "pending");
  if (!candidate) return null;

  await appendProjectIndex(app, candidate);
  await ensureProjectHome(app, candidate);

  candidate.status = "accepted";
  candidate.accepted_at = localTimestamp(new Date());
  queue.generated_at = candidate.accepted_at;
  await writeQueueIfChanged(app, queue);
  await writeDiscoveryInbox(app, queue);
  return candidate;
}

export async function ignoreProjectCandidate(app: App, candidateId: string): Promise<ProjectCandidate | null> {
  const queue = await loadQueue(app);
  const candidate = queue.candidates.find(item => item.id === candidateId && item.status === "pending");
  if (!candidate) return null;

  candidate.status = "ignored";
  candidate.ignored_at = localTimestamp(new Date());
  queue.generated_at = candidate.ignored_at;
  await writeQueueIfChanged(app, queue);
  await writeDiscoveryInbox(app, queue);
  return candidate;
}

async function ensureDiscoveryConfig(app: App): Promise<ProjectDiscoveryConfig> {
  const existing = await readAdapterFile(app, PROJECT_DISCOVERY_CONFIG_PATH);
  if (existing) return parseDiscoveryConfig(existing);

  const content = [
    "# ThirdSpace project discovery config",
    "# mode: discover_only means new repos are only queued for confirmation.",
    'version: "1.0"',
    'mode: "discover_only"',
    "roots:",
    ...DEFAULT_ROOTS.map(root => `  - "${root}"`),
    "include_paths:",
    ...DEFAULT_INCLUDE_PATHS.map(projectPath => `  - "${projectPath}"`),
    "ignore_names:",
    ...DEFAULT_IGNORE_NAMES.map(name => `  - "${name}"`),
    "",
  ].join("\n");
  await writeAdapterFileIfChanged(app, PROJECT_DISCOVERY_CONFIG_PATH, content);
  return { roots: DEFAULT_ROOTS, includePaths: DEFAULT_INCLUDE_PATHS, ignoreNames: DEFAULT_IGNORE_NAMES };
}

function parseDiscoveryConfig(content: string): ProjectDiscoveryConfig {
  const roots = parseYamlStringList(content, "roots");
  const includePaths = parseYamlStringList(content, "include_paths");
  const ignoreNames = parseYamlStringList(content, "ignore_names");
  return {
    roots: roots.length > 0 ? roots : DEFAULT_ROOTS,
    includePaths,
    ignoreNames: ignoreNames.length > 0 ? ignoreNames : DEFAULT_IGNORE_NAMES,
  };
}

function parseYamlStringList(content: string, key: string): string[] {
  const values: string[] = [];
  let inList = false;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line === `${key}:`) {
      inList = true;
      continue;
    }
    if (inList && /^[a-zA-Z0-9_-]+:/.test(line)) break;
    if (!inList || !line.startsWith("- ")) continue;
    const value = line.replace(/^- /, "").trim().replace(/^["']|["']$/g, "");
    if (value) values.push(value);
  }
  return values;
}

async function scanConfiguredRoots(
  config: ProjectDiscoveryConfig,
  registeredPaths: Set<string>,
  registeredIds: Set<string>,
  timestamp: string,
): Promise<ProjectCandidate[]> {
  const candidates: ProjectCandidate[] = [];
  for (const root of config.roots) {
    const rootReal = await safeRealpath(root);
    if (!rootReal) continue;
    const entries = await safeReadDir(rootReal);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (shouldIgnoreName(entry.name, config.ignoreNames)) continue;

      const fullPath = nodePath.join(rootReal, entry.name);
      const stat = await safeLstat(fullPath);
      if (!stat || stat.isSymbolicLink()) continue;

      const candidate = await candidateFromPath(fullPath, registeredPaths, registeredIds, timestamp);
      if (candidate) candidates.push(candidate);
    }
  }

  for (const explicitPath of config.includePaths) {
    const candidate = await candidateFromPath(explicitPath, registeredPaths, registeredIds, timestamp);
    if (candidate) candidates.push(candidate);
  }

  const byPath = new Map<string, ProjectCandidate>();
  for (const candidate of candidates) byPath.set(normalizeProjectPath(candidate.path), candidate);
  return Array.from(byPath.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function candidateFromPath(
  projectPath: string,
  registeredPaths: Set<string>,
  registeredIds: Set<string>,
  timestamp: string,
): Promise<ProjectCandidate | null> {
  const stat = await safeLstat(projectPath);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) return null;

  const realPath = await safeRealpath(projectPath);
  if (!realPath) return null;
  const normalizedPath = normalizeProjectPath(realPath);
  if (registeredPaths.has(normalizedPath)) return null;

  const name = nodePath.basename(realPath);
  const id = uniqueCandidateId(slugify(name), registeredIds);
  if (registeredIds.has(id)) return null;

  const markers = await detectProjectMarkers(realPath);
  if (markers.length === 0) return null;

  return {
    id,
    name,
    path: realPath,
    markers,
    reason: `检测到 ${markers.join(" / ")} 项目特征`,
    status: "pending",
    detected_at: timestamp,
    last_seen_at: timestamp,
    suggested_category: "研究验证",
    suggested_workspace: `04-项目/研究验证/${name}`,
  };
}

function mergeQueue(
  queue: ProjectCandidateQueue,
  scanned: ProjectCandidate[],
  registeredPaths: Set<string>,
  timestamp: string,
  config: ProjectDiscoveryConfig,
): ProjectCandidateQueue {
  let changed = false;
  const byPath = new Map(queue.candidates.map(candidate => [normalizeProjectPath(candidate.path), candidate]));
  for (const existing of queue.candidates) {
    if (registeredPaths.has(normalizeProjectPath(existing.path)) && existing.status !== "ignored") {
      if (existing.status !== "accepted") {
        existing.status = "accepted";
        existing.accepted_at = existing.accepted_at ?? timestamp;
        changed = true;
      }
    }
  }

  for (const candidate of scanned) {
    const key = normalizeProjectPath(candidate.path);
    const existing = byPath.get(key);
    if (!existing) {
      queue.candidates.push(candidate);
      byPath.set(key, candidate);
      changed = true;
      continue;
    }
    if (existing.name !== candidate.name) {
      existing.name = candidate.name;
      changed = true;
    }
    if (!sameStringArray(existing.markers, candidate.markers)) {
      existing.markers = candidate.markers;
      existing.reason = candidate.reason;
      existing.last_seen_at = timestamp;
      changed = true;
    }
    if (!existing.suggested_category) {
      existing.suggested_category = candidate.suggested_category;
      changed = true;
    }
    if (!existing.suggested_workspace) {
      existing.suggested_workspace = candidate.suggested_workspace;
      changed = true;
    }
  }

  if (!sameStringArray(queue.roots, config.roots)) {
    queue.roots = config.roots;
    changed = true;
  }
  if (!sameStringArray(queue.include_paths ?? [], config.includePaths)) {
    queue.include_paths = config.includePaths;
    changed = true;
  }
  if (changed) queue.generated_at = timestamp;
  queue.candidates.sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name));
  return queue;
}

function statusRank(status: CandidateStatus): number {
  if (status === "pending") return 0;
  if (status === "accepted") return 1;
  return 2;
}

async function detectProjectMarkers(projectPath: string): Promise<string[]> {
  const markers: string[] = [];
  for (const marker of PROJECT_MARKERS) {
    if (await pathExists(nodePath.join(projectPath, marker.path))) markers.push(marker.label);
  }

  const entries = await safeReadDir(projectPath);
  if (entries.some(entry => entry.name.endsWith(".xcodeproj"))) markers.push("xcode");
  if (entries.some(entry => entry.name.endsWith(".xcworkspace"))) markers.push("xcode");
  return Array.from(new Set(markers));
}

async function appendProjectIndex(app: App, candidate: ProjectCandidate): Promise<void> {
  const now = localTimestamp(new Date());
  let raw = await readAdapterFile(app, ".thirdspace/project-index.yaml");
  if (!raw) {
    raw = [
      "# ThirdSpace AI Project Knowledge Index",
      'version: "1.0"',
      `generated_at: "${now}"`,
      `vault: "${(app.vault.adapter as any).basePath ?? ""}"`,
      "projects:",
      "",
    ].join("\n");
  }

  if (raw.includes(`id: "${candidate.id}"`) || raw.includes(`repo_path: "${candidate.path}"`)) return;

  const block = [
    `  - id: "${candidate.id}"`,
    `    name: "${candidate.name}"`,
    `    repo_path: "${candidate.path}"`,
    `    category: "${candidate.suggested_category}"`,
    `    lifecycle: "watch"`,
    `    project_home: "${candidate.suggested_workspace}/首页.md"`,
    `    status_note: "${candidate.suggested_workspace}/项目状态.md"`,
    `    codex_context: "${candidate.suggested_workspace}/${candidate.name}-Codex上下文.md"`,
    `    workspace: "${candidate.suggested_workspace}"`,
  ].join("\n");

  const next = raw.trimEnd().replace(/generated_at: ".*"/, `generated_at: "${now}"`) + "\n\n" + block + "\n";
  await writeAdapterFileIfChanged(app, ".thirdspace/project-index.yaml", next);
}

async function ensureProjectHome(app: App, candidate: ProjectCandidate): Promise<void> {
  await ensureVaultFolder(app, candidate.suggested_workspace);
  const homePath = `${candidate.suggested_workspace}/首页.md`;
  if (app.vault.getAbstractFileByPath(homePath)) return;

  const now = localTimestamp(new Date());
  const content = [
    "---",
    `title: "${candidate.name} 首页"`,
    'type: "project_home"',
    `topic: "${candidate.name}"`,
    'workspace: "04-项目"',
    `created: "${now}"`,
    `modified: "${now}"`,
    'tags: ["project", "discovered", "thirdspace"]',
    'source: "dashboard-discovery"',
    'status: "watch"',
    `project: "${candidate.name}"`,
    'project_type: "unknown"',
    `project_category: "${candidate.suggested_category}"`,
    'stage: "discovered"',
    `repo_path: "${candidate.path}"`,
    "---",
    "",
    `# ${candidate.name} 首页`,
    "",
    "## 当前状态",
    "",
    "- 状态：待审读",
    `- 仓库路径：\`${candidate.path}\``,
    `- 发现依据：${candidate.reason}`,
    "",
    "## 下一步",
    "",
    "- [ ] 审读项目 README/AGENTS/关键文档。",
    "- [ ] 判断是否需要补 Codex 上下文、项目状态页和验证命令。",
    "- [ ] 确认是否进入活跃项目、观察项目或归档项目。",
    "",
  ].join("\n");
  await app.vault.create(homePath, content);
}

async function writeDiscoveryInbox(app: App, queue: ProjectCandidateQueue): Promise<void> {
  await ensureVaultFolder(app, "01-收件箱/待整理");
  const existing = await readAdapterFile(app, PROJECT_DISCOVERY_INBOX_PATH);
  const created = frontmatterValue(existing, "created") ?? queue.generated_at ?? localTimestamp(new Date());
  const modified = frontmatterValue(existing, "modified") ?? queue.generated_at ?? created;
  const pending = queue.candidates.filter(candidate => candidate.status === "pending");
  const accepted = queue.candidates.filter(candidate => candidate.status === "accepted").slice(0, 12);
  const ignored = queue.candidates.filter(candidate => candidate.status === "ignored").slice(0, 12);
  const lines = [
    "---",
    'title: "项目发现确认"',
    'type: "inbox_review"',
    'topic: "project-discovery"',
    'workspace: "01-收件箱"',
    `created: "${created}"`,
    `modified: "${modified}"`,
    'tags: ["thirdspace", "project-discovery", "inbox"]',
    'source: "dashboard"',
    'status: "active"',
    "---",
    "",
    "# 项目发现确认",
    "",
    "> 规则：发现但不纳入。这里出现的仓库只在 System/Inbox 提醒，确认前不会进入项目 Dashboard，也不会安装 Git hook、不会执行项目命令。",
    "",
    "## 扫描范围",
    "",
    ...queue.roots.map(root => `- \`${root}\``),
    ...(queue.include_paths && queue.include_paths.length > 0 ? ["", "## 显式项目路径", "", ...queue.include_paths.map(projectPath => `- \`${projectPath}\``)] : []),
    "",
    "## 待确认",
    "",
    pending.length === 0 ? "- 当前没有待确认的新项目。" : "",
    ...pending.flatMap(candidate => [
      `- [ ] ${candidate.name}`,
      `  - id: \`${candidate.id}\``,
      `  - path: \`${candidate.path}\``,
      `  - markers: ${candidate.markers.join(", ")}`,
      `  - 建议入口：\`${candidate.suggested_workspace}/首页.md\``,
      "  - 操作：在 ThirdSpace Dashboard 的 System/Inbox 提示中点击“纳入”或“忽略”。",
    ]),
    "",
    "## 已纳入",
    "",
    accepted.length === 0 ? "- 暂无。" : "",
    ...accepted.map(candidate => `- ${candidate.name} · \`${candidate.path}\` · ${candidate.accepted_at ?? candidate.last_seen_at}`),
    "",
    "## 已忽略",
    "",
    ignored.length === 0 ? "- 暂无。" : "",
    ...ignored.map(candidate => `- ${candidate.name} · \`${candidate.path}\` · ${candidate.ignored_at ?? candidate.last_seen_at}`),
    "",
  ].filter(line => line !== "").join("\n");

  await writeVaultFileIfChanged(app, PROJECT_DISCOVERY_INBOX_PATH, lines);
}

async function writeDiscoverySystemNote(app: App): Promise<void> {
  await ensureVaultFolder(app, "00-系统/运行时");
  const existing = await readAdapterFile(app, PROJECT_DISCOVERY_SYSTEM_PATH);
  const created = frontmatterValue(existing, "created") ?? localTimestamp(new Date());
  const modified = frontmatterValue(existing, "modified") ?? created;
  const content = [
    "---",
    'title: "项目发现机制"',
    'type: "runtime_spec"',
    'topic: "project-discovery"',
    'workspace: "00-系统"',
    `created: "${created}"`,
    `modified: "${modified}"`,
    'tags: ["thirdspace", "dashboard", "project-discovery"]',
    'source: "dashboard"',
    'status: "active"',
    "---",
    "",
    "# 项目发现机制",
    "",
    "## 规则",
    "",
    "- 只扫描 `.thirdspace/project-discovery.yaml` 里登记的 `roots`。",
    "- 新项目只进入 `.thirdspace/queues/project-candidates.json` 和 `01-收件箱/待整理/项目发现确认.md`。",
    "- 确认前不写 `.thirdspace/project-index.yaml`，不进入 Dashboard 项目活跃，不安装 Git hook，不执行项目命令。",
    "- 点击“纳入”后，只写 Rain 知识库内的项目索引和项目首页，不修改项目源码。",
    "- 点击“忽略”后保留队列记录，后续不重复打扰。",
    "",
    "## 配置",
    "",
    `- 配置：\`${PROJECT_DISCOVERY_CONFIG_PATH}\``,
    `- 队列：\`${PROJECT_DISCOVERY_QUEUE_PATH}\``,
    `- 确认单：[[${PROJECT_DISCOVERY_INBOX_PATH.replace(/\.md$/, "")}|项目发现确认]]`,
    "",
  ].join("\n");

  await writeVaultFileIfChanged(app, PROJECT_DISCOVERY_SYSTEM_PATH, content);
}

async function loadQueue(app: App): Promise<ProjectCandidateQueue> {
  const raw = await readAdapterFile(app, PROJECT_DISCOVERY_QUEUE_PATH);
  if (!raw) return emptyQueue();
  try {
    const parsed = JSON.parse(raw) as ProjectCandidateQueue;
    if (!Array.isArray(parsed.candidates)) return emptyQueue();
    return {
      version: parsed.version || "1.0",
      generated_at: parsed.generated_at || localTimestamp(new Date()),
      roots: Array.isArray(parsed.roots) ? parsed.roots : DEFAULT_ROOTS,
      include_paths: Array.isArray(parsed.include_paths) ? parsed.include_paths : [],
      candidates: parsed.candidates,
    };
  } catch {
    return emptyQueue();
  }
}

function emptyQueue(): ProjectCandidateQueue {
  return {
    version: "1.0",
    generated_at: localTimestamp(new Date()),
    roots: DEFAULT_ROOTS,
    include_paths: DEFAULT_INCLUDE_PATHS,
    candidates: [],
  };
}

async function writeQueueIfChanged(app: App, queue: ProjectCandidateQueue): Promise<void> {
  await writeAdapterFileIfChanged(app, PROJECT_DISCOVERY_QUEUE_PATH, JSON.stringify(queue, null, 2) + "\n");
}

function summarizeQueue(queue: ProjectCandidateQueue): ProjectDiscoverySummary {
  return {
    roots: queue.roots,
    pending: queue.candidates.filter(candidate => candidate.status === "pending"),
    accepted: queue.candidates.filter(candidate => candidate.status === "accepted"),
    ignored: queue.candidates.filter(candidate => candidate.status === "ignored"),
    notePath: PROJECT_DISCOVERY_INBOX_PATH,
    queuePath: PROJECT_DISCOVERY_QUEUE_PATH,
    generatedAt: queue.generated_at,
  };
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, idx) => value === right[idx]);
}

function frontmatterValue(content: string | null, key: string): string | null {
  if (!content) return null;
  const match = content.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?$`, "m"));
  return match?.[1]?.trim() ?? null;
}

async function writeVaultFileIfChanged(app: App, vaultPath: string, content: string): Promise<void> {
  const existing = app.vault.getAbstractFileByPath(vaultPath) as TFile | null;
  if (existing) {
    const current = await app.vault.read(existing);
    if (current !== content) await app.vault.modify(existing, content);
    return;
  }
  await ensureVaultFolder(app, nodePath.posix.dirname(vaultPath));
  await app.vault.create(vaultPath, content);
}

async function writeAdapterFileIfChanged(app: App, vaultPath: string, content: string): Promise<void> {
  const current = await readAdapterFile(app, vaultPath);
  if (current === content) return;
  await ensureVaultFolder(app, nodePath.posix.dirname(vaultPath));
  await app.vault.adapter.write(vaultPath, content);
}

async function readAdapterFile(app: App, vaultPath: string): Promise<string | null> {
  try {
    return await app.vault.adapter.read(vaultPath);
  } catch {
    return null;
  }
}

async function ensureVaultFolder(app: App, folderPath: string): Promise<void> {
  if (!folderPath || folderPath === ".") return;
  const parts = folderPath.split("/").filter(Boolean);
  let cur = "";
  for (const part of parts) {
    cur = cur ? `${cur}/${part}` : part;
    if (await app.vault.adapter.exists(cur)) continue;
    await app.vault.createFolder(cur);
  }
}

function shouldIgnoreName(name: string, ignoreNames: string[]): boolean {
  if (name.startsWith(".") || name.startsWith("_DELETE_AFTER_")) return true;
  return ignoreNames.includes(name);
}

function uniqueCandidateId(base: string, registeredIds: Set<string>): string {
  if (!registeredIds.has(base)) return base;
  const suffix = localDateCompact(new Date()).slice(2);
  return `${base}-${suffix}`;
}

function slugify(value: string): string {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return ascii || `project-${Date.now()}`;
}

function normalizeProjectPath(value: string): string {
  return nodePath.resolve(value).replace(/\/+$/, "");
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

async function safeReadDir(value: string) {
  try {
    return await fs.readdir(value, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function safeLstat(value: string) {
  try {
    return await fs.lstat(value);
  } catch {
    return null;
  }
}

async function safeRealpath(value: string): Promise<string | null> {
  try {
    return await fs.realpath(value);
  } catch {
    return null;
  }
}
