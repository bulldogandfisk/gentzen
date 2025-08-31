// Centralized configuration system with environment support and validation.
//

import { LogLevel } from './logger.js';

// Default configuration values
const DEFAULT_CONFIG = {
    // Logging configuration
    logging: {
        level: LogLevel.INFO,
        enableColors: true,
        enableTimestamps: true,
        enableLabels: true
    },

    // Reasoning engine settings
    reasoning: {
        maxProofDepth: 5,
        maxIterations: 1000,
        maxQueueSize: 1000,
        maxSteps: 100
    },

    // Performance settings
    performance: {
        enableCaching: true,
        cacheSize: 1000,
        enableMemoization: true
    },

    // Validation settings
    validation: {
        strictMode: false,
        validateInputs: true,
        warnOnInvalidFormulas: true
    },

    // Display settings
    display: {
        maxDisplayItems: 100,
        truncateFormulas: false,
        maxFormulaLength: 200
    }
};

// Environment-specific configuration overrides
const ENVIRONMENT_CONFIGS = {
    development: {
        logging: {
            level: LogLevel.DEBUG
        },
        validation: {
            strictMode: true
        }
    },

    test: {
        logging: {
            level: LogLevel.WARN,
            enableColors: false,
            enableTimestamps: false
        },
        performance: {
            enableCaching: false
        }
    },

    production: {
        logging: {
            level: LogLevel.INFO,
            enableColors: false
        },
        reasoning: {
            maxProofDepth: 3  // More conservative for production
        },
        validation: {
            strictMode: true
        }
    }
};

// Configuration validation schema
const CONFIG_SCHEMA = {
    logging: {
        level: { type: 'number', min: 0, max: 4 },
        enableColors: { type: 'boolean' },
        enableTimestamps: { type: 'boolean' },
        enableLabels: { type: 'boolean' }
    },
    reasoning: {
        maxProofDepth: { type: 'number', min: 1, max: 20 },
        maxIterations: { type: 'number', min: 10, max: 100000 },
        maxQueueSize: { type: 'number', min: 10, max: 100000 },
        maxSteps: { type: 'number', min: 1, max: 10000 }
    },
    performance: {
        enableCaching: { type: 'boolean' },
        cacheSize: { type: 'number', min: 0, max: 100000 },
        enableMemoization: { type: 'boolean' }
    },
    validation: {
        strictMode: { type: 'boolean' },
        validateInputs: { type: 'boolean' },
        warnOnInvalidFormulas: { type: 'boolean' }
    },
    display: {
        maxDisplayItems: { type: 'number', min: 1, max: 10000 },
        truncateFormulas: { type: 'boolean' },
        maxFormulaLength: { type: 'number', min: 10, max: 10000 }
    }
};

// Validate a configuration value against schema
function validateConfigValue(value, schema) {
    if (schema.type === 'boolean' && typeof value !== 'boolean') {
        throw new Error(`Expected boolean value, got ${typeof value}`);
    }
    if (schema.type === 'number') {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(`Expected number value, got ${typeof value}`);
        }
        if (schema.min !== undefined && value < schema.min) {
            throw new Error(`Value ${value} is below minimum ${schema.min}`);
        }
        if (schema.max !== undefined && value > schema.max) {
            throw new Error(`Value ${value} is above maximum ${schema.max}`);
        }
    }
    if (schema.type === 'string' && typeof value !== 'string') {
        throw new Error(`Expected string value, got ${typeof value}`);
    }
}

// Validate entire configuration object
function validateConfig(config) {
    const errors = [];

    function validateSection(obj, schema, path = '') {
        for (const [key, schemaValue] of Object.entries(schema)) {
            const fullPath = path ? `${path}.${key}` : key;
            const value = obj[key];

            if (value === undefined) {
                continue; // Allow missing values (will use defaults)
            }

            if (typeof schemaValue === 'object' && schemaValue.type) {
                // Leaf value with validation rules
                try {
                    validateConfigValue(value, schemaValue);
                } catch (error) {
                    errors.push(`${fullPath}: ${error.message}`);
                }
            } else if (typeof schemaValue === 'object') {
                // Nested object
                if (typeof value !== 'object' || value === null) {
                    errors.push(`${fullPath}: Expected object, got ${typeof value}`);
                    continue;
                }
                validateSection(value, schemaValue, fullPath);
            }
        }
    }

    validateSection(config, CONFIG_SCHEMA);
    return errors;
}

// Deep merge two configuration objects
function mergeConfig(base, override) {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
        if (value && typeof value === 'object' && !Array.isArray(value) &&
            result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
            // Recursively merge nested objects
            result[key] = mergeConfig(result[key], value);
        } else {
            // Direct assignment for primitives and arrays
            result[key] = value;
        }
    }
    
    return result;
}

// Parse environment variables into configuration
function parseEnvironmentConfig() {
    const envConfig = {};

    // Parse LOG_LEVEL
    const logLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (logLevel) {
        const levelMap = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SILENT: 4 };
        if (levelMap[logLevel] !== undefined) {
            envConfig.logging = { level: levelMap[logLevel] };
        }
    }

    // Parse other environment variables
    if (process.env.MAX_PROOF_DEPTH) {
        const depth = parseInt(process.env.MAX_PROOF_DEPTH, 10);
        if (!isNaN(depth)) {
            envConfig.reasoning = { maxProofDepth: depth };
        }
    }

    if (process.env.ENABLE_CACHING !== undefined) {
        envConfig.performance = { 
            enableCaching: process.env.ENABLE_CACHING === 'true' 
        };
    }

    if (process.env.STRICT_MODE !== undefined) {
        envConfig.validation = { 
            strictMode: process.env.STRICT_MODE === 'true' 
        };
    }

    return envConfig;
}

// Configuration manager class
class ConfigManager {
    constructor() {
        this._config = null;
        this._listeners = new Set();
    }

    // Load configuration from various sources
    load(userConfig = {}) {
        // Start with defaults
        let config = { ...DEFAULT_CONFIG };

        // Apply environment-specific overrides
        const environment = process.env.NODE_ENV || 'development';
        if (ENVIRONMENT_CONFIGS[environment]) {
            config = mergeConfig(config, ENVIRONMENT_CONFIGS[environment]);
        }

        // Apply environment variables
        const envConfig = parseEnvironmentConfig();
        config = mergeConfig(config, envConfig);

        // Apply user-provided configuration
        config = mergeConfig(config, userConfig);

        // Validate the final configuration
        const errors = validateConfig(config);
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }

        this._config = config;
        this._notifyListeners();
        return config;
    }

    // Get current configuration
    get() {
        if (!this._config) {
            this.load(); // Load defaults if not yet loaded
        }
        return this._config;
    }

    // Get specific configuration section
    getSection(section) {
        return this.get()[section];
    }

    // Update configuration at runtime
    update(updates) {
        const newConfig = mergeConfig(this.get(), updates);
        const errors = validateConfig(newConfig);
        if (errors.length > 0) {
            throw new Error(`Configuration update validation failed:\n${errors.join('\n')}`);
        }
        this._config = newConfig;
        this._notifyListeners();
    }

    // Add listener for configuration changes
    addListener(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback); // Return unsubscribe function
    }

    // Notify listeners of configuration changes
    _notifyListeners() {
        for (const listener of this._listeners) {
            try {
                listener(this._config);
            } catch (error) {
                console.warn('Configuration listener error:', error);
            }
        }
    }

    // Reset to defaults
    reset() {
        this._config = null;
        this.load();
    }
}

// Singleton configuration manager instance
const configManager = new ConfigManager();

// Public API
export function loadConfig(userConfig = {}) {
    return configManager.load(userConfig);
}

export function getConfig() {
    return configManager.get();
}

export function getConfigSection(section) {
    return configManager.getSection(section);
}

export function updateConfig(updates) {
    return configManager.update(updates);
}

export function onConfigChange(callback) {
    return configManager.addListener(callback);
}

export function resetConfig() {
    return configManager.reset();
}

// Initialize with defaults
loadConfig();