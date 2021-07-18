import fs from 'fs';
import path from 'path';
import copy from 'rollup-plugin-copy';
import { terser } from 'rollup-plugin-terser';
import wasm from '@rollup/plugin-wasm';
import webWorkerLoader from 'rollup-plugin-web-worker-loader';

const outputPath = path.resolve(__dirname, 'dist');

export default {
  input: path.join(__dirname, 'src', 'world.js'),
  output: {
    file: path.join(outputPath, 'softxels.js'),
    format: 'esm',
  },
  plugins: [
    wasm({
      maxFileSize: Infinity,
    }),
    webWorkerLoader({
      forceInline: true,
      skipPlugins: ['copy'],
    }),
    copy({
      targets: [
        { src: 'LICENSE', dest: 'dist' },
        { src: 'README.md', dest: 'dist' },
      ],
      copyOnce: !process.env.ROLLUP_WATCH,
    }),
    {
      writeBundle() {
        fs.writeFileSync(path.join(outputPath, 'package.json'), JSON.stringify({
          name: 'softxels',
          author: 'Daniel Esteban Nombela',
          license: 'MIT',
          module: 'softxels.js',
          version: '0.0.8',
          homepage: 'https://softxels.gatunes.com',
          repository: {
            type: 'git',
            url: 'https://github.com/danielesteban/softxels',
          },
          dependencies: {
            three: '^0.130.1',
          },
        }, null, '  '));
      },
    },
    ...(!process.env.ROLLUP_WATCH ? [
      terser(),
    ] : []),
  ],
  external: ['three'],
  watch: { clearScreen: false },
};
