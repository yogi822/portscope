/**
 * Minimal structured logger. Uses only `console`, so it runs identically on
 * Node and on Cloudflare Workers (pino is Node-specific and is intentionally
 * avoided in the Worker).
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, data?: Record<string, unknown>): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => emit('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => emit('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit('error', msg, data),
};
