import type { ZodType } from 'zod';

import { AppError, ErrorCode } from '#/shared/errors';

export function zodInput<S extends ZodType>(
  schema: S,
): (raw: unknown) => S['_output'] {
  return (raw) => {
    const result = schema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      throw new AppError(ErrorCode.ValidationFailed, {
        message: `validation failed: ${issues.map((i) => `${i.path || '<root>'}: ${i.message}`).join('; ')}`,
        meta: { issues },
      });
    }
    return result.data;
  };
}
