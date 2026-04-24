/**
 * Project Manager — CRUD operations for projects.
 *
 * Uses SQLite for persistence.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { Project, ProjectCreateInput } from './types.js';

const DB_PATH = join(homedir(), '.kele', 'kele.db');

function initDb(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Check if old schema exists (has raw_text column) and migrate if needed
  const hasOldSchema = db.prepare(
    "SELECT 1 FROM pragma_table_info('projects') WHERE name = 'raw_text'"
  ).get();

  if (hasOldSchema) {
    db.exec('DROP TABLE projects');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      root_dir TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return db;
}

export class ProjectManager {
  private db: Database.Database;

  constructor() {
    this.db = initDb();
  }

  create(input: ProjectCreateInput): Project {
    const id = `proj-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const project: Project = {
      id,
      name: input.name,
      description: input.description,
      rootDir: input.rootDir,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, root_dir, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(project.id, project.name, project.description, project.rootDir, project.status, project.createdAt, project.updatedAt);
    return project;
  }

  get(id: string): Project | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.rowToProject(row);
  }

  list(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToProject(r));
  }

  updateStatus(id: string, status: Project['status']): void {
    this.db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  close(): void {
    this.db.close();
  }

  private rowToProject(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      rootDir: row.root_dir as string,
      status: row.status as Project['status'],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
