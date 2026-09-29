// Holder side of UC-7, run on the student's own device: make the 32-byte secret (keep it, never send it)
// and print holderKey(secret), the only value to hand the registrar (the CSV's holder_key column).
// Usage: npm run holder:key
import { cryptoRandom, holderKeyOf } from '../src/adapters/simulator/commitment';

const secret = cryptoRandom.bytes32();
console.log(JSON.stringify({ keepPrivate: { secret }, handToRegistrar: { holder_key: holderKeyOf(secret) } }, null, 1));
