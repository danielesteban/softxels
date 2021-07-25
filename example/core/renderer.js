import {
  ACESFilmicToneMapping,
  AudioListener,
  Clock,
  PerspectiveCamera,
  ShaderChunk,
  sRGBEncoding,
  WebGLRenderer,
} from 'three';

class Renderer {
  constructor(dom) {
    this.clock = new Clock();
    this.clock.localStartTime = Date.now();
    this.fps = {
      count: 0,
      lastTick: this.clock.oldTime / 1000,
    };
    this.dom = dom;

    this.camera = new PerspectiveCamera(70, 1, 0.1, 1000);
    this.renderer = new WebGLRenderer({
      antialias: true,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputEncoding = sRGBEncoding;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    // this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setAnimationLoop(this.onAnimationTick.bind(this));
    dom.renderer.appendChild(this.renderer.domElement);

    this.onFirstInteraction = this.onFirstInteraction.bind(this);
    window.addEventListener('click', this.onFirstInteraction, false);
    window.addEventListener('keydown', this.onFirstInteraction, false);

    window.addEventListener('resize', this.onResize.bind(this), false);
    requestAnimationFrame(this.onResize.bind(this));
  }

  onAnimationTick() {
    const {
      camera,
      clock,
      dom,
      fps,
      listener,
      renderer,
      scene,
    } = this;

    const animation = {
      delta: Math.min(clock.getDelta(), 1 / 30),
      time: clock.oldTime / 1000,
    };

    scene.onAnimationTick(animation);
    if (listener) {
      camera.matrixWorld.decompose(listener.position, listener.quaternion, listener.scale);
      listener.updateMatrixWorld();
    }
    renderer.render(scene, camera);

    fps.count += 1;
    if (animation.time >= fps.lastTick + 1) {
      renderer.fps = Math.round(fps.count / (animation.time - fps.lastTick));
      dom.fps.innerText = `${renderer.fps}fps`;
      fps.lastTick = animation.time;
      fps.count = 0;
    }
  }

  onFirstInteraction() {
    const { scene } = this;
    window.removeEventListener('click', this.onFirstInteraction);
    window.removeEventListener('keydown', this.onFirstInteraction);
    this.listener = new AudioListener();
    scene.onFirstInteraction();
  }

  onResize() {
    const {
      camera,
      dom,
      renderer,
    } = this;

    const { width, height } = dom.renderer.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  static patchFog() {
    ShaderChunk.fog_pars_vertex = ShaderChunk.fog_pars_vertex.replace(
      'varying float fogDepth;',
      'varying vec3 fogPosition;'
    );

    ShaderChunk.fog_vertex = ShaderChunk.fog_vertex.replace(
      'fogDepth = - mvPosition.z;',
      'fogPosition = - mvPosition.xyz;'
    );

    ShaderChunk.fog_pars_fragment = ShaderChunk.fog_pars_fragment.replace(
      'varying float fogDepth;',
      'varying vec3 fogPosition;'
    );

    ShaderChunk.fog_fragment = ShaderChunk.fog_fragment
      .replace(
        '#ifdef USE_FOG',
        [
          '#ifdef USE_FOG',
          '  float fogDepth = length(fogPosition);',
        ].join('\n')
      );
  }
}

export default Renderer;
