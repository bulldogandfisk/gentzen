// bfs-facts.test.js
// Verify that expandOneLevel iterates synthetic wrappers for system.facts
// alongside system.steps so atomic resolver facts participate in BFS
// without YAML scaffolding.
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test('MP fires on an atomic fact + a proposition implication', t => {
    // A is in system.facts; (A → B) is the only step. BFS wraps the fact as
    // a synthetic source so MP can pair it with the implication.
    //
    const sys = new GentzenSystem();
    sys.addFact('A');
    sys.addProposition('(A → B)');

    const result = sys.searchForProof('B');

    t.true(result.proven, 'B should derive via MP on the atomic fact');
    t.is(result.derivation, 'inference');
});

test('alpha-AND fires on two atomic facts', t => {
    const sys = new GentzenSystem();
    sys.addFact('A');
    sys.addFact('B');

    const result = sys.searchForProof('(A ∧ B)');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
});

test('MP fires on a compound fact (implication-as-fact) plus an atomic fact', t => {
    const sys = new GentzenSystem();
    sys.addFact('(A → B)');
    sys.addFact('A');

    const result = sys.searchForProof('B');

    t.true(result.proven);
    t.is(result.derivation, 'inference');
});

test('Chained MP across facts and propositions', t => {
    // A is a fact; (A → B) and (B → C) are propositions. BFS chains them.
    //
    const sys = new GentzenSystem();
    sys.addFact('A');
    sys.addProposition('(A → B)');
    sys.addProposition('(B → C)');

    const result = sys.searchForProof('C');

    t.true(result.proven, 'C should derive via two MP applications across fact and propositions');
    t.is(result.derivation, 'inference');
});

test('Facts-only system: target equal to a fact reports derivation: "fact"', t => {
    // Direct-match precedence: isProved must still classify a fact target
    // as 'fact', not 'inference'.
    //
    const sys = new GentzenSystem();
    sys.addFact('A');

    const result = sys.searchForProof('A');

    t.true(result.proven);
    t.is(result.derivation, 'fact');
});

test('Contraposition fires on an implication fact', t => {
    const sys = new GentzenSystem();
    sys.addFact('(A → B)');

    const result = sys.searchForProof('(~B → ~A)');

    t.true(result.proven, 'contrapositive should derive from the implication fact');
    t.is(result.derivation, 'inference');
});
