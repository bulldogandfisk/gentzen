// gentzen.js
//

import { parseFormulaFromString } from './utilities/formulaParser.js';
import {
    astToString as astToStringImpl,
    normalizeAST,
    getAtoms,
    isImplication,
    isNegation,
    isConjunction,
    isDisjunction,
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
import { createLogger } from './utilities/logger.js';

const _logger = createLogger(getConfigSection('logging'));

// Reasoning limits, read from config with built-in defaults.
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
    const ast = parseFormulaFromString(formulaStr);
    const normalizedAST = normalizeAST(ast);

    return {
        raw: formulaStr,
        ast: normalizedAST,
        toString: () => astToStringImpl(normalizedAST)
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

// Build a structured DerivationStep[] chain by walking back from `targetStep`
// through its `from` references until reaching leaves (facts or propositions).
//
// Each chain entry describes one rule application: what rule fired, what
// premises it consumed, what it concluded, and where each premise came from.
// Leaves are NOT chain entries — they are referenced inside a chain entry's
// `sources` array with kind='fact' or kind='proposition' and fromPathIndex=null.
//
// Returns the chain in dependency order (leaves first, target last). For a
// chain of length N, the target is at index N-1.
//
// If `targetStep` is itself a fact wrapper or a proposition, returns [].
//
const buildDerivationPath = (targetStep, system) => {
    const path = [];
    const visited = new Map();

    const singleFormula = (step) => {
        const formulas = [...step.formulas];
        return formulas.length === 1 ? formulas[0] : null;
    };

    const isFactSource = (step) => {
        if (step.origin === 'Fact' || step.ruleType === 'fact') {
            const f = singleFormula(step);
            return f !== null && system.facts.has(f);
        }
        return false;
    };

    const isPropositionSource = (step) => step.origin === 'Proposition';

    const visit = (step) => {
        if (visited.has(step)) {
            return visited.get(step);
        }
        if (isFactSource(step) || isPropositionSource(step)) {
            visited.set(step, -1);
            return -1;
        }
        const conclusion = singleFormula(step);
        if (conclusion === null) {
            visited.set(step, -1);
            return -1;
        }
        const sources = [];
        const premises = [];
        for (const premise of step.from) {
            const premiseFormula = singleFormula(premise);
            premises.push(premiseFormula);
            let kind;
            let fromPathIndex = null;
            if (isFactSource(premise)) {
                kind = 'fact';
            } else if (isPropositionSource(premise)) {
                kind = 'proposition';
            } else {
                kind = 'derivation';
                fromPathIndex = visit(premise);
            }
            sources.push({
                formula: premiseFormula,
                kind,
                fromPathIndex
            });
        }
        const entry = {
            rule: step.ruleType,
            premises,
            conclusion,
            sources
        };
        path.push(entry);
        const idx = path.length - 1;
        visited.set(step, idx);
        return idx;
    };

    visit(targetStep);
    return path;
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

    // Strict-mode invariant check on _knownFormulas.
    // When validation.strictMode is true, every mutating method calls this
    // to confirm the dedup index has not drifted from steps + facts.
    //
    _assertKnownFormulasInvariant(methodName) {
        const validation = getConfigSection('validation') || {};
        if (!validation.strictMode) { return; }
        const rebuilt = buildKnownFormulas(this);
        if (rebuilt.size !== this._knownFormulas.size) {
            throw new Error(
                `_knownFormulas size mismatch after ${methodName}: ` +
                `rebuilt=${rebuilt.size}, tracked=${this._knownFormulas.size}`
            );
        }
        for (const f of rebuilt) {
            if (!this._knownFormulas.has(f)) {
                throw new Error(`_knownFormulas missing "${f}" after ${methodName}`);
            }
        }
    }

    addFact(formulaStr) {
        if (typeof formulaStr !== 'string' || formulaStr.trim().length === 0) {
            throw new Error('addFact requires a non-empty string argument');
        }
        this.facts.add(formulaStr);
        this._knownFormulas.add(normalizeFormula(formulaStr));
        this._assertKnownFormulasInvariant('addFact');
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

    // Collect every atom mentioned anywhere in the system — facts and step
    // formulas, including atoms nested inside compound formulas. Used by
    // isAtomResolvable to recognise atoms that the inference rules might
    // still derive (notably modus ponens, which produces atoms appearing
    // only as consequents inside implications).
    //
    _collectInScopeAtoms() {
        const atoms = new Set();
        const addFrom = (formula) => {
            try {
                for (const atom of extractFormulaAtoms(formula)) {
                    atoms.add(atom);
                }
            } catch (e) {
                // Unparseable formula in facts/steps is unexpected but should
                // not crash the resolvability check.
            }
        };
        for (const fact of this.facts) {
            addFrom(fact);
        }
        for (const step of this.steps) {
            for (const formula of step.formulas) {
                addFrom(formula);
            }
        }
        return atoms;
    }

    // Check if a formula atom is resolvable (considering negation and
    // potential derivation via the inference rules).
    //
    isAtomResolvable(atom) {
        // Directly available as a fact or step formula.
        if (this.isFactAvailable(atom)) {
            return true;
        }

        // Auto-negation: ~X is available if X is not.
        if (atom.startsWith('~')) {
            const baseFact = atom.slice(1);
            return !this.isFactAvailable(baseFact);
        }
        if (this.isFactAvailable(`~${atom}`)) {
            return true;
        }

        // Atom may be derivable via inference (e.g. modus ponens) if it
        // appears anywhere in any formula in the system.
        return this._collectInScopeAtoms().has(atom);
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
        this._assertKnownFormulasInvariant('addProposition');
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

    // Applies the alpha rule (conjunction introduction) to two steps.
    // Subtype must be 'and'. Implication-introduction is not a sound rule
    // without conditional-proof / assumption-discharge, so it is not
    // supported. Declare implications as compound propositions instead.
    //
    alphaRule(step1, step2, ruleType) {
        const A = getUniqueFormula(step1);
        const B = getUniqueFormula(step2);
        if (ruleType !== 'and') {
            throw new Error(`alphaRule: unsupported subtype '${ruleType}'. Only 'and' is supported. Declare implications as compound propositions.`);
        }
        const newFormula = `(${A} ∧ ${B})`;
        const newStep = {
            origin: 'AlphaRule',
            ruleType,
            from: [step1, step2],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        this._assertKnownFormulasInvariant('alphaRule');
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
        this._assertKnownFormulasInvariant('betaRule');
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
        this._assertKnownFormulasInvariant('contrapositionRule');
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
        this._assertKnownFormulasInvariant('doubleNegationRule');
        return newStep;
    }

    // Applies disjunction elimination (proof by cases): from (A ∨ B),
    // (A → C), and (B → C), derive C.
    //
    // Three-premise rule. The order of the two implications can be either
    // (left-disjunct→consequent, right-disjunct→consequent) or swapped;
    // the matcher tries both. The shared consequent is the derived formula.
    //
    orEliminationRule(disjStep, implStepA, implStepB) {
        const disjFormula = getUniqueFormula(disjStep);
        const implAFormula = getUniqueFormula(implStepA);
        const implBFormula = getUniqueFormula(implStepB);

        const parsedDisj = parseFormulaFromString(disjFormula);
        if (!isDisjunction(parsedDisj)) {
            throw new Error('orEliminationRule: first input must be a disjunction.');
        }
        const parsedImplA = parseFormulaFromString(implAFormula);
        const parsedImplB = parseFormulaFromString(implBFormula);
        if (!isImplication(parsedImplA) || !isImplication(parsedImplB)) {
            throw new Error('orEliminationRule: second and third inputs must be implications.');
        }

        const leftDisjunct = normalizeFormula(astToStringImpl(parsedDisj.left));
        const rightDisjunct = normalizeFormula(astToStringImpl(parsedDisj.right));
        const partsA = getImplicationParts(parsedImplA);
        const partsB = getImplicationParts(parsedImplB);
        const antA = normalizeFormula(astToStringImpl(partsA.antecedent));
        const antB = normalizeFormula(astToStringImpl(partsB.antecedent));
        const consA = normalizeFormula(astToStringImpl(partsA.consequent));
        const consB = normalizeFormula(astToStringImpl(partsB.consequent));

        if (consA !== consB) {
            throw new Error(`orEliminationRule: implication consequents must agree; got "${astToStringImpl(partsA.consequent)}" and "${astToStringImpl(partsB.consequent)}".`);
        }
        // Antecedents must match the disjuncts in either order.
        //
        const matchesABorder = antA === leftDisjunct && antB === rightDisjunct;
        const matchesBAorder = antA === rightDisjunct && antB === leftDisjunct;
        if (!matchesABorder && !matchesBAorder) {
            throw new Error(`orEliminationRule: implication antecedents "${astToStringImpl(partsA.antecedent)}" and "${astToStringImpl(partsB.antecedent)}" do not match the disjuncts of "${disjFormula}".`);
        }

        const newFormula = astToStringImpl(partsA.consequent);
        const newStep = {
            origin: 'OrEliminationRule',
            ruleType: 'orElim',
            from: [disjStep, implStepA, implStepB],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        this._assertKnownFormulasInvariant('orEliminationRule');
        return newStep;
    }

    // Applies conjunction elimination (left): from (A ∧ B), derive A.
    //
    andEliminationL(step) {
        const f = getUniqueFormula(step);
        const parsed = parseFormulaFromString(f);
        if (!isConjunction(parsed)) {
            throw new Error('andEliminationL requires a conjunction.');
        }
        const newFormula = astToStringImpl(parsed.left);
        const newStep = {
            origin: 'AndEliminationRule',
            ruleType: 'andElimL',
            from: [step],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        this._assertKnownFormulasInvariant('andEliminationL');
        return newStep;
    }

    // Applies conjunction elimination (right): from (A ∧ B), derive B.
    //
    andEliminationR(step) {
        const f = getUniqueFormula(step);
        const parsed = parseFormulaFromString(f);
        if (!isConjunction(parsed)) {
            throw new Error('andEliminationR requires a conjunction.');
        }
        const newFormula = astToStringImpl(parsed.right);
        const newStep = {
            origin: 'AndEliminationRule',
            ruleType: 'andElimR',
            from: [step],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        this._assertKnownFormulasInvariant('andEliminationR');
        return newStep;
    }

    // Applies disjunctive modus ponens: given ((A ∨ B) → C) and either
    // A or B, derive C. The first input must be an implication whose
    // antecedent is a disjunction; the second input must equal one of
    // the two disjuncts under normalizeFormula.
    //
    disjunctiveModusPonensRule(implicationStep, disjunctStep) {
        const implFormula = getUniqueFormula(implicationStep);
        const disjunctFormula = getUniqueFormula(disjunctStep);

        const parsed = parseFormulaFromString(implFormula);
        if (!isImplication(parsed)) {
            throw new Error('disjunctiveModusPonensRule: first input must be an implication.');
        }
        const parts = getImplicationParts(parsed);
        if (!isDisjunction(parts.antecedent)) {
            throw new Error("disjunctiveModusPonensRule: first input's antecedent must be a disjunction.");
        }
        const leftNorm = normalizeFormula(astToStringImpl(parts.antecedent.left));
        const rightNorm = normalizeFormula(astToStringImpl(parts.antecedent.right));
        const suppliedNorm = normalizeFormula(disjunctFormula);
        if (suppliedNorm !== leftNorm && suppliedNorm !== rightNorm) {
            throw new Error(`disjunctiveModusPonensRule: second input "${disjunctFormula}" does not match either disjunct of "${astToStringImpl(parts.antecedent)}".`);
        }

        const newFormula = astToStringImpl(parts.consequent);
        const newStep = {
            origin: 'DisjunctiveModusPonensRule',
            ruleType: 'disjunctiveMP',
            from: [implicationStep, disjunctStep],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        this._assertKnownFormulasInvariant('disjunctiveModusPonensRule');
        return newStep;
    }

    // Applies disjunctive syllogism: given (A ∨ B) and ~A, derive B.
    // (Symmetric: given (A ∨ B) and ~B, derive A.)
    //
    // The first input must be a disjunction; the second must be the
    // negation of one of the two disjuncts under normalized comparison.
    // The surviving disjunct is derived.
    //
    disjunctiveSyllogismRule(disjunctionStep, negationStep) {
        const disjFormula = getUniqueFormula(disjunctionStep);
        const negFormula = getUniqueFormula(negationStep);

        const parsed = parseFormulaFromString(disjFormula);
        if (!isDisjunction(parsed)) {
            throw new Error('disjunctiveSyllogismRule: first input must be a disjunction.');
        }
        const negLeftNorm = normalizeFormula(astToStringImpl(negate(parsed.left)));
        const negRightNorm = normalizeFormula(astToStringImpl(negate(parsed.right)));
        const negSuppliedNorm = normalizeFormula(negFormula);

        let survivorAst;
        if (negSuppliedNorm === negLeftNorm) {
            survivorAst = parsed.right;
        } else if (negSuppliedNorm === negRightNorm) {
            survivorAst = parsed.left;
        } else {
            throw new Error(`disjunctiveSyllogismRule: second input "${negFormula}" is not the negation of either disjunct of "${disjFormula}".`);
        }

        const newFormula = astToStringImpl(survivorAst);
        const newStep = {
            origin: 'DisjunctiveSyllogismRule',
            ruleType: 'disjunctiveSyllogism',
            from: [disjunctionStep, negationStep],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        this._assertKnownFormulasInvariant('disjunctiveSyllogismRule');
        return newStep;
    }

    // Applies modus tollens: given (A → B) and ~B, derive ~A.
    // step1 must carry an implication; step2 must carry the negated
    // consequent. Matching is by normalized-string equality.
    //
    modusTollensRule(implicationStep, negatedConsequentStep) {
        const implFormula = getUniqueFormula(implicationStep);
        const negConsFormula = getUniqueFormula(negatedConsequentStep);

        const parsed = parseFormulaFromString(implFormula);
        if (!isImplication(parsed)) {
            throw new Error('modusTollensRule: first input must be an implication.');
        }

        const parts = getImplicationParts(parsed);
        const expectedNegConsString = astToStringImpl(negate(parts.consequent));

        if (normalizeFormula(expectedNegConsString) !== normalizeFormula(negConsFormula)) {
            throw new Error(`modusTollensRule: negated-consequent mismatch — implication's negated consequent is "${expectedNegConsString}", second input is "${negConsFormula}".`);
        }

        const newFormula = astToStringImpl(negate(parts.antecedent));
        const newStep = {
            origin: 'ModusTollensRule',
            ruleType: 'modusTollens',
            from: [implicationStep, negatedConsequentStep],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        this._assertKnownFormulasInvariant('modusTollensRule');
        return newStep;
    }

    // Applies modus ponens: given (A → B) and A, derive B.
    // step1 must carry an implication; step2 must carry its antecedent.
    // Antecedent matching is by normalized-string equality, not unification.
    //
    modusPonensRule(implicationStep, antecedentStep) {
        const implFormula = getUniqueFormula(implicationStep);
        const antFormula = getUniqueFormula(antecedentStep);

        const parsed = parseFormulaFromString(implFormula);
        if (!isImplication(parsed)) {
            throw new Error('modusPonensRule: first input must be an implication.');
        }

        const parts = getImplicationParts(parsed);
        const antecedentString = astToStringImpl(parts.antecedent);

        if (normalizeFormula(antecedentString) !== normalizeFormula(antFormula)) {
            throw new Error(`modusPonensRule: antecedent mismatch — implication's antecedent is "${antecedentString}", second input is "${antFormula}".`);
        }

        const newFormula = astToStringImpl(parts.consequent);
        const newStep = {
            origin: 'ModusPonensRule',
            ruleType: 'modusPonens',
            from: [implicationStep, antecedentStep],
            formulas: new Set([newFormula])
        };
        this.steps.push(newStep);
        this._knownFormulas.add(normalizeFormula(newFormula));
        this._assertKnownFormulasInvariant('modusPonensRule');
        return newStep;
    }


    // Expand one level of the proof search by applying all rules.
    // Uses check-before-clone: computes what a rule would produce before
    // allocating a clone, avoiding wasted allocations for redundant derivations.
    //
    // Iterates over real steps AND synthetic single-formula wrappers built
    // from this.facts. The wrappers are fresh objects each call and never
    // added to this.steps or any clone's steps — they exist only to let
    // raw resolver facts participate in rule application. A derived step
    // whose `from` includes a fact wrapper is still valid because:
    //   - validateProof reads .formulas from each `from` entry, not identity.
    //   - cloneSystem copies facts (the string set), so subsequent expansions
    //     in clones rebuild their own wrappers from the same fact set.
    //
    expandOneLevel() {
        const { maxSteps } = getReasoningLimits();
        if (this.steps.length >= maxSteps) {
            return [];
        }
        const newSystems = [];
        const stepCount = this.steps.length;

        // Build synthetic step wrappers for each fact. Each wrapper has the
        // shape of a single-formula step so existing rule code reads it
        // uniformly. ruleType: 'fact' is in SKIPPED_RULE_TYPES (validateProof)
        // so these wrappers are not flagged as missing derivation handlers.
        //
        const factWrappers = [];
        for (const fact of this.facts) {
            factWrappers.push({
                origin: 'Fact',
                ruleType: 'fact',
                from: [],
                formulas: new Set([fact])
            });
        }
        const factCount = factWrappers.length;
        const sourceCount = stepCount + factCount;

        // Return the source object for index `idx` from this system. Indices
        // [0, stepCount) point to real steps; [stepCount, sourceCount) point
        // to fact wrappers built above.
        //
        const sourceAt = (idx) => idx < stepCount ? this.steps[idx] : factWrappers[idx - stepCount];

        // Return the source object for index `idx` from a cloned system.
        // Real-step indices resolve into the clone's own steps array;
        // fact-wrapper indices resolve to the wrapper we built in the parent
        // (safe because wrappers are immutable and validateProof / path-build
        // read formulas only).
        //
        const cloneSourceAt = (clone, idx) => idx < stepCount ? clone.steps[idx] : factWrappers[idx - stepCount];

        // Precompute the set of known canonical formulas to avoid cloning
        // when the derived formula is already known. `generated` tracks
        // formulas produced earlier in THIS expandOneLevel call — necessary
        // because under commutativity normalization, (A ∧ B) and (B ∧ A)
        // both canonicalize to (A ∧ B); without per-call tracking both
        // orderings would produce sibling clones with the same content.
        //
        const known = this._knownFormulas;
        const generated = new Set();

        // Two-step rules (alpha AND, beta OR, modus ponens). Iterate over
        // the unified source list (steps + fact wrappers).
        //
        for (let i = 0; i < sourceCount; i += 1) {
            const stepI = sourceAt(i);
            if (stepI.formulas.size !== 1) { continue; }
            const formulaI = [...stepI.formulas][0];

            for (let j = 0; j < sourceCount; j += 1) {
                const stepJ = sourceAt(j);
                if (stepJ.formulas.size !== 1) { continue; }
                const formulaJ = [...stepJ.formulas][0];

                // Alpha AND: (A ∧ B). Skip i==j: (A ∧ A) is idempotent with A
                // and just bloats the search space without proving anything new.
                //
                if (i !== j) {
                    const candidateAnd = normalizeFormula(`(${formulaI} ∧ ${formulaJ})`);
                    if (!known.has(candidateAnd) && !generated.has(candidateAnd)) {
                        generated.add(candidateAnd);
                        const sysClone = cloneSystem(this);
                        sysClone.alphaRule(cloneSourceAt(sysClone, i), cloneSourceAt(sysClone, j), 'and');
                        newSystems.push(sysClone);
                    }
                }

                // Beta OR: (A ∨ B). Skip i==j for the same reason (A ∨ A ≡ A).
                //
                if (i !== j) {
                    const candidateOr = normalizeFormula(`(${formulaI} ∨ ${formulaJ})`);
                    if (!known.has(candidateOr) && !generated.has(candidateOr)) {
                        generated.add(candidateOr);
                        const sysClone = cloneSystem(this);
                        sysClone.betaRule(cloneSourceAt(sysClone, i), cloneSourceAt(sysClone, j));
                        newSystems.push(sysClone);
                    }
                }

                // Modus ponens: if formula i is an implication whose
                // antecedent matches formula j, derive the consequent.
                //
                try {
                    const parsedI = parseFormulaFromString(formulaI);
                    if (isImplication(parsedI)) {
                        const partsI = getImplicationParts(parsedI);
                        const antString = astToStringImpl(partsI.antecedent);
                        if (normalizeFormula(antString) === normalizeFormula(formulaJ)) {
                            const consequentString = astToStringImpl(partsI.consequent);
                            const candidateMP = normalizeFormula(consequentString);
                            if (!known.has(candidateMP) && !generated.has(candidateMP)) {
                                generated.add(candidateMP);
                                const sysClone = cloneSystem(this);
                                sysClone.modusPonensRule(cloneSourceAt(sysClone, i), cloneSourceAt(sysClone, j));
                                newSystems.push(sysClone);
                            }
                        }
                    }
                } catch (e) {
                    _logger.debug(`modus ponens skipped for "${formulaI}", "${formulaJ}": ${e.message}`);
                }

                // Modus tollens: if formula i is an implication whose negated
                // consequent matches formula j, derive the negation of the
                // antecedent. Single-step rule; supersedes the two-step
                // contraposition + MP chain when both inputs are present.
                //
                try {
                    const parsedI = parseFormulaFromString(formulaI);
                    if (isImplication(parsedI)) {
                        const partsI = getImplicationParts(parsedI);
                        const negConsString = astToStringImpl(negate(partsI.consequent));
                        if (normalizeFormula(negConsString) === normalizeFormula(formulaJ)) {
                            const negAntString = astToStringImpl(negate(partsI.antecedent));
                            const candidateMT = normalizeFormula(negAntString);
                            if (!known.has(candidateMT) && !generated.has(candidateMT)) {
                                generated.add(candidateMT);
                                const sysClone = cloneSystem(this);
                                sysClone.modusTollensRule(cloneSourceAt(sysClone, i), cloneSourceAt(sysClone, j));
                                newSystems.push(sysClone);
                            }
                        }
                    }
                } catch (e) {
                    _logger.debug(`modus tollens skipped for "${formulaI}", "${formulaJ}": ${e.message}`);
                }

                // Disjunctive MP: if formula i is an implication whose
                // antecedent is a disjunction (A ∨ B) and formula j matches
                // either disjunct, derive the consequent. Bounded by the
                // number of disjunctive-antecedent implications in scope.
                //
                try {
                    const parsedI = parseFormulaFromString(formulaI);
                    if (isImplication(parsedI)) {
                        const partsI = getImplicationParts(parsedI);
                        if (isDisjunction(partsI.antecedent)) {
                            const leftDisjunct = normalizeFormula(astToStringImpl(partsI.antecedent.left));
                            const rightDisjunct = normalizeFormula(astToStringImpl(partsI.antecedent.right));
                            const formulaJNorm = normalizeFormula(formulaJ);
                            if (formulaJNorm === leftDisjunct || formulaJNorm === rightDisjunct) {
                                const consequentString = astToStringImpl(partsI.consequent);
                                const candidateDMP = normalizeFormula(consequentString);
                                if (!known.has(candidateDMP) && !generated.has(candidateDMP)) {
                                    generated.add(candidateDMP);
                                    const sysClone = cloneSystem(this);
                                    sysClone.disjunctiveModusPonensRule(
                                        cloneSourceAt(sysClone, i),
                                        cloneSourceAt(sysClone, j)
                                    );
                                    newSystems.push(sysClone);
                                }
                            }
                        }
                    }
                } catch (e) {
                    _logger.debug(`disjunctive MP skipped for "${formulaI}", "${formulaJ}": ${e.message}`);
                }

                // Disjunctive syllogism: if formula i is a disjunction (A ∨ B)
                // and formula j is the negation of one disjunct, derive the
                // other disjunct.
                //
                try {
                    const parsedI = parseFormulaFromString(formulaI);
                    if (isDisjunction(parsedI)) {
                        const negLeftNorm = normalizeFormula(astToStringImpl(negate(parsedI.left)));
                        const negRightNorm = normalizeFormula(astToStringImpl(negate(parsedI.right)));
                        const formulaJNorm = normalizeFormula(formulaJ);
                        let survivor = null;
                        if (formulaJNorm === negLeftNorm) {
                            survivor = astToStringImpl(parsedI.right);
                        } else if (formulaJNorm === negRightNorm) {
                            survivor = astToStringImpl(parsedI.left);
                        }
                        if (survivor !== null) {
                            const candidateDS = normalizeFormula(survivor);
                            if (!known.has(candidateDS) && !generated.has(candidateDS)) {
                                generated.add(candidateDS);
                                const sysClone = cloneSystem(this);
                                sysClone.disjunctiveSyllogismRule(
                                    cloneSourceAt(sysClone, i),
                                    cloneSourceAt(sysClone, j)
                                );
                                newSystems.push(sysClone);
                            }
                        }
                    }
                } catch (e) {
                    _logger.debug(`disjunctive syllogism skipped for "${formulaI}", "${formulaJ}": ${e.message}`);
                }

            }
        }

        // Single-step rules (contraposition, double negation). Iterate over
        // both real steps and fact wrappers.
        //
        for (let i = 0; i < sourceCount; i += 1) {
            const stepI = sourceAt(i);
            if (stepI.formulas.size !== 1) { continue; }
            const formula = [...stepI.formulas][0];

            // Contraposition applies only to implications.
            try {
                const parsed = parseFormula(formula);
                if (isImplication(parsed.ast)) {
                    const parts = getImplicationParts(parsed.ast);
                    const contraFormula = astToStringImpl(
                        createImplication(negate(parts.consequent), negate(parts.antecedent))
                    );
                    const cKey = normalizeFormula(contraFormula);
                    if (!known.has(cKey) && !generated.has(cKey)) {
                        generated.add(cKey);
                        const sysClone = cloneSystem(this);
                        sysClone.contrapositionRule(cloneSourceAt(sysClone, i));
                        newSystems.push(sysClone);
                    }
                }
            } catch (e) {
                _logger.debug(`contraposition skipped for "${formula}": ${e.message}`);
            }

            try {
                const parsedForIntro = parseFormulaFromString(formula);
                const introCandidate = astToStringImpl(negate(negate(parsedForIntro)));
                const iKey = normalizeFormula(introCandidate);
                if (!known.has(iKey) && !generated.has(iKey)) {
                    generated.add(iKey);
                    const sysClone = cloneSystem(this);
                    sysClone.doubleNegationRule(cloneSourceAt(sysClone, i), 'introduction');
                    newSystems.push(sysClone);
                }
            } catch (e) {
                _logger.debug(`double-negation introduction skipped for "${formula}": ${e.message}`);
            }

            try {
                const parsedForElim = parseFormulaFromString(formula);
                if (isNegation(parsedForElim) && isNegation(parsedForElim.operand)) {
                    const elimCandidate = astToStringImpl(normalizeAST(parsedForElim.operand.operand));
                    const eKey = normalizeFormula(elimCandidate);
                    if (!known.has(eKey) && !generated.has(eKey)) {
                        generated.add(eKey);
                        const sysClone = cloneSystem(this);
                        sysClone.doubleNegationRule(cloneSourceAt(sysClone, i), 'elimination');
                        newSystems.push(sysClone);
                    }
                }
            } catch (e) {
                _logger.debug(`double-negation elimination skipped for "${formula}": ${e.message}`);
            }

            // Conjunction elimination: from (A ∧ B), derive A and B as separate
            // children. Two children per conjunction step (left and right).
            //
            try {
                const parsedConj = parseFormulaFromString(formula);
                if (isConjunction(parsedConj)) {
                    const leftCandidate = astToStringImpl(parsedConj.left);
                    const lKey = normalizeFormula(leftCandidate);
                    if (!known.has(lKey) && !generated.has(lKey)) {
                        generated.add(lKey);
                        const sysClone = cloneSystem(this);
                        sysClone.andEliminationL(cloneSourceAt(sysClone, i));
                        newSystems.push(sysClone);
                    }
                    const rightCandidate = astToStringImpl(parsedConj.right);
                    const rKey = normalizeFormula(rightCandidate);
                    if (!known.has(rKey) && !generated.has(rKey)) {
                        generated.add(rKey);
                        const sysClone = cloneSystem(this);
                        sysClone.andEliminationR(cloneSourceAt(sysClone, i));
                        newSystems.push(sysClone);
                    }
                }
            } catch (e) {
                _logger.debug(`and-elimination skipped for "${formula}": ${e.message}`);
            }
        }

        // Disjunction elimination (∨E / proof by cases): three-premise rule.
        // From (A ∨ B), (A → C), (B → C), derive C.
        //
        // O(n³) in source count in the worst case. Three perf safeguards:
        //   1. Precompute parsed AST + canonical strings for each source ONCE.
        //   2. Outer loop scans only disjunctions; inner loops only implications.
        //   3. Early-prune in the innermost loop: literal-string match on
        //      normalized consequent BEFORE any deeper validation. If the two
        //      implications don't agree on consequent, skip — saves the
        //      antecedent-matching work.
        //
        const sourceMeta = new Array(sourceCount);
        for (let s = 0; s < sourceCount; s += 1) {
            const src = sourceAt(s);
            if (src.formulas.size !== 1) {
                sourceMeta[s] = null;
                continue;
            }
            const f = [...src.formulas][0];
            try {
                const ast = parseFormulaFromString(f);
                if (isDisjunction(ast)) {
                    sourceMeta[s] = {
                        kind: 'disj',
                        leftNorm: normalizeFormula(astToStringImpl(ast.left)),
                        rightNorm: normalizeFormula(astToStringImpl(ast.right))
                    };
                } else if (isImplication(ast)) {
                    const parts = getImplicationParts(ast);
                    sourceMeta[s] = {
                        kind: 'impl',
                        antNorm: normalizeFormula(astToStringImpl(parts.antecedent)),
                        consNorm: normalizeFormula(astToStringImpl(parts.consequent)),
                        consStr: astToStringImpl(parts.consequent)
                    };
                } else {
                    sourceMeta[s] = { kind: 'other' };
                }
            } catch (e) {
                sourceMeta[s] = null;
            }
        }

        for (let d = 0; d < sourceCount; d += 1) {
            const meta_d = sourceMeta[d];
            if (!meta_d || meta_d.kind !== 'disj') { continue; }
            const leftNorm = meta_d.leftNorm;
            const rightNorm = meta_d.rightNorm;

            for (let a = 0; a < sourceCount; a += 1) {
                const meta_a = sourceMeta[a];
                if (!meta_a || meta_a.kind !== 'impl') { continue; }
                // Match impl_a against either disjunct.
                //
                const aMatchesLeft = meta_a.antNorm === leftNorm;
                const aMatchesRight = meta_a.antNorm === rightNorm;
                if (!aMatchesLeft && !aMatchesRight) { continue; }

                for (let b = 0; b < sourceCount; b += 1) {
                    if (b === a) { continue; }
                    const meta_b = sourceMeta[b];
                    if (!meta_b || meta_b.kind !== 'impl') { continue; }
                    // Early-prune: consequents must literal-match. This is
                    // the cheapest filter and rules out the vast majority of
                    // candidate triples before the antecedent check below.
                    //
                    if (meta_a.consNorm !== meta_b.consNorm) { continue; }
                    // The two implication antecedents must cover both disjuncts.
                    //
                    const bMatchesOther = aMatchesLeft
                        ? meta_b.antNorm === rightNorm
                        : meta_b.antNorm === leftNorm;
                    if (!bMatchesOther) { continue; }

                    // Triple matches. Check dedup before cloning.
                    //
                    if (known.has(meta_a.consNorm) || generated.has(meta_a.consNorm)) { continue; }
                    generated.add(meta_a.consNorm);
                    const sysClone = cloneSystem(this);
                    sysClone.orEliminationRule(
                        cloneSourceAt(sysClone, d),
                        cloneSourceAt(sysClone, a),
                        cloneSourceAt(sysClone, b)
                    );
                    newSystems.push(sysClone);
                }
            }
        }

        return newSystems;
    }

    // Classify HOW a target is proved against this system. Used by
    // searchForProof to populate result.derivation. Returns one of:
    //   'fact'      — target matches an entry in this.facts (a sensor reading).
    //   'asserted'  — target matches a step whose origin is 'Proposition'
    //                 (a stipulated axiom in the scenario YAML, NOT derived).
    //   'derived'   — target matches a step produced by a rule application
    //                 during YAML step execution (alpha, beta, contraposition,
    //                 doubleNegation, modusPonens).
    //   null        — target is not yet in facts or steps.
    //
    // Consumers gating real-world side effects should treat 'asserted' as
    // "the scenario stipulated this; the scenario did not derive it" and
    // typically refuse to act on it.
    //
    _classifyProofSource(targetFormula) {
        const normalizedTarget = normalizeFormula(targetFormula);
        for (const f of this.facts) {
            if (normalizeFormula(f) === normalizedTarget) {
                return 'fact';
            }
        }
        for (const step of this.steps) {
            for (const f of step.formulas) {
                if (normalizeFormula(f) === normalizedTarget) {
                    return step.origin === 'Proposition' ? 'asserted' : 'derived';
                }
            }
        }
        return null;
    }

    // Find the step in this system whose formula matches the target. Used by
    // path building to anchor the chain. Returns null if no step matches.
    //
    _findMatchingStep(targetFormula) {
        const normalizedTarget = normalizeFormula(targetFormula);
        // Walk steps in reverse — for BFS-derived chains, the most recently
        // added step is the matching one, so reverse iteration is faster.
        //
        for (let i = this.steps.length - 1; i >= 0; i -= 1) {
            const step = this.steps[i];
            for (const f of step.formulas) {
                if (normalizeFormula(f) === normalizedTarget) {
                    return step;
                }
            }
        }
        return null;
    }

    searchForProof(targetFormula, maxDepth) {
        const limits = getReasoningLimits();
        const depth = maxDepth !== undefined ? maxDepth : limits.maxProofDepth;

        const result = {
            proven: false,
            derivation: null,
            path: [],
            missingFacts: [],
            skippedSteps: [],
            depth: 0
        };

        if (this.isProved(targetFormula)) {
            result.proven = true;
            result.derivation = this._classifyProofSource(targetFormula);
            // For 'derived' (the formula was produced by a YAML step), build
            // the chain. For 'fact' and 'asserted', path stays [] — there is
            // no derivation to walk.
            //
            if (result.derivation === 'derived') {
                const matching = this._findMatchingStep(targetFormula);
                if (matching) {
                    result.path = buildDerivationPath(matching, this);
                    result.depth = result.path.length;
                }
            }
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

        const queue = [{ system: this, depth: 0 }];
        const visited = new Set([getSystemSignature(this)]);
        let iterations = 0;

        while (queue.length) {
            iterations += 1;
            if (iterations > limits.maxIterations || queue.length > limits.maxQueueSize) {
                return result;
            }
            const { system, depth: currentDepth } = queue.shift();
            if (system.isProved(targetFormula)) {
                result.proven = true;
                result.derivation = 'inference';
                const matching = system._findMatchingStep(targetFormula);
                if (matching) {
                    result.path = buildDerivationPath(matching, system);
                }
                result.depth = result.path.length;
                return result;
            }
            if (currentDepth >= depth) {
                continue;
            }
            for (const child of system.expandOneLevel()) {
                if (child.isProved(targetFormula)) {
                    result.proven = true;
                    result.derivation = 'inference';
                    const matching = child._findMatchingStep(targetFormula);
                    if (matching) {
                        result.path = buildDerivationPath(matching, child);
                    }
                    result.depth = result.path.length;
                    return result;
                }
                const sig = getSystemSignature(child);
                if (!visited.has(sig)) {
                    visited.add(sig);
                    queue.push({ system: child, depth: currentDepth + 1 });
                }
            }
        }
        return result;
    }
}
