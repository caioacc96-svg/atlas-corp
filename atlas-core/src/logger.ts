export type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, event: string, payload: Record<string, unknown> = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };
  const json = JSON.stringify(line);
  if (level === 'error') {
    console.error(json);
  } else if (level === 'warn') {
    console.warn(json);
  } else {
    console.log(json);
  }
}
