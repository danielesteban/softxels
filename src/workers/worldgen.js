import instantiate from '../core/program.js';

let program;

const generators = {
  cave: 0,
  terrain: 1,
};

const onLoad = ({ data: { options: { chunkSize, generator, seed }, program: module } }) => {
  instantiate({
    memory: [
      { id: 'chunk', type: Uint8Array, size: chunkSize * chunkSize * chunkSize * 4 },
    ],
    program: module,
  })
    .then(({ memory, run }) => {
      program = {
        chunkSize,
        generator: generators[generator] || 0,
        memory,
        run,
        seed,
      };
      self.removeEventListener('message', onLoad);
      self.addEventListener('message', onData);
      self.postMessage(true);
    });
};
self.addEventListener('message', onLoad);

const onData = ({ data: { x, y, z } }) => {
  program.run(
    program.memory.chunk.address,
    program.chunkSize,
    program.generator,
    program.seed,
    x,
    y,
    z
  );
  const chunk = program.memory.chunk.view.slice(0);
  self.postMessage(chunk, [chunk.buffer]);
};
