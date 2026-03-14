// validator.test.js - Unit tests for scenario validation
//

import test from 'ava';
import { join } from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { EOL } from 'node:os';
import { validateScenario, validateAndDisplay } from '../../validator.js';

const testDir = import.meta.dirname;
const testScenariosPath = join(testDir, '../scenarios/test-scenarios');

// Helper to create a temporary YAML file with given content
//
function createTempScenario(content) {
    const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'gentzen-test-'));
    const tmpFile = join(tmpDir, 'test-scenario.yaml');
    fs.writeFileSync(tmpFile, content, 'utf8');
    return tmpFile;
}

test('validateScenario - valid scenario returns isValid true', t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const result = validateScenario(scenarioPath);

    t.true(result.isValid);
    t.deepEqual(result.errors, []);
    t.true(Array.isArray(result.warnings));
    t.is(typeof result.summary, 'string');
});

test('validateScenario - missing targets field returns error', t => {
    const tmpFile = createTempScenario(`steps:${EOL}  - rule: alpha${EOL}    from:${EOL}      - A${EOL}      - B${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('targets')));
});

test('validateScenario - empty targets array returns error', t => {
    const tmpFile = createTempScenario(`targets: []${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('targets')));
});

test('validateScenario - non-string target returns error', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - 123${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('Target')));
});

test('validateScenario - steps not an array returns error', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - A${EOL}steps: "not an array"${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.length > 0);
});

test('validateScenario - step missing rule field returns error', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - A${EOL}steps:${EOL}  - from:${EOL}      - A${EOL}      - B${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('missing "rule"')));
});

test('validateScenario - step missing from array returns error', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - A${EOL}steps:${EOL}  - rule: alpha${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('missing "from"')));
});

test('validateScenario - propositions not an array returns error', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - A${EOL}propositions: "not an array"${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('Propositions must be an array')));
});

test('validateScenario - non-string proposition returns error', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - A${EOL}propositions:${EOL}  - 42${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('Proposition') && e.includes('string')));
});

test('validateScenario - duplicate proposition name returns error', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - A${EOL}propositions:${EOL}  - Foo${EOL}  - Foo${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('Duplicate proposition')));
});

test('validateScenario - non-PascalCase proposition returns warning', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - A${EOL}propositions:${EOL}  - lowercase${EOL}`);
    const result = validateScenario(tmpFile);

    t.true(result.warnings.some(w => w.includes('PascalCase')));
});

test('validateScenario - unbalanced parentheses in formula returns error', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - "(A ∧ B"${EOL}`);
    const result = validateScenario(tmpFile);

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('unbalanced parentheses')));
});

test('validateScenario - compound formula without parentheses returns warning', t => {
    const tmpFile = createTempScenario(`targets:${EOL}  - "A ∧ B"${EOL}`);
    const result = validateScenario(tmpFile);

    t.true(result.warnings.some(w => w.includes('parentheses')));
});

test('validateScenario - nonexistent file returns parse error', t => {
    const result = validateScenario('/tmp/nonexistent-scenario-file.yaml');

    t.false(result.isValid);
    t.true(result.errors.some(e => e.includes('Failed to parse')));
    t.is(result.summary, 'File parsing failed');
});

test('validateAndDisplay - returns results for valid scenario', t => {
    const scenarioPath = join(testScenariosPath, 'minimal.yaml');
    const result = validateAndDisplay(scenarioPath);

    t.true(result.isValid);
    t.deepEqual(result.errors, []);
});

test('validateAndDisplay - returns results for invalid scenario', t => {
    const tmpFile = createTempScenario(`steps:${EOL}  - rule: alpha${EOL}`);
    const result = validateAndDisplay(tmpFile, true);

    t.false(result.isValid);
    t.true(result.errors.length > 0);
});
