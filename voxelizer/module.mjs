import { Color, Vector3, Vector4 } from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

export const parse = (buffer) => new Promise((resolve) => {
  const geometry = (new PLYLoader()).parse(buffer);
  geometry.deleteAttribute('normal');
  geometry.computeBoundingBox();
  geometry.boundingBox.size = geometry.boundingBox.getSize(new Vector3());
  geometry.translate(
    -geometry.boundingBox.min.x - geometry.boundingBox.size.x * 0.5,
    -geometry.boundingBox.min.y - geometry.boundingBox.size.y * 0.5,
    -geometry.boundingBox.min.z - geometry.boundingBox.size.z * 0.5,
  );
  geometry.rotateX(Math.PI * -0.5);
  resolve(geometry);
});

export const voxelize = ({ geometry, resolution }) => {
  const grid = [];
  {
    const s = 2;
    const c = s * 0.5;
    const r = Math.sqrt((c ** 2) * 3);
    for (let z = 0; z < s; z++) {
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          grid.push({ offset: new Vector3(x, y, z), value: Math.floor(0xFF - (Math.sqrt((x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2) / r) * 0x9F) });
        }
      }
    }
  }
  const color = geometry.getAttribute('color');
  const position = geometry.getAttribute('position');
  const scale = new Vector3(-resolution, resolution, -resolution);
  const voxels = new Map();
  const col = new Color();
  const pos = new Vector3();
  const vox = new Vector3();
  return new Promise((resolve) => {
    for (let i = 0, l = position.count; i < l; i++) {
      col
        .fromBufferAttribute(color, i);
      pos
        .fromBufferAttribute(position, i)
        .multiply(scale)
        .round();
      grid.forEach(({ offset, value }) => {
        vox.copy(pos).add(offset);
        const key = `${vox.x}:${vox.y}:${vox.z}`;
        let data = voxels.get(key);
        if (!data) {
          data = new Vector4(0, 0, 0, 0);
          data.count = 0;
          voxels.set(key, data);
        }
        data.x += value;
        data.y += col.r * (value / 0xFF);
        data.z += col.g * (value / 0xFF);
        data.w += col.b * (value / 0xFF);
        data.count++;
      });
    }
    resolve(voxels);
  });
};

export const chunk = ({ chunkSize, voxels }) => new Promise((resolve) => {
  const chunks = new Map();
  const chunk = new Vector3();
  const col = new Color();
  const vox = new Vector3();
  voxels.forEach((acc, key) => {
    vox.fromArray(new Int16Array(key.split(':')));
    chunk.copy(vox).divideScalar(chunkSize).floor();
    const chunkKey = `${chunk.x}:${chunk.y}:${chunk.z}`;
    let data = chunks.get(chunkKey);
    if (!data) {
      data = new Uint8Array(chunkSize * chunkSize * chunkSize * 4);
      chunks.set(chunkKey, data);
    }
    vox.addScaledVector(chunk, -chunkSize);
    const index = (vox.z * chunkSize * chunkSize + vox.y * chunkSize + vox.x) * 4;
    acc.divideScalar(acc.count);
    col.setRGB(acc.y, acc.z, acc.w).convertLinearToSRGB();
    acc.y = col.r * 0xFF;
    acc.z = col.g * 0xFF;
    acc.w = col.b * 0xFF;
    data.set(acc.round().toArray(), index);
  });
  voxels.clear();
  resolve(chunks);
});

export const pack = ({ chunks, deflate }) => new Promise((resolve, reject) => {
  let outputBuffer;
  const count = chunks.size;
  if (count) {
    const chunk = new Vector3();
    const stride = 6 + chunks.values().next().value.length;
    outputBuffer = new Uint8Array(stride * count);
    let offset = 0;
    chunks.forEach((data, key) => {
      chunk.fromArray(new Int16Array(key.split(':')));
      outputBuffer.set(new Uint8Array((new Int16Array([chunk.x, chunk.y, chunk.z])).buffer), offset);
      outputBuffer.set(data, offset + 6);
      offset += stride;
    });
    chunks.clear();
  } else {
    outputBuffer = new Uint8Array();
  }
  if (!deflate) {
    resolve(outputBuffer);
    return;
  }
  deflate(outputBuffer, (err, deflated) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(deflated);
  });
});
