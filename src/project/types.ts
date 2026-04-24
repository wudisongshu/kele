/**
 * Project type definitions.
 */

export interface Project {
  id: string;
  name: string;
  description: string;
  rootDir: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCreateInput {
  name: string;
  description: string;
  rootDir: string;
}
