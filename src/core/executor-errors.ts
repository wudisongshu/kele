/**
 * Structured error types for task execution.
 *
 * Each error carries machine-readable metadata so that executor.ts can
 * produce actionable, human-friendly diagnostics.
 */

export class APIError extends Error {
  readonly statusCode?: number;
  readonly responsePreview?: string;
  readonly provider?: string;

  constructor(message: string, meta?: { statusCode?: number; responsePreview?: string; provider?: string; cause?: Error }) {
    super(message);
    this.name = 'APIError';
    this.statusCode = meta?.statusCode;
    this.responsePreview = meta?.responsePreview;
    this.provider = meta?.provider;
    if (meta?.cause) {
      (this as unknown as Record<string, unknown>).cause = meta.cause;
    }
  }
}

export class ParseError extends Error {
  readonly rawResponse?: string;
  readonly parser?: string;

  constructor(message: string, meta?: { rawResponse?: string; parser?: string; cause?: Error }) {
    super(message);
    this.name = 'ParseError';
    this.rawResponse = meta?.rawResponse;
    this.parser = meta?.parser;
    if (meta?.cause) {
      (this as unknown as Record<string, unknown>).cause = meta.cause;
    }
  }
}

export class FileError extends Error {
  readonly filePath?: string;
  readonly code?: string;

  constructor(message: string, meta?: { filePath?: string; code?: string; cause?: Error }) {
    super(message);
    this.name = 'FileError';
    this.filePath = meta?.filePath;
    this.code = meta?.code;
    if (meta?.cause) {
      (this as unknown as Record<string, unknown>).cause = meta.cause;
    }
  }
}

export class ValidationError extends Error {
  readonly validator?: string;
  readonly reasons?: string[];

  constructor(message: string, meta?: { validator?: string; reasons?: string[]; cause?: Error }) {
    super(message);
    this.name = 'ValidationError';
    this.validator = meta?.validator;
    this.reasons = meta?.reasons;
    if (meta?.cause) {
      (this as unknown as Record<string, unknown>).cause = meta.cause;
    }
  }
}

export class TimeoutError extends Error {
  readonly timeoutMs?: number;
  readonly elapsedMs?: number;

  constructor(message: string, meta?: { timeoutMs?: number; elapsedMs?: number; cause?: Error }) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = meta?.timeoutMs;
    this.elapsedMs = meta?.elapsedMs;
    if (meta?.cause) {
      (this as unknown as Record<string, unknown>).cause = meta.cause;
    }
  }
}

/**
 * Extract an HTTP status code from an error message string.
 */
export function extractStatusCode(message: string): number | undefined {
  const m = message.match(/\b(\d{3})\b/);
  const code = m ? parseInt(m[1], 10) : undefined;
  if (code && code >= 400 && code <= 599) return code;
  return undefined;
}

/**
 * Build a user-friendly suggestion based on error type.
 */
export function buildSuggestion(err: Error): string {
  if (err instanceof APIError) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return 'API key 无效或已过期。请运行 `kele config` 重新配置。';
    }
    if (err.statusCode === 429) {
      return '请求过于频繁。请等待几分钟后重试，或切换到备用 provider。';
    }
    if (err.statusCode && err.statusCode >= 500) {
      return 'AI 服务端暂时不可用。建议：(1) 等待几分钟后重试，(2) 切换到备用 provider，(3) 检查网络连接。';
    }
    return 'AI API 调用失败。建议检查网络连接和 API provider 状态。';
  }
  if (err instanceof ParseError) {
    return 'AI 返回格式异常。建议重试此任务，或简化需求后再次尝试。';
  }
  if (err instanceof FileError) {
    return `文件操作失败：${err.filePath ?? '未知文件'}。请检查磁盘空间和权限。`;
  }
  if (err instanceof ValidationError) {
    return `代码验证失败：${err.reasons?.join('；') ?? err.message}。建议运行 \_kele retry\_ 重试。`;
  }
  if (err instanceof TimeoutError) {
    return `任务超时（已耗时 ${err.elapsedMs ? (err.elapsedMs / 1000).toFixed(1) : '?'} 秒）。建议增加超时时间或简化任务。`;
  }
  return '未知错误。建议运行 `kele retry` 重试，或使用 `--mock` 快速测试。';
}
