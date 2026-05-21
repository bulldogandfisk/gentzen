// formula-parser-properties.test.js
// Property-based tests for the parser/AST round-trip using fast-check.
//
// We generate formula strings, parse them, normalize, stringify back to
// canonical form, and assert structural invariants over the result.
//

import test from 'ava';
import fc from 'fast-check';
import { parseFormulaFromString } from '../../utilities/formulaParser.js';
import { astToString, normalizeAST, getAtoms } from '../../utilities/formulaAST.js';

// Atom generator: identifiers shaped like A0..A99. Avoids collision with
// the parser's reserved operator keywords (AND, OR, NOT, IMPLIES, IFF, ...).
//
const atomArb = fc.integer({ min: 0, max: 99 }).map(n => `A${n}`);

const BINARY_OPS = ['∧', '∨', '→', '↔'];

// Recursive formula generator. Produces strings the parser accepts.
//   formula  ::= atom | '~' formula | '(' formula op formula ')'
//
const { formula: formulaArb } = fc.letrec(tie => ({
    formula: fc.oneof(
        { withCrossShrink: true, depthSize: 'small' },
        { weight: 3, arbitrary: tie('atom') },
        { weight: 1, arbitrary: tie('negation') },
        { weight: 1, arbitrary: tie('binary') }
    ),
    atom: atomArb,
    negation: tie('formula').map(inner => `~${inner}`),
    binary: fc.tuple(
        tie('formula'),
        fc.constantFrom(...BINARY_OPS),
        tie('formula')
    ).map(([left, op, right]) => `(${left} ${op} ${right})`)
}));

// Canonical form of a formula string.
//
function canonicalize(s) {
    return astToString(normalizeAST(parseFormulaFromString(s)));
}

test('parse → normalize → stringify → parse → normalize is idempotent', t => {
    t.notThrows(() => {
        fc.assert(fc.property(formulaArb, (s) => {
            const c1 = canonicalize(s);
            const c2 = canonicalize(c1);
            return c1 === c2;
        }), { numRuns: 200 });
    });
});

test('atom set is preserved across canonicalization', t => {
    t.notThrows(() => {
        fc.assert(fc.property(formulaArb, (s) => {
            const ast1 = normalizeAST(parseFormulaFromString(s));
            const atoms1 = [...getAtoms(ast1)].sort();

            const ast2 = normalizeAST(parseFormulaFromString(astToString(ast1)));
            const atoms2 = [...getAtoms(ast2)].sort();

            return JSON.stringify(atoms1) === JSON.stringify(atoms2);
        }), { numRuns: 200 });
    });
});

test('normalizeAST is a fixed point', t => {
    t.notThrows(() => {
        fc.assert(fc.property(formulaArb, (s) => {
            const ast = parseFormulaFromString(s);
            const once = normalizeAST(ast);
            const twice = normalizeAST(once);
            return astToString(once) === astToString(twice);
        }), { numRuns: 200 });
    });
});

test('astToString output is always re-parseable', t => {
    t.notThrows(() => {
        fc.assert(fc.property(formulaArb, (s) => {
            const ast = normalizeAST(parseFormulaFromString(s));
            const out = astToString(ast);
            // Should not throw:
            parseFormulaFromString(out);
            return true;
        }), { numRuns: 200 });
    });
});

test('double-negation elimination collapses ~~x to x', t => {
    t.notThrows(() => {
        fc.assert(fc.property(formulaArb, (s) => {
            // Wrap any formula in ~~ and assert it canonicalizes to the
            // same result as the original.
            //
            const doubled = `~~${s}`;
            return canonicalize(doubled) === canonicalize(s);
        }), { numRuns: 200 });
    });
});
