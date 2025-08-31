# Scenario Files Guide

## What Are Scenario Files?

Scenario files are YAML documents that define logical reasoning workflows for the Gentzen system. They allow you to declare complex business logic, system checks, and decision flows in a structured, auditable format. Instead of writing nested boolean conditions in code, you define logical steps that can be formally proven.

**Key Benefits:**
- **Declarative Logic**: Define what should happen, not how
- **Formal Proofs**: Get mathematical certainty about your logic
- **Audit Trail**: See exactly why decisions were made
- **Testable**: All combinations can be systematically verified

## File Structure

Every scenario file has three main sections:

```yaml
propositions:     # Actions your system can take
steps:           # Logical reasoning steps  
targets:         # Goals to prove
```

## Example Walkthrough

Let's break down this business scenario step-by-step:

```yaml
propositions:
  - ProcessOrder
  - SendAlert  
  - ScheduleMaintenance

steps:
  # Business logic: Customer + Payment
  - rule: alpha
    subtype: and
    from:
      - CustomerIsVIP
      - PaymentProcessed

  # System check: Health + Time  
  - rule: alpha
    subtype: and
    from:
      - SystemHealthy
      - IsBusinessHours

  # Combined business decision
  - rule: alpha
    subtype: implies
    from:
      - (CustomerIsVIP ∧ PaymentProcessed)
      - ProcessOrder

  # System maintenance decision
  - rule: alpha
    subtype: implies
    from:
      - (SystemHealthy ∧ IsBusinessHours)
      - ScheduleMaintenance

targets:
  - (CustomerIsVIP ∧ PaymentProcessed)
  - (SystemHealthy ∧ IsBusinessHours)  
  - ProcessOrder
  - ScheduleMaintenance
```

### Section 1: Propositions

```yaml
propositions:
  - ProcessOrder
  - SendAlert
  - ScheduleMaintenance
```

**Purpose**: Declare the possible actions your system can take.

These are the outcomes you want to reason about. In this business scenario:
- `ProcessOrder` - Execute a customer order
- `SendAlert` - Notify administrators  
- `ScheduleMaintenance` - Queue system maintenance

**Think of propositions as**: The buttons your system can press or actions it can take.

### Section 2: Steps

Steps define the logical reasoning process. Each step applies a **rule** to derive new conclusions.

#### Step 1: Combine Business Conditions
```yaml
- rule: alpha
  subtype: and
  from:
    - CustomerIsVIP
    - PaymentProcessed
```

**What it does**: Creates the formula `(CustomerIsVIP ∧ PaymentProcessed)`

**Business meaning**: "A valid business transaction requires both VIP status AND successful payment"

#### Step 2: Combine System Conditions  
```yaml
- rule: alpha
  subtype: and
  from:
    - SystemHealthy
    - IsBusinessHours
```

**What it does**: Creates the formula `(SystemHealthy ∧ IsBusinessHours)`

**Business meaning**: "Safe system operation requires health checks AND business hours"

#### Step 3: Business Decision Rule
```yaml
- rule: alpha
  subtype: implies
  from:
    - (CustomerIsVIP ∧ PaymentProcessed)
    - ProcessOrder
```

**What it does**: Creates the implication `((CustomerIsVIP ∧ PaymentProcessed) → ProcessOrder)`

**Business meaning**: "IF we have a valid business transaction, THEN process the order"

#### Step 4: System Decision Rule
```yaml
- rule: alpha
  subtype: implies
  from:
    - (SystemHealthy ∧ IsBusinessHours)
    - ScheduleMaintenance
```

**What it does**: Creates the implication `((SystemHealthy ∧ IsBusinessHours) → ScheduleMaintenance)`

**Business meaning**: "IF the system is healthy during business hours, THEN we can schedule maintenance"

### Section 3: Targets

```yaml
targets:
  - (CustomerIsVIP ∧ PaymentProcessed)
  - (SystemHealthy ∧ IsBusinessHours)
  - ProcessOrder
  - ScheduleMaintenance
```

**Purpose**: Specify what you want to prove.

The system will attempt to prove each target using:
1. **Facts** from your resolver functions
2. **Logical derivations** from your steps

**Results**: Each target will be marked as ✅ PROVEN or ❌ UNPROVEN.

## Logical Rules Reference

### Alpha Rule
Creates conjunctions (AND) and implications (IF-THEN).

**Conjunction** (`subtype: and`):
```yaml
- rule: alpha
  subtype: and
  from:
    - FactA
    - FactB
# Result: (FactA ∧ FactB)
```

**Implication** (`subtype: implies`):
```yaml  
- rule: alpha
  subtype: implies
  from:
    - Condition
    - Action
# Result: (Condition → Action)
```

### Beta Rule
Creates disjunctions (OR).

```yaml
- rule: beta
  from:
    - OptionA
    - OptionB  
# Result: (OptionA ∨ OptionB)
```

### Contraposition
From `(A → B)` derives `(~B → ~A)`.

```yaml
- rule: contraposition
  from:
    - (UserLoggedIn → AccessGranted)
# Result: (~AccessGranted → ~UserLoggedIn)
```

### Double Negation
Handle classical logic double negation.

**Introduction** (A becomes ~~A):
```yaml
- rule: doubleNegation
  subtype: introduction
  from:
    - SystemHealthy
# Result: ~~SystemHealthy
```

**Elimination** (~~A becomes A):
```yaml
- rule: doubleNegation
  subtype: elimination
  from:
    - ~~SystemHealthy
# Result: SystemHealthy
```

### Equivalence
Creates biconditional relationships (IF AND ONLY IF).

```yaml
- rule: equivalence
  from:
    - MaintenanceMode
    - SystemUnavailable
# Result: (MaintenanceMode ↔ SystemUnavailable)
```

## Logical Operators

| Symbol | Meaning | Aliases |
|--------|---------|---------|
| `∧` | AND | `AND`, `&` |
| `∨` | OR | `OR`, `\|` |
| `→` | IMPLIES | `IMPLIES`, `->` |
| `↔` | EQUIVALENT | `IFF`, `<->` |
| `~` | NOT | `NOT`, `!` |
| `~~` | DOUBLE NEGATION | - |

**Example with aliases**:
```yaml
targets:
  - (CustomerIsVIP AND PaymentProcessed)    # Using alias
  - (CustomerIsVIP ∧ PaymentProcessed)      # Using symbol
  - (SystemHealthy & IsBusinessHours)       # Using shorthand
```

## Best Practices

### 1. Start Simple
Begin with basic AND/OR conditions before adding complex implications.

```yaml
# Good: Simple combination first
- rule: alpha
  subtype: and
  from:
    - UserAuthenticated
    - UserAuthorized

# Then build on it
- rule: alpha
  subtype: implies
  from:
    - (UserAuthenticated ∧ UserAuthorized)
    - GrantAccess
```

### 2. Use Descriptive Names
Make your facts and propositions self-documenting.

```yaml
# Good
- CustomerIsVIP
- PaymentProcessed
- SystemHealthy

# Avoid
- Flag1
- Check2
- Status
```

### 3. Group Related Logic
Use comments to organize related steps.

```yaml
steps:
  # User validation
  - rule: alpha
    # ... user-related logic

  # System checks  
  - rule: alpha
    # ... system-related logic

  # Business decisions
  - rule: alpha
    # ... decision logic
```

### 4. Test Your Targets
Make sure your targets are actually provable with your facts.

```yaml
# If you have these facts:
# CustomerIsVIP: true
# PaymentProcessed: true

# Then this target is provable:
targets:
  - (CustomerIsVIP ∧ PaymentProcessed)

# But this would NOT be provable:
targets:
  - (CustomerIsVIP ∧ SomeOtherFact)  # SomeOtherFact not available
```

## Common Patterns

### Business Authorization
```yaml
steps:
  # Combine user credentials  
  - rule: alpha
    subtype: and
    from:
      - UserAuthenticated
      - UserHasRole

  # Business rule
  - rule: alpha
    subtype: implies
    from:
      - (UserAuthenticated ∧ UserHasRole)
      - GrantAccess

targets:
  - GrantAccess
```

### System Health Checks
```yaml
steps:
  # Health indicators
  - rule: alpha
    subtype: and
    from:
      - DatabaseConnected
      - MemoryAvailable
      - DiskSpaceOK

  # Health decision
  - rule: alpha
    subtype: implies
    from:
      - (DatabaseConnected ∧ MemoryAvailable ∧ DiskSpaceOK)
      - SystemHealthy

targets:
  - SystemHealthy
```

### Error Handling with Negation
```yaml
steps:
  # Error conditions (using auto-negation)
  - rule: alpha
    subtype: and
    from:
      - ~MaintenanceMode      # From resolver returning false
      - ~SystemOverloaded     # From resolver returning false

  # Safe operation rule
  - rule: alpha
    subtype: implies
    from:
      - (~MaintenanceMode ∧ ~SystemOverloaded)
      - AllowOperations

targets:
  - AllowOperations
```

## Connecting to Resolver Functions

Your scenario steps work with **resolver functions** that provide real-world facts:

**Scenario file** (logical structure):
```yaml
targets:
  - (CustomerIsVIP ∧ PaymentProcessed)
```

**Resolver file** (data source):
```javascript
export const businessResolvers = {
    CustomerIsVIP: () => checkCustomerStatus(userId),
    PaymentProcessed: () => validatePayment(orderId)
};
```

**Result**: The system proves your logical targets using real data.

This separation allows you to:
- Change business logic without touching data access code
- Test different scenarios with mock data
- Audit decisions with complete reasoning traces
- Confidently verify complex conditional logic

## Running Your Scenario

```javascript
import { runGentzenReasoning } from './main.js';

const results = await runGentzenReasoning(
    './scenarios/my-business-logic.yaml',
    { 
        resolversPath: './resolvers',
        verbose: true 
    }
);

console.log(`✅ ${results.summary.provenTargets}/${results.summary.totalTargets} targets proven`);
```

The system will show you exactly which targets were proven and provide a complete reasoning trace for audit purposes.