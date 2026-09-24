// AC-21: the test count the README, the submission text and the deck state must equal what vitest
// actually ran — and every test must pass. Runs in CI after `npm run verify`.
// Usage: node scripts/check-test-count.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'je-')), 'vitest.json');
try {
  execFileSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${out}`], { stdio: ['ignore', 'ignore', 'inherit'] });
} catch {
  // failures are reported below from the JSON
}
const r = JSON.parse(readFileSync(out, 'utf8'));
const stated = {
  'README first screen': /\*\*(\d+) tests\*\*/.exec(readFileSync('README.md', 'utf8'))?.[1],
  'README ## Tests': /^## Tests \((\d+)\)/m.exec(readFileSync('README.md', 'utf8'))?.[1],
  'SUBMISSION How to run': /-> (\d+) tests ->/.exec(readFileSync('docs/SUBMISSION.md', 'utf8'))?.[1],
  'Midnight deck': /(\d+)(?:<\/b>)?\s*개 테스트/.exec(readFileSync('docs/deck/deck.html', 'utf8'))?.[1],
};
const bad = Object.entries(stated).filter(([, n]) => Number(n) !== r.numTotalTests);
console.log(`vitest: ${r.numPassedTests}/${r.numTotalTests} passed; stated: ${JSON.stringify(stated)}`);
if (r.numPassedTests !== r.numTotalTests) {
  console.error(`FAIL: ${r.numTotalTests - r.numPassedTests} test(s) failing`);
  process.exit(1);
}
if (bad.length) {
  console.error(`FAIL: stated test count differs from the real run: ${bad.map(([k, n]) => `${k}=${n}`).join(', ')}`);
  process.exit(1);
}
console.log(`OK: ${r.numTotalTests} tests, every stated count matches`);
