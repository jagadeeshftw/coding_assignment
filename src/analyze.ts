import OpenAI from "openai";
import type { CachedIssue } from "./types";

const MAX_ISSUES_CONTEXT = 50;
const MAX_BODY_LENGTH = 500;

type LLMProvider = "openai" | "groq" | "ollama" | "gemini";

function formatIssuesForContext(issues: CachedIssue[]): string {
  return issues
    .slice(0, MAX_ISSUES_CONTEXT)
    .map((i) => {
      const body = (i.body || "").slice(0, MAX_BODY_LENGTH);
      const bodySuffix = (i.body?.length ?? 0) > MAX_BODY_LENGTH ? "..." : "";
      return `## #${i.id} - ${i.title}\nCreated: ${i.created_at}\nURL: ${i.html_url}\n\n${body}${bodySuffix}`;
    })
    .join("\n\n---\n\n");
}

function getProvider(): LLMProvider {
  const p = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  if (p === "groq" || p === "ollama" || p === "gemini") return p;
  return "openai";
}

async function callOpenAICompatible(
  baseURL: string,
  apiKey: string,
  model: string,
  systemContent: string,
  userContent: string
): Promise<string> {
  const openai = new OpenAI({ apiKey, baseURL });
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    max_tokens: 2000,
  });
  const choice = response.choices[0];
  if (!choice?.message?.content) throw new Error("LLM returned no content");
  return choice.message.content;
}

async function callGemini(
  apiKey: string,
  systemContent: string,
  userContent: string
): Promise<string> {
  const combined = `${systemContent}\n\n${userContent}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: combined }] }],
      generationConfig: { maxOutputTokens: 2000 },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini returned no content");
  return text;
}

export async function analyzeWithLLM(
  repo: string,
  prompt: string,
  issues: CachedIssue[]
): Promise<string> {
  const provider = getProvider();
  const issuesContext = formatIssuesForContext(issues);
  const systemContent = `You are an assistant analyzing GitHub issues for the repository "${repo}".
You will be given a list of open issues (id, title, body excerpt, URL, created_at).
Answer the user's question based only on these issues. Be concise and actionable.`;
  const userContent = `Cached open issues for ${repo}:\n\n${issuesContext}\n\n---\n\nUser request: ${prompt}`;

  switch (provider) {
    case "groq": {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("GROQ_API_KEY is not set. Get a free key at https://console.groq.com");
      return callOpenAICompatible(
        "https://api.groq.com/openai/v1",
        apiKey,
        "llama-3.3-70b-versatile",
        systemContent,
        userContent
      );
    }
    case "ollama": {
      const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
      const model = process.env.OLLAMA_MODEL || "llama3.2";
      return callOpenAICompatible(
        baseURL,
        "ollama",
        model,
        systemContent,
        userContent
      );
    }
    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey");
      return callGemini(apiKey, systemContent, userContent);
    }
    default: {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is not set. Required for /analyze when LLM_PROVIDER=openai.");
      return callOpenAICompatible(
        "https://api.openai.com/v1",
        apiKey,
        "gpt-4o-mini",
        systemContent,
        userContent
      );
    }
  }
}
