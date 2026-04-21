import { randomUUID } from 'crypto';
import type { AIAdapter } from '../adapters/base.js';
import { debugLog } from '../debug.js';

/**
 * ResearchEngine — analyzes vague or competitor-based ideas before incubation.
 *
 * When a user says "like NiuNiu Match-3", kele must first understand:
 * 1. What is NiuNiu Match-3? (product analysis)
 * 2. Why does it make money? (monetization analysis)
 * 3. What makes games popular? (market insights)
 * 4. How should we build something similar? (recommendations)
 */

export interface ResearchReport {
  id: string;
  subject: string;
  summary: string;
  productAnalysis: string;
  monetizationAnalysis: string;
  marketInsights: string;
  recommendations: string;
  suggestedPlatforms: string[];
  suggestedKeywords: string[];
  createdAt: string;
}

export interface ResearchResult {
  success: boolean;
  report?: ResearchReport;
  error?: string;
}

/**
 * Detect if an idea needs research.
 * Returns true if the idea references competitors, is vague, or lacks clear direction.
 */
export function needsResearch(rawText: string, _keywords: string[]): boolean {
  const lower = rawText.toLowerCase();

  // References to existing products/apps/games
  const competitorPatterns = [
    /像(.+?)那样/,
    /像(.+?)一样/,
    /类似(.+?)/,
    /参考(.+?)/,
    /模仿(.+?)/,
    /对标(.+?)/,
    /(.+?)那种/,
    /(.+?)这样的/,
  ];

  for (const pattern of competitorPatterns) {
    if (pattern.test(lower)) return true;
  }

  // Vague expressions
  const vaguePatterns = [
    '随便', '什么都行', '看着办', '你决定', '随便做',
    'fast', 'quick', '随便一个', '简单的', '随便什么',
    '大概', '差不多', '类似', '类似这样', '类似这种',
  ];

  for (const word of vaguePatterns) {
    if (lower.includes(word)) return true;
  }

  // Too few keywords might mean unclear direction, but only if no clear type/monetization
  // Having a clear creative type and monetization channel means the direction is clear enough
  return false;
}

/**
 * Build a research prompt for the AI.
 */
function buildResearchPrompt(subject: string, rawText: string): string {
  return `You are a senior product analyst and mobile game monetization expert.

The user wants to build something inspired by or similar to: "${subject}"
Their full request: "${rawText}"

Please provide a structured research report with the following sections:

## 1. Product Analysis
What is "${subject}"? Describe its core gameplay/mechanics, target audience, and key features.

## 2. Monetization Analysis
Why does "${subject}" make money? Analyze its revenue model (ads, IAP, subscriptions, etc.), ARPU, and retention mechanics.

## 3. Market Insights
What makes this type of product successful? List 3-5 critical success factors and current market trends.

## 4. Recommendations
How should we build something similar but differentiated? Suggest:
- Core gameplay loop
- Unique selling point (USP)
- Recommended platform (WeChat Mini Program, Douyin, Steam, etc.)
- Estimated complexity (simple/medium/complex)
- Key features to implement in MVP

## 5. Suggested Keywords
Extract 5-10 relevant keywords for this project.

## 6. Genre-Specific Insights
If this is a game, analyze:
- Core loop: what keeps players coming back?
- Session length: how long should a single play session be?
- Difficulty curve: how should difficulty progress?
- Social features: what multiplayer/leaderboard/sharing mechanics work best?
- Retention hooks: daily rewards, streaks, achievements, etc.
- PWA potential: should this game support offline play and "Add to Home Screen"?

## 7. Technical Recommendations
- Best tech stack for the target platform
- Should the game be a PWA (Progressive Web App) for better retention?
- Estimated development time and team size

Respond in Chinese. Be concise but insightful.`;
}

/**
 * Parse AI research response into structured report.
 */
function parseResearchResponse(subject: string, rawResponse: string): ResearchReport | null {
  // If response looks like JSON (e.g., from mock fallback), skip parsing
  const trimmed = rawResponse.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return null;
  }

  // Simple parsing: extract sections by headers
  const sections = rawResponse.split(/## \d+\.\s+/);

  const productAnalysis = extractSection(rawResponse, '产品分析|Product Analysis') || '';
  const monetizationAnalysis = extractSection(rawResponse, '变现分析|Monetization Analysis') || '';
  const recommendations = extractSection(rawResponse, '建议|Recommendations') || '';

  // If all key fields are empty, the AI didn't return a proper report
  if (!productAnalysis && !monetizationAnalysis && !recommendations) {
    return null;
  }

  return {
    id: randomUUID(),
    subject,
    summary: extractSection(rawResponse, '总结|Summary') || sections[1] || '',
    productAnalysis,
    monetizationAnalysis,
    marketInsights: extractSection(rawResponse, '市场洞察|Market Insights') || '',
    recommendations,
    suggestedPlatforms: extractList(rawResponse, '平台|Platform'),
    suggestedKeywords: extractList(rawResponse, '关键词|Keywords'),
    createdAt: new Date().toISOString(),
  };
}

function extractSection(text: string, pattern: string): string | undefined {
  const regex = new RegExp(`##\\s*\\d*\\s*[\.\\s]*(${pattern})[\\s\\n]*([^#]+)`, 'i');
  const match = text.match(regex);
  return match ? match[2].trim() : undefined;
}

function extractList(text: string, pattern: string): string[] {
  const regex = new RegExp(`##\\s*\\d*\\s*[\\.\\s]*(${pattern})[\\s\\n]*([^#]+)`, 'i');
  const match = text.match(regex);
  if (!match) return [];

  const content = match[2];
  // Extract bullet points or numbered items
  const items = content
    .split(/\n/)
    .map((line) => line.replace(/^\s*[-\d\.\*]+\s*/, '').trim())
    .filter((line) => line.length > 0 && line.length < 50);

  return items.slice(0, 10);
}

/**
 * Extract the competitor/reference subject from user text.
 */
export function extractSubject(rawText: string): string | undefined {
  const patterns = [
    /像(.+?)那样/,
    /像(.+?)一样/,
    /类似(.+?)(?:的|那种|这样)/,
    /参考(.+?)(?:的|那种|这样)/,
    /模仿(.+?)(?:的|那种|这样)/,
    /对标(.+?)(?:的|那种|这样)/,
    /(?:做|弄|搞|建|写|开发|制作)(.+?)那种/,
    /(.+?)那种/,
    /(.+?)这样的/,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Run research on a vague/competitor-based idea.
 */
export async function research(
  rawText: string,
  adapter: AIAdapter
): Promise<ResearchResult> {
  try {
    const subject = extractSubject(rawText) || rawText.slice(0, 50);
    const prompt = buildResearchPrompt(subject, rawText);
    debugLog('Research Engine Prompt', prompt);

    const response = await adapter.execute(prompt);
    const report = parseResearchResponse(subject, response);

    if (!report) {
      return { success: false, error: 'AI returned empty or invalid research report' };
    }

    return { success: true, report };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Research failed',
    };
  }
}
