# Who This Is For: Agent Pre-Condition Validation

## The Agent Safety Problem

You're building agent systems that take real actions in the world. Before any agent runs, you need to **prove the world is in a safe state**. But current approaches are brittle, error-prone, and impossible to audit.

### The Pain Points You're Experiencing:

**🔥 Boolean Soup**: Your pre-condition checks look like this:
```javascript
if (user.isAuthenticated && !system.maintenanceMode && 
    (user.hasRole('admin') || (user.hasRole('user') && !user.isRestricted)) &&
    system.healthCheck() && !rateLimit.exceeded) {
    // Let agent run
}
```

**🔥 No Audit Trail**: When an agent is blocked, you get: *"Access denied"* - but why?

**🔥 Fragile Logic**: One wrong `&&` vs `||` and your agents misbehave in production

**🔥 Scattered Conditions**: Pre-condition logic is buried across multiple files and functions

**🔥 Testing Nightmare**: How do you test all combinations of 10+ boolean conditions?

## What This Is

This system enables **declarative logical reasoning** by:
- Defining logical scenarios in YAML files.
- Connecting to real data through JavaScript resolver functions.
- Performing formal proof search using natural deduction rules.
- Providing verifiable conclusions about complex logical conditions.

## Development

```bash
# Clone/download this repository. Then...
cd <your repo>
yarn install
```

### Basic Usage
```javascript
import { join } from 'node:path';
import { runGentzenReasoning } from '../main.js';

const WD = import.meta.dirname;

console.log('🧪 Minimal example - just the basics...\n');

// Simplest possible usage
const results = await runGentzenReasoning(
    join(WD, './scenarios/mixed-scenario.yaml'),
    { resolversPath: join(WD, './resolvers') }
);

console.log(`✅ ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);
```

## Scenario Files (`examples/scenarios/mixed-scenario.yaml`):
```yaml
propositions:
  - ProcessOrder
  - SendAlert
  - ScheduleMaintenance

steps:
  # Business logic: Customer + Payment.
  - rule: alpha
    subtype: and
    from:
      - CustomerIsVIP
      - PaymentProcessed

  # Combined business decision
  - rule: alpha
    subtype: implies
    from:
      - (CustomerIsVIP ∧ PaymentProcessed)
      - ProcessOrder

# Provable targets.
targets:
  - (CustomerIsVIP ∧ PaymentProcessed)
  - ProcessOrder
```

**Resolver Functions** (`examples/resolvers/factResolvers.js`):
```javascript
export const travelFactResolvers = {
    CustomerIsVIP: () => true,
    PaymentProcessed: () => true,
    SystemHealthy: () => true,
    IsBusinessHours: () => false  
};
```

**Run Example**:
```bash
node examples/demo-minimal.js
```

## Core Features

- **Formula Parsing**: Full AST-based formula parser with operator precedence.
- **Auto-Negation**: False resolvers automatically create negated facts (e.g., `false` → `~FactName`).
- **Natural Deduction Rules**: Five implemented rules for logical derivation.
- **YAML Scenarios**: Declarative scenario definition with step-by-step reasoning.
- **Resolver Discovery**: Automatic discovery of resolver functions.
- **Comprehensive Testing**: Unit and integration tests covering all functionality.

### Logical Rules Available

1. **Alpha Rule (AND/IMPLIES)**:
   - `alpha` + `subtype: and` → Creates conjunction: `(A ∧ B)`
   - `alpha` + `subtype: implies` → Creates implication: `(A → B)`

2. **Beta Rule (OR)**:
   - `beta` → Creates disjunction: `(A ∨ B)`

3. **Contraposition**:
   - `contraposition` → From `(A → B)` derives `(~B → ~A)`

4. **Double Negation**:
   - `doubleNegation` + `subtype: introduction` → `A` becomes `~~A`
   - `doubleNegation` + `subtype: elimination` → `~~A` becomes `A`

5. **Equivalence**:
   - `equivalence` → Creates biconditional: `(A ↔ B)`

## API 

```javascript
runGentzenReasoning(scenarioPath, options)
```

**Parameters**:
- `scenarioPath` (string): Path to YAML scenario file
- `options` (object):
  - `verbose` (boolean): Enable detailed output.
  - `customResolvers` (object): Direct resolver functions.
  - `resolversPath` (string): Path to auto-discover resolvers.
  - `validate` (boolean): Enable scenario validation.

**Returns**: Results object with `targets`, `summary`, `availableFacts`, etc.

## Auto-Negation System

When resolvers return `false`, the system automatically makes negated facts available:

```javascript
const resolvers = {
    UserLoggedIn: () => true,        // Creates: UserLoggedIn
    MaintenanceMode: () => false,    // Creates: ~MaintenanceMode  
    SystemOnline: () => false        // Creates: ~SystemOnline
};
```

This enables reasoning with negative conditions:
```yaml
targets:
  - (UserLoggedIn ∧ ~MaintenanceMode)  # Provable!
```

### Testing
```bash
yarn test                 # All tests
yarn test:unit           # Unit tests only  
yarn test:integration    # Integration tests only
yarn test:verbose        # Detailed output
```

## Logical Operators

- `∧` (AND): Both conditions must be true
- `∨` (OR): Either condition can be true  
- `→` (IMPLIES): If-then logical implication
- `↔` (EQUIVALENT): If-and-only-if (biconditional)
- `~` (NOT): Negation
- `~~` (DOUBLE NEGATION): Classical logic double negation

**Operator Aliases**: The parser accepts multiple formats for conditionals:
- AND: `∧`, `AND`, `&`
- OR: `∨`, `OR`, `|`  
- IMPLIES: `→`, `IMPLIES`, `->`
