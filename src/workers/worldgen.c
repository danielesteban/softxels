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
  const float noise
) {
  const float h = noise;
  const float s = 0.8f;
  const float v = 1.0f;
  
  const int i = floor(h * 6);
  const float f = h * 6 - i;
  const float p = v * (1 - s);
  const float q = v * (1 - f * s);
  const float t = v * (1 - (1 - f) * s);
  
  float r, g, b;
  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }

  voxel->r = r * 0xFF;
  voxel->g = g * 0xFF;
  voxel->b = b * 0xFF;
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
              fmin(fmax(64.0f + fabs(fnlGetNoise3D(&noise, x * 0.75f, y * 0.75f, z * 0.75f)) * 128.0f - y, 0.0f), 255.0f)
            );
            break;
        }
        setColorFromNoise(
          &chunk[i],
          fmod(fnlGetNoise3D(&noise, z * 0.25f, x * 0.25f, y * 0.25f) + 1.0f, 1.0f)
        );
      }
    }
  }
}
