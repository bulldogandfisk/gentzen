import { join } from 'node:path';
import { runGentzenReasoning, displayResults } from '../main.js';

const WD = import.meta.dirname;

try {
    // Run reasoning with explicit resolver path and selective resolution for performance
    const results = await runGentzenReasoning(
        join(WD, './scenarios/mixed-scenario.yaml'),
        {
            resolversPath: join(WD, './resolvers'),
            selectiveResolution: true
        }
    );

    displayResults(results);
    
} catch (error) {
    console.error('Test failed:', error.message);
}
