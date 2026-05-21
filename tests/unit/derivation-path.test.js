// derivation-path.test.js
// Verify that result.path is a structured DerivationStep[] chain. Each step
// entry records its rule, premises (formula strings), conclusion, and
// per-premise source (fact / proposition / derivation w/ back-reference).
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('Single-MP path: from A and (A → B), B has a 1-step inference chain', t => {
    const sys = new GentzenSystem();
    sys.addProposition('A');
    sys.addProposition('(A → B)');

    const result = sys.searchForProof('B');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
    t.true(Array.isArray(result.path));
    t.is(result.path.length, 1);

    const [step] = result.path;
    t.is(step.rule, 'modusPonens');
    t.is(step.conclusion, 'B');
    t.deepEqual(step.premises, ['(A → B)', 'A']);
    t.is(step.sources.length, 2);
    // Both premises are propositions (asserted axioms in this system).
    //
    t.is(step.sources[0].kind, 'proposition');
    t.is(step.sources[0].fromPathIndex, null);
    t.is(step.sources[1].kind, 'proposition');
    t.is(step.sources[1].fromPathIndex, null);
});

test('Chained-MP path: from A, (A → B), (B → C), C has 2 entries in dependency order', t => {
    const sys = new GentzenSystem();
    sys.addProposition('A');
    sys.addProposition('(A → B)');
    sys.addProposition('(B → C)');

    const result = sys.searchForProof('C');

    t.true(result.proven);
    t.is(result.path.length, 2);

    // Entry 0: MP on (A → B) and A → B. Entry 1: MP on (B → C) and B → C.
    // The second entry's "B" premise traces back to entry 0.
    //
    const [first, second] = result.path;
    t.is(first.rule, 'modusPonens');
    t.is(first.conclusion, 'B');

    t.is(second.rule, 'modusPonens');
    t.is(second.conclusion, 'C');

    // second's antecedent premise "B" should have kind 'derivation' and
    // fromPathIndex pointing to entry 0.
    //
    const bPremiseSource = second.sources.find(s => s.formula === 'B');
    t.truthy(bPremiseSource);
    t.is(bPremiseSource.kind, 'derivation');
    t.is(bPremiseSource.fromPathIndex, 0);
});

test('Fact-bottomed path: a chain bottoming out in a resolver fact records kind="fact"', t => {
    const sys = new GentzenSystem();
    sys.addFact('A');
    sys.addProposition('(A → B)');

    const result = sys.searchForProof('B');

    t.true(result.proven);
    t.is(result.path.length, 1);

    const [step] = result.path;
    t.is(step.rule, 'modusPonens');
    const aSource = step.sources.find(s => s.formula === 'A');
    t.is(aSource.kind, 'fact', 'A came from this.facts, not from a step');
    t.is(aSource.fromPathIndex, null);
});

test('Negative reasoning path: ~A derives via single-step MT', t => {
    // Given (A → B) and ~B, modus tollens derives ~A in one step.
    //
    const sys = new GentzenSystem();
    sys.addProposition('(A → B)');
    sys.addProposition('~B');

    const result = sys.searchForProof('~A');

    t.true(result.proven);
    t.is(result.path.length, 1, 'MT collapses the contraposition+MP chain');
    t.is(result.path[0].rule, 'modusTollens');
    t.is(result.path[0].conclusion, '~A');
});

test('Asserted target: path is empty when target is just a proposition', t => {
    const sys = new GentzenSystem();
    sys.addProposition('SomeAction');

    const result = sys.searchForProof('SomeAction');

    t.true(result.proven);
    t.is(result.derivation, 'asserted');
    t.deepEqual(result.path, []);
});

test('Fact target: path is empty when target matches a fact', t => {
    const sys = new GentzenSystem();
    sys.addFact('UserAuthenticated');

    const result = sys.searchForProof('UserAuthenticated');

    t.true(result.proven);
    t.is(result.derivation, 'fact');
    t.deepEqual(result.path, []);
});

test('Derived target (YAML-step-produced): path contains the producing step', t => {
    // Simulate what loadFromYaml does: build a derived step before searchForProof runs.
    //
    const sys = new GentzenSystem();
    const propA = sys.addProposition('A');
    const propB = sys.addProposition('B');
    sys.alphaRule(propA, propB, 'and');

    const result = sys.searchForProof('(A ∧ B)');

    t.true(result.proven);
    t.is(result.derivation, 'derived');
    t.is(result.path.length, 1);
    t.is(result.path[0].rule, 'and');
    t.is(result.path[0].conclusion, '(A ∧ B)');
});
