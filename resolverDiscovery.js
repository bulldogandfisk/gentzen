import { pathToFileURL } from 'node:url';
import fg from 'fast-glob';
import { createLogger } from './utilities/logger.js';
import { getConfigSection } from './utilities/config.js';

// Discover all .js files in a directory using fast-glob
// Handles symlink safety and depth limiting automatically.
//
async function discoverJSFiles(dirPath, logger = null) {
    try {
        const pattern = `${dirPath}/**/*.js`;
        const jsFiles = await fg(pattern, {
            followSymbolicLinks: false,
            absolute: true,
            onlyFiles: true,
            deep: 10,
            ignore: ['**/node_modules/**', '**/.git/**']
        });
        return jsFiles;
    } catch (error) {
        if (logger) {
            logger.warn(`Could not read directory ${dirPath}: ${error.message}`);
        }
        return [];
    }
}

async function loadResolversFromFiles(jsFiles, logger = null) {
    const allResolvers = {};
    const loadedFiles = [];
    const errors = [];

    for (const filePath of jsFiles) {
        try {
            const fileUrl = pathToFileURL(filePath).href;
            const module = await import(fileUrl);

            const moduleResolvers = extractResolverFunctions(module);

            if (Object.keys(moduleResolvers).length > 0) {
                Object.assign(allResolvers, moduleResolvers);
                loadedFiles.push(filePath);
                if (logger) {
                    logger.debug(`Loaded ${Object.keys(moduleResolvers).length} resolvers from ${filePath}`);
                }
            }
        } catch (error) {
            errors.push({
                file: filePath,
                error: error.message
            });
            if (logger) {
                logger.warn(`Failed to load resolver file '${filePath}': ${error.message}`);
            }
        }
    }

    return {
        resolvers: allResolvers,
        loadedFiles,
        errors,
        totalResolvers: Object.keys(allResolvers).length
    };
}

function extractResolverFunctions(module) {
    const resolvers = {};

    for (const [exportName, exportValue] of Object.entries(module)) {
        if (typeof exportValue === 'function') {
            resolvers[exportName] = exportValue;
        } else if (exportValue && typeof exportValue === 'object') {
            for (const [key, value] of Object.entries(exportValue)) {
                if (typeof value === 'function') {
                    resolvers[key] = value;
                }
            }
        }
    }

    return resolvers;
}

export async function discoverResolvers(resolversPath) {
    if (!resolversPath) {
        throw new Error('resolversPath is required - you must specify where your resolvers are located');
    }

    const logConfig = getConfigSection('logging');
    const logger = createLogger(logConfig);

    try {
        const jsFiles = await discoverJSFiles(resolversPath, logger);

        if (jsFiles.length === 0) {
            logger.warn(`No .js files found in resolvers path: ${resolversPath}`);
            return {
                resolvers: {},
                loadedFiles: [],
                errors: [],
                totalResolvers: 0
            };
        }

        logger.debug(`Found ${jsFiles.length} JS files in ${resolversPath}`);

        const result = await loadResolversFromFiles(jsFiles, logger);

        logger.info(`Loaded ${result.totalResolvers} resolvers from ${result.loadedFiles.length} files`);

        return result;
    } catch (error) {
        logger.error(`Failed to discover resolvers from path '${resolversPath}': ${error.message}`);
        throw new Error(`Failed to discover resolvers from path '${resolversPath}': ${error.message}`);
    }
}

// Helper function to get referenced atoms from a scenario
//
export function getReferencedAtoms(scenario) {
    const atoms = new Set();

    if (scenario.steps) {
        for (const step of scenario.steps) {
            if (step.from) {
                for (const fact of step.from) {
                    atoms.add(fact);
                }
            }
        }
    }

    if (scenario.targets) {
        for (const target of scenario.targets) {
            const targetAtoms = extractAtomsFromFormula(target);
            targetAtoms.forEach(atom => atoms.add(atom));
        }
    }

    if (scenario.propositions) {
        for (const prop of scenario.propositions) {
            atoms.add(prop);
        }
    }

    return atoms;
}

// Extract atomic propositions from a formula string
//
function extractAtomsFromFormula(formula) {
    const matches = formula.match(/[A-Za-z][A-Za-z0-9_]*/g) || [];
    return matches.filter(match =>
        !['and', 'or', 'not', 'implies', 'if', 'then', 'else'].includes(match.toLowerCase())
    );
}
