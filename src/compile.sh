#!/bin/sh
cd "${0%/*}"
clang --target=wasm32-unknown-wasi --sysroot=../vendor/wasi-libc/sysroot -nostartfiles -flto -Ofast \
-Wl,--import-memory -Wl,--no-entry -Wl,--lto-O3 \
-Wl,--export=malloc \
-Wl,--export=run \
-o ./${1}.wasm ${1}.c
