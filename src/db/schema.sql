-- kele SQLite Schema
-- Stores project state, sub-projects, tasks, and execution logs.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  creative_type TEXT NOT NULL,
  monetization TEXT NOT NULL,
  complexity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initialized',
  root_dir TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sub_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  target_dir TEXT NOT NULL,
  dependencies TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  sub_project_id TEXT NOT NULL REFERENCES sub_projects(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  complexity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ai_provider TEXT,
  result TEXT,
  error TEXT,
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sub_project ON tasks(sub_project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_provider ON tasks(ai_provider);
CREATE INDEX IF NOT EXISTS idx_sub_projects_project ON sub_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(creative_type);
CREATE INDEX IF NOT EXISTS idx_projects_monetization ON projects(monetization);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at);
