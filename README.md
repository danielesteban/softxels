[softxels](https://softxels.gatunes.com/)
[![npm-version](https://img.shields.io/npm/v/softxels.svg)](https://www.npmjs.com/package/softxels)
==

[![screenshot](https://github.com/danielesteban/softxels/raw/master/example/screenshot.png)](https://softxels.gatunes.com/)

### Installation

```bash
npm install softxels
```

### Basic usage

```js
import World from 'softxels';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';

const scene = new Scene();
const aspect = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(70, aspect, 0.1, 1000);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const world = new World({
  chunkSize: 32,
  renderRadius: 5,
  seed: Math.floor(Math.random() * 2147483647),
  shader: 'basic',
});
scene.add(world);

renderer.setAnimationLoop(() => {
  world.updateChunks(camera.position);
  renderer.render(scene, camera);
});
```

### Full example

 * Source: [example/main.js](example/main.js)
 * Live demo: [https://softxels.gatunes.com/](https://softxels.gatunes.com/)

### Modifying the WASM programs

To build the C code, you'll need to install LLVM:

 * Win: [https://chocolatey.org/packages/llvm](https://chocolatey.org/packages/llvm)
 * Mac: [https://formulae.brew.sh/formula/llvm](https://formulae.brew.sh/formula/llvm)
 * Linux: [https://releases.llvm.org/download.html](https://releases.llvm.org/download.html)

On the first build, it will complain about a missing file that you can get here:
[libclang_rt.builtins-wasm32-wasi-12.0.tar.gz](https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-12/libclang_rt.builtins-wasm32-wasi-12.0.tar.gz). Just put it on the same path that the error specifies and you should be good to go.

To build [wasi-libc](https://github.com/WebAssembly/wasi-libc), you'll need to install [GNU make](https://chocolatey.org/packages/make)

```bash
# clone this repo and it's submodules
git clone --recursive https://github.com/danielesteban/softxels.git
cd softxels
# build wasi-libc
cd vendor/wasi-libc && make -j8 && cd ../..
# install dev dependencies
npm install
# start the dev environment:
npm start
# open http://localhost:8080/ in your browser
```
