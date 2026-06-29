export function pascal(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

export function validateSlug(field: string, value: string, regex: RegExp): void {
  if (!regex.test(value)) {
    throw new Error(`${field} '${value}' is invalid. Must match ${regex}.`);
  }
}
