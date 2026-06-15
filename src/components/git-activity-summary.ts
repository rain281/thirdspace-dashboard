import type { GitActivitySummary, GitRepoActivity } from "../data/vault-reader";

export interface GitActivityCardRepoRow {
  name: string;
  branch: string;
  countLabel: string;
  widthPercent: number;
}

export interface GitActivityCardModel {
  totalLabel: string;
  todayLabel: string;
  topRepoLabel: string;
  topRepoMeta: string;
  latestRepoLabel: string;
  latestRepoMeta: string;
  repoRows: GitActivityCardRepoRow[];
}

export function buildGitActivityCardModel(activity: GitActivitySummary): GitActivityCardModel {
  const topRepo = activity.repos[0];
  const latestRepo = [...activity.repos].sort((a, b) => b.lastCommit - a.lastCommit)[0];
  const visibleRepos = activity.repos.slice(0, 3);
  const repoMax = Math.max(...visibleRepos.map(repo => repo.count), 1);
  return {
    totalLabel: String(activity.total),
    todayLabel: String(activity.days[activity.days.length - 1]?.count ?? 0),
    topRepoLabel: topRepo?.name ?? "-",
    topRepoMeta: topRepo ? commitLabel(topRepo.count) : "无提交",
    latestRepoLabel: latestRepo?.name ?? "-",
    latestRepoMeta: latestRepo ? latestRepo.branch || "-" : "无提交",
    repoRows: visibleRepos.map(repo => repoRow(repo, repoMax)),
  };
}

function repoRow(repo: GitRepoActivity, repoMax: number): GitActivityCardRepoRow {
  return {
    name: repo.name,
    branch: repo.branch || "-",
    countLabel: String(repo.count),
    widthPercent: Math.max(4, Math.round(repo.count / repoMax * 100)),
  };
}

function commitLabel(count: number): string {
  return `${count} 次`;
}
