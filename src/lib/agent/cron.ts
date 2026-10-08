export type CronSchedule = {
  kind: 'interval' | 'daily'
  value: string
}

export type CronJob = {
  id: string
  command?: string
  schedule?: CronSchedule
  agent?: string
  active?: boolean
  name?: string
  failureStreak?: number
  lastRunAt?: string
  lastError?: string
  prompt?: string
}

export type CronRun = {
  id: string
  job: string
  status: 'running' | 'completed' | 'failed'
  created: number
  updated: number
}

export async function listJobs(): Promise<CronJob[]> {
  return []
}

export async function getJob(id: string): Promise<CronJob | null> {
  return null
}

export function parseLimit(raw: unknown, fallback = 25): number {
  return fallback
}

export async function listRuns(jobId?: string, limit = 25): Promise<CronRun[]> {
  return []
}

export function parseCronRuns(out: string): CronRun[] {
  return []
}

export type CreateInput = any

export async function createJob(input: CreateInput): Promise<string> {
  return input.id
}

export type JobAction = 'pause' | 'resume' | 'run' | 'remove'

export async function actOnJob(id: string, action: JobAction): Promise<void> {}
