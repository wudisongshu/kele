import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Project, SubProject, Task, CreativeType, MonetizationChannel, Complexity, ProjectStatus, TaskStatus, AIProvider } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * kele Database — SQLite-backed state persistence.
 *
 * Stores projects, sub-projects, tasks, and execution history.
 * Database file location: ~/.kele/kele.db
 */

export function getDbPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return join(home, '.kele', 'kele.db');
}

function loadSchema(): string {
  // Try dist/db/schema.sql first (production)
  const distPath = join(__dirname, 'schema.sql');
  if (existsSync(distPath)) {
    return readFileSync(distPath, 'utf-8');
  }

  // Fallback to src/db/schema.sql (development)
  const srcPath = join(__dirname, '../../src/db/schema.sql');
  if (existsSync(srcPath)) {
    return readFileSync(srcPath, 'utf-8');
  }

  throw new Error('schema.sql not found in dist/db or src/db');
}

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const schema = loadSchema();
  db.exec(schema);

  return db;
}

export class KeleDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || getDbPath();
    // Ensure directory exists
    mkdirSync(dirname(path), { recursive: true });
    this.db = initDatabase(path);
  }

  // --- Projects ---

  saveProject(project: Project): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, raw_text, creative_type, monetization, complexity, status, root_dir, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      project.id,
      project.name,
      project.idea.rawText,
      project.idea.type,
      project.idea.monetization,
      project.idea.complexity,
      project.status,
      project.rootDir,
      project.createdAt,
      project.updatedAt
    );
  }

  getProject(id: string): Project | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;

    return this.rowToProject(row);
  }

  listProjects(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToProject(r));
  }

  deleteProject(projectId: string): void {
    // Delete in dependency order (SQLite has CASCADE but let's be explicit)
    this.db.prepare('DELETE FROM tasks WHERE project_id = ?').run(projectId);
    this.db.prepare('DELETE FROM sub_projects WHERE project_id = ?').run(projectId);
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  }

  // --- Sub Projects ---

  saveSubProject(sp: SubProject, projectId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sub_projects (id, project_id, name, description, type, target_dir, dependencies, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      sp.id,
      projectId,
      sp.name,
      sp.description,
      sp.type,
      sp.targetDir,
      JSON.stringify(sp.dependencies),
      sp.status,
      sp.createdAt
    );
  }

  getSubProjects(projectId: string): SubProject[] {
    const rows = this.db.prepare('SELECT * FROM sub_projects WHERE project_id = ? ORDER BY created_at').all(projectId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToSubProject(r));
  }

  // --- Tasks ---

  saveTask(task: Task, projectId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tasks (id, sub_project_id, project_id, title, description, complexity, status, ai_provider, result, error, parent_task_id, version, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      task.id,
      task.subProjectId,
      projectId,
      task.title,
      task.description,
      task.complexity,
      task.status,
      task.aiProvider || null,
      task.result || null,
      task.error || null,
      task.parentTaskId || null,
      task.version,
      task.createdAt,
      task.completedAt || null
    );
  }

  getTasks(projectId: string): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at').all(projectId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToTask(r));
  }

  updateTaskStatus(taskId: string, status: string, result?: string, error?: string): void {
    const stmt = this.db.prepare(`
      UPDATE tasks SET status = ?, result = ?, error = ?, completed_at = ? WHERE id = ?
    `);
    stmt.run(status, result || null, error || null, status === 'completed' || status === 'failed' ? new Date().toISOString() : null, taskId);
  }

  /**
   * Find all tasks with 'running' status across all projects.
   * Used for resume functionality.
   */
  getRunningTasks(): Array<{ task: Task; projectId: string; projectName: string }> {
    const rows = this.db.prepare(`
      SELECT t.*, p.id as project_id, p.name as project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.status = 'running'
      ORDER BY t.created_at DESC
    `).all() as Record<string, unknown>[];

    return rows.map((r) => ({
      task: this.rowToTask(r),
      projectId: r.project_id as string,
      projectName: r.project_name as string,
    }));
  }

  getProjectsByStatus(status: ProjectStatus): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects WHERE status = ? ORDER BY created_at DESC').all(status) as Record<string, unknown>[];
    return rows.map((r) => this.rowToProject(r));
  }

  getProjectsByType(type: CreativeType): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects WHERE creative_type = ? ORDER BY created_at DESC').all(type) as Record<string, unknown>[];
    return rows.map((r) => this.rowToProject(r));
  }

  getFailedTasks(projectId: string): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks WHERE project_id = ? AND status = ? ORDER BY created_at DESC').all(projectId, 'failed') as Record<string, unknown>[];
    return rows.map((r) => this.rowToTask(r));
  }

  // --- Helpers ---

  private rowToProject(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      name: row.name as string,
      idea: {
        id: row.id as string,
        rawText: row.raw_text as string,
        type: row.creative_type as CreativeType,
        monetization: row.monetization as MonetizationChannel,
        complexity: row.complexity as Complexity,
        keywords: [],
        createdAt: row.created_at as string,
      },
      subProjects: [],
      tasks: [],
      status: row.status as ProjectStatus,
      rootDir: row.root_dir as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private rowToSubProject(row: Record<string, unknown>): SubProject {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      type: row.type as string,
      targetDir: row.target_dir as string,
      dependencies: JSON.parse(row.dependencies as string) as string[],
      status: row.status as ProjectStatus,
      createdAt: row.created_at as string,
    };
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      subProjectId: row.sub_project_id as string,
      title: row.title as string,
      description: row.description as string,
      complexity: row.complexity as Complexity,
      status: row.status as TaskStatus,
      aiProvider: (row.ai_provider as AIProvider) || undefined,
      result: (row.result as string) || undefined,
      error: (row.error as string) || undefined,
      parentTaskId: (row.parent_task_id as string) || undefined,
      version: (row.version as number) || 1,
      createdAt: row.created_at as string,
      completedAt: (row.completed_at as string) || undefined,
    };
  }

  close(): void {
    this.db.close();
  }
}
