export interface CachedIssue {
  id: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
}

export interface ScanRequest {
  repo: string;
}

export interface ScanResponse {
  repo: string;
  issues_fetched: number;
  cached_successfully: boolean;
}

export interface AnalyzeRequest {
  repo: string;
  prompt: string;
}

export interface AnalyzeResponse {
  analysis: string;
}
