import { VarKind, type Var, type VarTemplated } from './types.js';

const VAR_REF_REGEX = /\{\{\s*vars\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const VAR_REF_REGEX_SINGLE = /^\{\{\s*vars\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}$/;
const ANY_TEMPLATE_BLOCK = /\{\{[^}]*\}\}/g;

export function* extractVarRefs(value: string): IterableIterator<string> {
  for (const m of value.matchAll(VAR_REF_REGEX)) {
    yield m[1]!;
  }
}

export function assertVarRefSyntax(value: string, location: string): void {
  for (const m of value.matchAll(ANY_TEMPLATE_BLOCK)) {
    const block = m[0];
    if (!VAR_REF_REGEX_SINGLE.test(block)) {
      throw new Error(
        `${location}: template block "${block}" doesn't match {{ vars.<NAME> }} syntax. `
        + `Expected an identifier matching [a-zA-Z_][a-zA-Z0-9_]*.`,
      );
    }
  }
}

export class TenantVars {
  constructor(private readonly vars: Record<string, Var>) {}

  interpolate(value: VarTemplated): string {
    return value.replace(VAR_REF_REGEX, (_match, name: string) => this.resolve(name));
  }

  interpolateOptional(value: VarTemplated | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    return this.interpolate(value);
  }

  resolve(name: string): string {
    const v = this.vars[name];
    if (!v) {
      throw new Error(
        `unknown var: "${name}" (declared under tenant.vars?). `
        + `Available: ${Object.keys(this.vars).join(', ') || '(none)'}`,
      );
    }
    switch (v.type) {
      case VarKind.Plain:
        return v.value;
      case VarKind.SecretManager:
        throw new Error(
          `var "${name}": type=secretmanager is reserved but not yet implemented `
          + `(secretId="${v.secretId}").`,
        );
    }
  }
}
