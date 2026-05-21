import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// Resolvers passed inline via options.customResolvers. No disk discovery,
// no resolversPath needed. Each value can be a function or a boolean-coercible value.
//
const customResolvers = {
    IsBusinessDay: () => {
        const dayOfWeek = new Date().getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    },
    IsWorkingHours: () => {
        const hour = new Date().getHours();
        return hour >= 9 && hour <= 17;
    },
    DatabaseConnected: () => true,
    ServicesHealthy: () => true,
    ShouldProcessPayments: () =>
        customResolvers.IsBusinessDay() &&
        customResolvers.IsWorkingHours() &&
        customResolvers.ServicesHealthy()
};

const results = await runGentzenReasoning(
    join(WD, './scenarios/mixed-scenario.yaml'),
    { customResolvers }
);

displayStory(results, {
    description: 'Resolvers supplied inline via options.customResolvers (no disk discovery).'
});
