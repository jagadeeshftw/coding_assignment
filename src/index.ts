import "dotenv/config";
import cors from "cors";
import express from "express";
import { fetchOpenIssues } from "./github";
import { saveIssues, getIssues, hasCachedRepo } from "./cache";
import { analyzeWithLLM } from "./analyze";
import type { ScanRequest, AnalyzeRequest } from "./types";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/scan", async (req, res) => {
  try {
    const { repo } = req.body as ScanRequest;
    if (!repo || typeof repo !== "string") {
      res.status(400).json({ error: "Missing or invalid 'repo' (expected string owner/repository-name)" });
      return;
    }
    const issues = await fetchOpenIssues(repo);
    saveIssues(repo, issues);
    res.json({
      repo,
      issues_fetched: issues.length,
      cached_successfully: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    res.status(500).json({ error: message });
  }
});

app.post("/analyze", async (req, res) => {
  try {
    const { repo, prompt } = req.body as AnalyzeRequest;
    if (!repo || typeof repo !== "string") {
      res.status(400).json({ error: "Missing or invalid 'repo'" });
      return;
    }
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "Missing or invalid 'prompt'" });
      return;
    }

    if (!hasCachedRepo(repo)) {
      res.status(404).json({
        error: "Repo not yet scanned. Call POST /scan with this repo first.",
      });
      return;
    }

    const issues = getIssues(repo);
    if (issues.length === 0) {
      res.json({
        analysis: "No cached issues for this repo. Run POST /scan first, or the repo has no open issues.",
      });
      return;
    }

    const analysis = await analyzeWithLLM(repo, prompt, issues);
    res.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: message });
  }
});

const port = Number(process.env.PORT) || 3000;
const llmProvider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`LLM provider: ${llmProvider}`);
});
