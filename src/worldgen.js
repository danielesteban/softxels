import instantiate from './program.js';

let program;

const onLoad = ({ data: { options: { chunkSize, seed }, program: module } }) => {
  instantiate({
    memory: [
      { id: 'chunk', type: Uint8Array, size: chunkSize * chunkSize * chunkSize * 4 },
    ],
    program: module,
  })
    .then(({ memory, run }) => {
      program = {
        chunkSize,
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
    program.seed,
    x,
    y,
    z
  );
  const chunk = program.memory.chunk.view.slice(0);
  self.postMessage(chunk, [chunk.buffer]);
};
