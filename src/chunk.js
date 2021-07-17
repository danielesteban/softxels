import {
  BufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  ShaderLib,
  ShaderMaterial,
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

  constructor({ chunkSize, position, shader, vertices }) {
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
    super(geometry, Chunk.materials[shader]);
    this.chunk = (new Vector3()).copy(position);
    this.position.copy(position).multiplyScalar(chunkSize);
  }
}

export default Chunk;
