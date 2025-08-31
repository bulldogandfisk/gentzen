// logger.js
// Structured logging system with configurable levels and output formatting

// Log levels with numeric priorities for filtering
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SILENT: 4
};

// Default logger configuration
const DEFAULT_CONFIG = {
    level: LogLevel.INFO,
    enableColors: true,
    enableTimestamps: true,
    enableLabels: true,
    outputFunction: null  // null = use console, or provide custom function
};

// ANSI color codes for console output
const COLORS = {
    DEBUG: '\x1b[36m',    // Cyan
    INFO: '\x1b[32m',     // Green  
    WARN: '\x1b[33m',     // Yellow
    ERROR: '\x1b[31m',    // Red
    RESET: '\x1b[0m'
};

// Log level labels
const LEVEL_LABELS = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR'
};

// Format timestamp for logs
function formatTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').replace('Z', '');
}

// Format log message with optional colors, timestamps, and labels
function formatMessage(level, message, config) {
    let formatted = '';
    
    // Add timestamp if enabled
    if (config.enableTimestamps) {
        formatted += `[${formatTimestamp()}] `;
    }
    
    // Add colored level label if enabled
    if (config.enableLabels) {
        const label = LEVEL_LABELS[level];
        if (config.enableColors) {
            const color = COLORS[label] || '';
            formatted += `${color}${label}${COLORS.RESET} `;
        } else {
            formatted += `${label} `;
        }
    }
    
    // Add the actual message
    formatted += message;
    
    return formatted;
}

// Logger class with configurable output and filtering
export class Logger {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Update logger configuration
    configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    // Internal method to output log messages
    _log(level, message, ...args) {
        // Filter out messages below configured level
        if (level < this.config.level) {
            return;
        }

        const formattedMessage = formatMessage(level, message, this.config);
        
        // Use custom output function or fallback to console
        if (this.config.outputFunction) {
            this.config.outputFunction(level, formattedMessage, ...args);
        } else {
            // Route to appropriate console method
            switch (level) {
                case LogLevel.DEBUG:
                    console.log(formattedMessage, ...args);
                    break;
                case LogLevel.INFO:
                    console.log(formattedMessage, ...args);
                    break;
                case LogLevel.WARN:
                    console.warn(formattedMessage, ...args);
                    break;
                case LogLevel.ERROR:
                    console.error(formattedMessage, ...args);
                    break;
            }
        }
    }

    // Public logging methods
    debug(message, ...args) {
        this._log(LogLevel.DEBUG, message, ...args);
    }

    info(message, ...args) {
        this._log(LogLevel.INFO, message, ...args);
    }

    warn(message, ...args) {
        this._log(LogLevel.WARN, message, ...args);
    }

    error(message, ...args) {
        this._log(LogLevel.ERROR, message, ...args);
    }

    // Convenience method for conditional logging
    logIf(condition, level, message, ...args) {
        if (condition) {
            this._log(level, message, ...args);
        }
    }

    // Create child logger with additional context
    child(context) {
        return new Logger({
            ...this.config,
            outputFunction: (level, message, ...args) => {
                const contextMessage = `[${context}] ${message}`;
                this._log(level, contextMessage, ...args);
            }
        });
    }
}

// Factory function for creating loggers with common configurations
export function createLogger(options = {}) {
    // Determine log level from environment or options
    let level = options.level;
    if (level === undefined) {
        const envLevel = process.env.LOG_LEVEL?.toUpperCase();
        switch (envLevel) {
            case 'DEBUG': level = LogLevel.DEBUG; break;
            case 'INFO': level = LogLevel.INFO; break;
            case 'WARN': level = LogLevel.WARN; break;
            case 'ERROR': level = LogLevel.ERROR; break;
            case 'SILENT': level = LogLevel.SILENT; break;
            default: level = LogLevel.INFO; break;
        }
    }

    // Determine if colors should be enabled
    let enableColors = options.enableColors;
    if (enableColors === undefined) {
        // Disable colors in CI environments or when output is not a TTY
        enableColors = process.env.CI !== 'true' && 
                      process.stdout.isTTY !== false &&
                      process.env.NO_COLOR === undefined;
    }

    return new Logger({
        level,
        enableColors,
        enableTimestamps: options.enableTimestamps !== false,
        enableLabels: options.enableLabels !== false,
        outputFunction: options.outputFunction
    });
}

// Default logger instance for immediate use
export const logger = createLogger();

// Convenience functions that use the default logger
export function debug(message, ...args) { logger.debug(message, ...args); }
export function info(message, ...args) { logger.info(message, ...args); }
export function warn(message, ...args) { logger.warn(message, ...args); }
export function error(message, ...args) { logger.error(message, ...args); }