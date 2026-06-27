#!/usr/bin/env node
/**
 * Validates environment before the server starts.
 * - Fails fast when required runtime env vars are unset.
 * - Ensures every env var referenced in src/ is documented in .env.example.
 *
 * Run with: node scripts/validate-env.js
 * Wired into npm start/dev via prestart/predev lifecycle hooks.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const REQUIRED = ['CONTRACT_ID', 'JWT_SECRET'];

const missingRequired = REQUIRED.filter((key) => !process.env[key]);
if (missingRequired.length) {
  console.error('Missing required environment variables:');
  missingRequired.forEach((key) => console.error(`  ${key}`));
  process.exit(1);
}

const examplePath = path.resolve(__dirname, '../.env.example');
const exampleKeys = new Set(
  fs
    .readFileSync(examplePath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=')[0].trim())
);

const srcFiles = fs
  .readdirSync(path.resolve(__dirname, '../src'), { recursive: true })
  .filter((f) => f.endsWith('.ts'))
  .map((f) => path.resolve(__dirname, '../src', f));

const undocumented = [];
for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const codeOnly = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
  const matches = [...codeOnly.matchAll(/process\.env\.([A-Z_]+)/g)];
  for (const [, key] of matches) {
    if (!exampleKeys.has(key)) undocumented.push({ key, file });
  }
}

if (undocumented.length) {
  console.error('Missing from .env.example:');
  undocumented.forEach(({ key, file }) => console.error(`  ${key}  (${file})`));
  process.exit(1);
}

console.log('Environment validation passed ✓');
