import { join } from 'node:path';
import { runGentzenReasoning, displayResults } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// selectiveResolution (default true) runs only the resolvers whose atom
// names appear in the scenario. For a directory of many resolvers and
// a small scenario, this is the dominant performance win.
//
const results = await runGentzenReasoning(
    join(WD, './scenarios/mixed-scenario.yaml'),
    {
        resolversPath: join(WD, './resolvers'),
        selectiveResolution: true
    }
);

displayResults(results, {
    mode: 'narrative',
    description: 'Selective resolution: only resolvers referenced by the scenario run.'
});
