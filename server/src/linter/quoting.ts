import keywords from './keywords.json';

const reserved = new Set(keywords.reserved);
const unquoted = /^[a-z_][a-z0-9_]*$/i;
const dashed = /^[a-z_][a-z0-9_]*(?:-(?:[a-z_][a-z0-9_]*|[0-9]+))*$/i;

export function canUnquoteIdentifier(name: string, first = true, allowDash = false): boolean {
  return (unquoted.test(name) || (allowDash && dashed.test(name))) && (!first || !reserved.has(name.toLowerCase()));
}

export function quoteIdentifierPath(parts: string[], allowDash = false): string {
  const path = parts.join('.');
  return parts.every((part, index) => canUnquoteIdentifier(part, index === 0, allowDash && index === 0))
    ? path
    : `\`${path.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``;
}
