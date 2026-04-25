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
  prompt?: string;
  type?: 'simple' | 'complex';
  pages?: string; // JSON string of GeneratedPage[]
}

export interface ProjectCreateInput {
  name: string;
  description: string;
  rootDir: string;
  prompt?: string;
  type?: 'simple' | 'complex';
  pages?: string;
}
