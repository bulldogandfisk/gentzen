// validator.test.js - Unit tests for scenario validation
//

import test from 'ava';
import { join } from 'node:path';
import fs from 'fs-extra';
import os from 'node:os';
import { EOL } from 'node:os';
import { validateScenario, validateAndDisplay } from '../../validator.js';

const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');

// Helper to create a temporary YAML file with given content
//
async function createTempScenario(content) {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'gentzen-test-'));
    const tmpFile = join(tmpDir, 'test-scenario.yaml');
    await fs.writeFile(tmpFile, content, 'utf8');
    return { tmpFile, tmpDir };
}

test('validateScenario - valid scenario returns isValid true', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const result = await validateScenario(scenarioPath);

    t.true(result.isValid);
    t.deepEqual(result.errors, []);
    t.true(Array.isArray(result.warnings));
    t.is(typeof result.summary, 'string');
});

test('validateScenario - missing targets field returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`steps:${EOL}  - rule: alpha${EOL}    from:${EOL}      - A${EOL}      - B${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('targets')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - empty targets array returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets: []${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('targets')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - non-string target returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - 123${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('Target')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - steps not an array returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - A${EOL}steps: "not an array"${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.length > 0);
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - step missing rule field returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - A${EOL}steps:${EOL}  - from:${EOL}      - A${EOL}      - B${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('missing "rule"')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - step missing from array returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - A${EOL}steps:${EOL}  - rule: alpha${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('missing "from"')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - propositions not an array returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - A${EOL}propositions: "not an array"${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('Propositions must be an array')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - non-string proposition returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - A${EOL}propositions:${EOL}  - 42${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('Proposition') && e.includes('string')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - duplicate proposition name returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - A${EOL}propositions:${EOL}  - Foo${EOL}  - Foo${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('Duplicate proposition')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - non-PascalCase proposition returns warning', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - A${EOL}propositions:${EOL}  - lowercase${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.true(result.warnings.some(w => w.includes('PascalCase')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - unbalanced parentheses in formula returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - "(A ∧ B"${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('unbalanced parentheses')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - compound formula without parentheses returns warning', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - "A ∧ B"${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.true(result.warnings.some(w => w.includes('parentheses')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - nonexistent file returns parse error', async t => {
    const result = await validateScenario('/tmp/nonexistent-scenario-file.yaml');

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('Failed to parse')));
    t.is(result.summary, 'File parsing failed');
});

test('validateAndDisplay - returns results for valid scenario', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const result = await validateAndDisplay(scenarioPath);

    t.true(result.isValid);
    t.deepEqual(result.errors, []);
});

test('validateAndDisplay - returns results for invalid scenario', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`steps:${EOL}  - rule: alpha${EOL}`);
    try {
        const result = await validateAndDisplay(tmpFile, true);
        t.false(result.isValid);
        t.true(result.errors.length > 0);
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateScenario - closing paren before opening returns error', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - ")A ∧ B("${EOL}`);
    try {
        const result = await validateScenario(tmpFile);
        t.false(result.isValid);
        t.true(result.errors.some(e => e.includes('unbalanced parentheses')));
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateAndDisplay - verbose with warnings shows details', async t => {
    const { tmpFile, tmpDir } = await createTempScenario(`targets:${EOL}  - "A ∧ B"${EOL}propositions:${EOL}  - lowercase${EOL}`);
    try {
        const result = await validateAndDisplay(tmpFile, true);
        t.true(result.warnings.length > 0);
    } finally {
        await fs.remove(tmpDir);
    }
});

test('validateAndDisplay - valid scenario non-verbose path', async t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const result = await validateAndDisplay(scenarioPath, false);

    t.true(result.isValid);
});
