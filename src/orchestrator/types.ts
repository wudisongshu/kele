/**
 * Orchestrator types — for complex multi-page product generation.
 */

export interface PageRequirement {
  name: string;
  description: string;
  icon?: string;
}

export interface GenerationTask {
  taskId: string;
  name: string;
  prompt: string;
  outputFile: string;
  standalone: boolean;
}

export interface GeneratedPage {
  name: string;
  fileName: string;
  description: string;
  icon: string;
  title: string;
}

export interface OrchestrateResult {
  success: boolean;
  projectPath: string;
  projectId: string;
  productName: string;
  pages: GeneratedPage[];
  failedPages: string[];
  error?: string;
}
