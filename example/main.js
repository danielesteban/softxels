import {
  Color,
  FogExp2,
  SpotLight,
  Scene,
  Vector3,
} from 'three';
import { World } from 'softxels';
import Player from './core/player.js';
import Renderer from './core/renderer.js';

Renderer.patchFog();

const renderer = new Renderer({
  dom: {
    cursor: document.getElementById('cursor'),
    fps: document.getElementById('fps'),
    renderer: document.getElementById('renderer'),
  },
  postprocessing: !navigator.userAgent.includes('Mobile'),
});

class Main extends Scene {
  constructor() {
    super();
    this.background = new Color(0x0A1A2A);
    this.fog = new FogExp2(this.background, 0.02);
    this.player = new Player({
      camera: renderer.camera,
      dom: renderer.dom,
    });
    const light = new SpotLight(0xFFFFFF, 0.5, 32, Math.PI / 3, 1);
    light.target.position.set(0, 0, -1);
    light.add(light.target);
    this.player.camera.add(light);
    this.add(this.player);
    this.world = new World({
      shader: 'phong',
    });
    this.add(this.world);
  }

  onAnimationTick(animation) {
    const { player, world } = this;
    player.onAnimationTick(animation);
    world.updateChunks(player.position);
  }
}

renderer.scene = new Main();
