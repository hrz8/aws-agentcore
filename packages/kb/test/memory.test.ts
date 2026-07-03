import { MemoryKbRepository } from '../src/adapters/memory/index.js';
import { runKbContract } from '../src/testing/contract.js';

runKbContract('memory', () => new MemoryKbRepository(), {
  bucket: 'memory-bucket',
  makeUnconfiguredWebRepo: () => new MemoryKbRepository({ webDataSourceConfigured: false }),
});
