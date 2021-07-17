export default ({
  memory: layout,
  program,
}) => {
  const pages = Math.ceil(layout.reduce((total, { type, size }) => (
    total + size * type.BYTES_PER_ELEMENT
  ), 0) / 65536) + 2;
  const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
  return WebAssembly
    .instantiate(program, { env: { memory } })
    .then((instance) => ({
      memory: layout.reduce((layout, { id, type, size }) => {
        const address = instance.exports.malloc(size * type.BYTES_PER_ELEMENT);
        layout[id] = {
          address,
          view: new type(memory.buffer, address, size),
        };
        return layout;
      }, {}),
      run: instance.exports.run,
    }));
}
