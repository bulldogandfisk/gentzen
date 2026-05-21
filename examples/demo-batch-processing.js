import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// Three scenarios run sequentially. Each prints its own narrative;
// a final aggregate summarises proven targets across the batch.
//
const scenarios = [
    {
        name: 'Mixed business and system rules',
        path: join(WD, './scenarios/mixed-scenario.yaml'),
        resolversPath: join(WD, './resolvers')
    },
    {
        name: 'Pure structural reasoning',
        path: join(WD, './scenarios/scenario-no-facts.yaml'),
        resolversPath: null
    },
    {
        name: 'System monitoring',
        path: join(WD, './scenarios/system-scenario.yaml'),
        resolversPath: join(WD, './resolvers')
    }
];

let totalProven = 0;
let totalTargets = 0;
const failures = [];

for (const scenario of scenarios) {
    const options = scenario.resolversPath ? { resolversPath: scenario.resolversPath } : {};
    try {
        const result = await runGentzenReasoning(scenario.path, options);
        displayStory(result, { description: scenario.name });
        totalProven += result.summary.provenTargets;
        totalTargets += result.summary.totalTargets;
    } catch (error) {
        failures.push({ name: scenario.name, error: error.message });
    }
}

console.log('Batch aggregate');
console.log(`  scenarios:        ${scenarios.length - failures.length}/${scenarios.length} ran cleanly`);
console.log(`  targets proven:   ${totalProven}/${totalTargets} across the batch`);
if (failures.length > 0) {
    console.log('  failures:');
    for (const f of failures) {
        console.log(`    ${f.name}: ${f.error}`);
    }
}
