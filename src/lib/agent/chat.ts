import { db } from './db'
import { randomUUID } from 'crypto'

export type ChatSession = {
  id: string
  agent: string
  startedAt: string
  lastMessageAt: string
  messageCount: number
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export async function listChatSessions(): Promise<ChatSession[]> {
  const rows = db.prepare('SELECT * FROM sessions').all() as any[]
  return rows.map(r => ({
    id: r.id,
    agent: r.agentName,
    startedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    messageCount: 0
  }))
}

export async function getChatSession(agent: string): Promise<ChatSession | null> {
  const r = db.prepare('SELECT * FROM sessions WHERE agentName = ? LIMIT 1').get(agent) as any
  if (!r) return null
  return {
    id: r.id,
    agent: r.agentName,
    startedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    messageCount: 0
  }
}

export type SendResult = {
  text: string
  sessionId: string
}

export async function sendChatMessage(
  agent: string,
  message: string,
  opts?: { signal?: AbortSignal; onChunk?: (chunk: string) => void; sessionId?: string }
): Promise<SendResult> {
  let session = db.prepare('SELECT id FROM sessions WHERE agentName = ? LIMIT 1').get(agent) as any
  let sessionId = session?.id
  if (!sessionId) {
    sessionId = `sess-${randomUUID().substring(0, 8)}`
    db.prepare('INSERT INTO sessions (id, agentName, context) VALUES (?, ?, ?)').run(sessionId, agent, '[]')
  }

  // ponytail: hook up actual 9router API here
  const response = `I am ${agent}. This is a 9Router mock response.`
  if (opts?.onChunk) opts.onChunk(response)

  return { text: response, sessionId }
}

export async function readChatHistory(
  agent: string,
  opts?: { sessionId?: string; limit?: number }
): Promise<ChatMessage[]> {
  // ponytail: implement reading from memories table
  return []
}

export async function resetChatSession(agent: string): Promise<void> {
  db.prepare('DELETE FROM sessions WHERE agentName = ?').run(agent)
}
