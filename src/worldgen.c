#define FNL_IMPL
#include "../vendor/FastNoiseLite/C/FastNoiseLite.h"

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
        chunk[i].value = (
          0xFF - (fabs(fnlGetNoise3D(&noise, x * 1.5f, y * 1.5f, z * 1.5f)) * 0xFF)
        );
        setColorFromNoise(
          &chunk[i],
          fabs(fnlGetNoise3D(&noise, z, x, y)) * 0xFF
        );
      }
    }
  }
}
