type Level = 'cache' | 'ws' | 'thresholds' | 'net';

export function log(level: Level, message: string, error?: unknown) {
  if (error !== undefined) {
    console.log(`[${level.toUpperCase()}] ${message}`, error);
    return;
  }
  console.log(`[${level.toUpperCase()}] ${message}`);
}
