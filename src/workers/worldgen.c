#define FNL_IMPL
#include "../../vendor/FastNoiseLite/C/FastNoiseLite.h"

fnl_state noise;

typedef struct {
  unsigned char value;
  unsigned char r;
  unsigned char g;
  unsigned char b;
} Voxel;

static void setColorFromNoise(
  Voxel* voxel,
  unsigned char noise
) {
  noise = 255 - noise;
  if (noise < 85) {
    voxel->r = (255 - noise * 3);
    voxel->g = 0;
    voxel->b = noise * 3;
    return;
  }
  if (noise < 170) {
    noise -= 85;
    voxel->r = 0;
    voxel->g = noise * 3;
    voxel->b = 255 - noise * 3;
    return;
  }
  noise -= 170;
  voxel->r = noise * 3;
  voxel->g = 255 - noise * 3;
  voxel->b = 0;
}

void run(
  Voxel* chunk,
  unsigned char chunkSize,
  unsigned char generator,
  const int seed,
  int chunkX,
  int chunkY,
  int chunkZ
) {
  noise = fnlCreateState();
  noise.seed = seed;
  noise.fractal_type = FNL_FRACTAL_FBM;
  chunkX *= chunkSize;
  chunkY *= chunkSize;
  chunkZ *= chunkSize;
  for (int i = 0, z = chunkZ; z < chunkZ + chunkSize; z++) {
    for (int y = chunkY; y < chunkY + chunkSize; y++) {
      for (int x = chunkX; x < chunkX + chunkSize; x++, i++) {
        switch (generator) {
          default:
          case 0: // default
            chunk[i].value = (
              fmin(fabs(fnlGetNoise3D(&noise, x * 1.5f, y * 1.5f, z * 1.5f)) * 384.0f, 255.0f)
            );
          break;
          case 1: // terrain
            chunk[i].value = (
              fmin(fmax(64.0f + fabs(fnlGetNoise3D(&noise, x * 0.75f, y * 0.75f, z * 0.75f)) * 96.0f - y, 0.0f), 255.0f)
            );
            break;
        }
        setColorFromNoise(
          &chunk[i],
          fabs(fnlGetNoise3D(&noise, z, x, y)) * 0xFF
        );
      }
    }
  }
}
