// strict-mode-invariant.test.js
// Exercises the _knownFormulas invariant check that fires when
// validation.strictMode is enabled.
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

function setupBaseSystem() {
    const system = new GentzenSystem();
    system.addFact('Fact1');
    const propA = system.addProposition('A');
    const propB = system.addProposition('B');
    return { system, propA, propB };
}

test.serial('strictMode off (default) - rules run without invariant check', t => {
    const { system, propA, propB } = setupBaseSystem();
    t.notThrows(() => system.alphaRule(propA, propB, 'and'));
    t.notThrows(() => system.betaRule(propA, propB));
});

test.serial('strictMode on - every rule passes the invariant', t => {
    updateConfig({ validation: { strictMode: true } });

    const { system, propA, propB } = setupBaseSystem();

    const alphaAnd = system.alphaRule(propA, propB, 'and');
    const alphaImplies = system.alphaRule(propA, propB, 'implies');
    const beta = system.betaRule(propA, propB);
    system.equivalenceRule(propA, propB);
    system.doubleNegationRule(propA, 'introduction');
    system.contrapositionRule(alphaImplies);

    // No throw above means invariant held after every rule application.
    t.true(system.steps.length > 3);
});

test.serial('strictMode on - addFact and addProposition keep the invariant', t => {
    updateConfig({ validation: { strictMode: true } });

    const system = new GentzenSystem();
    t.notThrows(() => system.addFact('X'));
    t.notThrows(() => system.addProposition('Y'));
    t.notThrows(() => system.addFact('Z'));
});

test.serial('strictMode on - desynced _knownFormulas throws on next rule', t => {
    updateConfig({ validation: { strictMode: true } });

    const { system, propA, propB } = setupBaseSystem();

    // Simulate the failure mode the invariant exists to catch: push a step
    // whose formula is not tracked in _knownFormulas.
    //
    system.steps.push({
        origin: 'ManualBug',
        ruleType: 'fact',
        from: [],
        formulas: new Set(['UntrackedFormula'])
    });

    t.throws(() => system.alphaRule(propA, propB, 'and'), {
        message: /_knownFormulas size mismatch|_knownFormulas missing/
    });
});
