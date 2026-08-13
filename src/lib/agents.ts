// Multiple agent endpoints (Supabase instances or local Python servers),
// stored only in the browser. This app is just the interface/voice layer —
// conversation history lives in the connected project.

export type AgentType = "supabase" | "local";

export type AgentConfig = {
  id: string;
  name: string;
  type: AgentType;
  /** Supabase: project URL. Local: full endpoint URL. */
  url: string;
  /** Supabase anon key (unused for local). */
  key?: string;
  /** Supabase edge function name. */
  functionName?: string;
  /** HTTP method for local agents. */
  method?: "POST" | "GET";
  /** Extra headers as "Name: value" lines. */
  headers?: string;
};

const AGENTS_KEY = "agent.agents.v1";
const ACTIVE_KEY = "agent.activeAgent.v1";

export function newAgentId() {
  return Math.random().toString(36).slice(2, 10);
}

export function loadAgents(): AgentConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AGENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveAgents(list: AgentConfig[]) {
  try { localStorage.setItem(AGENTS_KEY, JSON.stringify(list)); } catch { /* noop */ }
}

export function loadActiveAgentId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveAgentId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* noop */ }
}

function parseHeaders(raw?: string): Record<string, string> {
  const out: Record<string, string> = {};
  (raw || "").split("\n").forEach((line) => {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return out;
}

export type AgentReply = { text: string; emotion?: string };

export async function sendToAgent(
  agent: AgentConfig,
  message: string,
  sessionId: string,
): Promise<AgentReply> {
  const payload = { message, session_id: sessionId };
  let url: string;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...parseHeaders(agent.headers),
  };

  if (agent.type === "supabase") {
    url = `${agent.url.replace(/\/$/, "")}/functions/v1/${agent.functionName || "chat"}`;
    if (agent.key) {
      headers["Authorization"] = `Bearer ${agent.key}`;
      headers["apikey"] = agent.key;
    }
  } else {
    url = agent.url;
  }

  const method = agent.type === "local" ? agent.method || "POST" : "POST";
  const res = await fetch(
    method === "GET"
      ? `${url}${url.includes("?") ? "&" : "?"}message=${encodeURIComponent(message)}&session_id=${encodeURIComponent(sessionId)}`
      : url,
    method === "GET"
      ? { method, headers }
      : { method, headers, body: JSON.stringify(payload) },
  );

  if (!res.ok) throw new Error(`Agente respondeu ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) return { text: await res.text() };
  const data = await res.json();
  return {
    text: data.response ?? data.text ?? data.reply ?? data.message ?? "",
    emotion: data.emotion,
  };
}

export function agentLabel(a: AgentConfig) {
  return a.name || (a.type === "supabase" ? "Supabase" : "Local");
}
