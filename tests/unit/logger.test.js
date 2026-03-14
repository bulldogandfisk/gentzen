// logger.test.js - Unit tests for logging system
//

import test from 'ava';
import { Logger, LogLevel, createLogger } from '../../utilities/logger.js';

// Helper to capture log output
//
function createCapture() {
    const messages = [];
    const outputFunction = (level, message) => {
        messages.push({ level, message });
    };
    return { messages, outputFunction };
}

test('Logger at INFO level suppresses DEBUG messages', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({ level: LogLevel.INFO, outputFunction });

    logger.debug('should not appear');
    logger.info('should appear');

    t.is(messages.length, 1);
    t.true(messages[0].message.includes('should appear'));
});

test('Logger at DEBUG level outputs DEBUG messages', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({ level: LogLevel.DEBUG, outputFunction });

    logger.debug('debug message');

    t.is(messages.length, 1);
    t.true(messages[0].message.includes('debug message'));
});

test('Logger at WARN level suppresses INFO and DEBUG', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({ level: LogLevel.WARN, outputFunction });

    logger.debug('no');
    logger.info('no');
    logger.warn('yes');
    logger.error('yes');

    t.is(messages.length, 2);
});

test('Logger at SILENT level suppresses all messages', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({ level: LogLevel.SILENT, outputFunction });

    logger.debug('no');
    logger.info('no');
    logger.warn('no');
    logger.error('no');

    t.is(messages.length, 0);
});

test('logIf - true condition outputs message', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({ level: LogLevel.DEBUG, outputFunction });

    logger.logIf(true, LogLevel.INFO, 'conditional message');

    t.is(messages.length, 1);
    t.true(messages[0].message.includes('conditional message'));
});

test('logIf - false condition suppresses message', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({ level: LogLevel.DEBUG, outputFunction });

    logger.logIf(false, LogLevel.INFO, 'should not appear');

    t.is(messages.length, 0);
});

test('child logger prefixes messages with context', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({ level: LogLevel.DEBUG, outputFunction });
    const child = logger.child('MyContext');

    child.info('child message');

    t.is(messages.length, 1);
    t.true(messages[0].message.includes('[MyContext]'));
    t.true(messages[0].message.includes('child message'));
});

test('custom outputFunction receives formatted messages', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({
        level: LogLevel.INFO,
        outputFunction,
        enableLabels: true
    });

    logger.info('test message');

    t.is(messages.length, 1);
    t.is(messages[0].level, LogLevel.INFO);
    t.is(typeof messages[0].message, 'string');
});

test('enableColors false produces output without ANSI codes', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({
        level: LogLevel.INFO,
        outputFunction,
        enableColors: false,
        enableLabels: true
    });

    logger.info('no color');

    t.is(messages.length, 1);
    // ANSI codes start with \x1b[
    t.false(messages[0].message.includes('\x1b['));
});

test('enableTimestamps false omits timestamps', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({
        level: LogLevel.INFO,
        outputFunction,
        enableTimestamps: false,
        enableLabels: false
    });

    logger.info('plain');

    t.is(messages.length, 1);
    // Timestamps look like [2024-01-01 ...] — square bracket at start
    t.false(messages[0].message.startsWith('['));
});

test('enableLabels false omits level labels', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({
        level: LogLevel.INFO,
        outputFunction,
        enableLabels: false,
        enableTimestamps: false,
        enableColors: false
    });

    logger.info('no label');

    t.is(messages.length, 1);
    t.false(messages[0].message.includes('INFO'));
});

test('createLogger - defaults to INFO level', t => {
    const { messages, outputFunction } = createCapture();
    const logger = createLogger({ outputFunction });

    logger.debug('should not appear');
    logger.info('should appear');

    t.is(messages.length, 1);
});

test('createLogger - LOG_LEVEL=DEBUG enables debug output', t => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'DEBUG';
    try {
        const { messages, outputFunction } = createCapture();
        const logger = createLogger({ outputFunction });
        logger.debug('debug visible');
        t.is(messages.length, 1);
        t.true(messages[0].message.includes('debug visible'));
    } finally {
        if (original === undefined) {
            delete process.env.LOG_LEVEL;
        } else {
            process.env.LOG_LEVEL = original;
        }
    }
});

test('createLogger - LOG_LEVEL=WARN suppresses info', t => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'WARN';
    try {
        const { messages, outputFunction } = createCapture();
        const logger = createLogger({ outputFunction });
        logger.info('suppressed');
        logger.warn('visible');
        t.is(messages.length, 1);
        t.true(messages[0].message.includes('visible'));
    } finally {
        if (original === undefined) {
            delete process.env.LOG_LEVEL;
        } else {
            process.env.LOG_LEVEL = original;
        }
    }
});

test('createLogger - LOG_LEVEL=ERROR suppresses warn and below', t => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'ERROR';
    try {
        const { messages, outputFunction } = createCapture();
        const logger = createLogger({ outputFunction });
        logger.info('no');
        logger.warn('no');
        logger.error('yes');
        t.is(messages.length, 1);
        t.true(messages[0].message.includes('yes'));
    } finally {
        if (original === undefined) {
            delete process.env.LOG_LEVEL;
        } else {
            process.env.LOG_LEVEL = original;
        }
    }
});

test('createLogger - LOG_LEVEL=SILENT suppresses all output', t => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'SILENT';
    try {
        const { messages, outputFunction } = createCapture();
        const logger = createLogger({ outputFunction });
        logger.debug('no');
        logger.info('no');
        logger.warn('no');
        logger.error('no');
        t.is(messages.length, 0);
    } finally {
        if (original === undefined) {
            delete process.env.LOG_LEVEL;
        } else {
            process.env.LOG_LEVEL = original;
        }
    }
});

test('configure - updates level at runtime', t => {
    const { messages, outputFunction } = createCapture();
    const logger = new Logger({ level: LogLevel.WARN, outputFunction });

    logger.info('suppressed');
    t.is(messages.length, 0);

    logger.configure({ level: LogLevel.DEBUG });
    logger.info('now visible');

    t.is(messages.length, 1);
    t.true(messages[0].message.includes('now visible'));
});

// Console routing without custom outputFunction
//

test('Logger routes to console methods without outputFunction', t => {
    const logger = new Logger({
        level: LogLevel.DEBUG,
        enableTimestamps: false,
        enableLabels: false,
        enableColors: false
    });

    // These should not throw — they just go to console.log/warn/error
    //
    t.notThrows(() => {
        logger.debug('debug to console');
        logger.info('info to console');
        logger.warn('warn to console');
        logger.error('error to console');
    });
});
