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
  static setupMaterial() {
    const { uniforms, vertexShader, fragmentShader } = ShaderLib.basic;
    Chunk.material = new ShaderMaterial({
      uniforms: UniformsUtils.clone(uniforms),
      vertexShader: vertexShader
        .replace(
          '#include <color_vertex>',
          'vColor.xyz = color.xyz / 255.0;',
        ),
      fragmentShader,
      vertexColors: true,
      fog: true,
    });
  }

  constructor({ chunkSize, position, vertices }) {
    if (!Chunk.material) {
      Chunk.setupMaterial();
    }
    const buffer = new InterleavedBuffer(vertices, 6);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new InterleavedBufferAttribute(buffer, 3, 0));
    geometry.setAttribute('color', new InterleavedBufferAttribute(buffer, 3, 3));
    super(geometry, Chunk.material);
    this.chunk = (new Vector3()).copy(position);
    this.position.copy(position).multiplyScalar(chunkSize);
  }
}

export default Chunk;
