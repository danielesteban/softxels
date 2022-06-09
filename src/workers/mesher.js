import instantiate from '../core/program.js';

let program;

const onLoad = ({ data: { options: { chunkSize }, program: module } }) => {
  instantiate({
    memory: [
      { id: 'chunks', type: Uint8Array, size: chunkSize * chunkSize * chunkSize * 4 * 8 },
      { id: 'vertices', type: Float32Array, size: chunkSize * chunkSize * chunkSize * 3 * 9 * 5 },
      { id: 'bounds', type: Float32Array, size: 6 },
    ],
    program: module,
  })
    .then(({ memory, run }) => {
      program = {
        chunkSize,
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
  // chunks.length = 0;
  const triangles = program.run(
    program.memory.chunks.address,
    program.memory.vertices.address,
    program.memory.bounds.address,
    program.chunkSize
  );
  if (triangles === 0) {
    self.postMessage(false);
    return;    
  }
  const bounds = program.memory.bounds.view.slice(0);
  const vertices = program.memory.vertices.view.slice(0, triangles * 3 * 9);
  self.postMessage({ bounds, vertices }, [bounds.buffer, vertices.buffer]);
};
