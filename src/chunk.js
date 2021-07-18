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
    bounds,
    chunkMaterial,
    chunkSize,
    position,
    vertices,
  }) {
    if (!Chunk.material) {
      Chunk.setupMaterial();
    }
    const buffer = new InterleavedBuffer(vertices, 9);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new InterleavedBufferAttribute(buffer, 3, 0));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(buffer, 3, 3));
    geometry.setAttribute('color', new InterleavedBufferAttribute(buffer, 3, 6));
    geometry.boundingBox = new Box3(
      new Vector3(bounds[0], bounds[1], bounds[2]),
      new Vector3(bounds[3], bounds[4], bounds[5])
    );
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
    super(geometry, chunkMaterial || Chunk.material);
    this.chunk = (new Vector3()).copy(position);
    this.position.copy(position).multiplyScalar(chunkSize);
}

  dispose() {
    const { geometry } = this;
    geometry.dispose();
  }
}

export default Chunk;
