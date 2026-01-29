# GitHub Issue Analyzer

A small service that fetches and caches GitHub issues, then analyzes them with an LLM.

## How to run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment template and set your keys:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - **LLM for /analyze** – choose one (set `LLM_PROVIDER` and the matching key):
     - `LLM_PROVIDER=groq` + `GROQ_API_KEY` – free tier, recommended if OpenAI quota exceeded
     - `LLM_PROVIDER=gemini` + `GEMINI_API_KEY` – free tier
     - `LLM_PROVIDER=ollama` – local, no key (run `ollama run llama3.2` first)
     - `LLM_PROVIDER=openai` + `OPENAI_API_KEY` – default
   - `GITHUB_TOKEN` (optional; increases rate limit for POST /scan)

3. Run the server:
   ```bash
   npm run dev
   ```
   Or build and run:
   ```bash
   npm run build && npm start
   ```

4. Use the API:
   - **POST /scan** – Cache open issues for a repo:
     ```json
     { "repo": "owner/repository-name" }
     ```
   - **POST /analyze** – Analyze cached issues with a prompt:
     ```json
     { "repo": "owner/repository-name", "prompt": "Find themes and recommend what to fix first" }
     ```

## LLM options (if OpenAI quota exceeded)

Set `LLM_PROVIDER` in `.env` and the matching API key:

| Provider | Env | Free tier | Get key |
|----------|-----|-----------|---------|
| **Groq** | `LLM_PROVIDER=groq`, `GROQ_API_KEY` | Yes | [console.groq.com](https://console.groq.com) |
| **Gemini** | `LLM_PROVIDER=gemini`, `GEMINI_API_KEY` | Yes | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Ollama** | `LLM_PROVIDER=ollama` | Local, no key | Run `ollama run llama3.2` |

Restart the server after changing `.env`.

## Local storage choice: SQLite

We use **SQLite** (via `better-sqlite3`) to cache issues.

- **Durable**: Data survives server restarts; no need to re-scan after deploy.
- **Simple**: Single file (`issues.db`), no separate DB server.
- **Queryable**: Easy to add indexes (e.g. by repo) and future queries.
- **Portable**: One file to backup or move.

In-memory and JSON-file were considered; SQLite was chosen for durability and minimal setup.

## Prompts used

*(For understanding the workflow; they don’t have to be perfect.)*

### 1. Prompts sent to AI coding tools for help

- "Build a small service with two endpoints: POST /scan (fetch and cache GitHub issues) and POST /analyze (analyze cached issues with an LLM). Use TypeScript and Express."
- "Use SQLite for local caching. Document storage choice in README."
- "Handle edge cases: repo not scanned, no issues cached, LLM errors."
- "OpenAI quota exceeded – suggest other LLM options and add support for Groq/Gemini/Ollama."
- "Server still using OpenAI even though I set LLM_PROVIDER=groq – fix or explain."
- "What else needs to be tested? Ensure we have everything for the form deliverables."

### 2. Prompts used to design the code, fix errors, or generate logic

- "Implement POST /scan: fetch from GitHub REST API, paginate, exclude PRs, store id/title/body/html_url/created_at."
- "Implement POST /analyze: look up cached issues, combine with user prompt, call LLM, return { analysis }. Validate repo and prompt."
- "Return 404 when repo not scanned; return a clear message when no issues cached; surface LLM/API errors in the response."
- "Add startup log so we can see which LLM provider is active (e.g. groq vs openai)."
- "Add support for multiple LLM providers via env (openai, groq, ollama, gemini) so we can switch when one hits quota."

### 3. Prompts used for constructing the final LLM request inside the analyze endpoint

**System message (instructions to the LLM):**

- "You are an assistant analyzing GitHub issues for the repository \"{repo}\". You will be given a list of open issues (id, title, body excerpt, URL, created_at). Answer the user's question based only on these issues. Be concise and actionable."

**User message (what we send each time):**

- "Cached open issues for {repo}: [formatted issue list]. --- User request: {user's prompt}"

**Example user prompts (what callers can pass in the `/analyze` request body):**

- "Find themes across recent issues and recommend what the maintainers should fix first."
- "Summarize the top 3 recurring complaints."
- "List issues that look like bugs vs feature requests."
