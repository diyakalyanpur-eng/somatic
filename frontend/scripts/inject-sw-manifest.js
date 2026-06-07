#!/usr/bin/env node
/**
 * Post-build: inject the hashed Vite asset paths into dist/sw.js SHELL array
 * so the service worker pre-caches every chunk on install.
 *
 * Runs automatically after `vite build` via the npm build script.
 * Written as CommonJS so it works without "type":"module" in package.json.
 */

const fs   = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "../dist");

// All generated Vite asset files (hashed JS/CSS chunks)
const assetFiles = fs.readdirSync(path.join(DIST, "assets"))
  .map((f) => `/assets/${f}`);

// Static files that are always present regardless of build hash
const staticFiles = [
  "/",
  "/manifest.json",
  "/aisteth.html",
  "/heartsize.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/aisteth/main.js",
  "/aisteth/rppg.js",
  "/aisteth/cardiac-glyph.js",
  "/aisteth/heartbeat.js",
  "/aisteth/handtrack.js",
];

const allFiles = [...staticFiles, ...assetFiles];

// Read the generated sw.js
const swPath = path.join(DIST, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");

// Bump cache version so stale caches are busted on every deploy
const newVersion = "somatic-v" + Date.now();
sw = sw.replace(/const CACHE = "somatic-v\d+";/, `const CACHE = "${newVersion}";`);

// Replace the SHELL array with the full asset manifest
const shellStr = "const SHELL = " + JSON.stringify(allFiles, null, 2) + ";";
sw = sw.replace(/const SHELL = \[[\s\S]*?\];/, shellStr);

fs.writeFileSync(swPath, sw);
console.log("SW manifest injected: " + allFiles.length + " files, cache=" + newVersion);
