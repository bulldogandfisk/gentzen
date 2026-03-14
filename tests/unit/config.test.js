// config.test.js - Unit tests for configuration management
//

import test from 'ava';
import {
    loadConfig,
    getConfig,
    getConfigSection,
    updateConfig,
    onConfigChange,
    resetConfig
} from '../../utilities/config.js';

// Reset config before each test to avoid singleton pollution
//
test.beforeEach(() => {
    resetConfig();
});

test('getConfigSection - logging section has expected keys', t => {
    const logging = getConfigSection('logging');

    t.is(typeof logging.level, 'number');
    t.is(typeof logging.enableColors, 'boolean');
    t.is(typeof logging.enableTimestamps, 'boolean');
    t.is(typeof logging.enableLabels, 'boolean');
});

test('getConfigSection - reasoning section has expected keys', t => {
    const reasoning = getConfigSection('reasoning');

    t.is(typeof reasoning.maxProofDepth, 'number');
    t.is(typeof reasoning.maxIterations, 'number');
    t.is(typeof reasoning.maxQueueSize, 'number');
    t.is(typeof reasoning.maxSteps, 'number');
});

test('getConfigSection - performance section has expected keys', t => {
    const performance = getConfigSection('performance');

    t.is(typeof performance.enableCaching, 'boolean');
    t.is(typeof performance.cacheSize, 'number');
    t.is(typeof performance.enableMemoization, 'boolean');
});

test('updateConfig - valid partial update merges correctly', t => {
    updateConfig({ reasoning: { maxProofDepth: 10 } });
    const reasoning = getConfigSection('reasoning');

    t.is(reasoning.maxProofDepth, 10);
    // Siblings should remain
    t.is(typeof reasoning.maxIterations, 'number');
    t.true(reasoning.maxIterations > 0);
});

test('updateConfig - invalid type throws', t => {
    t.throws(() => {
        updateConfig({ logging: { level: 'string' } });
    }, { message: /validation failed/i });
});

test('updateConfig - out-of-range number throws', t => {
    t.throws(() => {
        updateConfig({ reasoning: { maxProofDepth: 999 } });
    }, { message: /validation failed/i });
});

test('onConfigChange - listener fires on update', t => {
    let called = false;
    let receivedConfig = null;

    onConfigChange((config) => {
        called = true;
        receivedConfig = config;
    });

    updateConfig({ reasoning: { maxProofDepth: 7 } });

    t.true(called);
    t.is(receivedConfig.reasoning.maxProofDepth, 7);
});

test('onConfigChange - unsubscribe stops notifications', t => {
    let callCount = 0;

    const unsubscribe = onConfigChange(() => {
        callCount++;
    });

    updateConfig({ reasoning: { maxProofDepth: 8 } });
    t.is(callCount, 1);

    unsubscribe();
    updateConfig({ reasoning: { maxProofDepth: 9 } });
    t.is(callCount, 1);
});

test('resetConfig - reverts to defaults', t => {
    updateConfig({ reasoning: { maxProofDepth: 15 } });
    t.is(getConfigSection('reasoning').maxProofDepth, 15);

    resetConfig();

    const reasoning = getConfigSection('reasoning');
    t.is(typeof reasoning.maxProofDepth, 'number');
    t.true(reasoning.maxProofDepth <= 10);
});

test('loadConfig - user overrides merge without clobbering siblings', t => {
    loadConfig({ logging: { enableColors: false } });
    const logging = getConfigSection('logging');

    t.false(logging.enableColors);
    // Sibling fields should still be present
    t.is(typeof logging.level, 'number');
    t.is(typeof logging.enableTimestamps, 'boolean');
    t.is(typeof logging.enableLabels, 'boolean');
});

test('loadConfig - validation rejects boolean where number expected', t => {
    t.throws(() => {
        loadConfig({ reasoning: { maxProofDepth: true } });
    }, { message: /validation failed/i });
});

test('getConfig - returns full config object', t => {
    const config = getConfig();

    t.is(typeof config, 'object');
    t.truthy(config.logging);
    t.truthy(config.reasoning);
    t.truthy(config.performance);
    t.truthy(config.validation);
    t.truthy(config.display);
});

test('getConfigSection - returns undefined for unknown section', t => {
    const result = getConfigSection('nonexistent');
    t.is(result, undefined);
});

test('loadConfig - MAX_PROOF_DEPTH env var is parsed', t => {
    const orig = process.env.MAX_PROOF_DEPTH;
    process.env.MAX_PROOF_DEPTH = '8';
    try {
        resetConfig();
        loadConfig();
        const reasoning = getConfigSection('reasoning');
        t.is(reasoning.maxProofDepth, 8);
    } finally {
        if (orig === undefined) {
            delete process.env.MAX_PROOF_DEPTH;
        } else {
            process.env.MAX_PROOF_DEPTH = orig;
        }
    }
});

test('loadConfig - ENABLE_CACHING env var is parsed', t => {
    const orig = process.env.ENABLE_CACHING;
    process.env.ENABLE_CACHING = 'true';
    try {
        resetConfig();
        loadConfig();
        const perf = getConfigSection('performance');
        t.is(perf.enableCaching, true);
    } finally {
        if (orig === undefined) {
            delete process.env.ENABLE_CACHING;
        } else {
            process.env.ENABLE_CACHING = orig;
        }
    }
});

test('loadConfig - STRICT_MODE env var is parsed', t => {
    const orig = process.env.STRICT_MODE;
    process.env.STRICT_MODE = 'true';
    try {
        resetConfig();
        loadConfig();
        const validation = getConfigSection('validation');
        t.is(validation.strictMode, true);
    } finally {
        if (orig === undefined) {
            delete process.env.STRICT_MODE;
        } else {
            process.env.STRICT_MODE = orig;
        }
    }
});

test('loadConfig - unknown NODE_ENV falls back to defaults', t => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'staging';
    try {
        resetConfig();
        loadConfig();
        const config = getConfig();
        t.truthy(config.logging);
        t.truthy(config.reasoning);
    } finally {
        if (orig === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = orig;
        }
    }
});

test('loadConfig - production NODE_ENV applies production overrides', t => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        resetConfig();
        loadConfig();
        const reasoning = getConfigSection('reasoning');
        t.is(reasoning.maxProofDepth, 3);
    } finally {
        if (orig === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = orig;
        }
    }
});

test('loadConfig - test NODE_ENV applies test overrides', t => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
        resetConfig();
        loadConfig();
        const perf = getConfigSection('performance');
        t.is(perf.enableCaching, false);
    } finally {
        if (orig === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = orig;
        }
    }
});

test('loadConfig - LOG_LEVEL env var is parsed', t => {
    const orig = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'DEBUG';
    try {
        resetConfig();
        loadConfig();
        const logging = getConfigSection('logging');
        t.is(logging.level, 0);
    } finally {
        if (orig === undefined) {
            delete process.env.LOG_LEVEL;
        } else {
            process.env.LOG_LEVEL = orig;
        }
    }
});

test('loadConfig - non-object section value throws validation error', t => {
    t.throws(() => {
        loadConfig({ logging: 'not_an_object' });
    }, { message: /validation failed/i });
});

test('onConfigChange - listener error is caught gracefully', t => {
    onConfigChange(() => {
        throw new Error('listener boom');
    });

    t.notThrows(() => {
        updateConfig({ reasoning: { maxProofDepth: 6 } });
    });
    t.is(getConfigSection('reasoning').maxProofDepth, 6);
});
