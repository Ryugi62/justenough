// UC-7 CLI — a registrar turns its CSV export into (1) the public commitments to issue and (2) one private
// bundle per holder. Usage: npm run issue:batch -- <registrar.csv> <outDir>
// Publish only <outDir>/commitments.json; deliver <outDir>/holders/<ref>.json to each holder privately.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRegistrarCsv } from '../src/domain/registrar';
import { issueBatch } from '../src/application/issue-batch';
import { contractCommitmentHasher, cryptoRandom } from '../src/adapters/simulator/commitment';

const [csvPath, outDir] = process.argv.slice(2);
if (!csvPath || !outDir) {
  console.error('usage: npm run issue:batch -- <registrar.csv> <outDir>');
  process.exit(64);
}
const { records, errors } = parseRegistrarCsv(readFileSync(csvPath, 'utf8'));
for (const e of errors) console.error(`line ${e.line}: ${e.reason} (not issued)`);
const t = performance.now();
const out = issueBatch(records, contractCommitmentHasher, cryptoRandom);
const ms = performance.now() - t;
mkdirSync(join(outDir, 'holders'), { recursive: true });
writeFileSync(join(outDir, 'commitments.json'), JSON.stringify({ count: out.publicCommitments.length, commitments: out.publicCommitments }, null, 1) + '\n');
for (const b of out.bundles) writeFileSync(join(outDir, 'holders', `${b.holderRef}.json`), JSON.stringify(b, null, 1) + '\n', { mode: 0o600 });
console.log(`${records.length} issued · ${errors.length} rejected · ${ms.toFixed(0)} ms → publish ${join(outDir, 'commitments.json')}; deliver ${join(outDir, 'holders')}/* privately`);
process.exit(errors.length ? 2 : 0);
