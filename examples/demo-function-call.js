import { join } from 'node:path';
import { runGentzenReasoning, displayResults } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// runGentzenReasoning returns a structured result object. displayResults
// renders it (in 'narrative' mode here); the same object is what your application code
// would consume programmatically (results.targets, results.summary, etc.).
//
const results = await runGentzenReasoning(
    join(WD, './scenarios/mixed-scenario.yaml'),
    { resolversPath: join(WD, './resolvers') }
);

displayResults(results, {
    mode: 'narrative',
    description: 'Reasoning and display are separate calls. The result object is the public API.'
});
