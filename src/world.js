import { Group, Vector3 } from 'three';
import Chunk from './chunk.js';
import MesherProgram from './mesher.wasm';
import MesherWorker from 'web-worker:./mesher.js';
import WorldGenProgram from './worldgen.wasm';
import WorldGenWorker from 'web-worker:./worldgen.js';
import Worker from './worker.js';

class World extends Group {
  constructor({
    chunkMaterial = null,
    chunkSize = 32,
    renderRadius = 5,
    seed = Math.floor(Math.random() * 2147483647),
    worldgen = 'default',
  } = {}) {
    super();
    this.chunkMaterial = chunkMaterial;
    this.chunkSize = chunkSize;
    this.aux = {
      chunk: new Vector3(),
      voxel: new Vector3(),
    };
    this.anchorChunk = new Vector3(Infinity, Infinity, Infinity);
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
        options: { chunkSize },
        instances: 4,
        program: MesherProgram,
        script: MesherWorker,
      }),
      ...(worldgen !== 'empty' ? {
        worldgen: new Worker({
          options: { chunkSize, generator: worldgen, seed },
          instances: 4,
          program: WorldGenProgram,
          script: WorldGenWorker,
        }),
      } : {})
    };
  }

  dispose() {
    const { renderChunks, workers } = this;
    renderChunks.forEach((mesh) => mesh.dispose());
    [workers.mesher, workers.worldgen].forEach((worker) => {
      if (worker) {
        worker.dispose();
      }
    });
  }

  generateChunk(x, y, z) {
    const { chunkSize, dataChunks, loading: { data: loading }, workers } = this;
    const key = `${x}:${y}:${z}`;
    if (loading.has(key)) {
      return;
    }
    if (!workers.worldgen) {
      dataChunks.set(key, new Uint8Array(chunkSize * chunkSize * chunkSize * 4));
      this.loadPendingNeighbors(x, y, z);
      return;
    }
    loading.set(key, true);
    workers.worldgen.run({ x, y, z }).then((data) => {
      dataChunks.set(key, data);
      loading.delete(key);
      this.loadPendingNeighbors(x, y, z);
    });
  }

  loadChunk(x, y, z) {
    const { chunkMaterial, chunkSize, dataChunks, renderChunks, loading, workers } = this;
    const key = `${x}:${y}:${z}`;
    if (loading.mesh.has(key)) {
      return;
    }
    let needsData = false;
    const neighbors = [];
    for (let nz = z; nz <= z + 1; nz++) {
      for (let ny = y; ny <= y + 1; ny++) {
        for (let nx = x; nx <= x + 1; nx++) {
          const nkey = `${nx}:${ny}:${nz}`;
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
      loading.neighbors.set(key, true);
      return;
    }
    loading.neighbors.delete(key);
    const request = { abort: false };
    loading.mesh.set(key, request);
    return workers.mesher.run({ chunks: neighbors }).then((geometry) => {
      if (!geometry || request.abort) {
        return;
      }
      loading.mesh.delete(key);
      const { bounds, vertices } = geometry;
      const chunk = new Chunk({
        bounds,
        chunkMaterial,
        chunkSize,
        position: { x, y, z },
        vertices,
      });
      this.add(chunk);
      if (renderChunks.has(key)) {
        const current = renderChunks.get(key);
        current.dispose();
        this.remove(current);
      }
      renderChunks.set(key, chunk);
    });
  }

  loadPendingNeighbors(x, y, z) {
    const { loading: { neighbors } } = this;
    for (let nz = z - 1; nz <= z + 1; nz++) {
      for (let ny = y - 1; ny <= y + 1; ny++) {
        for (let nx = x - 1; nx <= x + 1; nx++) {
          if (neighbors.has(`${nx}:${ny}:${nz}`)) {
            this.loadChunk(nx, ny, nz);
          }
        }
      }
    }
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
        mesh.dispose();
        this.remove(mesh);
        renderChunks.delete(key);
      }
    });
    renderGrid.forEach(({ x, y, z }) => {
      if (!renderChunks.has(`${x}:${y}:${z}`)) {
        this.loadChunk(chunk.x + x, chunk.y + y, chunk.z + z);
      }
    });
  }

  updateVolume(point, radius, value, color) {
    const { aux: { chunk, voxel }, chunkSize, dataChunks, renderChunks, loading: { mesh: loading } } = this;
    this.worldToLocal(point).floor();
    const affected = new Map();
    World.getBrush(radius).forEach((offset) => {
      voxel.copy(point).add(offset);
      chunk.copy(voxel).divideScalar(chunkSize).floor();
      voxel.addScaledVector(chunk, -chunkSize).floor();
      const key = `${chunk.x}:${chunk.y}:${chunk.z}`;
      const data = dataChunks.get(key);
      if (data) {
        const index = (
          (voxel.z * chunkSize * chunkSize + voxel.y * chunkSize + voxel.x) * 4
        );
        data[index] = value;
        if (color) {
          data.set([color.r, color.g, color.b], index + 1);
        }
        affected.set(key, true);
        if (voxel.x === 0) {
          affected.set(`${chunk.x - 1}:${chunk.y}:${chunk.z}`, true);
        }
        if (voxel.y === 0) {
          affected.set(`${chunk.x}:${chunk.y - 1}:${chunk.z}`, true);
        }
        if (voxel.z === 0) {
          affected.set(`${chunk.x}:${chunk.y}:${chunk.z - 1}`, true);
        }
        if (voxel.x === 0 && voxel.y === 0 && voxel.z === 0) {
          affected.set(`${chunk.x - 1}:${chunk.y - 1}:${chunk.z - 1}`, true);
        }
        if (voxel.x === 0 && voxel.y === 0) {
          affected.set(`${chunk.x - 1}:${chunk.y - 1}:${chunk.z}`, true);
        }
        if (voxel.y === 0 && voxel.z === 0) {
          affected.set(`${chunk.x}:${chunk.y - 1}:${chunk.z - 1}`, true);
        }
        if (voxel.x === 0 && voxel.z === 0) {
          affected.set(`${chunk.x - 1}:${chunk.y}:${chunk.z - 1}`, true);
        }
      }
    });
    affected.forEach((v, key) => {
      if (loading.has(key)) {
        loading.get(key).abort = true;
        loading.delete(key);
      }
      const [x, y, z] = key.split(':');
      this.loadChunk(parseInt(x, 10), parseInt(y, 10), parseInt(z, 10));
    });
    return affected.size;
  }

  static getBrush(radius) {
    const { brushes } = World;
    let brush = brushes.get(radius);
    if (!brush) {
      brush = [];
      const center = (new Vector3()).setScalar(0.5);
      for (let z = -radius; z <= radius + 1; z += 1) {
        for (let y = -radius; y <= radius + 1; y += 1) {
          for (let x = -radius; x <= radius + 1; x += 1) {
            const point = new Vector3(x, y, z);
            if (point.distanceTo(center) <= radius) {
              brush.push(point);
            }
          }
        }
      }
      brush.sort((a, b) => (a.distanceTo(center) - b.distanceTo(center)));
      brushes.set(radius, brush);
    }
    return brush;
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

World.brushes = new Map();

export default World;
