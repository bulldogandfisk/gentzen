import { join } from 'node:path';
import { runGentzenReasoning, displayResults } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// Exercises double-negation elimination (~~A → A) and contraposition
// ((A → B) → (~B → ~A)) on a scenario with negated facts and implications.
//
const customResolvers = {
    UserIsAdmin: () => true,
    SystemSecure: () => true,
    DatabaseConnected: () => true
};

const results = await runGentzenReasoning(
    join(WD, './scenarios/advanced-negation.yaml'),
    { customResolvers }
);

displayResults(results, {
    mode: 'narrative',
    description: 'Double negation elimination and contraposition in action.'
});
