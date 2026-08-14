// Local-only memory: conversation history + remembered facts, per agent.
// No backend required — everything lives in localStorage.

export type MemoryMessage = { role: "user" | "agent"; text: string; ts: number };

const HIST_KEY = (agentId: string) => `agent.memory.history.${agentId}`;
const FACTS_KEY = "agent.memory.facts.v1";
const LIMIT_KEY = "agent.memory.limit.v1";

export function getMemoryLimit(): number {
  if (typeof window === "undefined") return 20;
  const raw = localStorage.getItem(LIMIT_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 20;
}

export function setMemoryLimit(n: number) {
  try { localStorage.setItem(LIMIT_KEY, String(n)); } catch { /* noop */ }
}

export function loadHistory(agentId: string): MemoryMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HIST_KEY(agentId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function appendHistory(agentId: string, msg: MemoryMessage) {
  const limit = getMemoryLimit();
  const list = [...loadHistory(agentId), msg].slice(-limit);
  try { localStorage.setItem(HIST_KEY(agentId), JSON.stringify(list)); } catch { /* noop */ }
}

export function clearHistory(agentId: string) {
  try { localStorage.removeItem(HIST_KEY(agentId)); } catch { /* noop */ }
}

export function loadFacts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FACTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveFacts(facts: string[]) {
  try { localStorage.setItem(FACTS_KEY, JSON.stringify(facts)); } catch { /* noop */ }
}

/** Builds a compact context string sent along with the user message. */
export function buildContext(agentId: string): string {
  const facts = loadFacts();
  const history = loadHistory(agentId);
  const parts: string[] = [];
  if (facts.length) parts.push(`Fatos lembrados:\n- ${facts.join("\n- ")}`);
  if (history.length) {
    parts.push(
      "Conversa recente:\n" +
        history.map((m) => `${m.role === "user" ? "Usuário" : "Agente"}: ${m.text}`).join("\n"),
    );
  }
  return parts.join("\n\n");
}

export function exportMemory(agentId: string) {
  return JSON.stringify({ facts: loadFacts(), history: loadHistory(agentId) }, null, 2);
}

export function importMemory(agentId: string, json: string) {
  const data = JSON.parse(json);
  if (Array.isArray(data.facts)) saveFacts(data.facts);
  if (Array.isArray(data.history)) {
    try { localStorage.setItem(HIST_KEY(agentId), JSON.stringify(data.history)); } catch { /* noop */ }
  }
}
