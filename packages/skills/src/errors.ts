export class SkillValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillValidationError';
  }
}

export class SkillNotFoundError extends Error {
  constructor(name: string) {
    super(`skill not found: ${name}`);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillPathError';
  }
}
