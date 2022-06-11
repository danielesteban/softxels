#!/usr/bin/env node
import Blob from 'fetch-blob';
import { readFile, writeFile } from 'fs';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
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

const { input, output, chunkSize, resolution } = yargs(hideBin(process.argv))
  .option('input', {
    alias: 'i',
    type: 'string',
    description: 'Input PLY'
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output BIN'
  })
  .option('chunkSize', {
    alias: 'c',
    type: 'number',
    description: 'Chunk size',
    default: 32,
  })
  .option('resolution', {
    alias: 'r',
    type: 'number',
    description: 'Resolution',
    default: 1,
  })
  .parse();

if (!input || !output) {
  console.log('Usage:');
  console.log('-i "input.ply" -o "output.bin"');
  process.exit(1);
}

const t = 'Total time';
console.time(t);
run('Reading input file', () => read(input))()
  .then(run('Parsing point cloud', parse))
  .then(run(
    ['Merging %s points into voxels\nThe resulting volume will be %dx%dx%d', (geometry) => [
      geometry.getAttribute('position').count.toLocaleString(),
      Math.round(geometry.boundingBox.size.x * resolution),
      Math.round(geometry.boundingBox.size.y * resolution),
      Math.round(geometry.boundingBox.size.z * resolution),
    ]],
    (geometry) => voxelize({ geometry, resolution })
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
