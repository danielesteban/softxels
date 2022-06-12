import { Color, MathUtils, Vector3, Vector4 } from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

export const parse = ({ buffer, rotateX, rotateY, rotateZ }) => new Promise((resolve) => {
  const geometry = (new PLYLoader()).parse(buffer);
  geometry.deleteAttribute('normal');
  geometry.computeBoundingBox();
  geometry.boundingBox.size = geometry.boundingBox.getSize(new Vector3());
  geometry.translate(
    -geometry.boundingBox.min.x - geometry.boundingBox.size.x * 0.5,
    -geometry.boundingBox.min.y - geometry.boundingBox.size.y * 0.5,
    -geometry.boundingBox.min.z - geometry.boundingBox.size.z * 0.5,
  );
  if (rotateX) {
    geometry.rotateX(MathUtils.degToRad(rotateX));
  }
  if (rotateY) {
    geometry.rotateY(MathUtils.degToRad(rotateY));
  }
  if (rotateZ) {
    geometry.rotateZ(MathUtils.degToRad(rotateZ));
  }
  geometry.boundingBox.getSize(geometry.boundingBox.size);
  geometry.translate(0, geometry.boundingBox.size.y * 0.5, 0);
  resolve(geometry);
});

export const voxelize = ({ geometry, gain, grid, resolution }) => {
  const samples = [];
  {
    for (let z = -grid; z <= grid; z++) {
      for (let y = -grid; y <= grid; y++) {
        for (let x = -grid; x <= grid; x++) {
          samples.push({ offset: new Vector3(x, y, z), value: (1 - (Math.sqrt(x ** 2 + y ** 2 + z ** 2) / grid) * 0.5) });
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
      if (col.r === 0 && (col.g === 0 || col.g === 1) && col.b === 0) {
        continue;
      }
      pos
        .fromBufferAttribute(position, i)
        .multiply(scale)
        .round();
      samples.forEach(({ offset, value }) => {
        vox.copy(pos).add(offset);
        const key = `${vox.x}:${vox.y}:${vox.z}`;
        let data = voxels.get(key);
        if (!data) {
          data = new Vector4(0, 0, 0, 0);
          data.count = 0;
          voxels.set(key, data);
        }
        data.x += value * gain;
        data.y += col.r * value;
        data.z += col.g * value;
        data.w += col.b * value;
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
  const pos = new Vector3();
  voxels.forEach((voxel, key) => {
    if (voxel.x < 1 || voxel.count < 2) {
      return;
    }
    pos.fromArray(new Int16Array(key.split(':')));
    chunk.copy(pos).divideScalar(chunkSize).floor();
    const chunkKey = `${chunk.x}:${chunk.y}:${chunk.z}`;
    let data = chunks.get(chunkKey);
    if (!data) {
      data = new Uint8Array(chunkSize * chunkSize * chunkSize * 4);
      chunks.set(chunkKey, data);
    }
    pos.addScaledVector(chunk, -chunkSize);
    const index = (pos.z * chunkSize * chunkSize + pos.y * chunkSize + pos.x) * 4;
    col.setRGB(voxel.y / voxel.x, voxel.z / voxel.x, voxel.w / voxel.x).convertLinearToSRGB();
    data.set(
      voxel
        .set(voxel.x / voxel.count, col.r, col.g, col.b)
        .clampScalar(0, 1)
        .multiplyScalar(0xFF)
        .floor()
        .toArray(),
      index
    );
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
