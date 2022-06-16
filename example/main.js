import {
  AudioLoader,
  Color,
  FogExp2,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PMREMGenerator,
  PositionalAudio,
  SpotLight,
  Scene,
  Vector3,
} from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import World, { WorldGen } from 'softxels';
import Fish from './core/fish.js';
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

    const params = location.hash.substr(2).split('/');
    if (params[0] === '') location.hash = '/terrain';
    setTimeout(() => { window.onhashchange = () => location.reload(); }, 0);

    const chunkSize = 32;
    const chunkMaterial = new MeshStandardMaterial({
      metalness: 0.2,
      roughness: 0.8,
      vertexColors: true,
      envMapIntensity: 0.1,
    });

    this.player = new Player({
      camera: renderer.camera,
      renderer: renderer.dom.renderer,
    });
    this.player.position.setScalar(chunkSize * 0.5);
    this.player.targetPosition.copy(this.player.position);
    this.player.camera.rotation.set(0, 0, 0, 'YXZ');
    this.player.targetRotation.copy(this.player.camera.rotation);
    this.player.raycaster.far = chunkSize * 1.5;
    this.add(this.player);

    const worldgen = params[0] === 'cave' ? 'cave' : 'terrain';
    document.getElementById(`worldgen:${worldgen}`).classList.add('active');
    switch (worldgen) {
      default:
      case 'cave': {
        this.ambient = 'ambient';
        this.background = new Color(0x0A1A2A);
        const light = new SpotLight(0xFFFFFF, 0.5, 32, Math.PI / 3, 1);
        light.target.position.set(0, 0, -1);
        light.add(light.target);
        this.player.camera.add(light);
        break;
      }
      case 'terrain':
        renderer.renderer.shadowMap.enabled = true;
        renderer.renderer.shadowMap.type = PCFSoftShadowMap;
        this.ambient = 'underwater';
        this.background = new Color(0x2A4A6A);
        this.csm = new CSM({
          camera: renderer.camera,
          cascades: 3,
          lightDirection: new Vector3(0, -1, 0),
          lightIntensity: 0.5,
          maxFar: 512,
          mode: 'practical',
          parent: this,
          shadowMapSize: 1024,
        });
        this.csm.setupMaterial(chunkMaterial);
        break;
    }
    this.fog = new FogExp2(this.background, 0.015);
    this.environment = (new PMREMGenerator(renderer.renderer)).fromScene(new RoomEnvironment(), 0.04).texture;

    this.world = new World({
      chunkMaterial,
      chunkSize,
      worldgen: WorldGen({
        generator: worldgen,
        ...(params.includes('persist') ? {
          // Set a fixed seed so the generation is the same across reloads
          seed: 1337,
        } : {}),
      }),
      ...(params.includes('persist') ? {
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

    if (worldgen === 'terrain') {
      this.fish = [];
      const loader = new GLTFLoader();
      [
        { id: 'barramundi', instances: 128, rotation: Math.PI, scale: 2 },
        { id: 'fish', instances: 128, rotation: Math.PI * 0.5, scale: 0.25 },
      ].forEach(({ id, instances, rotation, scale, intensity }) => (
        loader
          .loadAsync(`models/${id}.glb`)
          .then(({ scene: { children: [model] } }) => {
            model = model.children.length ? model.children[0] : model;
            model.geometry.rotateY(rotation);
            model.geometry.scale(scale, scale, scale);
            model.material.envMapIntensity = 0.5;
            this.csm.setupMaterial(model.material);
            const mesh = new Fish({
              model,
              instances,
              radius: 96,
              anchor: this.player.position,
              world: this.world,
            });
            this.fish.push(mesh);
            this.add(mesh);
          })
      ));
    }
  }

  onAnimationTick(animation) {
    const { csm, fish, player, sfx, world } = this;
    player.onAnimationTick(animation);
    world.updateChunks(player.position);
    if (csm) csm.update();
    if (fish) fish.forEach((mesh) => mesh.animate(animation));

    if (
      player.buttons.primaryDown
      || player.buttons.secondaryDown
    ) {
      const [hit] = player.raycaster.intersectObjects(this.world.children);
      if (hit) {
        hit.point.addScaledVector(hit.face.normal.normalize(), 0.25 * (player.buttons.primaryDown ? -1 : 1));
        world.updateVolume(
          hit.point,
          1,
          player.buttons.primaryDown ? 0 : 0xFF
        );
        if (sfx) {
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
      const ambient = new Audio(`/sounds/${this.ambient}.ogg`);
      ambient.loop = true;
      ambient.volume = 1 / 3;
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
    if (csm) csm.updateFrustums();
  }
}

renderer.scene = new Main();
