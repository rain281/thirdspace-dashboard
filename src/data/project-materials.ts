import type { App } from "obsidian";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as nodePath from "path";
import { ensureTodayWorklog, loadProjectIndex, localTimestamp } from "./vault-reader";

const MATERIAL_IMPORTS_PATH = ".thirdspace/material-imports.json";
const MATERIAL_INDEX_NAME = "资料索引.md";
const MATERIAL_SNAPSHOT_DIR = "资料快照";
const MAX_FILES_PER_PROJECT = 120;
const MAX_FILE_BYTES = 512 * 1024;
const MATERIAL_IMPORT_MODE = "index-only";

const ROOT_DOC_NAMES = new Set([
  "README.md",
  "README.markdown",
  "AGENTS.md",
  "CLAUDE.md",
  "CHANGELOG.md",
  "DESIGN.md",
  "CONVENTIONS.md",
  "GAME_DESIGN.md",
]);
const DOC_DIRS = new Set(["docs", "doc", "plans", "plan", "specs", "spec", "design", "designs"]);
const ALLOWED_EXT = new Set([".md", ".markdown", ".txt"]);
const SECRET_NAME_PATTERNS = [/\.env/i, /secret/i, /token/i, /credential/i, /private[-_]?key/i, /id_rsa/i];
const SKIP_DIRS = new Set([".git", "node_modules", "target", "dist", "build", ".next", ".turbo", ".venv", "__pycache__"]);

export interface ProjectMaterialsItem {
  id: string;
  name: string;
  repoPath: string;
  workspace: string;
  indexPath: string;
  snapshotDir: string;
  candidateCount: number;
  importedCount: number;
  syncedCount: number;
  newCount: number;
  changedCount: number;
  staleCount: number;
  indexExists: boolean;
  selfVault: boolean;
  needsImport: boolean;
  reason: string;
}

export interface ProjectMaterialsImportResult {
  project: ProjectMaterialsItem;
  indexedCount: number;
  snapshotCount: number;
  skippedCount: number;
  indexPath: string;
  snapshotDir: string;
}

interface MaterialCandidate {
  relativePath: string;
  absPath: string;
  size: number;
  hash: string;
}

interface MaterialManifest {
  generated_at: string;
  projects: Array<{
    id: string;
    name: string;
    repo_path: string;
    workspace: string;
    imported_at: string;
    index_path: string;
    snapshot_dir: string;
    file_count: number;
    mode?: "index-only" | "snapshot";
    files: Array<{ relative_path: string; hash: string; size: number; source_path?: string; snapshot_path?: string }>;
  }>;
}

export async function loadProjectMaterials(app: App): Promise<ProjectMaterialsItem[]> {
  const [projects, manifest] = await Promise.all([loadProjectIndex(app), readManifest(app)]);
  const vaultRoot = vaultAbsPath(app, "");
  const items: ProjectMaterialsItem[] = [];

  for (const project of projects) {
    if (!project.repo_path || !project.workspace) continue;
    if (project.lifecycle === "archived") continue;
    const repoPath = normalizePath(project.repo_path);
    const workspace = normalizeVaultRelativePath(project.workspace);
    if (!isAllowedProjectWorkspace(workspace)) continue;
    const indexPath = `${workspace}/${MATERIAL_INDEX_NAME}`;
    const snapshotDir = `${workspace}/${MATERIAL_SNAPSHOT_DIR}`;
    const selfVault = repoPath === normalizePath(vaultRoot);
    if (selfVault) continue;

    const candidates = await findMaterialCandidates(repoPath);
    const imported = manifest.projects.find(entry => entry.id === project.id || normalizePath(entry.repo_path) === repoPath);
    const importedByPath = new Map((imported?.files ?? []).map(file => [file.relative_path, file.hash]));
    const candidatePaths = new Set(candidates.map(candidate => candidate.relativePath));
    const newCount = candidates.filter(candidate => !importedByPath.has(candidate.relativePath)).length;
    const changedCount = candidates.filter(candidate => {
      const importedHash = importedByPath.get(candidate.relativePath);
      return Boolean(importedHash && importedHash !== candidate.hash);
    }).length;
    const staleCount = (imported?.files ?? []).filter(file => !candidatePaths.has(file.relative_path)).length;
    const syncedCount = Math.max(0, candidates.length - newCount - changedCount);
    const indexExists = await app.vault.adapter.exists(indexPath);
    const importedCount = imported?.file_count ?? 0;
    const needsImport = candidates.length > 0 && (!indexExists || importedCount === 0 || newCount > 0 || changedCount > 0 || staleCount > 0);
    const reason = needsImport
      ? importedCount === 0
        ? `${candidates.length} files 可索引`
        : `新增 ${newCount} / 变更 ${changedCount} / 移除 ${staleCount}`
      : candidates.length === 0
        ? "未发现资料文档"
        : `${syncedCount} files 已索引`;

    items.push({
      id: project.id,
      name: project.name,
      repoPath,
      workspace,
      indexPath,
      snapshotDir,
      candidateCount: candidates.length,
      importedCount,
      syncedCount,
      newCount,
      changedCount,
      staleCount,
      indexExists,
      selfVault,
      needsImport,
      reason,
    });
  }

  return items.sort((a, b) => Number(b.needsImport) - Number(a.needsImport) || b.candidateCount - a.candidateCount);
}

export async function runProjectMaterialsImport(app: App, projectId: string): Promise<ProjectMaterialsImportResult | null> {
  const projects = await loadProjectIndex(app);
  const project = projects.find(item => item.id === projectId);
  if (!project?.repo_path || !project.workspace) return null;
  if (!isAllowedProjectWorkspace(normalizeVaultRelativePath(project.workspace))) return null;

  const item = (await loadProjectMaterials(app)).find(entry => entry.id === projectId);
  if (!item) return null;

  const candidates = await findMaterialCandidates(item.repoPath);
  await removeLegacySnapshotDir(app, item.snapshotDir);
  const indexedFiles: MaterialManifest["projects"][number]["files"] = [];
  let skippedCount = 0;

  for (const candidate of candidates) {
    indexedFiles.push({
      relative_path: candidate.relativePath,
      hash: candidate.hash,
      size: candidate.size,
      source_path: candidate.absPath,
    });
  }

  skippedCount += Math.max(0, item.candidateCount - candidates.length);
  const indexMarkdown = renderMaterialIndex(project.name, item, candidates, indexedFiles);
  await writeVaultFileIfChanged(app, item.indexPath, indexMarkdown);
  await updateManifest(app, {
    id: project.id,
    name: project.name,
    repo_path: item.repoPath,
    workspace: item.workspace,
    imported_at: localTimestamp(new Date()),
    index_path: item.indexPath,
    snapshot_dir: item.snapshotDir,
    mode: MATERIAL_IMPORT_MODE,
    file_count: indexedFiles.length,
    files: indexedFiles,
  });
  await appendMaterialsEvent(app, project.name, item.repoPath, indexedFiles.length, item.indexPath);

  return {
    project: item,
    indexedCount: candidates.length,
    snapshotCount: 0,
    skippedCount,
    indexPath: item.indexPath,
    snapshotDir: item.snapshotDir,
  };
}

async function findMaterialCandidates(repoPath: string): Promise<MaterialCandidate[]> {
  const result: MaterialCandidate[] = [];
  if (!(await pathExists(repoPath))) return result;
  const entries = await fs.readdir(repoPath, { withFileTypes: true });

  for (const entry of entries) {
    const absPath = nodePath.join(repoPath, entry.name);
    if (entry.isFile() && ROOT_DOC_NAMES.has(entry.name)) await maybePushCandidate(repoPath, absPath, result);
    if (entry.isDirectory() && DOC_DIRS.has(entry.name)) await walkDocDir(repoPath, absPath, result);
    if (result.length >= MAX_FILES_PER_PROJECT) break;
  }

  return result.slice(0, MAX_FILES_PER_PROJECT).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function walkDocDir(repoPath: string, dir: string, result: MaterialCandidate[]): Promise<void> {
  if (result.length >= MAX_FILES_PER_PROJECT) return;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (result.length >= MAX_FILES_PER_PROJECT) return;
    if (entry.name.startsWith(".") || SECRET_NAME_PATTERNS.some(pattern => pattern.test(entry.name))) continue;
    const absPath = nodePath.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkDocDir(repoPath, absPath, result);
      continue;
    }
    if (entry.isFile()) await maybePushCandidate(repoPath, absPath, result);
  }
}

async function maybePushCandidate(repoPath: string, absPath: string, result: MaterialCandidate[]): Promise<void> {
  const relativePath = normalizeRelativePath(nodePath.relative(repoPath, absPath));
  if (SECRET_NAME_PATTERNS.some(pattern => pattern.test(relativePath))) return;
  const ext = nodePath.extname(absPath).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return;
  const stat = await fs.stat(absPath).catch(() => null);
  if (!stat || stat.size > MAX_FILE_BYTES) return;
  const raw = await fs.readFile(absPath);
  result.push({
    relativePath,
    absPath,
    size: stat.size,
    hash: crypto.createHash("sha256").update(raw).digest("hex"),
  });
}

function renderMaterialIndex(
  projectName: string,
  item: ProjectMaterialsItem,
  candidates: MaterialCandidate[],
  indexedFiles: MaterialManifest["projects"][number]["files"],
): string {
  const now = localTimestamp(new Date());
  const rows = indexedFiles.map(file =>
    `| \`${file.relative_path}\` | ${file.size} | \`${file.hash.slice(0, 12)}\` | 索引-only |`,
  );
  return [
    "---",
    `title: "${escapeYaml(`${projectName} 资料索引`)}"`,
    'type: "project_material_index"',
    `topic: "${escapeYaml(projectName)}"`,
    'workspace: "04-项目"',
    `created: "${now}"`,
    `modified: "${now}"`,
    'tags: ["project", "materials", "index"]',
    'source: "project-material-import"',
    'status: "active"',
    `project: "${escapeYaml(projectName)}"`,
    `repo_path: "${escapeYaml(item.repoPath)}"`,
    "---",
    "",
    `# ${projectName} 资料索引`,
    "",
    "## 范围",
    "",
    "- 默认只索引项目资料文档，不复制全文快照。",
    "- 来源范围：根目录 README/AGENTS/CLAUDE/CHANGELOG/DESIGN/CONVENTIONS/GAME_DESIGN，以及 docs/plans/specs/design 目录。",
    "- 不导入源码、依赖目录、密钥文件和二进制。",
    "- 需要全文快照时必须另走显式确认流程，不能由 Dashboard 自动生成。",
    `- 候选文件：${candidates.length}真实/${candidates.length}总数。`,
    `- 已索引：${indexedFiles.length}真实/${candidates.length}总数。`,
    "- 导入快照：0真实/0总数。",
    "",
    "## 文件",
    "",
    "| Source | Size | Hash | Mode |",
    "|---|---:|---|---|",
    ...rows,
    "",
  ].join("\n");
}

async function readManifest(app: App): Promise<MaterialManifest> {
  const raw = await readAdapterFile(app, MATERIAL_IMPORTS_PATH);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MaterialManifest;
      if (Array.isArray(parsed.projects)) return parsed;
    } catch {}
  }
  return { generated_at: new Date().toISOString(), projects: [] };
}

async function updateManifest(app: App, entry: MaterialManifest["projects"][number]): Promise<void> {
  const manifest = await readManifest(app);
  const idx = manifest.projects.findIndex(item => item.id === entry.id || normalizePath(item.repo_path) === normalizePath(entry.repo_path));
  if (idx >= 0) manifest.projects[idx] = entry;
  else manifest.projects.push(entry);
  manifest.generated_at = new Date().toISOString();
  await writeAdapterFile(app, MATERIAL_IMPORTS_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

async function appendMaterialsEvent(app: App, projectName: string, repoPath: string, count: number, indexPath: string): Promise<void> {
  const file = await ensureTodayWorklog(app);
  const markdown = await app.vault.read(file);
  const timestamp = localTimestamp(new Date());
  const eventId = `project_material_import:${projectName}:${timestamp}`;
  const line = `- ${timestamp} [agent_event:${eventId}] 完成项目资料索引：${projectName}；indexed=${count}；snapshots=0；index=\`${indexPath}\`；repo=\`${repoPath}\``;
  const next = appendToSection(markdown, "Agent 产出", line, eventId).replace(/modified: ".*?"/, `modified: "${timestamp}"`);
  if (next !== markdown) await app.vault.modify(file, next);
}

function appendToSection(markdown: string, section: string, line: string, eventId: string): string {
  if (markdown.includes(eventId)) return markdown;
  const heading = `## ${section}`;
  const idx = markdown.indexOf(heading);
  if (idx === -1) return `${markdown.trimEnd()}\n\n${heading}\n\n${line}\n`;
  const nextIdx = markdown.indexOf("\n## ", idx + heading.length);
  const insertAt = nextIdx === -1 ? markdown.length : nextIdx;
  return `${markdown.slice(0, insertAt).trimEnd()}\n\n${line}\n${markdown.slice(insertAt)}`;
}

async function writeVaultFileIfChanged(app: App, vaultPath: string, content: string): Promise<void> {
  const current = await readAdapterFile(app, vaultPath);
  if (current === content) return;
  await ensureVaultFolder(app, nodePath.posix.dirname(vaultPath));
  await app.vault.adapter.write(vaultPath, content);
}

async function writeAdapterFile(app: App, vaultPath: string, content: string): Promise<void> {
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

async function removeLegacySnapshotDir(app: App, snapshotDir: string): Promise<void> {
  const vaultRoot = normalizePath(vaultAbsPath(app, ""));
  const absPath = normalizePath(nodePath.join(vaultRoot, snapshotDir));
  if (!absPath.startsWith(`${vaultRoot}${nodePath.sep}`)) return;
  if (!(await pathExists(absPath))) return;
  await fs.rm(absPath, { recursive: true, force: true });
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function vaultAbsPath(app: App, child: string): string {
  const base = (app.vault.adapter as any).basePath ?? "";
  return child ? nodePath.join(base, child) : base;
}

function normalizePath(value: string): string {
  return nodePath.resolve(value).replace(/\/+$/, "");
}

function normalizeRelativePath(value: string): string {
  return value.split(nodePath.sep).join("/");
}

function normalizeVaultRelativePath(value: string): string {
  return value.split("\\").join("/").replace(/^\/+|\/+$/g, "");
}

function isAllowedProjectWorkspace(value: string): boolean {
  if (!value || value.includes("\0")) return false;
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) return false;
  return value.startsWith("04-项目/") || value.startsWith("99-归档/完结项目/");
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
