// gentzen.js

import { parseFormulaFromString } from './utilities/formulaParser.js';
import { 
    astToString as astToStringImpl, 
    normalizeAST, 
    getAtoms,
    isImplication,
    getImplicationParts,
    negate,
    createImplication
} from './utilities/formulaAST.js';
import { 
    normalizeFormula, 
    extractFormulaAtoms, 
    canonicalDoubleNeg as canonicalDoubleNegUtil,
    extractMissingFactsFromFormula
} from './utilities/formulaUtils.js';

// Safeguard constants to guarantee termination
const MAX_ITERATIONS = 1000;
const MAX_QUEUE_SIZE = 1000;
const MAX_STEPS = 100;

// Parse a formula string into an abstract representation
export function parseFormula(formulaStr) {
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

// Use imported canonical double negation utility
const canonicalDoubleNeg = canonicalDoubleNegUtil;

// Deep-clone a GentzenSystem, preserving facts and steps
const cloneSystem = (system) => {
    const newSys = new GentzenSystem();
    newSys.facts = new Set(system.facts);
    newSys.steps = system.steps.map(step => ({
        origin: step.origin,
        ruleType: step.ruleType,
        from: step.from,
        formulas: new Set(step.formulas)
    }));
    return newSys;
};

// Generate a unique signature for a system by collecting all formulas
const getSystemSignature = (system) => {
    const formulas = [];
    for (const step of system.steps) {
        for (const f of step.formulas) {
            formulas.push(canonicalDoubleNeg(f));
        }
    }
    for (const f of system.facts) {
        formulas.push(canonicalDoubleNeg(f));
    }
    const uniqueSorted = [...new Set(formulas)].sort();
    return uniqueSorted.join(' | ');
};

// Check if a new derivation step added any genuinely new formula
const didWeDeriveNewFormula = (originalSystem, newSystem, newStep) => {
    if (!newStep) {
        return false;
    }
    const known = new Set();
    for (const step of originalSystem.steps) {
        for (const f of step.formulas) {
            known.add(canonicalDoubleNeg(f));
        }
    }
    for (const f of originalSystem.facts) {
        known.add(canonicalDoubleNeg(f));
    }
    for (const f of newStep.formulas) {
        if (!known.has(canonicalDoubleNeg(f))) {
            return true;
        }
    }
    return false;
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
export class GentzenSystem {
    constructor(options = {}) {
        this.steps = [];
        this.facts = new Set();
        this.missingFacts = new Set();
        this.skippedSteps = [];
        this.proofResults = new Map();
        this.dependencyGraph = new Map();
    }

    addFact(formulaStr) {
        this.facts.add(formulaStr);
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
        return newStep;
    }

    // Applies the beta rule (or) to two steps
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
        return newStep;
    }

    // Applies contraposition to a single step
    contrapositionRule(step) {
        const f = getUniqueFormula(step);
        
        const parsed = parseFormula(f);
        if (!isImplication(parsed.ast)) {
            throw new Error('Formula is not an implication - contraposition requires an implication.');
        }
        
        const parts = getImplicationParts(parsed.ast);
        // Create ~B → ~A from A → B
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
        return newStep;
    }

    // Applies double negation (intro or elim) to a single step
    doubleNegationRule(step, mode = 'introduction') {
        const f = getUniqueFormula(step);
        let newFormula;
        if (mode === 'introduction') {
            newFormula = f.startsWith('~~') ? f : `~~${f}`;
        } else {
            newFormula = f.startsWith('~~') ? f.slice(2) : f;
        }
        const newStep = {
            origin: 'DoubleNegationRule',
            ruleType: mode === 'introduction' ? 'doubleNegIntro' : 'doubleNegElim',
            from: [step],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        return newStep;
    }

    // Applies equivalence (↔) to two steps
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
        return newStep;
    }


    // Expand one level of the proof search by applying all rules
    expandOneLevel() {
        if (this.steps.length >= MAX_STEPS) {
            return [];
        }
        const newSystems = [];
        const stepCount = this.steps.length;

        for (let i = 0; i < stepCount; i += 1) {
            for (let j = 0; j < stepCount; j += 1) {
                const combos = [
                    { rule: 'alpha', subtype: 'and' },
                    { rule: 'alpha', subtype: 'implies' },
                    { rule: 'beta' },
                    { rule: 'equivalence' }
                ];
                for (const { rule, subtype } of combos) {
                    const sysClone = cloneSystem(this);
                    try {
                        let newStep;
                        if (rule === 'alpha') {
                            newStep = sysClone.alphaRule(sysClone.steps[i], sysClone.steps[j], subtype);
                        } else if (rule === 'beta') {
                            newStep = sysClone.betaRule(sysClone.steps[i], sysClone.steps[j]);
                        } else {
                            newStep = sysClone.equivalenceRule(sysClone.steps[i], sysClone.steps[j]);
                        }
                        if (didWeDeriveNewFormula(this, sysClone, newStep)) {
                            newSystems.push(sysClone);
                        }
                    } catch (e) {
                        // ignore rule application errors
                    }
                }
            }
        }

        for (let i = 0; i < stepCount; i += 1) {
            for (const { rule, mode } of [
                { rule: 'contraposition' },
                { rule: 'doubleNegation', mode: 'introduction' },
                { rule: 'doubleNegation', mode: 'elimination' }
            ]) {
                const sysClone = cloneSystem(this);
                try {
                    let newStep;
                    if (rule === 'contraposition') {
                        newStep = sysClone.contrapositionRule(sysClone.steps[i]);
                    } else {
                        newStep = sysClone.doubleNegationRule(sysClone.steps[i], mode);
                    }
                    if (didWeDeriveNewFormula(this, sysClone, newStep)) {
                        newSystems.push(sysClone);
                    }
                } catch (e) {
                    // ignore rule application errors
                }
            }
        }


        return newSystems;
    }

    searchForProof(targetFormula, maxDepth = 5) {
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
            if (iterations > MAX_ITERATIONS || queue.length > MAX_QUEUE_SIZE) {
                return result;
            }
            const { system, depth, path } = queue.shift();
            if (system.isProved(targetFormula)) {
                result.proven = true;
                result.path = path;
                result.depth = depth;
                return result;
            }
            if (depth >= maxDepth) {
                continue;
            }
            for (const child of system.expandOneLevel()) {
                if (child.isProved(targetFormula)) {
                    result.proven = true;
                    result.path = [...path, 'final_step'];
                    result.depth = depth + 1;
                    return result;
                }
                const sig = getSystemSignature(child);
                if (!visited.has(sig)) {
                    visited.add(sig);
                    queue.push({ system: child, depth: depth + 1, path: [...path, `step_${depth + 1}`] });
                }
            }
        }
        return result;
    }
}
