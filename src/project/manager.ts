/**
 * Project Manager — CRUD operations for projects.
 *
 * Uses SQLite for persistence.
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { homedir } from 'os';
import type { Project, ProjectCreateInput, Deployment } from './types.js';

const DB_PATH = join(homedir(), '.kele', 'kele.db');

function initDb(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Migrate: add missing columns to existing table
  const columns = db.prepare(
    "SELECT name FROM pragma_table_info('projects')"
  ).all() as { name: string }[];
  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has('deployments')) {
    db.exec(`ALTER TABLE projects ADD COLUMN deployments TEXT DEFAULT '[]'`);
  }
  if (!columnNames.has('prompt')) {
    db.exec(`ALTER TABLE projects ADD COLUMN prompt TEXT`);
  }
  if (!columnNames.has('type')) {
    db.exec(`ALTER TABLE projects ADD COLUMN type TEXT DEFAULT 'simple'`);
  }
  if (!columnNames.has('pages')) {
    db.exec(`ALTER TABLE projects ADD COLUMN pages TEXT`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      root_dir TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      deployments TEXT DEFAULT '[]',
      prompt TEXT,
      type TEXT DEFAULT 'simple',
      pages TEXT,
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
    const rand = Math.random().toString(36).slice(2, 6);
    const id = `proj-${Date.now().toString(36)}-${rand}`;
    const now = new Date().toISOString();
    const project: Project = {
      id,
      name: input.name,
      description: input.description,
      rootDir: input.rootDir,
      status: 'pending',
      deployments: [],
      prompt: input.prompt,
      type: input.type ?? 'simple',
      pages: input.pages,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, root_dir, status, deployments, prompt, type, pages, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      project.id, project.name, project.description, project.rootDir,
      project.status, '[]', project.prompt ?? null, project.type ?? 'simple',
      project.pages ?? null, project.createdAt, project.updatedAt,
    );
    return project;
  }

  get(id: string): Project | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const project = this.rowToProject(row);
    return this.normalizeName(project);
  }

  /**
   * Find a project by identifier — try id, name, then rootDir basename (slug).
   */
  findByIdentifier(identifier: string): Project | undefined {
    // 1. Try exact id match
    const byId = this.get(identifier);
    if (byId) return byId;

    // 2. Fall back to name match
    const rows = this.db.prepare('SELECT * FROM projects WHERE name = ?').all(identifier) as Record<string, unknown>[];
    if (rows.length > 0) return this.rowToProject(rows[0]);

    // 3. Fall back to rootDir basename (slug) match, e.g. "game-3adac4"
    const allRows = this.db.prepare('SELECT * FROM projects').all() as Record<string, unknown>[];
    for (const row of allRows) {
      const rootDir = row.root_dir as string;
      if (basename(rootDir) === identifier) {
        return this.rowToProject(row);
      }
    }

    return undefined;
  }

  list(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map((r) => this.normalizeName(this.rowToProject(r)));
  }

  updateStatus(id: string, status: Project['status']): void {
    this.db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), id);
  }

  updateName(id: string, name: string): void {
    this.db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, new Date().toISOString(), id);
  }

  addDeployment(id: string, deployment: Deployment): void {
    const project = this.get(id);
    if (!project) return;
    const deployments = [...project.deployments, deployment];
    this.db.prepare('UPDATE projects SET deployments = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(deployments), new Date().toISOString(), id);
  }

  removeDeployment(id: string, platform: string): void {
    const project = this.get(id);
    if (!project) return;
    const deployments = project.deployments.filter((d) => d.platform !== platform);
    this.db.prepare('UPDATE projects SET deployments = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(deployments), new Date().toISOString(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  close(): void {
    this.db.close();
  }

  /**
   * For legacy projects where name was stored as the slug (e.g. game-b9fd19),
   * try to extract the real game title from index.html and update the DB.
   */
  private normalizeName(project: Project): Project {
    const slug = basename(project.rootDir);
    // If name matches the directory slug, try to extract real title from index.html
    if (project.name === slug) {
      const indexPath = join(project.rootDir, 'index.html');
      if (existsSync(indexPath)) {
        try {
          const html = readFileSync(indexPath, 'utf-8');
          const match = html.match(/<title>([^<]*)<\/title>/i);
          const extracted = match ? match[1].trim() : '';
          if (extracted && extracted !== slug && extracted !== project.id) {
            // eslint-disable-next-line no-console
            console.log(`[DEBUG] Extracted title for ${project.id}: ${extracted}`);
            this.updateName(project.id, extracted);
            project.name = extracted;
          }
        } catch {
          // ignore read errors
        }
      }
    }
    return project;
  }

  private rowToProject(row: Record<string, unknown>): Project {
    let deployments: Deployment[] = [];
    try {
      const raw = row.deployments as string;
      if (raw && raw !== '[]') {
        deployments = JSON.parse(raw) as Deployment[];
      }
    } catch {
      deployments = [];
    }

    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      rootDir: row.root_dir as string,
      status: row.status as Project['status'],
      deployments,
      prompt: (row.prompt as string | undefined) ?? undefined,
      type: (row.type as 'simple' | 'complex' | undefined) ?? undefined,
      pages: (row.pages as string | undefined) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
