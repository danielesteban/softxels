import {
  Object3D,
  Vector3,
} from 'three';
import Chunk from './chunk.js';
import MesherProgram from './mesher.wasm';
import MesherWorker from 'web-worker:./mesher.js';
import WorldGenProgram from './worldgen.wasm';
import WorldGenWorker from 'web-worker:./worldgen.js';
import Worker from './worker.js';

class World extends Object3D {
  constructor({
    chunkSize = 32,
    isolevel = 0.7,
    renderRadius = 5,
    seed = Math.floor(Math.random() * 2147483647),
  } = {}) {
    super();
    this.aux = {
      chunk: new Vector3(),
    };
    this.anchorChunk = new Vector3(Infinity, Infinity, Infinity);
    this.chunkSize = chunkSize;
    this.dataChunks = new Map();
    this.renderChunks = new Map();
    this.renderRadius = renderRadius;
    this.renderGrid = World.getRenderGrid(renderRadius);
    this.loading = {
      data: new Map(),
      neighbors: new Map(),
      mesh: new Map(),
    };
    this.workers = {
      mesher: new Worker({
        options: { chunkSize, isolevel: Math.floor(isolevel * 0xFF) },
        instances: 4,
        program: MesherProgram,
        script: MesherWorker,
      }),
      worldgen: new Worker({
        options: { chunkSize, seed },
        instances: 4,
        program: WorldGenProgram,
        script: WorldGenWorker,
      }),
    };
  }

  generateChunk(x, y, z) {
    const { dataChunks, loading, workers } = this;
    const key = `${z}:${y}:${x}`;
    if (loading.data.has(key)) {
      return;
    }
    loading.data.set(key, true);
    workers.worldgen.run({ x, y, z }).then((data) => {
      dataChunks.set(key, data);
      loading.data.set(key, false);
      for (let nz = z - 1; nz <= z + 1; nz++) {
        for (let ny = y - 1; ny <= y + 1; ny++) {
          for (let nx = x - 1; nx <= x + 1; nx++) {
            const nkey = `${nz}:${ny}:${nx}`;
            if (loading.neighbors.has(nkey)) {
              this.loadChunk(nx, ny, nz);
            }
          }
        }
      }
    });
  }

  loadChunk(x, y, z) {
    const { chunkSize, dataChunks, renderChunks, loading, workers } = this;
    const key = `${z}:${y}:${x}`;
    if (renderChunks.has(key) || loading.mesh.has(key)) {
      return;
    }
    let needsData = false;
    const neighbors = [];
    for (let nz = z; nz <= z + 1; nz++) {
      for (let ny = y; ny <= y + 1; ny++) {
        for (let nx = x; nx <= x + 1; nx++) {
          const nkey = `${nz}:${ny}:${nx}`;
          if (!dataChunks.has(nkey)) {
            this.generateChunk(nx, ny, nz);
            needsData = true;
          } else {
            neighbors.push(dataChunks.get(nkey));
          }
        }
      }
    }
    if (needsData) {
      loading.neighbors.set(key);
      return;
    }
    loading.neighbors.delete(key);
    loading.mesh.set(key);
    workers.mesher.run({ chunks: neighbors }).then((vertices) => {
      if (!vertices) {
        return;
      }
      loading.mesh.delete(key);
      const chunk = new Chunk({
        chunkSize,
        position: { x, y, z },
        vertices,
      });
      this.add(chunk);
      renderChunks.set(key, chunk);
    });
  }

  updateChunks(anchor) {
    const { aux: { chunk }, anchorChunk, chunkSize, renderChunks, renderGrid, renderRadius } = this;
    this.worldToLocal(chunk.copy(anchor)).divideScalar(chunkSize).floor();
    if (anchorChunk.equals(chunk)) {
      return;
    }
    anchorChunk.copy(chunk);
    const maxDistance = renderRadius * 1.25;
    renderChunks.forEach((mesh, key) => {
      if (
        anchorChunk.distanceTo(mesh.chunk) > maxDistance
      ) {
        this.remove(mesh);
        renderChunks.delete(key);
      }
    });
    renderGrid.forEach(({ x, y, z }) => {
      this.loadChunk(chunk.x + x, chunk.y + y, chunk.z + z);
    });
  }

  static getRenderGrid(radius) {
    const grid = [];
    const center = new Vector3();
    for (let z = -radius; z <= radius; z += 1) {
      for (let y = -radius; y <= radius; y += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          const chunk = new Vector3(x, y, z);
          if (chunk.distanceTo(center) <= radius) {
            grid.push(chunk);
          }
        }
      }
    }
    grid.sort((a, b) => (a.distanceTo(center) - b.distanceTo(center)));
    return grid;
  }
}

export default World;
