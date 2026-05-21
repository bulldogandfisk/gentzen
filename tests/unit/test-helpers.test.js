// test-helpers.test.js
// Meta-tests: the test-helper functions themselves must fail loudly on
// malformed inputs, not silently pass. These tests lock in the C2 fix.
//

import test from 'ava';
import {
    assertNotProven,
    assertArrayNotContains,
    assertExactlyMissingFacts
} from '../helpers/test-helpers.js';

// Capture pass/fail calls instead of acting on AVA's t.
//
function fakeT() {
    const calls = { pass: 0, fail: [], deepEqualOk: 0, deepEqualBad: [] };
    return {
        calls,
        pass: () => { calls.pass += 1; },
        fail: (msg) => { calls.fail.push(msg); },
        true: () => { /* unused */ },
        false: () => { /* unused */ },
        deepEqual: (a, b, msg) => {
            if (JSON.stringify(a) === JSON.stringify(b)) {
                calls.deepEqualOk += 1;
            } else {
                calls.deepEqualBad.push({ a, b, msg });
            }
        }
    };
}

test('assertNotProven fails when the target is missing from results', t => {
    const ft = fakeT();
    const results = { targets: [{ formula: 'OtherTarget', proven: false, missingFacts: [], path: [] }] };

    assertNotProven(ft, 'MissingTarget', results);

    t.is(ft.calls.fail.length, 1, 'must fail for missing target');
    t.true(
        ft.calls.fail[0].includes('MissingTarget'),
        'failure message must name the missing target'
    );
    t.is(ft.calls.pass, 0, 'must NOT call pass');
});

test('assertNotProven fails when the target IS proven', t => {
    const ft = fakeT();
    const results = { targets: [{ formula: 'X', proven: true, missingFacts: [], path: [] }] };

    assertNotProven(ft, 'X', results, 'X was proven when it should not have been');

    t.is(ft.calls.fail.length, 1);
    t.is(ft.calls.pass, 0);
});

test('assertNotProven passes when the target exists and is not proven', t => {
    const ft = fakeT();
    const results = { targets: [{ formula: 'X', proven: false, missingFacts: [], path: [] }] };

    assertNotProven(ft, 'X', results);

    t.is(ft.calls.fail.length, 0);
    t.is(ft.calls.pass, 1);
});

test('assertArrayNotContains fails on non-array input', t => {
    const ft = fakeT();

    assertArrayNotContains(ft, 'not-an-array', 'x');

    t.is(ft.calls.fail.length, 1);
    t.true(ft.calls.fail[0].includes('array'));
});

test('assertExactlyMissingFacts fails when results contain extra missing facts', t => {
    const ft = fakeT();
    const results = { missingFacts: ['A', 'B', 'C'] };

    assertExactlyMissingFacts(ft, ['A', 'B'], results);

    t.is(ft.calls.deepEqualBad.length, 1, 'must report mismatch when results have extras');
});

test('assertExactlyMissingFacts passes when sets match (order-insensitive)', t => {
    const ft = fakeT();
    const results = { missingFacts: ['B', 'A'] };

    assertExactlyMissingFacts(ft, ['A', 'B'], results);

    t.is(ft.calls.deepEqualOk, 1);
    t.is(ft.calls.deepEqualBad.length, 0);
});
