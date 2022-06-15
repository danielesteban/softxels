softxels-voxelizer
[![npm-version](https://img.shields.io/npm/v/softxels-voxelizer.svg)](https://www.npmjs.com/package/softxels-voxelizer)
==

```bash
npm install -g softxels-voxelizer
```

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
  softxels-voxelizer -i "input.ply" -o "output.bin"

Options:
      --help        Show help                                          [boolean]
      --version     Show version number                                [boolean]
  -i, --input       Input file                               [string] [required]
  -o, --output      Output file                              [string] [required]
  -r, --resolution  Resolution                            [number] [default: 10]
      --author      Author (metadata)                                   [string]
      --name        Name (metadata)                                     [string]
      --scale       Render scale (metadata)            [number] [default: 0.125]
      --spawn       Spawn point (metadata)           [string] [default: "0,8,0"]
      --rotateX     Input rotation                       [number] [default: -90]
      --rotateY     Input rotation                         [number] [default: 0]
      --rotateZ     Input rotation                         [number] [default: 0]
      --chunkSize   Chunk size                            [number] [default: 32]
      --gain        Sample gain                          [number] [default: 1.7]
      --grid        Sample grid                            [number] [default: 1]
```

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
  .then((buffer) => {
    world.importChunks(buffer, false);
    renderer.setAnimationLoop(() => {
      world.updateChunks(camera.position);
      renderer.render(scene, camera);
    });
  });
```
