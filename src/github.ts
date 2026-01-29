import type { CachedIssue } from "./types";

const GITHUB_API = "https://api.github.com";

export async function fetchOpenIssues(repo: string): Promise<CachedIssue[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "github-issue-analyzer",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const all: CachedIssue[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${GITHUB_API}/repos/${repo}/issues?state=open&per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as Array<{
      id: number;
      title: string;
      body: string | null;
      html_url: string;
      created_at: string;
      pull_request?: unknown;
    }>;
    const issues = data.filter((i) => !i.pull_request);
    for (const i of issues) {
      all.push({
        id: i.id,
        title: i.title,
        body: i.body,
        html_url: i.html_url,
        created_at: i.created_at,
      });
    }
    hasMore = issues.length === 100;
    page++;
  }

  return all;
}
