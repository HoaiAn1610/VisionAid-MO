/* eslint-disable no-console */
import { IS_PRODUCTION } from '@/config/env';

// KHÔNG log dữ liệu nhạy cảm (token, tọa độ, ảnh, transcript).
type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, message: string, meta?: unknown): void {
  if (IS_PRODUCTION && (level === 'debug' || level === 'info')) return;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta === undefined) fn(`[${level}] ${message}`);
  else fn(`[${level}] ${message}`, meta);
}

export const logger = {
  debug: (message: string, meta?: unknown) => log('debug', message, meta),
  info: (message: string, meta?: unknown) => log('info', message, meta),
  warn: (message: string, meta?: unknown) => log('warn', message, meta),
  error: (message: string, meta?: unknown) => log('error', message, meta),
};
