import { join } from 'node:path';
import { runGentzenReasoning, displayStory } from '../main.js';
import { updateConfig } from '../utilities/config.js';
import { LogLevel } from '../utilities/logger.js';

updateConfig({ logging: { level: LogLevel.WARN } });

const WD = import.meta.dirname;

// Resolvers that return false are surfaced as `~Atom` in available facts.
// Here, UserHasPermission=false becomes ~UserHasPermission, which the
// scenario can then reason over directly.
//
const customResolvers = {
    UserIsLoggedIn: () => true,
    UserHasPermission: () => false,
    UserIsGuest: () => true,
    SecurityCheckPassed: () => true,
    MaintenanceMode: () => false,
    SystemIsOffline: () => false
};

const results = await runGentzenReasoning(
    join(WD, './scenarios/negation-demo.yaml'),
    { customResolvers }
);

displayStory(results, {
    description: 'Negation and auto-negation: falsy resolvers become ~Atom facts.'
});
