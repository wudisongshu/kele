import { createInterface } from 'readline';
import { randomBytes } from 'crypto';
import { getAutoYes } from '../config/index.js';

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
 * Print help when no AI provider is configured.
 */
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
