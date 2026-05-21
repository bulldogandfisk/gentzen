// validateProof.js
// Structurally verify that every rule-application step in a system is
// the correct conclusion of the named rule applied to its `from` steps.
//
// Designed to fail loudly: unknown rule types, wrong arities, or wrong
// shapes (e.g. contraposition input that isn't an implication) all surface
// as test failures rather than silent skips. If a new rule is ever added
// to the engine, the corresponding case must be added here or every step
// using that rule will fail validation by name.
//

import { parseFormulaFromString } from '../../utilities/formulaParser.js';
import {
    astToString,
    normalizeAST,
    negate,
    createImplication,
    isImplication,
    getImplicationParts,
    isNegation,
    isConjunction,
    isDisjunction
} from '../../utilities/formulaAST.js';
import { normalizeFormula } from '../../utilities/formulaUtils.js';

// Rule types that mark a step as a stored fact rather than a derivation.
// These legitimately have no rule output to verify.
//
const SKIPPED_RULE_TYPES = new Set(['fact', 'factRef']);

// Every ruleType the engine can produce as a derivation. Each must appear
// in the expectedFormula switch below. Adding a new derivation rule to
// the engine requires adding it here AND to the switch.
//
const DERIVATION_RULE_TYPES = new Set([
    'and',
    'or',
    'contraposition',
    'doubleNegIntro',
    'doubleNegElim',
    'modusPonens',
    'modusTollens',
    'andElimL',
    'andElimR',
    'orElim',
    'disjunctiveMP',
    'disjunctiveSyllogism'
]);

// Pull the single formula out of a step.
//
function singleFormula(step) {
    const formulas = [...step.formulas];
    if (formulas.length !== 1) {
        return null;
    }
    return formulas[0];
}

// Thrown when a derivation step has the wrong arity or wrong input shape.
// The engine should never produce such a step; if it does, that's a real bug.
//
class ProofStructureError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProofStructureError';
    }
}

// Compute the canonical formula a derivation rule must produce given its inputs.
// Caller has already confirmed `ruleType` is in DERIVATION_RULE_TYPES.
// Throws ProofStructureError on arity or shape mismatch.
//
function expectedFormula(ruleType, fromFormulas) {
    const requireArity = (n) => {
        if (fromFormulas.length !== n) {
            throw new ProofStructureError(
                `${ruleType} requires ${n} input formula${n === 1 ? '' : 's'}, got ${fromFormulas.length}`
            );
        }
    };

    switch (ruleType) {
        case 'and':
            requireArity(2);
            return `(${fromFormulas[0]} ∧ ${fromFormulas[1]})`;
        case 'or':
            requireArity(2);
            return `(${fromFormulas[0]} ∨ ${fromFormulas[1]})`;
        case 'contraposition': {
            requireArity(1);
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (!isImplication(ast)) {
                throw new ProofStructureError(
                    `contraposition input must be an implication; got "${fromFormulas[0]}"`
                );
            }
            const parts = getImplicationParts(ast);
            return astToString(createImplication(negate(parts.consequent), negate(parts.antecedent)));
        }
        case 'doubleNegIntro': {
            requireArity(1);
            const ast = parseFormulaFromString(fromFormulas[0]);
            return astToString(negate(negate(ast)));
        }
        case 'doubleNegElim': {
            requireArity(1);
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (!isNegation(ast) || !isNegation(ast.operand)) {
                throw new ProofStructureError(
                    `doubleNegElim input must be a doubly-negated formula; got "${fromFormulas[0]}"`
                );
            }
            return astToString(normalizeAST(ast.operand.operand));
        }
        case 'modusPonens': {
            requireArity(2);
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (!isImplication(ast)) {
                throw new ProofStructureError(
                    `modusPonens first input must be an implication; got "${fromFormulas[0]}"`
                );
            }
            const parts = getImplicationParts(ast);
            const antecedentString = astToString(parts.antecedent);
            if (normalizeFormula(antecedentString) !== normalizeFormula(fromFormulas[1])) {
                throw new ProofStructureError(
                    `modusPonens antecedent "${antecedentString}" does not match second input "${fromFormulas[1]}"`
                );
            }
            return astToString(parts.consequent);
        }
        case 'modusTollens': {
            requireArity(2);
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (!isImplication(ast)) {
                throw new ProofStructureError(
                    `modusTollens first input must be an implication; got "${fromFormulas[0]}"`
                );
            }
            const parts = getImplicationParts(ast);
            const negConsString = astToString(negate(parts.consequent));
            if (normalizeFormula(negConsString) !== normalizeFormula(fromFormulas[1])) {
                throw new ProofStructureError(
                    `modusTollens negated-consequent "${negConsString}" does not match second input "${fromFormulas[1]}"`
                );
            }
            return astToString(negate(parts.antecedent));
        }
        case 'andElimL': {
            requireArity(1);
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (!isConjunction(ast)) {
                throw new ProofStructureError(
                    `andElimL input must be a conjunction; got "${fromFormulas[0]}"`
                );
            }
            return astToString(ast.left);
        }
        case 'andElimR': {
            requireArity(1);
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (!isConjunction(ast)) {
                throw new ProofStructureError(
                    `andElimR input must be a conjunction; got "${fromFormulas[0]}"`
                );
            }
            return astToString(ast.right);
        }
        case 'disjunctiveMP': {
            requireArity(2);
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (!isImplication(ast)) {
                throw new ProofStructureError(
                    `disjunctiveMP first input must be an implication; got "${fromFormulas[0]}"`
                );
            }
            const parts = getImplicationParts(ast);
            if (!isDisjunction(parts.antecedent)) {
                throw new ProofStructureError(
                    `disjunctiveMP first input's antecedent must be a disjunction; got "${astToString(parts.antecedent)}"`
                );
            }
            const leftDisjunctNorm = normalizeFormula(astToString(parts.antecedent.left));
            const rightDisjunctNorm = normalizeFormula(astToString(parts.antecedent.right));
            const matchedNorm = normalizeFormula(fromFormulas[1]);
            if (matchedNorm !== leftDisjunctNorm && matchedNorm !== rightDisjunctNorm) {
                throw new ProofStructureError(
                    `disjunctiveMP second input "${fromFormulas[1]}" does not match either disjunct of "${astToString(parts.antecedent)}"`
                );
            }
            return astToString(parts.consequent);
        }
        case 'disjunctiveSyllogism': {
            requireArity(2);
            const ast = parseFormulaFromString(fromFormulas[0]);
            if (!isDisjunction(ast)) {
                throw new ProofStructureError(
                    `disjunctiveSyllogism first input must be a disjunction; got "${fromFormulas[0]}"`
                );
            }
            const negLeftNorm = normalizeFormula(astToString(negate(ast.left)));
            const negRightNorm = normalizeFormula(astToString(negate(ast.right)));
            const suppliedNorm = normalizeFormula(fromFormulas[1]);
            if (suppliedNorm === negLeftNorm) {
                return astToString(ast.right);
            }
            if (suppliedNorm === negRightNorm) {
                return astToString(ast.left);
            }
            throw new ProofStructureError(
                `disjunctiveSyllogism second input "${fromFormulas[1]}" is not the negation of either disjunct of "${fromFormulas[0]}"`
            );
        }
        case 'orElim': {
            requireArity(3);
            const disjAst = parseFormulaFromString(fromFormulas[0]);
            if (!isDisjunction(disjAst)) {
                throw new ProofStructureError(
                    `orElim first input must be a disjunction; got "${fromFormulas[0]}"`
                );
            }
            const implAAst = parseFormulaFromString(fromFormulas[1]);
            const implBAst = parseFormulaFromString(fromFormulas[2]);
            if (!isImplication(implAAst) || !isImplication(implBAst)) {
                throw new ProofStructureError(
                    `orElim second and third inputs must be implications`
                );
            }
            const partsA = getImplicationParts(implAAst);
            const partsB = getImplicationParts(implBAst);
            const leftDisjunct = normalizeFormula(astToString(disjAst.left));
            const rightDisjunct = normalizeFormula(astToString(disjAst.right));
            const antA = normalizeFormula(astToString(partsA.antecedent));
            const antB = normalizeFormula(astToString(partsB.antecedent));
            const consA = normalizeFormula(astToString(partsA.consequent));
            const consB = normalizeFormula(astToString(partsB.consequent));
            if (consA !== consB) {
                throw new ProofStructureError(
                    `orElim implication consequents must agree; got "${astToString(partsA.consequent)}" and "${astToString(partsB.consequent)}"`
                );
            }
            const matchesABorder = antA === leftDisjunct && antB === rightDisjunct;
            const matchesBAorder = antA === rightDisjunct && antB === leftDisjunct;
            if (!matchesABorder && !matchesBAorder) {
                throw new ProofStructureError(
                    `orElim implication antecedents do not match the disjuncts of "${fromFormulas[0]}"`
                );
            }
            return astToString(partsA.consequent);
        }
        default:
            // Caller has already checked DERIVATION_RULE_TYPES membership.
            // Reaching here means the set and switch fell out of sync.
            //
            throw new ProofStructureError(
                `validateProof: ruleType '${ruleType}' is in DERIVATION_RULE_TYPES but has no expectedFormula case`
            );
    }
}

// Walk system.steps; for every step that names a derivation rule,
// assert its formula equals the canonical output of that rule applied
// to its `from` steps. Fails loudly on unknown rule types so that adding
// a rule to the engine without updating this helper is caught immediately.
//
// @param {object} t - AVA test assertion handle.
// @param {object} results - Result object from runGentzenReasoning.
//
export function validateProof(t, results) {
    const system = results.system;
    if (!system || !Array.isArray(system.steps)) {
        t.fail('results.system.steps is missing or not an array');
        return 0;
    }

    let checked = 0;

    for (let i = 0; i < system.steps.length; i += 1) {
        const step = system.steps[i];
        const ruleType = step.ruleType;

        if (SKIPPED_RULE_TYPES.has(ruleType)) {
            continue;
        }

        if (!DERIVATION_RULE_TYPES.has(ruleType)) {
            t.fail(
                `Step ${i} has unknown ruleType '${ruleType}'. ` +
                `If this rule was just added to the engine, update ` +
                `DERIVATION_RULE_TYPES and the expectedFormula switch in ` +
                `tests/helpers/validateProof.js.`
            );
            continue;
        }

        const fromFormulas = step.from.map(singleFormula);
        if (fromFormulas.some(f => f === null)) {
            t.fail(
                `Step ${i} (${ruleType}) has a 'from' entry without exactly one formula`
            );
            continue;
        }

        let expected;
        try {
            expected = expectedFormula(ruleType, fromFormulas);
        } catch (err) {
            if (err instanceof ProofStructureError) {
                t.fail(`Step ${i}: ${err.message}`);
                continue;
            }
            throw err;
        }

        const actual = singleFormula(step);
        if (actual === null) {
            t.fail(`Step ${i} (${ruleType}) does not have exactly one formula`);
            continue;
        }

        const normExpected = normalizeFormula(expected);
        const normActual = normalizeFormula(actual);
        t.is(
            normActual,
            normExpected,
            `Step ${i} (${ruleType}): expected "${expected}" but got "${actual}"`
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

// Walk a proven target's structured DerivationStep[] chain and assert that
// every premise source connects to a real, reachable origin:
//
//   - kind === 'fact':         the source formula appears in results.availableFacts.
//   - kind === 'proposition':  the source formula appears in results.propositions.
//   - kind === 'derivation':   fromPathIndex is non-null, in-range, refers to an
//                              earlier entry in target.path, and the referenced
//                              entry's conclusion matches the source formula
//                              (under normalizeFormula).
//
// Catches a class of regressions where intermediate steps could be fabricated:
// validateProof only checks rule-application shape; reachability ensures the
// chain bottoms out in declared inputs.
//
// Returns the number of sources verified. Logs a structured failure with the
// path index, source index, and broken link kind when something is amiss.
//
// @param {object} t - AVA test assertion handle.
// @param {string} targetFormula - The target whose path to verify.
// @param {object} results - Result object from runGentzenReasoning.
//
export function validateReachability(t, targetFormula, results) {
    const targetResult = results.targets ? results.targets.find(tr => tr.formula === targetFormula) : null;
    if (!targetResult) {
        t.fail(`validateReachability: target '${targetFormula}' not found in results.targets`);
        return 0;
    }
    if (!targetResult.proven) {
        // Nothing to validate — an unproven target has no chain.
        //
        return 0;
    }
    const path = Array.isArray(targetResult.path) ? targetResult.path : [];
    if (path.length === 0) {
        // 'asserted' and 'fact' derivations have empty paths by design;
        // their proof source is checked elsewhere.
        //
        return 0;
    }

    const availableFacts = results.availableFacts || [];
    const propositions = results.propositions || [];

    // Build normalized sets for fast lookup.
    //
    const normalizedFacts = new Set();
    for (const f of availableFacts) {
        try { normalizedFacts.add(normalizeFormula(f)); } catch { /* skip malformed */ }
    }
    const normalizedPropositions = new Set();
    for (const p of propositions) {
        try { normalizedPropositions.add(normalizeFormula(p)); } catch { /* skip malformed */ }
    }

    let checked = 0;

    for (let i = 0; i < path.length; i += 1) {
        const entry = path[i];
        if (!entry || !Array.isArray(entry.sources)) {
            t.fail(`validateReachability: path entry ${i} for '${targetFormula}' is missing 'sources'`);
            continue;
        }
        for (let s = 0; s < entry.sources.length; s += 1) {
            const src = entry.sources[s];
            const where = `target '${targetFormula}' path[${i}].sources[${s}]`;
            let normFormula;
            try {
                normFormula = normalizeFormula(src.formula);
            } catch (err) {
                t.fail(`${where}: formula "${src.formula}" failed to parse: ${err.message}`);
                continue;
            }
            if (src.kind === 'fact') {
                t.true(
                    normalizedFacts.has(normFormula),
                    `${where}: claimed kind='fact' but "${src.formula}" is not in availableFacts`
                );
            } else if (src.kind === 'proposition') {
                t.true(
                    normalizedPropositions.has(normFormula),
                    `${where}: claimed kind='proposition' but "${src.formula}" is not in propositions`
                );
            } else if (src.kind === 'derivation') {
                if (src.fromPathIndex === null || src.fromPathIndex === undefined) {
                    t.fail(`${where}: kind='derivation' but fromPathIndex is null`);
                    continue;
                }
                if (src.fromPathIndex < 0 || src.fromPathIndex >= i) {
                    t.fail(
                        `${where}: fromPathIndex=${src.fromPathIndex} is out of range (must be 0..${i - 1})`
                    );
                    continue;
                }
                const referenced = path[src.fromPathIndex];
                if (!referenced) {
                    t.fail(`${where}: fromPathIndex=${src.fromPathIndex} refers to no entry`);
                    continue;
                }
                let normReferenced;
                try {
                    normReferenced = normalizeFormula(referenced.conclusion);
                } catch (err) {
                    t.fail(`${where}: referenced conclusion "${referenced.conclusion}" failed to parse: ${err.message}`);
                    continue;
                }
                t.is(
                    normReferenced,
                    normFormula,
                    `${where}: referenced path[${src.fromPathIndex}].conclusion does not match source formula`
                );
            } else {
                t.fail(`${where}: unknown source kind '${src.kind}' (expected fact/proposition/derivation)`);
            }
            checked += 1;
        }
    }

    return checked;
}

// Assert a target is proven, every rule step is structurally correct, AND
// every premise in the target's derivation chain reaches a declared source.
//
export function assertProvenAndReachable(t, target, results) {
    const targetResult = results.targets.find(tr => tr.formula === target);
    if (!targetResult) {
        t.fail(`Target '${target}' not found in results`);
        return;
    }
    t.true(targetResult.proven, `Expected target '${target}' to be proven`);
    validateProof(t, results);
    validateReachability(t, target, results);
}
