import { createInterface } from 'readline';
import { randomBytes } from 'crypto';
import { getAutoYes } from '../config/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
export const { version } = packageJson;

const NO_COLOR = process.env.NO_COLOR || process.env.FORCE_COLOR === '0';

function color(code: string, text: string): string {
  return NO_COLOR ? text : `\x1b[${code}m${text}\x1b[0m`;
}

export const c = {
  red: (t: string) => color('31', t),
  green: (t: string) => color('32', t),
  yellow: (t: string) => color('33', t),
  blue: (t: string) => color('34', t),
  cyan: (t: string) => color('36', t),
  bold: (t: string) => color('1', t),
};

/**
 * Ask the user for confirmation at a checkpoint.
 * Respects the auto-yes configuration.
 */
export async function confirmCheckpoint(question: string): Promise<boolean> {
  if (getAutoYes()) {
    return true;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  rl.on('SIGINT', () => {
    rl.close();
    console.log('\n   ⏹️  已取消');
    process.exit(0);
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(`⏸️  ${question} [Y/n/e(edit)] `, resolve);
  });
  rl.close();

  const normalized = answer.trim().toLowerCase();
  if (normalized === 'e' || normalized === 'edit') {
    console.log('   💡 请重新描述你的想法，然后再次运行 kele');
    return false;
  }
  if (normalized === 'n' || normalized === 'no') {
    console.log('   ⏹️  已取消');
    return false;
  }
  return true;
}

/**
 * Generate a URL-friendly project slug from the idea text.
 */
export function generateProjectSlug(ideaText: string, type: string): string {
  const englishWords = ideaText.toLowerCase().match(/[a-z]{2,}/g) || [];

  if (englishWords.length > 0) {
    const slug = englishWords.slice(0, 3).join('-');
    return slug;
  }

  const suffix = randomBytes(3).toString('hex');
  return `${type}-${suffix}`;
}

/**
 * Format a duration in milliseconds to human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}

/**
 * Print help when no AI provider is configured.
 */
/**
 * Collect repeatable --header options into a Record.
 */
export function collectHeaders(value: string, previous: Record<string, string>): Record<string, string> {
  const [k, v] = value.split(':');
  if (k && v !== undefined) {
    previous[k.trim()] = v.trim();
  }
  return previous;
}

/**
 * Parse timeout from CLI option.
 * kele principle: no timeouts by default. Wait indefinitely for AI.
 * This option is kept for backward compatibility but has no effect.
 */
export function parseTimeout(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) {
    console.warn(`⚠️  Invalid timeout "${value}"`);
    return 3000;
  }
  return parsed;
}

/**
 * Print usage help.
 */
export function printUsage(): void {
  console.log('🥤 kele — 你的创意变现助手\n');
  console.log('用法示例：');
  console.log('  kele "我要做一个塔防游戏并部署到微信小程序赚钱"');
  console.log('  kele "帮我写一首歌并发布到音乐平台" --output ~/my-music');
  console.log('  kele "做一个像牛牛消消乐那样的游戏" --yes');
  console.log('\n管理项目：');
  console.log('  kele list                    列出所有项目');
  console.log('  kele show <project-id>       查看项目详情');
  console.log('  kele upgrade <pid> <tid> "..."  升级某个任务');
  console.log('  kele "继续" 或 kele "接着干"    恢复中断的项目');
  console.log('\n配置 AI：');
  console.log('  kele config --provider kimi --key sk-xxx --url https://api.moonshot.cn/v1 --model moonshot-v1-128k');
  console.log('  kele config --provider kimi-code --key sk-xxx --url https://api.kimi.com/coding/v1 --model kimi-for-coding');
  console.log('  kele config --provider deepseek --key sk-xxx --url https://api.deepseek.com/v1 --model deepseek-chat');
  console.log('\n配置平台凭证：');
  console.log('  kele secrets --platform wechat-miniprogram --set appId=wx123456');
  console.log('\n选项：');
  console.log('  -o, --output <dir>   指定项目生成目录');
  console.log('  -y, --yes            自动执行所有任务（跳过确认）');
  console.log('  -t, --timeout <s>    AI 请求超时时间（默认 3000 秒 = 50 分钟）');
  console.log('  --debug              显示 kele 发给 AI 的所有 prompt');
  console.log('  -v, --version        显示版本号');
}

export function printNoProviderHelp(): void {
  console.log('⚠️  未配置 AI API Key');
  console.log('kele 需要调用 AI 来完成任务。请配置至少一个 provider：\n');
  console.log('  kele config --provider kimi --key <your-key> --url https://api.moonshot.cn/v1 --model moonshot-v1-128k');
  console.log('  kele config --provider kimi-code --key <your-key> --url https://api.kimi.com/coding/v1 --model kimi-for-coding');
  console.log('  kele config --provider deepseek --key <your-key> --url https://api.deepseek.com/v1 --model deepseek-chat');
  console.log('  kele config --provider qwen --key <your-key> --url https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-turbo');
  console.log('\n💡 快捷方式（通过环境变量）：');
  console.log('  KIMI_API_KEY=xxx kele "你的 idea"');
  console.log('\n🧪 或者使用 --mock 模式快速测试（无需 API Key）：');
  console.log('  kele "你的 idea" --mock --yes');
  console.log('\n🔍 诊断环境：kele doctor');
}
