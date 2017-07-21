#!/usr/bin/env bash

cyclus_clean() {
    echo "Remove dist"
    rm -rf dist
}

cyclus_compile() {
    echo "Compiling target $1"
    tsc  --target $1 --outDir dist/$1
}

cyclus_webpack_compile() {
    echo "Compiling webpack"
    webpack --config webpack.config.js
}

cyclus_clean
cyclus_compile es5
cyclus_compile es6
cyclus_compile esnext
cyclus_webpack_compile
