import * as nodePath from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { ProjectIndexEntry } from "./vault-reader";

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_COUNT = 200;
const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_MAX_BUFFER = 5 * 1024 * 1024;
const GIT_LOG_FORMAT = "--pretty=format:%x1e%H%x1f%h%x1f%cI%x1f%an%x1f%s";

export interface LiveGitRepoSource {
  id: string;
  name: string;
  path: string;
}

export interface LiveGitCommit {
  hash: string;
  short_hash: string;
  time: string;
  author_name: string;
  subject: string;
  branch: string;
  files: string[];
  repo: LiveGitRepoSource;
}

export interface LiveGitRepoSnapshot {
  id: string;
  name: string;
  path: string;
  branch: string;
  commits: LiveGitCommit[];
}

export interface LiveGitDegradedRepo {
  id: string;
  name: string;
  path: string;
  reason: string;
}

export interface LiveGitSnapshot {
  repos: LiveGitRepoSnapshot[];
  degraded: LiveGitDegradedRepo[];
}

export type LiveGitExecutor = (
  command: string,
  args: string[],
  options: { encoding: "utf8"; timeout: number; maxBuffer: number },
) => Promise<{ stdout: string }>;

export interface ReadLiveGitSnapshotOptions {
  executor?: LiveGitExecutor;
  maxCount?: number;
  timeoutMs?: number;
}

export function buildLiveGitRepoSources(vaultRoot: string, projects: ProjectIndexEntry[]): LiveGitRepoSource[] {
  const seen = new Set<string>();
  const sources: LiveGitRepoSource[] = [];

  const add = (source: LiveGitRepoSource) => {
    if (!source.path.trim()) return;
    const normalized = normalizeRepoPath(source.path);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    sources.push({ ...source, path: normalized });
  };

  add({ id: "rain", name: "rain", path: vaultRoot });

  for (const project of projects) {
    if (!project.repo_path) continue;
    if (project.lifecycle === "archived") continue;
    add({
      id: project.id,
      name: project.name,
      path: project.repo_path,
    });
  }

  return sources;
}

export function parseGitLogOutput(output: string, repo: LiveGitRepoSource, branch: string): LiveGitCommit[] {
  const commits: LiveGitCommit[] = [];
  for (const block of output.split("\x1e")) {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const [hash, shortHash, time, authorName, subject] = lines[0].split("\x1f");
    if (!hash || !shortHash || !time) continue;
    commits.push({
      hash,
      short_hash: shortHash,
      time,
      author_name: authorName ?? "",
      subject: subject ?? "",
      branch,
      files: lines.slice(1),
      repo,
    });
  }
  return commits;
}

export async function readLiveGitSnapshot(
  sources: LiveGitRepoSource[],
  options: ReadLiveGitSnapshotOptions = {},
): Promise<LiveGitSnapshot> {
  const executor = options.executor ?? defaultGitExecutor;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxCount = options.maxCount ?? DEFAULT_MAX_COUNT;
  const repos: LiveGitRepoSnapshot[] = [];
  const degraded: LiveGitDegradedRepo[] = [];

  for (const source of sources) {
    try {
      const execOptions = { encoding: "utf8" as const, timeout, maxBuffer: DEFAULT_MAX_BUFFER };
      const branchResult = await executor("git", ["-C", source.path, "rev-parse", "--abbrev-ref", "HEAD"], execOptions);
      const branch = branchResult.stdout.trim();
      const logResult = await executor("git", [
        "-C",
        source.path,
        "log",
        `--max-count=${maxCount}`,
        "--date=iso-strict",
        "--name-only",
        GIT_LOG_FORMAT,
      ], execOptions);
      repos.push({
        id: source.id,
        name: source.name,
        path: source.path,
        branch,
        commits: parseGitLogOutput(logResult.stdout, source, branch),
      });
    } catch (error) {
      degraded.push({
        id: source.id,
        name: source.name,
        path: source.path,
        reason: errorMessage(error),
      });
    }
  }

  return { repos, degraded };
}

async function defaultGitExecutor(
  command: string,
  args: string[],
  options: { encoding: "utf8"; timeout: number; maxBuffer: number },
): Promise<{ stdout: string }> {
  const result = await execFileAsync(command, args, options);
  return { stdout: result.stdout };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeRepoPath(repoPath: string): string {
  return nodePath.resolve(repoPath).replace(/\/+$/, "");
}
