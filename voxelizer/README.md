softxels-voxelizer
[![npm-version](https://img.shields.io/npm/v/softxels-voxelizer.svg)](https://www.npmjs.com/package/softxels-voxelizer)
==

```bash
                  ▄▄▄▄                           ▄▄         
                ▄█▀ ▀▀ ██                      ▀███         
                ██▀    ██                        ██         
▄██▀███ ▄██▀██▄ █████ ██████▀██▀   ▀██▀ ▄▄█▀██   ██  ▄██▀███
██   ▀▀██▀   ▀██ ██     ██    ▀██ ▄█▀  ▄█▀   ██  ██  ██   ▀▀
▀█████▄██     ██ ██     ██      ███    ██▀▀▀▀▀▀  ██  ▀█████▄
█▄   ████▄   ▄██ ██     ██    ▄█▀ ██▄  ██▄    ▄  ██  █▄   ██
██████▀ ▀█████▀▄████▄   ▀██████▄   ▄██▄ ▀█████▀▄████▄██████▀

Usage:
  node voxelizer/cli.mjs -i "input.ply" -o "output.bin"

Options:
  -i, --input       Input file                               [string] [required]
  -o, --output      Output file                              [string] [required]
  -c, --chunkSize   Chunk size                            [number] [default: 32]
  -g, --gain        Sample gain                          [number] [default: 1.7]
  -s, --grid        Sample grid                            [number] [default: 1]
  -r, --resolution  Resolution                            [number] [default: 10]
```

### Basic usage

```js
import { inflate } from 'fflate';
import World from 'softxels';
import { PerspectiveCamera, Scene, sRGBEncoding, WebGLRenderer } from 'three';

const aspect = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(70, aspect, 0.1, 1000);
const renderer = new WebGLRenderer({ antialias: true });
renderer.outputEncoding = sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new Scene();
const world = new World();
scene.add(world);

fetch('./output.bin')
  .then((res) => res.arrayBuffer())
  .then((buffer) => new Promise((resolve, reject) => (
    inflate(new Uint8Array(buffer), (err, inflated) => {
      if (err) reject(err);
      else resolve(inflated.buffer);
    })
  )))
  .then((buffer) => world.importChunks(buffer))
  .then(() => {
    renderer.setAnimationLoop(() => {
      world.updateChunks(camera.position);
      renderer.render(scene, camera);
    });
  });
```
