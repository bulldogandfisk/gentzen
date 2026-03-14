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
