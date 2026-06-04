import type { App } from "obsidian";
import * as fs from "fs/promises";
import * as nodePath from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { ensureTodayWorklog, loadProjectIndex, localTimestamp } from "./vault-reader";

const execFileAsync = promisify(execFile);

const COMMITS_INDEX_PATH = ".thirdspace/git/commits.json";
const RUNTIME_SCRIPT = "00-系统/Skills/thirdspace-vault/scripts/thirdspace-vault.mjs";

export interface ProjectOnboardingItem {
  id: string;
  name: string;
  repoPath: string;
  lifecycle: string;
  hookInstalled: boolean;
  historyIndexed: boolean;
  needsOnboarding: boolean;
  reason: string;
}

export interface ProjectOnboardingResult {
  project: ProjectOnboardingItem;
  hookStatus: "installed" | "updated" | "already-installed" | "sidecar-created" | "skipped";
  historyStatus: "updated" | "skipped";
  commitCount: number;
  notePath: string;
}

interface CommitIndex {
  generated_at: string;
  vault: string;
  scope: string;
  policy: {
    reads_diff_content: boolean;
    reads_secret_values: boolean;
    writes_project_source: boolean;
    captured_fields: string[];
  };
  repos: CommitRepo[];
}

interface CommitRepo {
  id: string;
  name: string;
  path: string;
  branch: string;
  head: string;
  head_short: string;
  commit_count: number;
  commits: CommitRecord[];
}

interface CommitRecord {
  hash: string;
  short_hash: string;
  time: string;
  author_name: string;
  subject: string;
  branch: string;
  files: string[];
}

export async function loadProjectOnboarding(app: App): Promise<ProjectOnboardingItem[]> {
  const [projects, indexedPaths] = await Promise.all([
    loadProjectIndex(app),
    loadIndexedRepoPaths(app),
  ]);

  const items: ProjectOnboardingItem[] = [];
  for (const project of projects) {
    if (!project.repo_path) continue;
    if (project.lifecycle === "archived") continue;
    const repoPath = project.repo_path;
    const repoExists = await isGitRepo(repoPath);
    if (!repoExists) continue;

    const hookInstalled = await hasThirdSpaceHook(repoPath);
    const historyIndexed = indexedPaths.has(normalizePath(repoPath));
    const missing: string[] = [];
    if (!hookInstalled) missing.push("repo hook");
    if (!historyIndexed) missing.push("Git history");

    items.push({
      id: project.id,
      name: project.name,
      repoPath,
      lifecycle: project.lifecycle ?? "active",
      hookInstalled,
      historyIndexed,
      needsOnboarding: missing.length > 0,
      reason: missing.length > 0 ? `缺少 ${missing.join(" / ")}` : "已接入",
    });
  }

  return items.sort((a, b) => Number(b.needsOnboarding) - Number(a.needsOnboarding) || a.name.localeCompare(b.name));
}

export async function runProjectOnboarding(app: App, projectId: string): Promise<ProjectOnboardingResult | null> {
  const items = await loadProjectOnboarding(app);
  const project = items.find(item => item.id === projectId);
  if (!project) return null;

  const hookStatus = project.hookInstalled ? "already-installed" : await installRepoHook(app, project.repoPath);
  const history = project.historyIndexed ? { status: "skipped" as const, count: 0 } : await updateCommitHistory(app, project);
  const notePath = await appendOnboardingEvent(app, project, hookStatus, history.status, history.count);

  return {
    project,
    hookStatus,
    historyStatus: history.status,
    commitCount: history.count,
    notePath,
  };
}

async function installRepoHook(app: App, repoPath: string): Promise<ProjectOnboardingResult["hookStatus"]> {
  const gitDir = await git(repoPath, ["rev-parse", "--git-dir"]);
  const hookDir = nodePath.isAbsolute(gitDir)
    ? nodePath.join(gitDir, "hooks")
    : nodePath.join(repoPath, gitDir, "hooks");
  const hookPath = nodePath.join(hookDir, "post-commit");
  const scriptPath = vaultAbsPath(app, RUNTIME_SCRIPT);
  const vaultRoot = vaultAbsPath(app, "");
  const content = [
    "#!/bin/sh",
    "# ThirdSpace portable repo post-commit hook.",
    "# Source of truth: Dashboard project onboarding",
    `VAULT="${vaultRoot}"`,
    `SCRIPT="${scriptPath}"`,
    'NODE_BIN="$(command -v node 2>/dev/null)"',
    '[ -n "$NODE_BIN" ] || exit 0',
    '[ -f "$SCRIPT" ] || exit 0',
    'REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"',
    '"$NODE_BIN" "$SCRIPT" capture-git-commit --vault "$VAULT" --repo "$REPO_ROOT" >/dev/null 2>&1 || true',
    "exit 0",
    "",
  ].join("\n");

  await fs.mkdir(hookDir, { recursive: true });
  const existing = await readFileIfExists(hookPath);
  if (existing?.includes("ThirdSpace portable repo post-commit hook") || existing?.includes("thirdspace-vault post-commit hook")) {
    if (existing !== content) await fs.writeFile(hookPath, content, { encoding: "utf8", mode: 0o755 });
    await fs.chmod(hookPath, 0o755);
    return existing === content ? "already-installed" : "updated";
  }
  if (existing && existing.trim()) {
    const sidecar = nodePath.join(hookDir, "post-commit.thirdspace-vault");
    await fs.writeFile(sidecar, content, { encoding: "utf8", mode: 0o755 });
    await fs.chmod(sidecar, 0o755);
    return "sidecar-created";
  }
  await fs.writeFile(hookPath, content, { encoding: "utf8", mode: 0o755 });
  await fs.chmod(hookPath, 0o755);
  return "installed";
}

async function updateCommitHistory(app: App, project: ProjectOnboardingItem): Promise<{ status: "updated" | "skipped"; count: number }> {
  const branch = await git(project.repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = await git(project.repoPath, ["rev-parse", "HEAD"]);
  const hashes = (await git(project.repoPath, ["log", "--pretty=%H"])).split("\n").filter(Boolean);
  const commits: CommitRecord[] = [];
  for (const hash of hashes) {
    const [shortHash, time, author, subject] = (await git(project.repoPath, ["show", "-s", "--format=%h%x1f%cI%x1f%an%x1f%s", hash])).split("\x1f");
    const files = (await git(project.repoPath, ["show", "--pretty=", "--name-only", hash]))
      .split("\n")
      .filter(Boolean)
      .slice(0, 20);
    commits.push({
      hash,
      short_hash: shortHash,
      time,
      author_name: author,
      subject,
      branch,
      files,
    });
  }

  const index = await readCommitIndex(app);
  const repo: CommitRepo = {
    id: project.id,
    name: project.name,
    path: project.repoPath,
    branch,
    head,
    head_short: head.slice(0, 7),
    commit_count: commits.length,
    commits,
  };
  const normalized = normalizePath(project.repoPath);
  const existingIdx = index.repos.findIndex(item => item.id === project.id || normalizePath(item.path) === normalized);
  if (existingIdx >= 0) index.repos[existingIdx] = repo;
  else index.repos.push(repo);
  index.generated_at = new Date().toISOString();
  index.vault = vaultAbsPath(app, "");
  await writeVaultAdapterFile(app, COMMITS_INDEX_PATH, JSON.stringify(index, null, 2) + "\n");
  return { status: "updated", count: commits.length };
}

async function readCommitIndex(app: App): Promise<CommitIndex> {
  const raw = await readVaultAdapterFile(app, COMMITS_INDEX_PATH);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CommitIndex;
      if (Array.isArray(parsed.repos)) return parsed;
    } catch {}
  }
  return {
    generated_at: new Date().toISOString(),
    vault: vaultAbsPath(app, ""),
    scope: "current-branch-history",
    policy: {
      reads_diff_content: false,
      reads_secret_values: false,
      writes_project_source: false,
      captured_fields: ["hash", "short_hash", "time", "author_name", "subject", "branch", "files"],
    },
    repos: [],
  };
}

async function loadIndexedRepoPaths(app: App): Promise<Set<string>> {
  const index = await readCommitIndex(app);
  return new Set(index.repos.map(repo => normalizePath(repo.path)));
}

async function appendOnboardingEvent(
  app: App,
  project: ProjectOnboardingItem,
  hookStatus: ProjectOnboardingResult["hookStatus"],
  historyStatus: ProjectOnboardingResult["historyStatus"],
  commitCount: number,
): Promise<string> {
  const file = await ensureTodayWorklog(app);
  const markdown = await app.vault.read(file);
  const timestamp = localTimestamp(new Date());
  const eventId = `project_onboarding:${project.id}:${timestamp}`;
  const line = `- ${timestamp} [agent_event:${eventId}] 完成项目确认后接入：${project.name}；hook=${hookStatus}；history=${historyStatus}；commits=${commitCount}；repo=\`${project.repoPath}\``;
  const next = appendToSection(markdown, "Agent 产出", line, eventId).replace(/modified: ".*?"/, `modified: "${timestamp}"`);
  if (next !== markdown) await app.vault.modify(file, next);
  return file.path;
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

async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    await git(repoPath, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

async function hasThirdSpaceHook(repoPath: string): Promise<boolean> {
  try {
    const gitDir = await git(repoPath, ["rev-parse", "--git-dir"]);
    const hookPath = nodePath.join(nodePath.isAbsolute(gitDir) ? gitDir : nodePath.join(repoPath, gitDir), "hooks", "post-commit");
    const content = await readFileIfExists(hookPath);
    return !!content && (content.includes("ThirdSpace portable repo post-commit hook") || content.includes("thirdspace-vault post-commit hook"));
  } catch {
    return false;
  }
}

async function git(repoPath: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", repoPath, ...args], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  return result.stdout.trim();
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readVaultAdapterFile(app: App, vaultPath: string): Promise<string | null> {
  try {
    return await app.vault.adapter.read(vaultPath);
  } catch {
    return null;
  }
}

async function writeVaultAdapterFile(app: App, vaultPath: string, content: string): Promise<void> {
  const dir = nodePath.posix.dirname(vaultPath);
  if (dir && dir !== ".") await ensureVaultFolder(app, dir);
  await app.vault.adapter.write(vaultPath, content);
}

async function ensureVaultFolder(app: App, folderPath: string): Promise<void> {
  const parts = folderPath.split("/").filter(Boolean);
  let cur = "";
  for (const part of parts) {
    cur = cur ? `${cur}/${part}` : part;
    if (await app.vault.adapter.exists(cur)) continue;
    await app.vault.createFolder(cur);
  }
}

function vaultAbsPath(app: App, child: string): string {
  const base = (app.vault.adapter as any).basePath ?? "";
  return child ? nodePath.join(base, child) : base;
}

function normalizePath(value: string): string {
  return nodePath.resolve(value).replace(/\/+$/, "");
}
