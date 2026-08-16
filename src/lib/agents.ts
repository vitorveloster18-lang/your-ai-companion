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
  /** Sent as agent_id in the request body (required by some backends). */
  agentId?: string;
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

/**
 * Accepts anything the user pastes and returns the final endpoint URL:
 * - https://xxx.supabase.co                      -> + /functions/v1/<fn|chat>
 * - https://xxx.supabase.co/functions/v1/chat    -> used as is
 * - xxx.supabase.co                              -> https:// added
 * - xxx (project ref)                            -> https://xxx.supabase.co/functions/v1/<fn|chat>
 */
export function resolveAgentUrl(agent: AgentConfig): string {
  let raw = (agent.url || "").trim().replace(/\/+$/, "");
  if (!raw) throw new Error("Informe a URL do agente.");
  if (agent.type === "local") {
    if (!/^https?:\/\//i.test(raw)) raw = `http://${raw}`;
    return raw;
  }
  if (!/^https?:\/\//i.test(raw)) {
    raw = raw.includes(".") ? `https://${raw}` : `https://${raw}.supabase.co`;
  }
  if (/\/functions\/v1\//.test(raw)) return raw;
  const fn = (agent.functionName || "chat").trim().replace(/^\/+|\/+$/g, "") || "chat";
  return `${raw}/functions/v1/${fn}`;
}

export async function sendToAgent(
  agent: AgentConfig,
  message: string,
  sessionId: string,
): Promise<AgentReply> {
  const agentId = (agent.agentId || "").trim();
  const payload: Record<string, unknown> = { message, session_id: sessionId };
  if (agentId) {
    payload.agent_id = agentId;
    payload.agentId = agentId;
  }

  const url = resolveAgentUrl(agent);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...parseHeaders(agent.headers),
  };

  if (agent.type === "supabase" && agent.key) {
    headers["Authorization"] = `Bearer ${agent.key.trim()}`;
    headers["apikey"] = agent.key.trim();
  }

  const method = agent.type === "local" ? agent.method || "POST" : "POST";
  let res: Response;
  try {
    res = await fetch(
      method === "GET"
        ? `${url}${url.includes("?") ? "&" : "?"}message=${encodeURIComponent(message)}&session_id=${encodeURIComponent(sessionId)}`
        : url,
      method === "GET"
        ? { method, headers }
        : { method, headers, body: JSON.stringify(payload) },
    );
  } catch {
    throw new Error(
      "Não consegui alcançar o endereço. Verifique a URL e libere o CORS na sua função (responda OPTIONS com Access-Control-Allow-Origin: *).",
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(explainStatus(res.status, body));
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) return { text: await res.text() };
  const data = await res.json();
  return {
    text: data.response ?? data.text ?? data.reply ?? data.message ?? "",
    emotion: data.emotion,
  };
}

function explainStatus(status: number, body: string) {
  const extra = body ? ` — ${body.slice(0, 160)}` : "";
  if (status === 401 || status === 403)
    return `Chave inválida ou função exigindo login (${status}). Cole a anon key correta ou desative "Verify JWT" na função.${extra}`;
  if (status === 404)
    return `Função não encontrada (404). Confira o nome da função ou cole a URL completa.${extra}`;
  if (status === 500 || status === 502)
    return `A sua função respondeu com erro ${status}. Veja os logs dela.${extra}`;
  return `O agente respondeu ${status}.${extra}`;
}

/** Quick connectivity check used by the Testar button. */
export async function testAgent(agent: AgentConfig, sessionId = "test") {
  const url = resolveAgentUrl(agent);
  const reply = await sendToAgent(agent, "ping", sessionId);
  return { url, reply };
}

export function agentLabel(a: AgentConfig) {
  return a.name || (a.type === "supabase" ? "Supabase" : "Local");
}

