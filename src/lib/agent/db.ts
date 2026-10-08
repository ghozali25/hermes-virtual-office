import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'agent.db')
export const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    name TEXT PRIMARY KEY,
    displayName TEXT,
    role TEXT,
    deskIndex INTEGER,
    status TEXT,
    currentTaskId TEXT,
    model TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    status TEXT,
    assignee TEXT,
    priority INTEGER,
    body TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    origin_kind TEXT,
    origin_ref TEXT,
    origin_raw TEXT,
    model TEXT,
    provider TEXT
  );

  CREATE TABLE IF NOT EXISTS task_parents (
    taskId TEXT,
    parentId TEXT,
    PRIMARY KEY (taskId, parentId)
  );

  CREATE TABLE IF NOT EXISTS task_runs (
    id TEXT PRIMARY KEY,
    taskId TEXT,
    status TEXT,
    log TEXT,
    startedAt TEXT,
    endedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    agentName TEXT,
    context TEXT
  );

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    agentName TEXT,
    kind TEXT,
    content TEXT
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    topic TEXT,
    moderator TEXT,
    mode TEXT,
    state TEXT,
    phase TEXT,
    currentSpeaker TEXT,
    minutes TEXT,
    file TEXT
  );

  CREATE TABLE IF NOT EXISTS meeting_participants (
    meetingId TEXT,
    agentName TEXT,
    PRIMARY KEY (meetingId, agentName)
  );

  CREATE TABLE IF NOT EXISTS meeting_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meetingId TEXT,
    round INTEGER,
    speaker TEXT,
    kind TEXT,
    text TEXT,
    ts INTEGER
  );
`)

// Init default agents if empty
const count = db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number }
if (count.c === 0) {
  const insertAgent = db.prepare('INSERT INTO agents (name, displayName, role, deskIndex, status) VALUES (?, ?, ?, ?, ?)')
  const defaultAgents = [
    ['jun', 'Jun (Jr. Coder)', 'frontend', 0, 'idle'],
    ['sri', 'Sri (QA)', 'qa', 1, 'idle'],
    ['ken', 'Ken (Orchestrator)', 'orchestrator', 2, 'idle'],
    ['budi', 'Budi (Backend)', 'backend', 3, 'idle']
  ]
  db.transaction(() => {
    for (const a of defaultAgents) insertAgent.run(...a)
  })()
}
