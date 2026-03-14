// gentzen.js
//

import { parseFormulaFromString } from './utilities/formulaParser.js';
import {
    astToString as astToStringImpl,
    normalizeAST,
    getAtoms,
    isImplication,
    isNegation,
    getImplicationParts,
    negate,
    createImplication
} from './utilities/formulaAST.js';
import {
    normalizeFormula,
    extractFormulaAtoms,
    extractMissingFactsFromFormula
} from './utilities/formulaUtils.js';
import { getConfigSection } from './utilities/config.js';

// Read safeguard limits from config, falling back to defaults
//
function getReasoningLimits() {
    const config = getConfigSection('reasoning') || {};
    return {
        maxIterations: config.maxIterations || 1000,
        maxQueueSize: config.maxQueueSize || 1000,
        maxSteps: config.maxSteps || 100,
        maxProofDepth: config.maxProofDepth || 5
    };
}

// Parse a formula string into an abstract representation
export function parseFormula(formulaStr) {
    if (typeof formulaStr !== 'string' || formulaStr.trim().length === 0) {
        throw new Error('parseFormula requires a non-empty string argument');
    }
    // Parse the formula string into AST
    const ast = parseFormulaFromString(formulaStr);
    
    // Normalize the AST (apply double negation elimination, etc.)
    const normalizedAST = normalizeAST(ast);
    
    return {
        raw: formulaStr,                    // Original string
        ast: normalizedAST,                 // Parsed and normalized AST
        toString: () => astToStringImpl(normalizedAST)  // Canonical string form
    };
}

// Convert an AST back to a string
export function astToString(astOrFormulaObj) {
    if (astOrFormulaObj?.ast) {
        return astToStringImpl(astOrFormulaObj.ast);
    }
    if (astOrFormulaObj?.toString) {
        return astOrFormulaObj.toString();
    }
    throw new Error('Invalid formula object - must have ast or toString method');
}

// Deep-clone a GentzenSystem, preserving facts, steps, and signature cache
//
const cloneSystem = (system) => {
    const newSys = new GentzenSystem();
    newSys.facts = new Set(system.facts);
    newSys.steps = system.steps.map(step => ({
        origin: step.origin,
        ruleType: step.ruleType,
        from: step.from,
        formulas: new Set(step.formulas)
    }));
    newSys._knownFormulas = new Set(system._knownFormulas);
    return newSys;
};

// Build a set of all canonical formulas known to a system
//
const buildKnownFormulas = (system) => {
    const known = new Set();
    for (const step of system.steps) {
        for (const f of step.formulas) {
            known.add(normalizeFormula(f));
        }
    }
    for (const f of system.facts) {
        known.add(normalizeFormula(f));
    }
    return known;
};

// Generate a signature from the known formulas set (sorted, joined)
//
const getSystemSignature = (system) => {
    const known = system._knownFormulas || buildKnownFormulas(system);
    return [...known].sort().join(' | ');
};

// Extract the single formula from a step, error if not exactly one
const getUniqueFormula = (step) => {
    const formulas = [...step.formulas];
    if (formulas.length !== 1) {
        throw new Error('Step must contain exactly one formula.');
    }
    return formulas[0];
};

// GentzenSystem encapsulates facts, steps, and rule applications
//
export class GentzenSystem {
    constructor(options = {}) {
        this.steps = [];
        this.facts = new Set();
        this.missingFacts = new Set();
        this.skippedSteps = [];
        this._knownFormulas = new Set();
    }

    addFact(formulaStr) {
        if (typeof formulaStr !== 'string' || formulaStr.trim().length === 0) {
            throw new Error('addFact requires a non-empty string argument');
        }
        this.facts.add(formulaStr);
        this._knownFormulas.add(normalizeFormula(formulaStr));
    }

    // Check if a fact is available (either in facts or proven)
    isFactAvailable(factName) {
        if (this.facts.has(factName)) {
            return true;
        }
        // Check if it's been proven in any step
        for (const step of this.steps) {
            if (step.formulas.has(factName)) {
                return true;
            }
        }
        return false;
    }

    // Check if a formula atom is resolvable (considering negation)
    isAtomResolvable(atom) {
        // If the atom itself is available, it's resolvable
        if (this.isFactAvailable(atom)) {
            return true;
        }
        
        // If the atom starts with ~, check if the base fact is unavailable
        if (atom.startsWith('~')) {
            const baseFact = atom.slice(1);
            // If base fact is not available, then ~baseFact is effectively available
            return !this.isFactAvailable(baseFact);
        }
        
        // If atom doesn't start with ~, check if ~atom is available
        // This means the positive atom is unavailable due to auto-negation
        return this.isFactAvailable(`~${atom}`);
    }

    // Track missing facts for reporting
    trackMissingFact(factName) {
        this.missingFacts.add(factName);
    }

    addProposition(formulaStr) {
        const step = {
            origin: 'Proposition',
            ruleType: 'fact',
            from: [],
            formulas: new Set([formulaStr])
        };
        this.steps.push(step);
        this._knownFormulas.add(normalizeFormula(formulaStr));
        return step;
    }

    findStepsContaining(formula) {
        // Normalize the search formula using utility
        const normalizedSearchFormula = normalizeFormula(formula);
        
        return this.steps.filter(step => {
            for (const stepFormula of step.formulas) {
                const normalizedStepFormula = normalizeFormula(stepFormula);
                if (normalizedStepFormula === normalizedSearchFormula) {
                    return true;
                }
            }
            return false;
        });
    }

    // Check if a target formula is already proved (in facts or steps)
    isProved(targetFormula) {
        // Normalize the target formula for comparison using utility
        const normalizedTarget = normalizeFormula(targetFormula);
        
        for (const f of this.facts) {
            const normalizedFact = normalizeFormula(f);
            if (normalizedFact === normalizedTarget) {
                return true;
            }
        }
        
        for (const step of this.steps) {
            for (const f of step.formulas) {
                const normalizedFormula = normalizeFormula(f);
                if (normalizedFormula === normalizedTarget) {
                    return true;
                }
            }
        }
        return false;
    }

    // Get all atomic propositions referenced in a formula
    getAtomicPropositions(formula) {
        return extractFormulaAtoms(formula);
    }

    // Check if all required facts are available for a formula (considering auto-negation)
    canResolveFormula(formula) {
        return extractMissingFactsFromFormula(formula, (atom) => this.isAtomResolvable(atom));
    }

    // Applies the alpha rule (and or implies) to two steps
    //
    alphaRule(step1, step2, ruleType) {
        const A = getUniqueFormula(step1);
        const B = getUniqueFormula(step2);
        let newFormula;
        if (ruleType === 'and') {
            newFormula = `(${A} ∧ ${B})`;
        } else if (ruleType === 'implies') {
            newFormula = `(${A} → ${B})`;
        } else {
            throw new Error('Unknown subtype for alpha rule.');
        }
        const newStep = {
            origin: 'AlphaRule',
            ruleType,
            from: [step1, step2],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        return newStep;
    }

    // Applies the beta rule (or) to two steps
    //
    betaRule(step1, step2) {
        const A = getUniqueFormula(step1);
        const B = getUniqueFormula(step2);
        const newFormula = `(${A} ∨ ${B})`;
        const newStep = {
            origin: 'BetaRule',
            ruleType: 'or',
            from: [step1, step2],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        return newStep;
    }

    // Applies contraposition to a single step
    //
    contrapositionRule(step) {
        const f = getUniqueFormula(step);

        const parsed = parseFormula(f);
        if (!isImplication(parsed.ast)) {
            throw new Error('Formula is not an implication - contraposition requires an implication.');
        }

        const parts = getImplicationParts(parsed.ast);
        const negatedConsequent = negate(parts.consequent);
        const negatedAntecedent = negate(parts.antecedent);
        const contrapositive = createImplication(negatedConsequent, negatedAntecedent);
        const newFormula = astToStringImpl(contrapositive);

        const newStep = {
            origin: 'ContrapositionRule',
            ruleType: 'contraposition',
            from: [step],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        return newStep;
    }

    // Applies double negation (intro or elim) to a single step.
    // Uses AST-based manipulation to correctly handle compound
    // and negated formulas (e.g. ~A → ~~(~A), not ~~~A).
    //
    doubleNegationRule(step, mode = 'introduction') {
        const f = getUniqueFormula(step);
        const parsed = parseFormulaFromString(f);
        let newFormula;
        if (mode === 'introduction') {
            newFormula = astToStringImpl(negate(negate(parsed)));
        } else {
            if (isNegation(parsed) && isNegation(parsed.operand)) {
                newFormula = astToStringImpl(normalizeAST(parsed.operand.operand));
            } else {
                newFormula = f;
            }
        }
        const newStep = {
            origin: 'DoubleNegationRule',
            ruleType: mode === 'introduction' ? 'doubleNegIntro' : 'doubleNegElim',
            from: [step],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        return newStep;
    }

    // Applies equivalence (↔) to two steps
    //
    equivalenceRule(step1, step2) {
        const A = getUniqueFormula(step1);
        const B = getUniqueFormula(step2);
        const newFormula = `(${A} ↔ ${B})`;
        const newStep = {
            origin: 'EquivalenceRule',
            ruleType: 'equiv',
            from: [step1, step2],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        return newStep;
    }


    // Expand one level of the proof search by applying all rules.
    // Uses check-before-clone: computes what a rule would produce before
    // allocating a clone, avoiding wasted allocations for redundant derivations.
    //
    expandOneLevel() {
        const { maxSteps } = getReasoningLimits();
        if (this.steps.length >= maxSteps) {
            return [];
        }
        const newSystems = [];
        const stepCount = this.steps.length;

        // Precompute the set of known canonical formulas to avoid cloning
        // when the derived formula is already known.
        //
        const known = this._knownFormulas;

        // Two-step rules (alpha AND, beta OR): need pairs of steps
        //
        for (let i = 0; i < stepCount; i += 1) {
            const stepI = this.steps[i];
            if (stepI.formulas.size !== 1) { continue; }
            const formulaI = [...stepI.formulas][0];

            for (let j = 0; j < stepCount; j += 1) {
                const stepJ = this.steps[j];
                if (stepJ.formulas.size !== 1) { continue; }
                const formulaJ = [...stepJ.formulas][0];

                // Alpha AND: (A ∧ B)
                //
                const candidateAnd = normalizeFormula(`(${formulaI} ∧ ${formulaJ})`);
                if (!known.has(candidateAnd)) {
                    const sysClone = cloneSystem(this);
                    sysClone.alphaRule(sysClone.steps[i], sysClone.steps[j], 'and');
                    newSystems.push(sysClone);
                }

                // Beta OR: (A ∨ B)
                //
                const candidateOr = normalizeFormula(`(${formulaI} ∨ ${formulaJ})`);
                if (!known.has(candidateOr)) {
                    const sysClone = cloneSystem(this);
                    sysClone.betaRule(sysClone.steps[i], sysClone.steps[j]);
                    newSystems.push(sysClone);
                }

            }
        }

        // Single-step rules (contraposition, double negation)
        //
        for (let i = 0; i < stepCount; i += 1) {
            const stepI = this.steps[i];
            if (stepI.formulas.size !== 1) { continue; }
            const formula = [...stepI.formulas][0];

            // Contraposition: only valid on implications
            //
            try {
                const parsed = parseFormula(formula);
                if (isImplication(parsed.ast)) {
                    const parts = getImplicationParts(parsed.ast);
                    const contraFormula = astToStringImpl(
                        createImplication(negate(parts.consequent), negate(parts.antecedent))
                    );
                    if (!known.has(normalizeFormula(contraFormula))) {
                        const sysClone = cloneSystem(this);
                        sysClone.contrapositionRule(sysClone.steps[i]);
                        newSystems.push(sysClone);
                    }
                }
            } catch (e) {
                // Not a valid implication, skip
            }

            // Double negation introduction
            //
            try {
                const parsedForIntro = parseFormulaFromString(formula);
                const introCandidate = astToStringImpl(negate(negate(parsedForIntro)));
                if (!known.has(normalizeFormula(introCandidate))) {
                    const sysClone = cloneSystem(this);
                    sysClone.doubleNegationRule(sysClone.steps[i], 'introduction');
                    newSystems.push(sysClone);
                }
            } catch (e) {
                // Parse error, skip
            }

            // Double negation elimination
            //
            try {
                const parsedForElim = parseFormulaFromString(formula);
                if (isNegation(parsedForElim) && isNegation(parsedForElim.operand)) {
                    const elimCandidate = astToStringImpl(normalizeAST(parsedForElim.operand.operand));
                    if (!known.has(normalizeFormula(elimCandidate))) {
                        const sysClone = cloneSystem(this);
                        sysClone.doubleNegationRule(sysClone.steps[i], 'elimination');
                        newSystems.push(sysClone);
                    }
                }
            } catch (e) {
                // Parse error, skip
            }
        }

        return newSystems;
    }

    searchForProof(targetFormula, maxDepth) {
        const limits = getReasoningLimits();
        const depth = maxDepth !== undefined ? maxDepth : limits.maxProofDepth;

        const result = {
            proven: false,
            path: [],
            missingFacts: [],
            skippedSteps: [],
            depth: 0
        };

        if (this.isProved(targetFormula)) {
            result.proven = true;
            return result;
        }

        // Check if target requires missing facts.
        //
        const { canResolve, missing } = this.canResolveFormula(targetFormula);
        if (!canResolve) {
            result.missingFacts = missing;
            missing.forEach(fact => this.trackMissingFact(fact));
            return result;
        }

        const queue = [{ system: this, depth: 0, path: [] }];
        const visited = new Set([getSystemSignature(this)]);
        let iterations = 0;

        while (queue.length) {
            iterations += 1;
            if (iterations > limits.maxIterations || queue.length > limits.maxQueueSize) {
                return result;
            }
            const { system, depth: currentDepth, path } = queue.shift();
            if (system.isProved(targetFormula)) {
                result.proven = true;
                result.path = path;
                result.depth = currentDepth;
                return result;
            }
            if (currentDepth >= depth) {
                continue;
            }
            for (const child of system.expandOneLevel()) {
                if (child.isProved(targetFormula)) {
                    result.proven = true;
                    result.path = [...path, 'final_step'];
                    result.depth = currentDepth + 1;
                    return result;
                }
                const sig = getSystemSignature(child);
                if (!visited.has(sig)) {
                    visited.add(sig);
                    queue.push({ system: child, depth: currentDepth + 1, path: [...path, `step_${currentDepth + 1}`] });
                }
            }
        }
        return result;
    }
}
