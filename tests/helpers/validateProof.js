// validateProof.js
// Structurally verify that every rule-application step in a system is
// the correct conclusion of the named rule applied to its `from` steps.
//

import { parseFormulaFromString } from '../../utilities/formulaParser.js';
import {
    astToString,
    normalizeAST,
    negate,
    createImplication,
    isImplication,
    getImplicationParts,
    isNegation
} from '../../utilities/formulaAST.js';
import { normalizeFormula } from '../../utilities/formulaUtils.js';

// Pull the single formula out of a step. Steps in the live engine always
// carry exactly one formula in their `formulas` Set.
//
function singleFormula(step) {
    const formulas = [...step.formulas];
    if (formulas.length !== 1) {
        return null;
    }
    return formulas[0];
}

// Compute the canonical formula a rule should produce given its inputs.
// Returns null when the ruleType is not a derived-rule type
// (e.g. 'fact', 'factRef' — those steps require no check).
//
function expectedFormula(ruleType, fromFormulas) {
    switch (ruleType) {
        case 'and':
            if (fromFormulas.length !== 2) { return null; }
            return `(${fromFormulas[0]} ∧ ${fromFormulas[1]})`;
        case 'implies':
            if (fromFormulas.length !== 2) { return null; }
            return `(${fromFormulas[0]} → ${fromFormulas[1]})`;
        case 'or':
            if (fromFormulas.length !== 2) { return null; }
            return `(${fromFormulas[0]} ∨ ${fromFormulas[1]})`;
        case 'equiv':
            if (fromFormulas.length !== 2) { return null; }
            return `(${fromFormulas[0]} ↔ ${fromFormulas[1]})`;
        case 'contraposition': {
            if (fromFormulas.length !== 1) { return null; }
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (!isImplication(ast)) { return null; }
            const parts = getImplicationParts(ast);
            return astToString(createImplication(negate(parts.consequent), negate(parts.antecedent)));
        }
        case 'doubleNegIntro': {
            if (fromFormulas.length !== 1) { return null; }
            const ast = parseFormulaFromString(fromFormulas[0]);
            return astToString(negate(negate(ast)));
        }
        case 'doubleNegElim': {
            if (fromFormulas.length !== 1) { return null; }
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (isNegation(ast) && isNegation(ast.operand)) {
                return astToString(normalizeAST(ast.operand.operand));
            }
            return fromFormulas[0];
        }
        default:
            return null;
    }
}

// Walk system.steps; for every step that names a derivation rule,
// assert that its formula equals the canonical output of that rule
// applied to its `from` steps.
//
// @param {object} t - AVA test assertion handle.
// @param {object} results - Result object from runGentzenReasoning.
//
export function validateProof(t, results) {
    const system = results.system;
    if (!system || !Array.isArray(system.steps)) {
        t.fail('results.system.steps is missing or not an array');
        return;
    }

    let checked = 0;

    for (let i = 0; i < system.steps.length; i += 1) {
        const step = system.steps[i];
        const expected = expectedFormula(step.ruleType, step.from.map(singleFormula).filter(f => f !== null));

        if (expected === null) {
            continue;
        }

        const actual = singleFormula(step);
        if (actual === null) {
            t.fail(`Step ${i} (${step.ruleType}) does not have exactly one formula`);
            continue;
        }

        const normExpected = normalizeFormula(expected);
        const normActual = normalizeFormula(actual);
        t.is(
            normActual,
            normExpected,
            `Step ${i} (${step.ruleType}): expected "${expected}" but got "${actual}"`
        );
        checked += 1;
    }

    return checked;
}

// Assert a target is proven AND every rule step in the system is structurally correct.
// Convenience wrapper for the common case in integration tests.
//
export function assertProvenAndValid(t, target, results) {
    const targetResult = results.targets.find(tr => tr.formula === target);
    if (!targetResult) {
        t.fail(`Target '${target}' not found in results`);
        return;
    }
    t.true(targetResult.proven, `Expected target '${target}' to be proven`);
    validateProof(t, results);
}
