import {
  AmbientLight,
  AudioLoader,
  Color,
  FogExp2,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PositionalAudio,
  SpotLight,
  Scene,
  Vector3,
} from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import World from 'softxels';
import Player from './core/player.js';
import Renderer from './core/renderer.js';

Renderer.patchFog();

const renderer = new Renderer({
  fps: document.getElementById('fps'),
  renderer: document.getElementById('renderer'),
});

class Main extends Scene {
  constructor() {
    super();

    const chunkSize = 32;
    const chunkMaterial = new MeshStandardMaterial({ vertexColors: true });
    const params = location.hash.substr(2).split('/');

    this.background = new Color(0x0A1A2A);
    this.fog = new FogExp2(this.background, 0.015);

    this.player = new Player({
      camera: renderer.camera,
      renderer: renderer.dom.renderer,
    });
    this.player.position.setScalar(chunkSize * 0.5);
    this.player.raycaster.far = chunkSize * 1.5;
    this.add(this.player);

    let worldgen = 'default';
    if (params[0] === 'terrain') {
      worldgen = 'terrain';
      renderer.renderer.shadowMap.enabled = true;
			renderer.renderer.shadowMap.type = PCFSoftShadowMap;
      this.background.setHex(0x2A4A6A);
      this.fog.color.copy(this.background);
      this.add(new AmbientLight(0xFFFFFF, 0.1));
      this.csm = new CSM({
        camera: renderer.camera,
        cascades: 3,
        lightDirection: new Vector3(0, -1, 0),
        maxFar: 512,
        mode: 'practical',
        parent: this,
        shadowMapSize: 1024,
      });
      this.csm.setupMaterial(chunkMaterial);
    } else {
      const light = new SpotLight(0xFFFFFF, 0.5, 32, Math.PI / 3, 1);
      light.target.position.set(0, 0, -1);
      light.add(light.target);
      this.player.camera.add(light);
    }

    this.world = new World({
      chunkMaterial,
      chunkSize,
      worldgen,
      ...(params.includes('persist') ? {
        // Set a fixed seed so the generation is the same across reloads
        seed: 1337,
        // Persist volume changes to localStorage
        storage: {
          saveInterval: 5000,
          async get(key) {
            const stored = localStorage.getItem(`${worldgen}:${key}`);
            if (!stored) {
              return false;
            }
            const decoded = new Uint8Array(atob(stored).split('').map((c) => c.charCodeAt(0)));
            return decoded;
          },
          set(key, value) {
            const encoded = btoa([...value].map((c) => String.fromCharCode(c)).join(''));
            localStorage.setItem(`${worldgen}:${key}`, encoded);
          },
        },
      } : {}),
    });
    this.add(this.world);
  }

  onAnimationTick(animation) {
    const { csm, player, sfx, world } = this;
    player.onAnimationTick(animation);
    world.updateChunks(player.position);
    if (csm) {
      csm.update();
    }

    if (
      player.buttons.primaryDown
      || player.buttons.secondaryDown
    ) {
      const [hit] = player.raycaster.intersectObjects(this.world.children);
      if (hit) {
        hit.point.addScaledVector(hit.face.normal.normalize(), 0.25 * (player.buttons.primaryDown ? -1 : 1));
        const affected = world.updateVolume(
          hit.point,
          1,
          player.buttons.primaryDown ? 0 : 0xFF
        );
        if (affected && sfx) {
          const audio = sfx.find(({ isPlaying }) => (!isPlaying));
          if (audio) {
            audio.filter.type = player.buttons.primaryDown ? 'highpass' : 'lowpass';
            audio.filter.frequency.value = (Math.random() + 0.5) * 1000;
            audio.position.copy(hit.point);
            audio.play();
          }
        }
      }
    }
  }

  onFirstInteraction() {
    {
      const ambient = new Audio('/sounds/ambient.ogg');
      ambient.loop = true;
      ambient.play();
    }
    (new AudioLoader()).loadAsync('/sounds/plop.ogg')
      .then((buffer) => {
        this.sfx = [...Array(5)].map(() => {
          const audio = new PositionalAudio(renderer.listener);
          audio.filter = audio.context.createBiquadFilter();
          audio.setBuffer(buffer);
          audio.setFilter(audio.filter);
          audio.setRefDistance(8);
          this.add(audio);
          return audio;
        });
      });
  }

  onResize() {
    const { csm } = this;
    if (csm) {
      csm.updateFrustums();
    }
  }
}

renderer.scene = new Main();
