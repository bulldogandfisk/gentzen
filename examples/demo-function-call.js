import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// runGentzenReasoning returns a structured result object. displayStory
// renders it as a narrative; the same object is what your application code
// would consume programmatically (results.targets, results.summary, etc.).
//
const results = await runGentzenReasoning(
    join(WD, './scenarios/mixed-scenario.yaml'),
    { resolversPath: join(WD, './resolvers') }
);

displayStory(results, {
    description: 'Reasoning and display are separate calls. The result object is the public API.'
});
