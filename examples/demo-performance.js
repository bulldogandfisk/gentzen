import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

const scenarioPath = join(WD, './scenarios/mixed-scenario.yaml');
const resolversPath = join(WD, './resolvers');

// First run prints the narrative so you know what is being measured.
//
const firstRun = await runGentzenReasoning(scenarioPath, { resolversPath });
displayStory(firstRun, {
    description: 'Performance demo — first run shown for context, then four more for timing.'
});

// Four additional runs to gather timing samples.
//
const samples = [];
for (let i = 0; i < 4; i += 1) {
    const t0 = performance.now();
    await runGentzenReasoning(scenarioPath, { resolversPath });
    samples.push(performance.now() - t0);
}

const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
const min = Math.min(...samples);
const max = Math.max(...samples);

console.log(`Timing (4 additional runs)`);
console.log(`  avg: ${avg.toFixed(2)}ms`);
console.log(`  min: ${min.toFixed(2)}ms`);
console.log(`  max: ${max.toFixed(2)}ms`);
console.log(`See benchmarks/proof-search.js for the systematic benchmark.`);
