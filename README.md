[softxels](https://softxels.gatunes.com/)
[![npm-version](https://img.shields.io/npm/v/softxels.svg)](https://www.npmjs.com/package/softxels)
==

[![screenshot](https://github.com/danielesteban/softxels/raw/master/example/screenshot.png)](https://softxels.gatunes.com/)


#### Live example

[https://softxels.gatunes.com/](https://softxels.gatunes.com/)

### Installation

```bash
npm install softxels
```

### Usage

```js
import { World } from 'softxels';
import { Scene } from 'three';

const scene = new Scene();
const world = new World({
  chunkSize: 32,
  isolevel: 0.7,
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
