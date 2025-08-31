import { join } from 'node:path';
import { runGentzenReasoning } from '../main.js';

const WD = import.meta.dirname;

console.log('🧪 Minimal example - just the basics...\n');

// Simplest possible usage
const results = await runGentzenReasoning(
    join(WD, './scenarios/mixed-scenario.yaml'),
    { resolversPath: join(WD, './resolvers') }
);

console.log(`✅ ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);