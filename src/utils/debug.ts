// Forensic-only developer logging. Flip DEBUG to true locally to see
// cache/fetch/timezone diagnostics. With false, wrapper bodies are empty
// in production, but call-site arguments are still evaluated.
// This is the only file exempt from the console rule (see eslint.config.mjs).
const DEBUG = false;

export function debugLog(...args: unknown[]): void {
  if (DEBUG) console.debug(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (DEBUG) console.warn(...args);
}

export function debugError(...args: unknown[]): void {
  if (DEBUG) console.error(...args);
}
