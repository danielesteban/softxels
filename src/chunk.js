import {
  Box3,
  BufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  ShaderLib,
  ShaderMaterial,
  Sphere,
  UniformsUtils,
  Vector3,
} from 'three';

class Chunk extends Mesh {
  static setupMaterials() {
    Chunk.materials = ['basic', 'phong'].reduce((materials, shader) => {
      const { uniforms, vertexShader, fragmentShader } = ShaderLib[shader];
      materials[shader] = new ShaderMaterial({
        uniforms: UniformsUtils.clone(uniforms),
        vertexShader: vertexShader
          .replace(
            '#include <color_vertex>',
            'vColor.xyz = color.xyz / 255.0;',
          ),
        fragmentShader,
        vertexColors: true,
        fog: true,
        lights: shader !== 'basic',
      });
      return materials;
    }, {});
  }

  constructor({
    bounds,
    chunkSize,
    position,
    shader,
    vertices,
  }) {
    if (!Chunk.materials) {
      Chunk.setupMaterials();
    }
    const buffer = new InterleavedBuffer(vertices, 6);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new InterleavedBufferAttribute(buffer, 3, 0));
    geometry.setAttribute('color', new InterleavedBufferAttribute(buffer, 3, 3));
    if (shader !== 'basic') {
      geometry.computeVertexNormals();
    }
    geometry.boundingBox = new Box3(
      new Vector3(bounds[0], bounds[1], bounds[2]),
      new Vector3(bounds[3], bounds[4], bounds[5])
    );
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
    super(geometry, Chunk.materials[shader]);
    this.chunk = (new Vector3()).copy(position);
    this.position.copy(position).multiplyScalar(chunkSize);
}

  dispose() {
    const { geometry } = this;
    geometry.dispose();
  }
}

export default Chunk;