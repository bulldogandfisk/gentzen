// limit-boundaries.test.js
// Exercises the four BFS safeguard limits in gentzen.js searchForProof.
// Each test tightens a single limit so the search cannot close the target,
// and asserts the contract: proven=false with no thrown error and no
// missingFacts (the failure mode for a limit hit, not a missing atom).
//

import test from 'ava';
import { GentzenSystem } from '../../gentzen.js';
import { updateConfig, resetConfig } from '../../utilities/config.js';
import { clearNormalizeCache } from '../../utilities/formulaUtils.js';

test.beforeEach(() => {
    clearNormalizeCache();
});

test.afterEach(() => {
    resetConfig();
    clearNormalizeCache();
});

// Build a system with three propositions A, B, C.
//
function threePropSystem() {
    const system = new GentzenSystem();
    system.addProposition('A');
    system.addProposition('B');
    system.addProposition('C');
    return system;
}

test.serial('maxProofDepth boundary - returns not-proven without throwing', t => {
    // depth=1 expands only the initial system. Target `((A ∧ B) ∨ C)` needs
    // depth 2 (alpha-AND then beta-OR) so the search cannot close.
    //
    updateConfig({ reasoning: { maxProofDepth: 1 } });

    const result = threePropSystem().searchForProof('((A ∧ B) ∨ C)');

    t.false(result.proven);
    t.is(result.missingFacts.length, 0);
});

test.serial('maxIterations boundary - returns not-proven without throwing', t => {
    // The target requires depth 3: (A ∧ B) then (B ∧ C) within the same system,
    // then alpha-AND combines them. BFS with 3 props enqueues ~21 depth-1
    // systems on iteration 1. With maxIterations=10 the search runs out before
    // any depth-2 system is dequeued, so no depth-3 child is ever generated.
    //
    updateConfig({ reasoning: { maxIterations: 10, maxProofDepth: 10, maxQueueSize: 100000 } });

    const result = threePropSystem().searchForProof('((A ∧ B) ∧ (B ∧ C))');

    t.false(result.proven);
    t.is(result.missingFacts.length, 0);
});

test.serial('maxQueueSize boundary - returns not-proven without throwing', t => {
    // Layer 1 of a 3-prop system enqueues ~21 child systems. With
    // maxQueueSize=10, iteration 2 sees queue.length > 10 and returns.
    //
    updateConfig({ reasoning: { maxQueueSize: 10, maxProofDepth: 10, maxIterations: 100000 } });

    const result = threePropSystem().searchForProof('((A ∧ B) ∧ (B ∧ C))');

    t.false(result.proven);
    t.is(result.missingFacts.length, 0);
});

test.serial('maxSteps boundary - expandOneLevel yields nothing once exceeded', t => {
    // 3 propositions give the initial system 3 steps. maxSteps=4 allows
    // one rule application per system, so layer-1 children have 4 steps and
    // can no longer expand. Target needs depth 2, so search cannot close.
    //
    updateConfig({ reasoning: { maxSteps: 4, maxProofDepth: 10, maxIterations: 100000, maxQueueSize: 100000 } });

    const result = threePropSystem().searchForProof('((A ∧ B) ∨ C)');

    t.false(result.proven);
    t.is(result.missingFacts.length, 0);
});

test.serial('limit hit is distinguishable from missing-fact failure', t => {
    // Same system, but a target referencing an undeclared atom.
    // The engine returns proven=false with a populated missingFacts list,
    // not the empty list a limit hit produces.
    //
    const result = threePropSystem().searchForProof('NeverDeclared');

    t.false(result.proven);
    t.true(result.missingFacts.length > 0);
});
