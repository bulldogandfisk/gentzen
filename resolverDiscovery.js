import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readdir, stat } from 'node:fs/promises';
import { createLogger } from './utilities/logger.js';
import { getConfigSection } from './utilities/config.js';

// Recursively discover all .js files in a directory
async function discoverJSFiles(dirPath, logger = null) {
    const jsFiles = [];
    
    try {
        const entries = await readdir(dirPath);
        
        for (const entry of entries) {
            const fullPath = join(dirPath, entry);
            const stats = await stat(fullPath);
            
            if (stats.isDirectory()) {
                // Recursively scan subdirectories
                const subFiles = await discoverJSFiles(fullPath, logger);
                jsFiles.push(...subFiles);
            } else if (entry.endsWith('.js')) {
                jsFiles.push(fullPath);
            }
        }
    } catch (error) {
        if (logger) {
            logger.warn(`Could not read directory ${dirPath}: ${error.message}`);
        }
    }
    
    return jsFiles;
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
    
    // Check all exported values
    for (const [exportName, exportValue] of Object.entries(module)) {
        if (typeof exportValue === 'function') {
            // Direct function export
            resolvers[exportName] = exportValue;
        } else if (exportValue && typeof exportValue === 'object') {
            // Object containing functions (like { travelFactResolvers: {...} })
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
export function getReferencedAtoms(scenario) {
    const atoms = new Set();
    
    // Extract atoms from steps
    if (scenario.steps) {
        for (const step of scenario.steps) {
            if (step.from) {
                for (const fact of step.from) {
                    atoms.add(fact);
                }
            }
        }
    }
    
    // Extract atoms from targets
    if (scenario.targets) {
        for (const target of scenario.targets) {
            // Extract atoms from formula strings
            const targetAtoms = extractAtomsFromFormula(target);
            targetAtoms.forEach(atom => atoms.add(atom));
        }
    }
    
    // Extract atoms from propositions
    if (scenario.propositions) {
        for (const prop of scenario.propositions) {
            atoms.add(prop);
        }
    }
    
    return atoms;
}

// Extract atomic propositions from a formula string
function extractAtomsFromFormula(formula) {
    // Simple regex to extract identifiers (atoms)
    const matches = formula.match(/[A-Za-z][A-Za-z0-9_]*/g) || [];
    return matches.filter(match => 
        // Filter out logical operators
        !['and', 'or', 'not', 'implies', 'if', 'then', 'else'].includes(match.toLowerCase())
    );
}
