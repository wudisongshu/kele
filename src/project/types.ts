/**
 * Project type definitions.
 */

export interface Deployment {
  platform: string;
  url: string;
  deployedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  rootDir: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  deployments: Deployment[];
}

export interface ProjectCreateInput {
  name: string;
  description: string;
  rootDir: string;
}
