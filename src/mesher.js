import instantiate from './program.js';

let program;

const onLoad = ({ data: { options: { chunkSize, isolevel }, program: module } }) => {
  instantiate({
    memory: [
      { id: 'bounds', type: Uint8Array, size: 6 },
      { id: 'chunks', type: Uint8Array, size: chunkSize * chunkSize * chunkSize * 4 * 8 },
      { id: 'vertices', type: Uint8Array, size: chunkSize * chunkSize * chunkSize * 3 * 6 * 5 },
    ],
    program: module,
  })
    .then(({ memory, run }) => {
      program = {
        chunkSize,
        isolevel,
        memory,
        run,
      };
      self.removeEventListener('message', onLoad);
      self.addEventListener('message', onData);
      self.postMessage(true);
    });
};
self.addEventListener('message', onLoad);

const onData = ({ data: { chunks } }) => {
  let offset = 0;
  chunks.forEach((chunk) => {
    program.memory.chunks.view.set(chunk, offset);
    offset += chunk.length;
  });
  const triangles = program.run(
    program.memory.bounds.address,
    program.memory.chunks.address,
    program.memory.vertices.address,
    program.chunkSize,
    program.isolevel
  );
  if (triangles === 0) {
    self.postMessage(false);
    return;    
  }
  const bounds = program.memory.bounds.view.slice(0);
  const vertices = program.memory.vertices.view.slice(0, triangles * 3 * 6);
  self.postMessage({ bounds, vertices }, [bounds.buffer, vertices.buffer]);
};
