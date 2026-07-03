import { validate as validateUuid, v4 as uuidV4, v7 as uuidV7 } from 'uuid';

export function isUuid(value: string): boolean {
  return validateUuid(value);
}

export function newUuid(): string {
  return uuidV4();
}

export function newUuidV7(): string {
  return uuidV7();
}
