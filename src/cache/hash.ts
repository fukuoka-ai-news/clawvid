import { createHash } from 'node:crypto';

/**
 * Produce a stable JSON string for an arbitrary value by sorting object keys
 * recursively. This guarantees that two structurally-equal objects produce
 * identical JSON regardless of insertion order.
 *
 * NOTE: A previous implementation used `JSON.stringify(step, Object.keys(step).sort())`,
 * but the 2nd argument of JSON.stringify is a KEY FILTER that applies at every depth,
 * so nested properties (like `input.prompt`) were silently stripped — making every
 * scene hash collide. This recursive variant fixes that.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

export function hashWorkflowStep(step: Record<string, unknown>): string {
  const json = stableStringify(step);
  return createHash('sha256').update(json).digest('hex').slice(0, 32);
}

export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}
