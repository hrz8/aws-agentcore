import { MemorySkillsRepository } from '../src/adapters/memory/index.js';
import { runSkillsContract } from '../src/testing/contract.js';

runSkillsContract('memory', () => new MemorySkillsRepository());
