#!/usr/bin/env node
import Blob from 'fetch-blob';
import { readFile, writeFile } from 'fs';
import yargs from 'yargs';
import { deflateRaw } from 'zlib';
import {
  parse,
  voxelize,
  chunk,
  pack,
} from './module.mjs';

global.Blob = Blob; // Required for the PLYLoader

const run = (message, run) => (...args) => {
  if (Array.isArray(message)) {
    const [template, vars] = message;
    console.log(template, ...vars(...args));
  } else {
    console.log(message);
  }
  return run(...args);
};

const read = (input) => new Promise((resolve, reject) => (
  readFile(input, (err, buffer) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(buffer.buffer);
  })
));

const write = ({ buffer, output }) => new Promise((resolve, reject) => (
  writeFile(output, buffer, (err) => {
    if (err) {
      reject(err);
      return;
    }
    resolve();
  })
));

console.log(`
                  ▄▄▄▄                           ▄▄         
                ▄█▀ ▀▀ ██                      ▀███         
                ██▀    ██                        ██         
▄██▀███ ▄██▀██▄ █████ ██████▀██▀   ▀██▀ ▄▄█▀██   ██  ▄██▀███
██   ▀▀██▀   ▀██ ██     ██    ▀██ ▄█▀  ▄█▀   ██  ██  ██   ▀▀
▀█████▄██     ██ ██     ██      ███    ██▀▀▀▀▀▀  ██  ▀█████▄
█▄   ████▄   ▄██ ██     ██    ▄█▀ ██▄  ██▄    ▄  ██  █▄   ██
██████▀ ▀█████▀▄████▄   ▀██████▄   ▄██▄ ▀█████▀▄████▄██████▀
`);

const { chunkSize, gain, grid, input, output, resolution, rotateX, rotateY, rotateZ } = yargs(process.argv)
  .scriptName('softxels-voxelizer')
  .usage('Usage:\n  $0 -i "input.ply" -o "output.bin"')
  .option('input', {
    alias: 'i',
    type: 'string',
    description: 'Input file',
    demandOption: 'Input file is required.',
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output file',
    demandOption: 'Output file is required.',
  })
  .option('chunkSize', {
    alias: 'c',
    type: 'number',
    description: 'Chunk size',
    default: 32,
  })
  .option('gain', {
    alias: 'g',
    type: 'number',
    description: 'Sample gain',
    default: 1.7,
  })
  .option('grid', {
    alias: 's',
    type: 'number',
    description: 'Sample grid',
    default: 1,
  })
  .option('resolution', {
    alias: 'r',
    type: 'number',
    description: 'Resolution',
    default: 10,
  })
  .option('rotateX', {
    alias: 'x',
    type: 'number',
    description: 'Input rotation',
    default: -90,
  })
  .option('rotateY', {
    alias: 'y',
    type: 'number',
    description: 'Input rotation',
    default: 0,
  })
  .option('rotateZ', {
    alias: 'z',
    type: 'number',
    description: 'Input rotation',
    default: 0,
  })
  .parse();

const t = 'Total time';
console.time(t);
run('Reading input file', () => read(input))()
  .then(run('Parsing point cloud', (buffer) => parse({ buffer, rotateX, rotateY, rotateZ })))
  .then(run(
    ['Merging %s points into voxels\nThe resulting volume will be %dx%dx%d', (geometry) => [
      geometry.getAttribute('position').count.toLocaleString(),
      Math.round(geometry.boundingBox.size.x * resolution),
      Math.round(geometry.boundingBox.size.y * resolution),
      Math.round(geometry.boundingBox.size.z * resolution),
    ]],
    (geometry) => voxelize({ geometry, gain, grid, resolution })
  ))
  .then(run('Generating chunk data', (voxels) => chunk({ chunkSize, voxels })))
  .then(run(
    ['Packing %d chunks', (chunks) => [chunks.size]],
    (chunks) => pack({ chunks, deflate: deflateRaw })
  ))
  .then(run('Writing output file', (buffer) => write({ buffer, output })))
  .then(() => {
    console.timeEnd(t);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
