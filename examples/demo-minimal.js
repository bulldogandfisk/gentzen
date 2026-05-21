import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

const results = await runGentzenReasoning(
    join(WD, './scenarios/mixed-scenario.yaml'),
    { resolversPath: join(WD, './resolvers') }
);

displayStory(results, {
    description: 'The smallest possible Gentzen call: one scenario, one resolver directory.'
});
