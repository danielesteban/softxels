#define FNL_IMPL
#include "./fastnoise.h"

static const unsigned int getColorFromNoise(unsigned char noise) {
  noise = 255 - noise;
  if (noise < 85) {
    return (
      ((255 - noise * 3) << 16)
      | (0 << 8)
      | (noise * 3)
    );
  }
  if (noise < 170) {
    noise -= 85;
    return (
      (0 << 16)
      | ((noise * 3) << 8)
      | (255 - noise * 3)
    );
  }
  noise -= 170;
  return (
    ((noise * 3) << 16)
    | ((255 - noise * 3) << 8)
    | 0
  );
}

void run(
  unsigned char* chunk,
  unsigned char chunkSize,
  const int seed,
  int chunkX,
  int chunkY,
  int chunkZ
) {
  fnl_state noise = fnlCreateState();
  noise.seed = seed;
  noise.fractal_type = FNL_FRACTAL_FBM;
  chunkX *= chunkSize;
  chunkY *= chunkSize;
  chunkZ *= chunkSize;
  for (int i = 0, z = chunkZ; z < chunkZ + chunkSize; z++) {
    for (int y = chunkY; y < chunkY + chunkSize; y++) {
      for (int x = chunkX; x < chunkX + chunkSize; x++, i += 4) {
        const unsigned int color = getColorFromNoise(
          fabs(fnlGetNoise3D(&noise, z, x, y)) * 255
        );
        chunk[i] = 255 - (fabs(fnlGetNoise3D(&noise, x * 1.5f, y * 1.5f, z * 1.5f)) * 255);
        chunk[i + 1] = (int) (color >> 16) & 0xFF;
        chunk[i + 2] = (int) (color >> 8) & 0xFF;
        chunk[i + 3] = (int) (color & 0xFF);
      }
    }
  }
}
