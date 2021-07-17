import {
  RGBFormat,
  sRGBEncoding,
  Vector2,
  WebGLMultisampleRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

function SetupComposer(renderer) {
  const size = renderer.getDrawingBufferSize(new Vector2());
  const target = new WebGLMultisampleRenderTarget(
    size.x, size.y, { encoding: sRGBEncoding, format: RGBFormat }
  );
  const composer = new EffectComposer(renderer, target);
  composer.renderPass = new RenderPass();
  composer.addPass(composer.renderPass);
  composer.shader = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: size },
    },
    vertexShader: [
      'varying highp vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D tDiffuse;',
      'uniform vec2 resolution;',
      'varying highp vec2 vUv;',
      'void main() {',
      '  vec2 dxy = 3.0 / resolution;',
      '  float l = mod(vUv.y, dxy.y) / dxy.y;',
      '  float d = 0.75 - length(vUv - vec2(0.5, 0.5));',
      '  float v = smoothstep(-0.5, 0.5, d);',
      '  vec3 diffuse = texture2D(tDiffuse, vUv).xyz;',
      '  gl_FragColor = vec4(diffuse * mix(vec3(1.0), vec3(l >= 0.5 ? 1.0 - l : l), 1.0 - v) * v, 1.0);',
      '}',
    ].join('\n'),
  });
  composer.addPass(composer.shader);
  return composer;
}

export default SetupComposer;
