import type { AIAdapter } from '../adapters/base.js';
import type { Idea, SubProject } from '../types/index.js';

/**
 * AI-Driven Incubator — lets the AI decide what sub-projects are needed.
 *
 * Philosophy: The AI knows better than hard-coded rules what a project needs.
 * We give the AI the user's raw idea and let it design the project structure.
 * If AI fails, we fall back to the local rule-based incubator.
 */

const INCUBATOR_PROMPT = `You are kele's AI Incubator. Given a user's idea, decide what sub-projects are needed to bring it to life.

Analyze the idea carefully:
- What type of product is it? (game, tool, content, music, etc.)
- Does the user want to publish/deploy it?
- Does the user want to make money from it?
- What is the minimal viable scope?

Return ONLY a JSON object in this exact format:
{
  "subProjects": [
    {
      "id": "unique-id",
      "name": "Display Name",
      "description": "What this sub-project does",
      "type": "setup|development|production|creation|testing|deployment|monetization",
      "dependencies": ["id-of-prerequisite"]
    }
  ],
  "reasoning": "brief explanation of why you chose this structure"
}

Rules:
1. ALWAYS include a "project-setup" sub-project first (type: setup, dependencies: [])
2. Include the core work sub-project(s) next
3. Only add "testing" if quality/bugs matter for this idea
4. Only add "deployment" if the user mentioned publishing, hosting, or releasing
5. Only add "monetization" if the user mentioned making money, ads, or revenue
6. Keep it lean — don't add unnecessary steps
7. Use kebab-case for ids, English for names`;

export interface AIIncubateResult {
  success: boolean;
  subProjects?: SubProject[];
  error?: string;
  reasoning?: string;
}

export async function incubateWithAI(
  idea: Idea,
  rootDir: string,
  adapter: AIAdapter
): Promise<AIIncubateResult> {
  try {
    const prompt = `${INCUBATOR_PROMPT}\n\nUser idea: "${idea.rawText}"\nDetected type: ${idea.type}\nDetected complexity: ${idea.complexity}\nMonetization channel: ${idea.monetization}`;

    const response = await adapter.execute(prompt);

    // Extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;

    const parsed = JSON.parse(jsonStr) as {
      subProjects: Array<{
        id: string;
        name: string;
        description: string;
        type: string;
        dependencies: string[];
      }>;
      reasoning?: string;
    };

    if (!parsed.subProjects || !Array.isArray(parsed.subProjects)) {
      return { success: false, error: 'AI returned invalid sub-project structure' };
    }

    const now = new Date().toISOString();
    const subProjects: SubProject[] = parsed.subProjects.map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      type: tpl.type,
      targetDir: `${rootDir}/${tpl.id}`,
      dependencies: tpl.dependencies || [],
      status: 'pending',
      createdAt: now,
    }));

    return { success: true, subProjects, reasoning: parsed.reasoning };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'AI incubation failed',
    };
  }
}
