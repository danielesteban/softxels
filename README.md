[softxels](https://softxels.gatunes.com/)
[![npm-version](https://img.shields.io/npm/v/softxels.svg)](https://www.npmjs.com/package/softxels)
==

[![screenshot](https://github.com/danielesteban/softxels/raw/master/example/screenshot.png)](https://softxels.gatunes.com/)


### Installation

```bash
npm install softxels
```

### Usage

```js
import { World } from 'softxels';

const world = new World({
  chunkSize: 32,
  isolevel: 0.7,
  renderRadius: 5,
  seed: Math.floor(Math.random() * 2147483647),
});
scene.add(world);

onAnimationTick() {
  world.updateChunks(camera.position);
}
```
