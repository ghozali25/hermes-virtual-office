import { db } from './db'
import type { Meeting, ArchivedMeeting, MeetingMode } from '@/types/agent'
import { randomUUID } from 'crypto'

export async function listArchived(): Promise<ArchivedMeeting[]> {
  const rows = db.prepare("SELECT * FROM meetings WHERE state = 'done'").all() as any[]
  return rows.map(r => ({
    id: r.id,
    topic: r.topic,
    file: r.file,
    startedAt: new Date().toISOString(),
    participants: db.prepare('SELECT agentName FROM meeting_participants WHERE meetingId = ?').all(r.id).map((p: any) => p.agentName),
    moderator: r.moderator,
    mode: r.mode as MeetingMode,
    turnCount: 0,
    preview: r.topic,
    archived: true
  }))
}

export async function readArchived(id: string): Promise<string | null> {
  const r = db.prepare('SELECT minutes FROM meetings WHERE id = ?').get(id) as any
  return r ? r.minutes : null
}

export function isConfigured(): boolean {
  return true
}

export async function startMeeting(input: {
  topic: string
  participants: string[]
  moderator: string
  mode: MeetingMode
}): Promise<Meeting> {
  const id = `meet-${randomUUID().substring(0, 8)}`
  db.prepare(`
    INSERT INTO meetings (id, topic, moderator, mode, state, phase, currentSpeaker, minutes)
    VALUES (?, ?, ?, ?, 'running', 'opening', ?, '')
  `).run(id, input.topic, input.moderator, input.mode, input.moderator)

  for (const p of input.participants) {
    db.prepare('INSERT INTO meeting_participants (meetingId, agentName) VALUES (?, ?)').run(id, p)
  }

  return getMeeting(id)!
}

export function getMeeting(id: string): Meeting | null {
  const r = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as any
  if (!r) return null
  return {
    id: r.id,
    topic: r.topic,
    participants: db.prepare('SELECT agentName FROM meeting_participants WHERE meetingId = ?').all(id).map((p: any) => p.agentName),
    moderator: r.moderator,
    mode: r.mode as MeetingMode,
    state: r.state,
    phase: r.phase,
    currentSpeaker: r.currentSpeaker,
    turns: db.prepare('SELECT * FROM meeting_turns WHERE meetingId = ?').all(id) as any[],
    minutes: r.minutes
  }
}

export function listMeetings(): Meeting[] {
  const rows = db.prepare("SELECT id FROM meetings WHERE state = 'running'").all() as any[]
  return rows.map(r => getMeeting(r.id)!)
}

export function activeMeeting(): Meeting | null {
  const meets = listMeetings()
  return meets.length > 0 ? meets[0] : null
}
