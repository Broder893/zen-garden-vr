// Stand-in for @iwsdk/core in unit tests: only what component declarations call.
export const Types = new Proxy({}, { get: (_target, key) => String(key) }) as Record<string, string>;
export function createComponent(name: string, schema: unknown): { name: string; schema: unknown } {
  return { name, schema };
}
