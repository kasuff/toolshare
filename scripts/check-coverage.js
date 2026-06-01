#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/check-coverage.js <coverage-dir> [line%] [branch%] [functions%]');
  process.exit(2);
}

const coverageDir = args[0];
const thresholds = {
  lines: args[1] ? Number(args[1]) : 85,
  branches: args[2] ? Number(args[2]) : 75,
  functions: args[3] ? Number(args[3]) : 80,
};

function parseLcov(fileContent) {
  const lines = fileContent.split(/\r?\n/);
  let LF = 0, LH = 0, FNF = 0, FNH = 0, BRF = 0, BRH = 0;
  for (const l of lines) {
    if (l.startsWith('LF:')) LF += Number(l.split(':')[1] || 0);
    if (l.startsWith('LH:')) LH += Number(l.split(':')[1] || 0);
    if (l.startsWith('FNF:')) FNF += Number(l.split(':')[1] || 0);
    if (l.startsWith('FNH:')) FNH += Number(l.split(':')[1] || 0);
    if (l.startsWith('BRF:')) BRF += Number(l.split(':')[1] || 0);
    if (l.startsWith('BRH:')) BRH += Number(l.split(':')[1] || 0);
  }
  return { LF, LH, FNF, FNH, BRF, BRH };
}

function percent(hit, total) {
  if (!total || total === 0) return 100;
  return (hit / total) * 100;
}

const lcovPath = path.join(process.cwd(), coverageDir, 'lcov.info');
if (!fs.existsSync(lcovPath)) {
  console.error(`Coverage file not found: ${lcovPath}`);
  process.exit(2);
}

const content = fs.readFileSync(lcovPath, 'utf8');
const sums = parseLcov(content);

const linesPct = percent(sums.LH, sums.LF);
const branchesPct = percent(sums.BRH, sums.BRF);
const functionsPct = percent(sums.FNH, sums.FNF);

console.log(`Coverage summary for ${coverageDir}:`);
console.log(`  Lines:     ${linesPct.toFixed(2)}% (${sums.LH}/${sums.LF})`);
console.log(`  Branches:  ${branchesPct.toFixed(2)}% (${sums.BRH}/${sums.BRF})`);
console.log(`  Functions: ${functionsPct.toFixed(2)}% (${sums.FNH}/${sums.FNF})`);

let ok = true;
if (linesPct < thresholds.lines) {
  console.error(`Line coverage ${linesPct.toFixed(2)}% is below threshold ${thresholds.lines}%`);
  ok = false;
}
if (branchesPct < thresholds.branches) {
  console.error(`Branch coverage ${branchesPct.toFixed(2)}% is below threshold ${thresholds.branches}%`);
  ok = false;
}
if (functionsPct < thresholds.functions) {
  console.error(`Function coverage ${functionsPct.toFixed(2)}% is below threshold ${thresholds.functions}%`);
  ok = false;
}

if (!ok) process.exit(1);
console.log('Coverage thresholds met.');
process.exit(0);
