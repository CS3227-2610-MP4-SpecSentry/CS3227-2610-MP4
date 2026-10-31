// JSON.parse alone accepts duplicate keys. This bounded parser rejects them,
// including keys made equivalent by Unicode escapes, before schema validation.
export function parseStrictJson(source: string, maxBytes = 65_536, maxDepth = 32): unknown {
  if (Buffer.byteLength(source, 'utf8') > maxBytes) throw new Error('JSON size');
  let cursor = 0;
  const space = () => { while (cursor < source.length && /[\x20\t\r\n]/.test(source[cursor]!)) cursor++; };
  const string = (): string => {
    const start = cursor++;
    while (cursor < source.length) {
      const ch = source[cursor++];
      if (ch === '"') return JSON.parse(source.slice(start, cursor)) as string;
      if (ch === '\\') {
        const escape = source[cursor++];
        if (escape === 'u') {
          if (!/^[a-fA-F0-9]{4}$/.test(source.slice(cursor, cursor + 4))) throw new Error('JSON escape');
          cursor += 4;
        } else if (!'"\\/bfnrt'.includes(escape ?? '')) throw new Error('JSON escape');
      } else if ((ch ?? '').charCodeAt(0) < 32) throw new Error('JSON control');
    }
    throw new Error('JSON string');
  };
  const value = (depth: number): unknown => {
    if (depth > maxDepth) throw new Error('JSON depth');
    space();
    const ch = source[cursor];
    if (ch === '"') return string();
    if (ch === '{') {
      cursor++; space();
      const object: Record<string, unknown> = Object.create(null);
      const keys = new Set<string>();
      if (source[cursor] === '}') { cursor++; return object; }
      while (true) {
        space(); if (source[cursor] !== '"') throw new Error('JSON key');
        const key = string();
        if (keys.has(key)) throw new Error('JSON duplicate key');
        keys.add(key); space();
        if (source[cursor++] !== ':') throw new Error('JSON colon');
        object[key] = value(depth + 1); space();
        const separator = source[cursor++];
        if (separator === '}') return object;
        if (separator !== ',') throw new Error('JSON object');
      }
    }
    if (ch === '[') {
      cursor++; space();
      const array: unknown[] = [];
      if (source[cursor] === ']') { cursor++; return array; }
      while (true) {
        array.push(value(depth + 1)); space();
        const separator = source[cursor++];
        if (separator === ']') return array;
        if (separator !== ',') throw new Error('JSON array');
      }
    }
    const match = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(source.slice(cursor));
    if (!match) throw new Error('JSON value');
    cursor += match[0].length;
    const parsed: unknown = JSON.parse(match[0]);
    if (typeof parsed === 'number' && !Number.isFinite(parsed)) throw new Error('JSON number');
    return parsed;
  };
  const parsed = value(0); space();
  if (cursor !== source.length) throw new Error('JSON trailing');
  return parsed;
}
