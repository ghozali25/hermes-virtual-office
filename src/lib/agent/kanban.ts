import { db } from './db'
import type { Agent, AgentRole, NewTaskInput, Task, TaskOrigin, TaskStatus } from '@/types/agent'
import { randomUUID } from 'crypto'

export function originMarker(o: TaskOrigin): string {
  if (o.kind === 'manual') return 'manual'
  return `${o.kind}:${o.ref || ''}`
}

export function parseOrigin(createdBy?: string | null): TaskOrigin | undefined {
  if (!createdBy) return undefined
  if (createdBy === 'manual') return { kind: 'manual' }
  const [kind, ...rest] = createdBy.split(':')
  const ref = rest.join(':')
  if (kind === 'meeting' || kind === 'cron' || kind === 'agent') {
    return { kind, ref: ref || undefined, raw: createdBy }
  }
  return { kind: 'manual', raw: createdBy }
}

export async function listTasks(opts: { includeArchived?: boolean } = {}): Promise<Task[]> {
  const rows = db.prepare(`SELECT * FROM tasks ${opts.includeArchived ? '' : "WHERE status != 'archived'"}`).all() as any[]
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    status: r.status as TaskStatus,
    assignee: r.assignee,
    priority: r.priority,
    body: r.body,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    origin: parseOrigin(r.origin_raw),
    model: r.model,
    provider: r.provider,
    parents: db.prepare('SELECT parentId FROM task_parents WHERE taskId = ?').all(r.id).map((p: any) => p.parentId)
  }))
}

export async function getTask(id: string): Promise<Task | null> {
  const r = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any
  if (!r) return null
  return {
    id: r.id,
    title: r.title,
    status: r.status as TaskStatus,
    assignee: r.assignee,
    priority: r.priority,
    body: r.body,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    origin: parseOrigin(r.origin_raw),
    model: r.model,
    provider: r.provider,
    parents: db.prepare('SELECT parentId FROM task_parents WHERE taskId = ?').all(id).map((p: any) => p.parentId)
  }
}

export async function createTask(input: NewTaskInput): Promise<Task> {
  const id = `task-${randomUUID().substring(0, 8)}`
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO tasks (id, title, status, assignee, priority, body, createdAt, updatedAt, origin_raw)
    VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?)
  `).run(id, input.title, input.assignee || null, input.priority || 0, input.body || '', now, now, input.origin ? originMarker(input.origin) : null)
  return getTask(id) as Promise<Task>
}

export async function tasksForAssignee(name: string): Promise<Task[]> {
  const all = await listTasks()
  return all.filter(t => t.assignee === name)
}

export async function purgeTasks(ids: string[]): Promise<{ archived: number; purged: number }> {
  let purged = 0
  db.transaction(() => {
    for (const id of ids) {
      db.prepare("DELETE FROM tasks WHERE id = ? AND status = 'archived'").run(id)
      purged++
    }
  })()
  return { archived: 0, purged }
}

export async function commentOnTask(taskId: string, body: string): Promise<boolean> {
  db.prepare('INSERT INTO task_comments (taskId, body, createdAt) VALUES (?, ?, ?)').run(taskId, body, new Date().toISOString())
  return true
}

export async function releaseWorker(taskId: string): Promise<boolean> {
  db.prepare("UPDATE tasks SET status = 'todo' WHERE id = ?").run(taskId)
  db.prepare("UPDATE agents SET status = 'idle', currentTaskId = NULL WHERE currentTaskId = ?").run(taskId)
  return true
}

export async function dispatchTask(): Promise<{ spawned: string[] }> {
  return { spawned: [] }
}

export async function promoteTask(taskId: string, reason: string): Promise<boolean> {
  db.prepare("UPDATE tasks SET status = 'ready' WHERE id = ?").run(taskId)
  return true
}

export async function unblockTask(taskId: string, reason: string): Promise<boolean> {
  db.prepare("UPDATE tasks SET status = 'todo' WHERE id = ?").run(taskId)
  return true
}

export async function setTaskModel(taskId: string, model: string | null, provider: string | null): Promise<boolean> {
  db.prepare("UPDATE tasks SET model = ?, provider = ? WHERE id = ?").run(model, provider, taskId)
  return true
}

export type ModelChoice = { model: string; provider: string; label: string }
export type RawProvider = any

export function providersToModels(raw: RawProvider[]): ModelChoice[] {
  return [
    { model: 'mk/gpt-5.6-luna', provider: '9router', label: 'GPT 5.6 Luna (9router)' },
    { model: 'mk/glm-5', provider: '9router', label: 'GLM 5 (9router)' },
    { model: 'mk/auto', provider: '9router', label: 'Auto (9router)' }
  ]
}

export async function listModels(provider?: string): Promise<ModelChoice[]> {
  return providersToModels([])
}

export async function profileModel(name: string): Promise<{ model: string | null; provider: string | null }> {
  const r = db.prepare('SELECT model FROM agents WHERE name = ?').get(name) as any
  if (!r || !r.model) return { model: null, provider: null }
  return { model: r.model, provider: '9router' }
}

export async function setProfileModel(name: string, model: string | null, provider: string | null): Promise<boolean> {
  db.prepare("UPDATE agents SET model = ? WHERE name = ?").run(model, name)
  return true
}

export function roleFor(name: string): AgentRole {
  const r = db.prepare('SELECT role FROM agents WHERE name = ?').get(name) as any
  return r ? (r.role as AgentRole) : 'frontend'
}

export async function listAssignees(): Promise<{ name: string; onDisk: boolean; total: number }[]> {
  const rows = db.prepare('SELECT name FROM agents').all() as any[]
  return rows.map(r => ({ name: r.name, onDisk: true, total: 1 }))
}

export async function listProfiles(): Promise<string[]> {
  const rows = db.prepare('SELECT name FROM agents').all() as any[]
  return rows.map(r => r.name)
}

export async function createProfile(name: string, model?: string, provider?: string): Promise<{ name: string; description: string }> {
  db.prepare('INSERT INTO agents (name, displayName, role, deskIndex, status, model) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, name, 'frontend', null, 'idle', model || null)
  return { name, description: '' }
}

export async function deleteProfile(name: string): Promise<void> {
  db.prepare('DELETE FROM agents WHERE name = ?').run(name)
}

export async function listAgents(tasks: Task[], prefetchedAssignees?: any[]): Promise<Agent[]> {
  const rows = db.prepare('SELECT * FROM agents').all() as any[]
  return rows.map(r => ({
    name: r.name,
    displayName: r.displayName,
    role: r.role as AgentRole,
    deskIndex: r.deskIndex,
    status: r.status as any,
    currentTaskId: r.currentTaskId,
    model: r.model
  }))
}

export type RunInfo = {
  id: string
  task: string
  status: 'running' | 'completed' | 'failed'
  created: number
  updated: number
}

export async function listRuns(taskId: string): Promise<RunInfo[]> {
  const rows = db.prepare('SELECT * FROM task_runs WHERE taskId = ?').all(taskId) as any[]
  return rows.map(r => ({
    id: r.id,
    task: r.taskId,
    status: r.status,
    created: new Date(r.startedAt).getTime(),
    updated: new Date(r.endedAt || r.startedAt).getTime()
  }))
}

export async function taskLog(taskId: string, bytes = 16_000): Promise<string> {
  const r = db.prepare('SELECT log FROM task_runs WHERE taskId = ? ORDER BY startedAt DESC LIMIT 1').get(taskId) as any
  return r ? r.log : ''
}
