import { Group, Vector3 } from 'three';
import Chunk from './chunk.js';
import Worker from './core/worker.js';
import { setImmediate } from './core/setimmediate.js';
import MesherProgram from './workers/mesher.wasm';
import MesherWorker from 'web-worker:./workers/mesher.js';

const _chunk = new Vector3();
const _origin = new Vector3();
const _voxel = new Vector3();

class World extends Group {
  constructor({
    chunkMaterial = null,
    chunkSize = 32,
    renderRadius = 5,
    storage = null,
    worldgen = null,
  } = {}) {
    super();
    this.chunkMaterial = chunkMaterial;
    this.chunkSize = chunkSize;
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
    this.saving = new Map();
    this.storage = storage;
    this.workers = {
      mesher: new Worker({
        buffer: chunkSize * chunkSize * chunkSize * 4 * 8,
        options: { chunkSize },
        program: MesherProgram,
        script: MesherWorker,
      }),
      ...(worldgen ? { worldgen: worldgen(chunkSize) } : {})
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

  reset() {
    const { anchorChunk, dataChunks, renderChunks, loading, workers } = this;
    anchorChunk.set(Infinity, Infinity, Infinity);
    dataChunks.clear();
    renderChunks.forEach((mesh) => {
      mesh.dispose();
      this.remove(mesh);
    });
    renderChunks.clear();
    loading.data.forEach((request) => {
      request.abort = true;
    });
    loading.data.clear();
    loading.neighbors.clear();
    loading.mesh.forEach((request) => {
      request.abort = true;
    });
    loading.mesh.clear();
    [workers.mesher, workers.worldgen].forEach((worker) => {
      if (worker) {
        worker.queue.length = 0;
      }
    });
  }

  importChunks(buffer, autoUpdateScale = true) {
    const { chunkSize, dataChunks } = this;
    const [metadataLength] = new Uint16Array(buffer.slice(0, 2));
    const metadata = JSON.parse((new TextDecoder()).decode(buffer.slice(2, 2 + metadataLength)));
    const stride = 6 + chunkSize * chunkSize * chunkSize * 4;
    this.reset();
    if (metadata.chunkSize !== chunkSize) {
      // @incomplete: Support swapping the chunkSize on the fly
      //              This will require refactoring the worker startup
      //              so it can be call again from here
      throw new Error('World chunkSize is: ${chunkSize} but imported chunkSize is: ${metadata.chunkSize}. They need to match.');
    }
    for (let i = 2 + metadataLength; i < buffer.byteLength; i += stride) {
      const chunk = new Int16Array(buffer.slice(i, i + 6));
      dataChunks.set(
        `${chunk[0]}:${chunk[1]}:${chunk[2]}`,
        new Uint8Array(buffer.slice(i + 6, i + stride))
      );
    }
    if (autoUpdateScale) {
      this.scale.setScalar(metadata.scale);
      this.updateMatrixWorld();
    }
    return metadata;
  }

  generateChunk(x, y, z) {
    const { chunkSize, dataChunks, loading: { data: loading }, storage, workers } = this;
    const key = `${x}:${y}:${z}`;
    if (loading.has(key)) {
      return;
    }
    const request = { abort: false };
    loading.set(key, request);
    setImmediate(() => {
      if (request.abort) {
        return;
      }
      (storage ? storage.get(key) : Promise.resolve(false))
        .then((stored) => {
          if (request.abort) {
            return;
          }
          if (stored) {
            return stored;
          }
          if (workers.worldgen) {
            return workers.worldgen.run({ x, y, z });
          }
          return new Uint8Array(chunkSize * chunkSize * chunkSize * 4);
        })
        .then((data) => {
          if (request.abort) {
            return;
          }
          loading.delete(key);
          dataChunks.set(key, data);
          this.loadPendingNeighbors(x, y, z);
        });
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
    setImmediate(() => {
      if (request.abort) {
        return;
      }
      workers.mesher.run(neighbors).then((geometry) => {
        if (request.abort) {
          return;
        }
        const current = renderChunks.get(key);
        if (!geometry) {
          if (current) {
            current.dispose();
            this.remove(current);
          }
          return;
        }
        loading.mesh.delete(key);
        if (current) {
          current.update(geometry);
        } else {
          const chunk = new Chunk({
            chunkMaterial,
            chunkSize,
            geometry,
            position: { x, y, z },
          });
          this.add(chunk);
          renderChunks.set(key, chunk);
        }        
      });
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

  saveChunk(x, y, z) {
    const { dataChunks, saving, storage } = this;
    const key = `${x}:${y}:${z}`;
    if (!storage || !storage.set || saving.has(key)) {
      return;
    }
    saving.set(key, true);
    setTimeout(() => {
      saving.delete(key);
      storage.set(key, dataChunks.get(key));
    }, storage.saveInterval || 0);
  }

  updateChunks(anchor) {
    const { anchorChunk, chunkSize, renderChunks, renderGrid, renderRadius } = this;
    this.worldToLocal(_chunk.copy(anchor)).divideScalar(chunkSize).floor();
    if (anchorChunk.equals(_chunk)) {
      return;
    }
    anchorChunk.copy(_chunk);
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
    renderGrid.forEach((offset) => {
      _chunk.addVectors(anchorChunk, offset);
      const key = `${_chunk.x}:${_chunk.y}:${_chunk.z}`;
      if (!renderChunks.has(key)) {
        this.loadChunk(_chunk.x, _chunk.y, _chunk.z);
      }
    });
  }

  updateVolume(point, radius, value, color) {
    const { chunkSize, dataChunks, loading: { mesh: loading } } = this;
    this.worldToLocal(_origin.copy(point)).floor();
    const affected = new Map();
    World.getBrush(radius).forEach((offset) => {
      _voxel.addVectors(_origin, offset);
      _chunk.copy(_voxel).divideScalar(chunkSize).floor();
      _voxel.addScaledVector(_chunk, -chunkSize).floor();
      const key = `${_chunk.x}:${_chunk.y}:${_chunk.z}`;
      const data = dataChunks.get(key);
      if (data) {
        const index = (
          (_voxel.z * chunkSize * chunkSize + _voxel.y * chunkSize + _voxel.x) * 4
        );
        data[index] = value;
        if (color) {
          data.set([color.r, color.g, color.b], index + 1);
        }
        this.saveChunk(_chunk.x, _chunk.y, _chunk.z);
        affected.set(key, true);
        if (_voxel.x === 0) {
          affected.set(`${_chunk.x - 1}:${_chunk.y}:${_chunk.z}`, true);
        }
        if (_voxel.y === 0) {
          affected.set(`${_chunk.x}:${_chunk.y - 1}:${_chunk.z}`, true);
        }
        if (_voxel.z === 0) {
          affected.set(`${_chunk.x}:${_chunk.y}:${_chunk.z - 1}`, true);
        }
        if (_voxel.x === 0 && _voxel.y === 0 && _voxel.z === 0) {
          affected.set(`${_chunk.x - 1}:${_chunk.y - 1}:${_chunk.z - 1}`, true);
        }
        if (_voxel.x === 0 && _voxel.y === 0) {
          affected.set(`${_chunk.x - 1}:${_chunk.y - 1}:${_chunk.z}`, true);
        }
        if (_voxel.y === 0 && _voxel.z === 0) {
          affected.set(`${_chunk.x}:${_chunk.y - 1}:${_chunk.z - 1}`, true);
        }
        if (_voxel.x === 0 && _voxel.z === 0) {
          affected.set(`${_chunk.x - 1}:${_chunk.y}:${_chunk.z - 1}`, true);
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
