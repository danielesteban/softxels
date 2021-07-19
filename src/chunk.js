import {
  Box3,
  BufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Sphere,
  Vector3,
} from 'three';

class Chunk extends Mesh {
  static setupMaterial() {
    Chunk.material = new MeshBasicMaterial({ vertexColors: true });
  }

  constructor({
    chunkMaterial,
    chunkSize,
    geometry,
    position,
  }) {
    if (!Chunk.material) {
      Chunk.setupMaterial();
    }
    super(new BufferGeometry(), chunkMaterial || Chunk.material);
    this.geometry.boundingBox = new Box3();
    this.geometry.boundingSphere = new Sphere();
    this.update(geometry);
    this.chunk = (new Vector3()).copy(position);
    this.position.copy(position).multiplyScalar(chunkSize);
    this.updateMatrixWorld();
    this.matrixAutoUpdate = false;
  }

  dispose() {
    const { geometry } = this;
    geometry.dispose();
  }

  update({ bounds, vertices }) {
    const { geometry } = this;
    const buffer = new InterleavedBuffer(vertices, 9);
    geometry.setAttribute('position', new InterleavedBufferAttribute(buffer, 3, 0));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(buffer, 3, 3));
    geometry.setAttribute('color', new InterleavedBufferAttribute(buffer, 3, 6));
    geometry.boundingBox.min.set(bounds[0], bounds[1], bounds[2]);
    geometry.boundingBox.max.set(bounds[3], bounds[4], bounds[5]);
    geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
  }
}

export default Chunk;
