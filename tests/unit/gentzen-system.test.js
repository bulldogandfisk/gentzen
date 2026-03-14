// gentzen-system.test.js - Unit tests for GentzenSystem class and helpers
//

import test from 'ava';
import { GentzenSystem, parseFormula, astToString } from '../../gentzen.js';

// parseFormula tests
//

test('parseFormula - returns object with raw, ast, toString', t => {
    const result = parseFormula('A');

    t.is(result.raw, 'A');
    t.truthy(result.ast);
    t.is(typeof result.toString, 'function');
    t.is(result.toString(), 'A');
});

test('parseFormula - normalizes double negation', t => {
    const result = parseFormula('~~A');

    t.is(result.toString(), 'A');
});

test('parseFormula - handles complex formulas', t => {
    const result = parseFormula('(A ∧ B) → C');

    t.is(result.toString(), '((A ∧ B) → C)');
});

// astToString tests
//

test('astToString - with .ast property', t => {
    const formula = parseFormula('A ∧ B');
    const str = astToString(formula);

    t.is(str, '(A ∧ B)');
});

test('astToString - with .toString method only', t => {
    const obj = { toString: () => 'custom' };
    const str = astToString(obj);

    t.is(str, 'custom');
});

test('astToString - throws for invalid input without ast or toString', t => {
    const noProto = Object.create(null);
    t.throws(() => {
        astToString(noProto);
    }, { message: /Invalid formula object/ });
});

// GentzenSystem - addFact / isFactAvailable
//

test('addFact and isFactAvailable - basic round-trip', t => {
    const system = new GentzenSystem();
    system.addFact('Foo');

    t.true(system.isFactAvailable('Foo'));
    t.false(system.isFactAvailable('Bar'));
});

test('isFactAvailable - finds fact in proven steps', t => {
    const system = new GentzenSystem();
    system.addProposition('MyProp');

    t.true(system.isFactAvailable('MyProp'));
});

// isAtomResolvable
//

test('isAtomResolvable - atom directly available', t => {
    const system = new GentzenSystem();
    system.addFact('Foo');

    t.true(system.isAtomResolvable('Foo'));
});

test('isAtomResolvable - ~Foo when Foo not available returns true', t => {
    const system = new GentzenSystem();
    // Foo is not added, so ~Foo should be resolvable via auto-negation
    t.true(system.isAtomResolvable('~Foo'));
});

test('isAtomResolvable - Foo when ~Foo is available returns true', t => {
    const system = new GentzenSystem();
    system.addFact('~Bar');

    t.true(system.isAtomResolvable('Bar'));
});

test('isAtomResolvable - unresolvable atom returns false', t => {
    const system = new GentzenSystem();
    // Neither Baz nor ~Baz is available, but Baz needs positive/negated presence
    // Actually: isAtomResolvable('Baz') checks:
    //   1. isFactAvailable('Baz') -> false
    //   2. atom doesn't start with ~, so checks isFactAvailable('~Baz') -> false
    // So it returns false
    t.false(system.isAtomResolvable('Baz'));
});

// trackMissingFact
//

test('trackMissingFact - adds to missingFacts set', t => {
    const system = new GentzenSystem();
    system.trackMissingFact('Missing1');
    system.trackMissingFact('Missing2');

    t.true(system.missingFacts.has('Missing1'));
    t.true(system.missingFacts.has('Missing2'));
    t.is(system.missingFacts.size, 2);
});

// addProposition
//

test('addProposition - creates step with origin Proposition', t => {
    const system = new GentzenSystem();
    const step = system.addProposition('MyProp');

    t.is(step.origin, 'Proposition');
    t.is(step.ruleType, 'fact');
    t.deepEqual(step.from, []);
    t.true(step.formulas.has('MyProp'));
});

// findStepsContaining
//

test('findStepsContaining - finds by normalized formula', t => {
    const system = new GentzenSystem();
    system.addProposition('A');
    const found = system.findStepsContaining('A');

    t.true(found.length > 0);
    t.true(found[0].formulas.has('A'));
});

// isProved
//

test('isProved - finds in facts', t => {
    const system = new GentzenSystem();
    system.addFact('FactA');

    t.true(system.isProved('FactA'));
});

test('isProved - finds in steps', t => {
    const system = new GentzenSystem();
    system.addProposition('StepFormula');

    t.true(system.isProved('StepFormula'));
});

test('isProved - returns false for unknown formula', t => {
    const system = new GentzenSystem();
    t.false(system.isProved('Unknown'));
});

// canResolveFormula
//

test('canResolveFormula - returns canResolve and missing', t => {
    const system = new GentzenSystem();
    system.addFact('A');
    system.addFact('B');

    const result = system.canResolveFormula('(A ∧ B)');
    t.true(result.canResolve);
    t.deepEqual(result.missing, []);
});

test('canResolveFormula - reports missing atoms', t => {
    const system = new GentzenSystem();
    system.addFact('A');

    const result = system.canResolveFormula('(A ∧ Unknown)');
    t.false(result.canResolve);
    t.true(result.missing.includes('Unknown'));
});

// alphaRule
//

test('alphaRule - and produces conjunction', t => {
    const system = new GentzenSystem();
    const step1 = system.addProposition('A');
    const step2 = system.addProposition('B');

    const result = system.alphaRule(step1, step2, 'and');
    const formula = [...result.formulas][0];

    t.is(result.origin, 'AlphaRule');
    t.is(result.ruleType, 'and');
    t.is(formula, '(A ∧ B)');
});

test('alphaRule - implies produces implication', t => {
    const system = new GentzenSystem();
    const step1 = system.addProposition('A');
    const step2 = system.addProposition('B');

    const result = system.alphaRule(step1, step2, 'implies');
    const formula = [...result.formulas][0];

    t.is(formula, '(A → B)');
});

test('alphaRule - unknown subtype throws', t => {
    const system = new GentzenSystem();
    const step1 = system.addProposition('A');
    const step2 = system.addProposition('B');

    t.throws(() => {
        system.alphaRule(step1, step2, 'unknown');
    }, { message: /Unknown subtype/ });
});

// betaRule
//

test('betaRule - produces disjunction', t => {
    const system = new GentzenSystem();
    const step1 = system.addProposition('A');
    const step2 = system.addProposition('B');

    const result = system.betaRule(step1, step2);
    const formula = [...result.formulas][0];

    t.is(result.origin, 'BetaRule');
    t.is(formula, '(A ∨ B)');
});

// contrapositionRule
//

test('contrapositionRule - on implication produces contrapositive', t => {
    const system = new GentzenSystem();
    const step1 = system.addProposition('A');
    const step2 = system.addProposition('B');
    const implStep = system.alphaRule(step1, step2, 'implies');

    const result = system.contrapositionRule(implStep);
    const formula = [...result.formulas][0];

    t.is(result.origin, 'ContrapositionRule');
    t.true(formula.includes('~'));
});

test('contrapositionRule - on non-implication throws', t => {
    const system = new GentzenSystem();
    const step = system.addProposition('A');

    t.throws(() => {
        system.contrapositionRule(step);
    }, { message: /not an implication/ });
});

// doubleNegationRule
//

test('doubleNegationRule - introduction on plain formula', t => {
    const system = new GentzenSystem();
    const step = system.addProposition('A');

    const result = system.doubleNegationRule(step, 'introduction');
    const formula = [...result.formulas][0];

    t.is(formula, '~~A');
    t.is(result.ruleType, 'doubleNegIntro');
});

test('doubleNegationRule - introduction on already ~~ formula', t => {
    const system = new GentzenSystem();
    const step = system.addProposition('~~A');

    const result = system.doubleNegationRule(step, 'introduction');
    const formula = [...result.formulas][0];

    // AST-based: wraps in two more NOT layers → ~~~~A
    //
    t.is(formula, '~~~~A');
});

test('doubleNegationRule - elimination on ~~ formula', t => {
    const system = new GentzenSystem();
    const step = system.addProposition('~~A');

    const result = system.doubleNegationRule(step, 'elimination');
    const formula = [...result.formulas][0];

    t.is(formula, 'A');
    t.is(result.ruleType, 'doubleNegElim');
});

test('doubleNegationRule - elimination on plain formula keeps it', t => {
    const system = new GentzenSystem();
    const step = system.addProposition('A');

    const result = system.doubleNegationRule(step, 'elimination');
    const formula = [...result.formulas][0];

    t.is(formula, 'A');
});

// equivalenceRule
//

test('equivalenceRule - produces biconditional', t => {
    const system = new GentzenSystem();
    const step1 = system.addProposition('A');
    const step2 = system.addProposition('B');

    const result = system.equivalenceRule(step1, step2);
    const formula = [...result.formulas][0];

    t.is(result.origin, 'EquivalenceRule');
    t.is(formula, '(A ↔ B)');
});

// expandOneLevel
//

test('expandOneLevel - returns empty when MAX_STEPS reached', t => {
    const system = new GentzenSystem();
    // Fill with enough steps to reach MAX_STEPS (100)
    for (let i = 0; i < 101; i++) {
        system.steps.push({
            origin: 'Test',
            ruleType: 'test',
            from: [],
            formulas: new Set([`F${i}`])
        });
    }

    const result = system.expandOneLevel();
    t.deepEqual(result, []);
});

// searchForProof
//

test('searchForProof - early return when already proven', t => {
    const system = new GentzenSystem();
    system.addFact('AlreadyTrue');

    const result = system.searchForProof('AlreadyTrue');

    t.true(result.proven);
    t.deepEqual(result.path, []);
});

test('searchForProof - returns missing facts when unresolvable', t => {
    const system = new GentzenSystem();

    const result = system.searchForProof('(A ∧ Unknown)');

    t.false(result.proven);
    t.true(result.missingFacts.length > 0);
});

// Step with multi-formula (edge case)
//

test('rule application fails with multi-formula step', t => {
    const system = new GentzenSystem();
    const badStep = {
        origin: 'Test',
        ruleType: 'test',
        from: [],
        formulas: new Set(['A', 'B'])
    };

    t.throws(() => {
        system.alphaRule(badStep, badStep, 'and');
    }, { message: /exactly one formula/ });
});

// searchForProof - BFS exploration
//

test('searchForProof - discovers conjunction via expandOneLevel', t => {
    const system = new GentzenSystem();
    system.addProposition('A');
    system.addProposition('B');

    const result = system.searchForProof('(A ∧ B)');

    t.true(result.proven);
    t.true(result.depth > 0);
});

test('searchForProof - negative proof for implication between unrelated facts', t => {
    const system = new GentzenSystem();
    system.addProposition('Rain');
    system.addProposition('SkyIsBlue');

    // Implication intro removed from proof search — should NOT prove
    //
    const result = system.searchForProof('(Rain → SkyIsBlue)');

    t.false(result.proven);
});

test('searchForProof - maxDepth 0 prevents expansion', t => {
    const system = new GentzenSystem();
    system.addProposition('A');
    system.addProposition('B');

    const result = system.searchForProof('(A ∧ B)', 0);

    t.false(result.proven);
});

test('searchForProof - maxDepth 1 allows one level of expansion', t => {
    const system = new GentzenSystem();
    system.addProposition('A');
    system.addProposition('B');

    const result = system.searchForProof('(A ∧ B)', 1);

    t.true(result.proven);
});

// Input validation
//

test('parseFormula - throws on null input', t => {
    t.throws(() => {
        parseFormula(null);
    }, { message: /non-empty string/ });
});

test('parseFormula - throws on empty string', t => {
    t.throws(() => {
        parseFormula('');
    }, { message: /non-empty string/ });
});

test('addFact - throws on undefined input', t => {
    const system = new GentzenSystem();
    t.throws(() => {
        system.addFact(undefined);
    }, { message: /non-empty string/ });
});

// getAtomicPropositions
//

test('getAtomicPropositions - extracts atoms from formula', t => {
    const system = new GentzenSystem();
    const atoms = system.getAtomicPropositions('(A ∧ B) → C');

    t.true(atoms.includes('A'));
    t.true(atoms.includes('B'));
    t.true(atoms.includes('C'));
});

// expandOneLevel - produces new systems from propositions
//

test('expandOneLevel - generates conjunctions and disjunctions from propositions', t => {
    const system = new GentzenSystem();
    system.addProposition('X');
    system.addProposition('Y');

    const children = system.expandOneLevel();
    t.true(children.length > 0);

    // Check at least one child proves (X ∧ Y)
    //
    const hasConjunction = children.some(child => child.isProved('(X ∧ Y)'));
    t.true(hasConjunction);
});

// searchForProof - queue size overflow
//

test('searchForProof - returns false when depth too shallow for nested target', t => {
    const system = new GentzenSystem();
    system.addProposition('Prop0');
    system.addProposition('Prop1');
    system.addProposition('Prop2');
    system.addProposition('Prop3');

    // Requires multiple expansion levels to build nested conjunctions, maxDepth 1 is too shallow
    //
    const result = system.searchForProof('((Prop0 ∧ Prop1) ∧ (Prop2 ∧ Prop3))', 1);

    t.false(result.proven);
});
