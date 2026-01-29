import Database from "better-sqlite3";
import path from "path";
import type { CachedIssue } from "./types";

const DB_PATH = path.join(process.cwd(), "issues.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS issues (
        repo TEXT NOT NULL,
        id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        html_url TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (repo, id)
      );
      CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues(repo);
    `);
  }
  return db;
}

export function saveIssues(repo: string, issues: CachedIssue[]): void {
  const database = getDb();
  const insert = database.prepare(`
    INSERT OR REPLACE INTO issues (repo, id, title, body, html_url, created_at)
    VALUES (@repo, @id, @title, @body, @html_url, @created_at)
  `);
  const transaction = database.transaction(() => {
    for (const issue of issues) {
      insert.run({
        repo,
        id: issue.id,
        title: issue.title,
        body: issue.body ?? null,
        html_url: issue.html_url,
        created_at: issue.created_at,
      });
    }
  });
  transaction();
}

export function getIssues(repo: string): CachedIssue[] {
  const database = getDb();
  const rows = database
    .prepare(
      "SELECT id, title, body, html_url, created_at FROM issues WHERE repo = ? ORDER BY created_at DESC"
    )
    .all(repo) as Array<{
    id: number;
    title: string;
    body: string | null;
    html_url: string;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    html_url: r.html_url,
    created_at: r.created_at,
  }));
}

export function hasCachedRepo(repo: string): boolean {
  const database = getDb();
  const row = database
    .prepare("SELECT 1 FROM issues WHERE repo = ? LIMIT 1")
    .get(repo);
  return !!row;
}
