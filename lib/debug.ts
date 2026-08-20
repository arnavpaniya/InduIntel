const isDebug = process.env.DEBUG === 'true';

export function debugLog(...args: unknown[]) {
  if (isDebug) console.log(...args);
}

export function debugError(...args: unknown[]) {
  if (isDebug) console.error(...args);
}

export function debugWarn(...args: unknown[]) {
  if (isDebug) console.warn(...args);
}

export function debugJson(label: string, obj: unknown) {
  if (isDebug) console.log(label, JSON.stringify(obj, null, 2));
}