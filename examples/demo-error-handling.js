import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.ERROR } });

const WD = import.meta.dirname;

// Each block exercises a different failure mode. The engine throws on
// scenario-load failures; runtime failures (missing resolver directory,
// missing facts) surface in the result object instead of throwing.
//

console.log('Case 1: scenario file does not exist (engine throws)');
try {
    await runGentzenReasoning('./non-existent-scenario.yaml');
    console.log('  unexpected: no error thrown');
} catch (error) {
    console.log(`  caught: ${error.message}`);
}

console.log('\nCase 2: invalid YAML syntax (engine throws)');
try {
    await runGentzenReasoning(
        join(WD, '../tests/scenarios/test-scenarios/invalid-syntax.yaml')
    );
    console.log('  unexpected: no error thrown');
} catch (error) {
    console.log(`  caught: ${error.message}`);
}

console.log('\nCase 3: resolvers path does not exist (engine continues with empty fact set)');
try {
    const results = await runGentzenReasoning(
        join(WD, './scenarios/mixed-scenario.yaml'),
        { resolversPath: './non-existent-path' }
    );
    console.log(`  ran cleanly: ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven, ${results.summary.missingFacts} missing facts`);
} catch (error) {
    console.log(`  unexpected error: ${error.message}`);
}

console.log('\nCase 4: scenario references facts no resolver provides (engine reports missing facts)');
const results = await runGentzenReasoning(
    join(WD, '../tests/scenarios/test-scenarios/missing-facts.yaml'),
    { resolversPath: join(WD, '../tests/scenarios/test-resolvers') }
);
displayStory(results, {
    description: 'Missing facts surface in target.missingFacts and skippedSteps with reason="missing_fact".'
});
