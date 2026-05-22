# Gentzen — Auditable Rule-Based Reasoning for Agent Decision Gates

An engine for agents to determine what is the case in the world before acting, and to produce a step-by-step proof of that determination that survives compliance audit and post-hoc review.

## What this is

Agents take real actions. Before each action, you need an answer to: *given the current state of the world, which of these actions are justified?*

Gentzen answers that question as a **per-target verdict table**, not a single yes/no. You write business rules once, in YAML, as compound propositions like `((CustomerVerified ∧ NotFlagged) → ProcessOrder)`. Resolver functions observe the world (databases, APIs, time, queues). The engine reports, for every candidate action you declare, one of:

- `✅ PROVEN (inference)` — the rules plus the current world state derive this action.
- `✅ PROVEN (fact)` — a resolver reported this directly.
- `⚠ ASSUMED (proposition)` — the scenario YAML declared this as an axiom; the agent did **not** derive it. **Refuse to gate side effects on this**.
- `❌ FAILED` — the conditions aren't met. The missing facts are surfaced so the agent can explain why.

Two things you can rely on:

- **Resolver failures abort the run.** A throw or rejection in a resolver is a sensor outage, not a `false` answer. The scenario returns `{ aborted: true, reason: 'resolver_error', resolverName, cause }` and the agent must not act.
- **Every `inference`-class result comes with an auditable derivation chain** — a structured list of which rules fired on which premises to produce the conclusion. Pipe it into your audit log; render it for humans.

## What this is not

Not a general-purpose classical theorem prover. The engine supports a focused fragment of classical propositional logic suited to agent decision-gating: modus ponens, contraposition, double negation (intro/elim), conjunction introduction & elimination, disjunction introduction, disjunction elimination (proof by cases). It does **not** introduce implications or biconditionals from arbitrary pairs of formulas — those constructs are stipulated as propositions, not synthesized. See `docs/logical-rules.md` for the complete list.

## Quick start

```bash
git clone https://github.com/bulldogandfisk/gentzen.git
cd gentzen
yarn install
node examples/demo-minimal.js
```

```javascript
import { join } from 'node:path';
import { runGentzenReasoning, isAbortedResults } from './main.js';

const WD = import.meta.dirname;

const results = await runGentzenReasoning(
    join(WD, './scenarios/mixed-scenario.yaml'),
    { resolversPath: join(WD, './resolvers') }
);

if (isAbortedResults(results)) {
    // Sensor outage; do not act.
    console.error(`Aborted: ${results.resolverName} — ${results.cause}`);
    process.exit(1);
}

// Per-target verdict table.
//
for (const target of results.targets) {
    if (target.proven && target.derivation !== 'asserted') {
        console.log(`OK to ${target.formula}`);
    } else if (target.derivation === 'asserted') {
        console.warn(`Refusing to gate on ${target.formula} (asserted-only)`);
    } else {
        console.log(`Cannot ${target.formula}: missing ${target.missingFacts.join(', ')}`);
    }
}
```

## Documentation

Full documentation lives in [`docs/`](docs/index.md).

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Zero-to-running in 5 minutes — install, first scenario, first result |
| [Scenario Guide](docs/scenario-guide.md) | Writing YAML scenarios: propositions as business rules, resolvers as sensors |
| [Scenario Author Checklist](docs/scenario-author-checklist.md) | Prescriptive dos and don'ts; pre-deployment review checklist for any scenario PR |
| [Logical Rules](docs/logical-rules.md) | Every inference rule with formal definition and business example |
| [Operator Reference](docs/operator-reference.md) | Quick-reference — operators, precedence, formula syntax |
| [Resolvers](docs/resolvers.md) | How to write, organize, and debug resolver functions |
| [Architecture](docs/architecture.md) | System internals — modules, data structures, configuration |
| [Proof Engine](docs/proof-engine.md) | BFS proof search and derivation-path building |
| [API Reference](docs/api-reference.md) | Complete API surface — exports, options, config keys, return types |
| [Integration Patterns](docs/integration-patterns.md) | Real-world deployment — agent gates, batch processing, what to do with each derivation class |

## Testing

```bash
yarn test                 # All tests
yarn test:unit            # Unit tests only
yarn test:integration     # Integration tests only
yarn test:verbose         # Detailed output
```

## License

[SSPL-1.0](LICENSE.md)
