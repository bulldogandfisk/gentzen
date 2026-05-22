import { join } from 'node:path';
import { runGentzenReasoning, displayResults } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// Scenarios that declare propositions and inference rules can run without
// any external resolvers. Useful for pure-logic demos and structural tests.
//
const results = await runGentzenReasoning(
    join(WD, './scenarios/scenario-no-facts.yaml')
);

displayResults(results, {
    mode: 'narrative',
    description: 'No external resolvers — propositions and structural rules only.'
});
