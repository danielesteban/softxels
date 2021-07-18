import fs from 'fs';
import path from 'path';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import livereload from 'rollup-plugin-livereload';
import resolve from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import { terser } from 'rollup-plugin-terser';

const outputPath = path.resolve(__dirname, 'dist');

export default {
  input: path.join(__dirname, 'main.js'),
  output: {
    dir: outputPath,
    format: 'iife',
  },
  plugins: [
    ...(process.env.ROLLUP_WATCH ? [
      alias({
        entries: { 'softxels': path.join(__dirname, '..', 'dist') },
      }),
    ] : []),
    commonjs(),
    resolve({
      browser: true,
      moduleDirectories: [path.join(__dirname, 'node_modules')],
    }),
    copy({
      targets: [
        { src: 'index.*', dest: 'dist' },
        { src: 'screenshot.png', dest: 'dist' },
        { src: 'sounds/*.ogg', dest: 'dist/sounds' },
      ],
      copyOnce: !process.env.ROLLUP_WATCH,
    }),
    ...(process.env.ROLLUP_WATCH ? [
      serve({
        contentBase: outputPath,
        port: 8080,
      }),
      livereload(outputPath),
    ] : [
      terser(),
      {
        writeBundle() {
          fs.writeFileSync(path.join(outputPath, 'CNAME'), 'softxels.gatunes.com');
        },
      },
    ]),
  ],
  watch: { clearScreen: false },
};
