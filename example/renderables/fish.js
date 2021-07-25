import {
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';

class Fish extends InstancedMesh {
  static setupGeometry() {
    Fish.geometry = new IcosahedronGeometry(1, 2);
  }

  static setupMaterial() {
    Fish.material = new MeshStandardMaterial();
  }

  constructor({
    anchor,
    world,
  }) {
    if (!Fish.geometry) {
      Fish.setupGeometry();
    }
    if (!Fish.material) {
      Fish.setupMaterial();
    }
    super(Fish.geometry, Fish.material, Fish.maxInstances);
    this.aux = {
      chunk: new Vector3(),
      direction: new Vector3(),
      dummy: new Object3D(),
      vector: new Vector3(),
      voxel: new Vector3(),
    };
    this.anchor = anchor;
    this.world = world;
    this.instances = [...Array(Fish.maxInstances)].map(() => ({
      from: new Vector3(),
      to: new Vector3(),
      fromDirection: new Vector3(),
      toDirection: new Vector3(),
      speed: 1 + Math.random(),
      step: 0,
    }));
    const color = new Color();
    this.instances.forEach((v, i) => this.setColorAt(i, color.setRGB(
      0.5 + Math.random(),
      0.5 + Math.random(),
      0.5 + Math.random()
    ).convertSRGBToLinear()));
    this.count = 0;
    this.receiveShadow = true;
    this.matrixAutoUpdate = false;
    this.instanceMatrix.setUsage(DynamicDrawUsage);
  }

  animate(animation) {
    const { aux: { dummy, vector }, anchor, instances } = this;
    if (this.count < Fish.maxInstances) {
      if (this.spawn(instances[this.count])) {
        this.count += 1;
      }
    }
    const { count } = this;
    for (let i = 0; i < count; i++) {
      const instance = instances[i];
      instance.step += animation.delta * instance.speed;
      dummy.position.lerpVectors(instance.from, instance.to, Math.min(instance.step, 1));
      dummy.scale.setScalar(3 - instance.speed);
      dummy.lookAt(vector.lerpVectors(instance.fromDirection, instance.toDirection, Math.min(instance.step, 1)).add(dummy.position));
      dummy.updateMatrix();
      this.setMatrixAt(
        i,
        dummy.matrix
      );
      if (instance.step >= 1) {
        if (dummy.position.distanceTo(anchor) > Fish.radius || !this.destination(instance)) {
          this.spawn(instance);
        }
      }
    }
    this.instanceMatrix.needsUpdate = true;
  }

  test(position, direction) {
    const { aux: { chunk, vector, voxel }, world } = this;
    const { chunkSize } = world;
    world.worldToLocal(vector.addVectors(position, direction)).floor();
    for (let z = 1; z >= 0; z--) {
      for (let y = 1; y >= 0; y--) {
        for (let x = 1; x >= 0; x--) {
          voxel.set(vector.x + x, vector.y + y, vector.z + z);
          chunk.copy(voxel).divideScalar(chunkSize).floor();
          voxel.addScaledVector(chunk, -chunkSize).floor();
          const data = world.dataChunks.get(`${chunk.x}:${chunk.y}:${chunk.z}`);
          if (
            !data || data[(voxel.z * chunkSize * chunkSize + voxel.y * chunkSize + voxel.x) * 4] >= 0x80
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  spawn(instance) {
    const { aux: { chunk, direction, vector, voxel }, anchor, world } = this;
    let attempt = 0;
    do {
      if (attempt++ > 10) {
        return false;
      }
      const radius = Fish.radius * (0.5 + Math.random() * 0.5);
      direction.copy(instance.toDirection)
        .add(
          vector.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        )
        .normalize()
        .multiply({ x: radius, y: radius * 0.5, z: radius });
    } while (!this.test(anchor, direction));
    const { chunkSize } = world;
    instance.toDirection.copy(direction.normalize());
    instance.to.set(
      chunk.x * chunkSize + voxel.x,
      chunk.y * chunkSize + voxel.y,
      chunk.z * chunkSize + voxel.z
    );
    return this.destination(instance);
  }

  destination(instance) {
    const { aux: { chunk, direction, vector, voxel }, world } = this;
    let attempt = 0;
    do {
      if (attempt++ > 10) {
        return false;
      }
      direction.copy(instance.toDirection);
      if (attempt > 5) {
        direction.negate();
      }
      direction
        .add(
          vector.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        )
        .normalize()
        .multiplyScalar(2 + Math.random() * 2);
    } while (!this.test(instance.to, direction));
    const { chunkSize } = world;
    instance.fromDirection.copy(instance.toDirection);
    instance.from.copy(instance.to);
    instance.toDirection.copy(direction.normalize());
    instance.to.set(
      chunk.x * chunkSize + voxel.x,
      chunk.y * chunkSize + voxel.y,
      chunk.z * chunkSize + voxel.z
    );
    instance.step = 0;
    return true;
  }
}

Fish.maxInstances = 256;
Fish.radius = 96;

export default Fish;
