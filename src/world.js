import { Group, Vector3 } from 'three';
import Chunk from './chunk.js';
import Worker from './core/worker.js';
import MesherProgram from './workers/mesher.wasm';
import MesherWorker from 'web-worker:./workers/mesher.js';

const _queueMicrotask = (typeof self.queueMicrotask === 'function') ? (
  self.queueMicrotask
) : (callback) => {
  Promise.resolve()
    .then(callback)
    .catch(e => setTimeout(() => { throw e; }));
};

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
      mesh: new Map(),
    };
    this.saving = new Map();
    this.storage = storage;
    this.updateQueue = new Map();
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
    const { loading, renderChunks, updateQueue, workers } = this;
    [loading.data, loading.mesh].forEach((requests) => {
      requests.forEach((request) => {
        request.abort = true;
      });
      requests.clear();
    });
    renderChunks.forEach((mesh) => mesh.dispose());
    updateQueue.clear();
    [workers.mesher, workers.worldgen].forEach((worker) => {
      if (worker) {
        worker.dispose();
      }
    });
  }

  reset() {
    const { anchorChunk, dataChunks, loading, renderChunks, updateQueue, workers } = this;
    anchorChunk.set(Infinity, Infinity, Infinity);
    dataChunks.clear();
    [loading.data, loading.mesh].forEach((requests) => {
      requests.forEach((request) => {
        request.abort = true;
      });
      requests.clear();
    });
    if (renderChunks.size) {
      renderChunks.forEach((mesh) => {
        mesh.dispose();
        this.remove(mesh);
      });
      renderChunks.clear();
      this.dispatchEvent({ type: 'update' });
    }
    updateQueue.clear();
    [workers.mesher, workers.worldgen].forEach((worker) => {
      if (worker) {
        worker.queue.length = 0;
      }
    });
  }

  getChunk(x, y, z) {
    const { chunkSize, dataChunks, loading: { data: loading }, storage, workers } = this;
    const key = `${x}:${y}:${z}`;
    return new Promise((resolve) => {
      if (dataChunks.has(key)) {
        resolve(dataChunks.get(key));
        return;
      }
      if (loading.has(key)) {
        loading.get(key).promises.push(resolve);
        return;
      }
      const request = { abort: false, promises: [resolve] };
      loading.set(key, request);
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
          request.promises.forEach((resolve) => resolve(data));
        });
      });
  }

  loadChunk(x, y, z) {
    const { chunkMaterial, chunkSize, renderChunks, loading: { mesh: loading }, workers } = this;
    const key = `${x}:${y}:${z}`;
    if (loading.has(key)) {
      return;
    }
    const request = { abort: false };
    loading.set(key, request);
    return Promise.all(
      World.chunkGrid.map((n) => this.getChunk(x + n.x, y + n.y, z + n.z))
    )
      .then((chunks) => {
        if (request.abort) {
          return;
        }
        return workers.mesher.run(chunks);
      })
      .then((geometry) => {
        if (request.abort) {
          return;
        }
        loading.delete(key);
        const current = renderChunks.get(key);
        if (current) {
          if (geometry) {
            current.update(geometry);
          } else {
            current.dispose();
            this.remove(current);
          }
        } else if (geometry) {
          const chunk = new Chunk({
            chunkMaterial,
            chunkSize,
            geometry,
            position: { x, y, z },
          });
          this.add(chunk);
          renderChunks.set(key, chunk);
        }
        this.dispatchEvent({ type: 'update' });
      });
  }

  importChunks(buffer, autoUpdateChunks = true, autoUpdateScale = true) {
    const { chunkSize, dataChunks } = this;
    const [metadataLength] = new Uint16Array(buffer.slice(0, 2));
    const metadata = JSON.parse((new TextDecoder()).decode(buffer.slice(2, 2 + metadataLength)));
    const stride = 6 + chunkSize * chunkSize * chunkSize * 4;
    if (metadata.chunkSize !== chunkSize) {
      // @incomplete: Support swapping the chunkSize on the fly
      //              This will require refactoring the worker startup
      //              so it can be call again from here
      throw new Error('World chunkSize is: ${chunkSize} but imported chunkSize is: ${metadata.chunkSize}. They need to match.');
    }
    this.reset();
    for (let i = 2 + metadataLength; i < buffer.byteLength; i += stride) {
      const chunk = new Int16Array(buffer.slice(i, i + 6));
      dataChunks.set(
        `${chunk[0]}:${chunk[1]}:${chunk[2]}`,
        new Uint8Array(buffer.slice(i + 6, i + stride))
      );
    }
    if (autoUpdateChunks) {
      this.updateLoadedChunks();
    }
    if (autoUpdateScale) {
      this.scale.setScalar(metadata.scale);
      this.updateMatrixWorld();
    }
    return metadata;
  }

  updateChunks(anchor) {
    const { anchorChunk, chunkSize, dataChunks, loading: { mesh: loading }, renderChunks, renderGrid, renderRadius } = this;
    this.worldToLocal(_chunk.copy(anchor)).divideScalar(chunkSize).floor();
    if (anchorChunk.equals(_chunk)) {
      return;
    }
    anchorChunk.copy(_chunk);
    let hasRemoved = false;
    const maxDistance = renderRadius + 2;
    dataChunks.forEach((v, key) => {
      const [x, y, z] = key.split(':');
      _chunk.set(parseInt(x, 10), parseInt(y, 10), parseInt(z, 10));
      if (
        anchorChunk.distanceTo(_chunk) > maxDistance
      ) {
        dataChunks.delete(key);
        if (loading.has(key)) {
          loading.get(key).abort = true;
          loading.delete(key);
        }
        const mesh = renderChunks.get(key);
        if (mesh) {
          renderChunks.delete(key);
          mesh.dispose();
          this.remove(mesh);
          hasRemoved = true;
        }
      }
    });
    if (hasRemoved) {
      this.dispatchEvent({ type: 'update' });
    }
    renderGrid.forEach((offset) => {
      _chunk.addVectors(anchorChunk, offset);
      const key = `${_chunk.x}:${_chunk.y}:${_chunk.z}`;
      if (!renderChunks.has(key)) {
        this.loadChunk(_chunk.x, _chunk.y, _chunk.z);
      }
    });
  }

  updateLoadedChunks() {
    const { dataChunks, renderChunks } = this;
    const center = new Vector3(-0.5, -0.5, -0.5);
    const chunks = [];
    for (let key of dataChunks.keys()) {
      if (!renderChunks.has(key)) {
        const [x, y, z] = key.split(':');
        chunks.push(new Vector3(parseInt(x, 10), parseInt(y, 10), parseInt(z, 10)));
      }
    }
    chunks
      .sort((a, b) => (a.distanceTo(center) - b.distanceTo(center)))
      .forEach(({ x, y, z }) => this.loadChunk(x, y, z));
  }

  updateVolume(point, radius, value, color) {
    const { chunkSize, dataChunks, loading: { mesh: loading }, updateQueue: queue } = this;
    const hasQueuedUpdate = !!queue.size;
    this.worldToLocal(_origin.copy(point)).floor();
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
        this.saveChunk(key);
        queue.set(key, true);
        if (_voxel.x === 0) {
          queue.set(`${_chunk.x - 1}:${_chunk.y}:${_chunk.z}`, true);
        }
        if (_voxel.y === 0) {
          queue.set(`${_chunk.x}:${_chunk.y - 1}:${_chunk.z}`, true);
        }
        if (_voxel.z === 0) {
          queue.set(`${_chunk.x}:${_chunk.y}:${_chunk.z - 1}`, true);
        }
        if (_voxel.x === 0 && _voxel.y === 0 && _voxel.z === 0) {
          queue.set(`${_chunk.x - 1}:${_chunk.y - 1}:${_chunk.z - 1}`, true);
        }
        if (_voxel.x === 0 && _voxel.y === 0) {
          queue.set(`${_chunk.x - 1}:${_chunk.y - 1}:${_chunk.z}`, true);
        }
        if (_voxel.y === 0 && _voxel.z === 0) {
          queue.set(`${_chunk.x}:${_chunk.y - 1}:${_chunk.z - 1}`, true);
        }
        if (_voxel.x === 0 && _voxel.z === 0) {
          queue.set(`${_chunk.x - 1}:${_chunk.y}:${_chunk.z - 1}`, true);
        }
      }
    });
    if (!hasQueuedUpdate && queue.size) {
      // updateVolume can be called multiple times per frame
      // deferring this prevents duplicated chunk remeshing
      _queueMicrotask(() => {
        queue.forEach((v, key) => {
          if (loading.has(key)) {
            loading.get(key).abort = true;
            loading.delete(key);
          }
          const [x, y, z] = key.split(':');
          this.loadChunk(parseInt(x, 10), parseInt(y, 10), parseInt(z, 10));
        });
        queue.clear();
      });
    }
  }

  saveChunk(key) {
    const { dataChunks, saving, storage } = this;
    if (!storage || !storage.set || saving.has(key)) {
      return;
    }
    saving.set(key, true);
    setTimeout(() => {
      saving.delete(key);
      const data = dataChunks.get(key);
      if (data) {
        storage.set(key, data);
      }
    }, storage.saveInterval || 0);
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

World.chunkGrid = (() => {
  const grid = [];
  for (let z = 0; z < 2; z++) {
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        grid.push(new Vector3(x, y, z));
      }
    }
  }
  return grid;
})();

export default World;
