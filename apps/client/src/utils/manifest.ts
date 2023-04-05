export function getStructure(a: unknown): string {
  if (a === null || a === undefined) {
    return 'null';
  }

  if (Array.isArray(a)) {
    return `[ ${a.map(getStructure).join(' | ')} ]`;
  }

  if (typeof a === 'object') {
    return `{ ${Object.entries(a)
      .map(([k, v]) => `${k}: ${getStructure(v)}`)
      .join(', ')} }`;
  }

  return typeof a;
}
