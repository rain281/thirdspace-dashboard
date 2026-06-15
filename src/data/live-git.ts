import * as nodePath from "path";
import type { ProjectIndexEntry } from "./vault-reader";

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

function normalizeRepoPath(repoPath: string): string {
  return nodePath.resolve(repoPath).replace(/\/+$/, "");
}
