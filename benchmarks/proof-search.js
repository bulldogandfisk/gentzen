// proof-search.js
// Baseline benchmark for GentzenSystem.searchForProof.
//
// Run: node benchmarks/proof-search.js
//
// Reports median, min, and max wall-clock time per scenario over a fixed
// number of iterations. The numbers are not stable across machines but
// are stable enough run-to-run on the same machine to detect regressions
// or improvements from engine changes.
//

import { performance } from 'node:perf_hooks';
import { GentzenSystem } from '../gentzen.js';
import { updateConfig } from '../utilities/config.js';
import { clearNormalizeCache } from '../utilities/formulaUtils.js';
import { LogLevel } from '../utilities/logger.js';

// Suppress engine logging during measurement.
updateConfig({ logging: { level: LogLevel.WARN } });

// Lift defaults so the harder scenarios can complete.
updateConfig({
    reasoning: {
        maxProofDepth: 6,
        maxIterations: 10000,
        maxQueueSize: 10000,
        maxSteps: 200
    }
});

const ITERATIONS = 5;

const SCENARIOS = [
    {
        name: 'tiny',
        props: ['A', 'B'],
        target: '(A ∧ B)',
        depth: 1,
        purpose: 'sanity check, near-floor cost'
    },
    {
        name: 'small',
        props: ['A', 'B', 'C'],
        target: '((A ∧ B) ∨ C)',
        depth: 2,
        purpose: 'typical'
    },
    {
        name: 'medium',
        props: ['A', 'B', 'C', 'D'],
        target: '(((A ∧ B) ∧ C) ∧ D)',
        depth: 3,
        purpose: 'depth dominates — left-leaning chain'
    },
    {
        name: 'wide',
        props: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        target: '((A ∧ B) ∨ C)',
        depth: 2,
        purpose: 'width dominates'
    },
    {
        name: 'ceiling',
        props: ['A', 'B', 'C', 'D', 'E', 'F'],
        target: '((((A ∧ B) ∧ C) ∧ D) ∧ E)',
        depth: 4,
        purpose: 'BFS ceiling — search exhausts a limit before proving'
    },
    {
        name: 'mp-single',
        props: ['A', '(A → B)'],
        target: 'B',
        depth: 1,
        purpose: 'modus ponens — single application'
    },
    {
        name: 'mp-chain',
        props: ['A', '(A → B)', '(B → C)'],
        target: 'C',
        depth: 2,
        purpose: 'modus ponens — two-step chain'
    }
];

function buildSystem(props) {
    const sys = new GentzenSystem();
    for (const p of props) {
        sys.addProposition(p);
    }
    return sys;
}

function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function runScenario(scenario) {
    // One warm-up run, discarded. Lets the JIT settle and primes the
    // formula normalize cache. The cache is then cleared so each timed
    // run starts from the same state.
    //
    buildSystem(scenario.props).searchForProof(scenario.target);

    const times = [];
    let proven = false;

    for (let i = 0; i < ITERATIONS; i += 1) {
        clearNormalizeCache();
        const sys = buildSystem(scenario.props);
        const t0 = performance.now();
        const result = sys.searchForProof(scenario.target);
        const t1 = performance.now();
        times.push(t1 - t0);
        proven = result.proven;
    }

    return {
        name: scenario.name,
        props: scenario.props.length,
        depth: scenario.depth,
        proven,
        medianMs: median(times),
        minMs: Math.min(...times),
        maxMs: Math.max(...times)
    };
}

function pad(s, n) {
    return String(s).padEnd(n);
}

function formatNumber(n) {
    return n.toFixed(3);
}

console.log(`Gentzen proof-search benchmark`);
console.log(`Node ${process.version}, iterations per scenario: ${ITERATIONS}`);
console.log(`Date: ${new Date().toISOString()}`);
console.log('');

const headers = ['Scenario', 'Props', 'Depth', 'Proven', 'Median(ms)', 'Min(ms)', 'Max(ms)'];
const widths = [10, 7, 7, 8, 12, 10, 10];

console.log(headers.map((h, i) => pad(h, widths[i])).join(''));
console.log('-'.repeat(widths.reduce((a, b) => a + b, 0)));

for (const scenario of SCENARIOS) {
    const result = runScenario(scenario);
    const row = [
        result.name,
        result.props,
        result.depth,
        result.proven,
        formatNumber(result.medianMs),
        formatNumber(result.minMs),
        formatNumber(result.maxMs)
    ];
    console.log(row.map((v, i) => pad(v, widths[i])).join(''));
}
