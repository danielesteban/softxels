import Worker from './core/worker.js';
import WorldGenProgram from './workers/worldgen.wasm';
import WorldGenWorker from 'web-worker:./workers/worldgen.js';

export default ({
  generator = 'cave',
  seed = Math.floor(Math.random() * 2147483647),
} = {}) => (chunkSize) => (
  new Worker({
    options: { chunkSize, generator, seed },
    program: WorldGenProgram,
    script: WorldGenWorker,
  })
);
