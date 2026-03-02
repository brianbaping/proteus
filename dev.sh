#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Installing dependencies..."
npm install

echo "Building shared..."
npm run build -w @proteus-forge/shared

echo "Building CLI..."
npm run build -w @proteus-forge/cli

echo "Starting GUI..."
npm run dev -w @proteus-forge/gui
