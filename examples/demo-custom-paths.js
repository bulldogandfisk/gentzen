import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// You can point runGentzenReasoning at any scenario file and any resolver
// directory. Inline customResolvers stack on top — caller-supplied resolvers
// win over same-named discovered ones.
//
const results = await runGentzenReasoning(
    join(WD, './demo-custom/my-scenarios/simple-test.yaml'),
    {
        resolversPath: join(WD, './demo-custom/my-resolvers'),
        customResolvers: { CustomTestFact: () => true }
    }
);

displayStory(results, {
    description: 'Custom scenario and resolver directory paths, plus an inline override.'
});
