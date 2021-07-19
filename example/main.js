import {
  AudioLoader,
  Color,
  FogExp2,
  MeshPhongMaterial,
  PositionalAudio,
  SpotLight,
  Scene,
} from 'three';
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

    this.background = new Color(0x0A1A2A);
    this.fog = new FogExp2(this.background, 0.02);

    const light = new SpotLight(0xFFFFFF, 0.5, 32, Math.PI / 3, 1);
    light.target.position.set(0, 0, -1);
    light.add(light.target);

    this.player = new Player({
      camera: renderer.camera,
      renderer: renderer.dom.renderer,
    });
    this.player.camera.add(light);
    this.player.position.setScalar(chunkSize * 0.5);
    this.player.raycaster.far = chunkSize * 1.5;
    this.add(this.player);

    this.world = new World({
      chunkMaterial: new MeshPhongMaterial({ vertexColors: true }),
      chunkSize,
    });
    this.add(this.world);
  }

  onAnimationTick(animation) {
    const { player, sfx, world } = this;
    player.onAnimationTick(animation);
    world.updateChunks(player.position);

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
}

renderer.scene = new Main();
