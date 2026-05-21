# Gentzen — Formal Reasoning for Agents

## The Agent Safety Problem

You're building agent systems that take real actions in the world. Before any agent runs, you need to **prove the world is in a safe state**. But current approaches are brittle, error-prone, and impossible to audit.

**Boolean Soup** — your pre-condition checks look like this:
```javascript
if (user.isAuthenticated && !system.maintenanceMode &&
    (user.hasRole('admin') || (user.hasRole('user') && !user.isRestricted)) &&
    system.healthCheck() && !rateLimit.exceeded) {
    // Let agent run
}
```

**No Audit Trail** — when an agent is blocked, you get: *"Access denied"* — but why?

**Fragile Logic** — one wrong `&&` vs `||` and your agents misbehave in production.

**Scattered Conditions** — pre-condition logic is buried across multiple files and functions.

Gentzen replaces boolean soup with formal proof. You declare business rules in YAML. Resolver functions gather real-world facts. The reasoning engine applies inference rules to produce a mathematical proof that your conditions are met — or a clear explanation of what's missing.

## Quick Start

```bash
git clone https://github.com/bulldogandfisk/gentzen.git
cd gentzen
yarn install
node examples/demo-minimal.js
```

```javascript
import { join } from 'node:path';
import { runGentzenReasoning } from './main.js';

const WD = import.meta.dirname;

const results = await runGentzenReasoning(
    join(WD, './scenarios/mixed-scenario.yaml'),
    { resolversPath: join(WD, './resolvers') }
);

console.log(`${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);
```

## Documentation

Full documentation lives in [`docs/`](docs/index.md).

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Zero-to-running in 5 minutes — install, first scenario, first result |
| [Scenario Guide](docs/scenario-guide.md) | Complete guide to writing YAML scenario files with worked examples |
| [Logical Rules](docs/logical-rules.md) | Every inference rule with formal definition, diagram, and business example |
| [Operator Reference](docs/operator-reference.md) | Quick-reference card — operators, precedence, formula syntax |
| [Resolvers](docs/resolvers.md) | How to write, organize, and debug resolver functions |
| [Architecture](docs/architecture.md) | System internals — modules, data structures, configuration |
| [Proof Engine](docs/proof-engine.md) | BFS proof search algorithm and formula parsing pipeline |
| [API Reference](docs/api-reference.md) | Complete API surface — exports, options, config keys, return types |
| [Integration Patterns](docs/integration-patterns.md) | Real-world deployment — agent gates, batch processing, testing strategies |

## Testing

```bash
yarn test                 # All tests
yarn test:unit            # Unit tests only
yarn test:integration     # Integration tests only
yarn test:verbose         # Detailed output
```

## License

[SSPL-1.0](LICENSE.md)
