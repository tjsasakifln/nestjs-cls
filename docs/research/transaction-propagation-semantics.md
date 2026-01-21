# Transaction Propagation Semantics

**Research Document**
**Issue:** [#11](https://github.com/tjsasakifln/nestjs-cls/issues/11)
**Milestone:** Architectural Refactor v7.0
**Date:** 2026-01-21
**Author:** Human Developer (AI-assisted research)

---

## Executive Summary

This document defines correct transaction propagation semantics for nestjs-cls, specifically addressing Issue #196 (transaction context reuse corruption with non-awaited transactions). After analyzing Spring Framework and TypeORM semantics, we identify critical flaws in the current `ifNested: 'inherit'` approach for `Propagation.Required` and propose solutions for proper context isolation.

**Key Findings:**

- Current `Propagation.Required` uses `ifNested: 'inherit'`, causing parent/child context corruption
- Non-awaited child transactions can outlive parents, triggering "Transaction already finished" errors
- Spring's REQUIRED creates **physical transaction participation**, not context inheritance
- Proposed solution: Implement `ifNested: 'isolated'` mode for proper transaction lifecycle tracking

---

## Table of Contents

1. [Industry Standards](#1-industry-standards)
2. [Current nestjs-cls Implementation](#2-current-nestjs-cls-implementation)
3. [Problem Analysis](#3-problem-analysis)
4. [Propagation Mode Semantics](#4-propagation-mode-semantics)
5. [Decision Tables](#5-decision-tables)
6. [Sequence Diagrams](#6-sequence-diagrams)
7. [Proposed Solutions](#7-proposed-solutions)
8. [References](#8-references)

---

## 1. Industry Standards

### 1.1 Spring Framework @Transactional

Spring Framework defines transaction propagation through the [`@Transactional`](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html) annotation with 7 propagation modes.

#### REQUIRED (Default)

- **Behavior:** Enforces a physical transaction, either locally for the current scope if no transaction exists yet or **participating in an existing 'outer' transaction** defined for a larger scope
- **Key Insight:** "Participating" means sharing the same transaction, not inheriting context
- **Commit/Rollback:** Outer transaction controls commit; inner rollback marks entire transaction for rollback

#### REQUIRES_NEW

- **Behavior:** Always starts a new transaction, **suspending** the existing transaction until the new one completes
- **Key Insight:** Creates independent physical transaction; outer transaction paused
- **Commit/Rollback:** Inner transaction commits/rolls back independently; outer transaction resumed afterward

#### NESTED

- **Behavior:** Uses a single physical transaction with multiple **savepoints** for partial rollbacks
- **Key Insight:** Uses JDBC savepoints; not supported by all transaction managers (e.g., Hibernate/JPA)
- **Commit/Rollback:** Inner rollback to savepoint; outer rollback undoes everything including nested
- **Limitation:** Savepoint support is driver/database-dependent

**Sources:**

- [Spring Framework Transaction Propagation](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)
- [Spring Transaction Propagation and Isolation (Baeldung)](https://www.baeldung.com/spring-transactional-propagation-isolation)
- [Spring Transaction Propagation API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html)

### 1.2 TypeORM QueryRunner

TypeORM implements transactions through QueryRunner with support for nested transactions via savepoints.

#### Transaction Basics

- **QueryRunner:** Single database connection managing transaction lifecycle
- **Methods:** `startTransaction(isolationLevel?)`, `commitTransaction()`, `rollbackTransaction()`
- **Savepoint Support:** Nested transactions create savepoints named `typeorm_${transactionDepth}`

#### Nested Transaction Behavior

- **Mechanism:** Transaction depth counter tracks nesting level
- **Savepoint Creation:** Each nested level creates a savepoint
- **Rollback:** Rolls back to savepoint, not entire transaction
- **Known Issues:** Historical bugs with transactionDepth counter causing duplicate SAVEPOINT names ([Issue #10209](https://github.com/typeorm/typeorm/issues/10209))

**Sources:**

- [Advanced Transaction Management with NestJS & TypeORM](https://medium.com/@dev.muhammet.ozen/advanced-transaction-management-with-nestjs-typeorm-43a839363491)
- [TypeORM Transactions Documentation](https://deepwiki.com/typeorm/typeorm/5.4-transactions)
- [TypeORM QueryRunner Documentation](https://deepwiki.com/typeorm/typeorm/7.2-query-runners)
- [TypeORM Nested Transaction Commit](https://github.com/typeorm/typeorm/commit/6523526003bab74a0df8f7d578790c1728b26057)

### 1.3 Async Context and Non-Awaited Transactions

Critical insights about asynchronous transaction management:

#### Context Isolation

- **Problem:** Asynchronous methods run in separate threads, causing transaction context to be absent in new threads
- **Spring Limitation:** `REQUIRES_NEW` propagation doesn't apply when async method runs outside original transaction context
- **Best Practice:** Decouple asynchronous execution from transactional logic in separate service methods

#### Lifecycle Challenges

- **Threading Context:** Async operations change threading context, causing disposal exceptions
- **Recommendation:** Nested transactions with async operations are **not recommended** due to complex debugging challenges
- **Non-Awaited Transactions:** Can outlive parent contexts, causing "transaction already finished" errors

**Sources:**

- [Spring: Synchronizing @Transactional and @Async](https://dzone.com/articles/mastering-spring-synchronizing-transactional-and-a)
- [Handling Async Execution with Transactions in Spring](https://dev.to/arashariani/handling-asynchronous-execution-with-transactions-in-spring-a-common-pitfall-and-how-to-solve-it-5ah4)

---

## 2. Current nestjs-cls Implementation

### 2.1 Transaction Host Architecture

**File:** `packages/transactional/src/lib/transaction-host.ts`

The `TransactionHost` class implements transaction lifecycle management using NestJS CLS (Continuation-Local Storage).

#### Key Components

```typescript
// Line 18-55: Singleton pattern for transaction host instances
class TransactionHost<TAdapter> {
    private readonly cls = ClsServiceManager.getClsService();
    private readonly transactionInstanceSymbol: symbol;

    static getInstance<TAdapter>(
        connectionName?: string,
    ): TransactionHost<TAdapter> {
        const instanceSymbol = getTransactionClsKey(connectionName);
        return this._instanceMap.get(instanceSymbol);
    }
}
```

**Design Pattern:**

- Singleton per connection name
- Transaction instance stored in CLS context using symbol key
- Fallback to non-transactional instance when no CLS context active

### 2.2 Propagation Implementation

**File:** `packages/transactional/src/lib/transaction-host.ts:158-221`

```typescript
private decidePropagationAndRun(propagation: string, options: any, fn: Function) {
    switch (propagation) {
        case Propagation.Required:
            if (this.isTransactionActive()) {
                return this.cls.run({ ifNested: 'inherit' }, fn); // ⚠️ PROBLEM
            } else {
                return this.runWithTransaction(options, fn);
            }

        case Propagation.RequiresNew:
            return this.runWithTransaction(options, fn);

        case Propagation.Nested:
            if (this.isTransactionActive()) {
                return this.runInNestedTransaction(options, fn);
            } else {
                return this.runWithTransaction(options, fn);
            }

        // ... other modes
    }
}
```

#### Critical Methods

**runWithTransaction (Line 223-232):**

```typescript
private runWithTransaction(options: any, fn: Function) {
    return this.cls.run({ ifNested: 'inherit' }, () =>
        this._options
            .wrapWithTransaction(options, fn, this.setTxInstance.bind(this))
            .finally(() => this.setTxInstance(undefined))
    );
}
```

**Problem:** Uses `ifNested: 'inherit'` for **all** new transactions, not just `Required`.

### 2.3 Current Propagation Modes

**File:** `packages/transactional/src/lib/propagation.ts`

| Mode         | Enum Value      | Description                                            |
| ------------ | --------------- | ------------------------------------------------------ |
| Required     | `REQUIRED`      | Reuse existing transaction or create new one (default) |
| RequiresNew  | `REQUIRES_NEW`  | Always create new transaction                          |
| NotSupported | `NOT_SUPPORTED` | Run without transaction                                |
| Mandatory    | `MANDATORY`     | Require existing transaction or throw                  |
| Never        | `NEVER`         | Throw if transaction exists                            |
| Supports     | `SUPPORTS`      | Use transaction if exists, otherwise continue without  |
| Nested       | `NESTED`        | Create subtransaction (savepoint) if supported         |

---

## 3. Problem Analysis

### 3.1 Issue #196: Transaction Context Reuse Corruption

**Scenario:** Non-awaited nested transactions cause parent context corruption

**Test Case:** `packages/transactional/test/edge-cases/nested-non-awaited-transaction.spec.ts:46-77`

```typescript
const childTransaction = () =>
    txHost.withTransaction(async () => {
        await txHost.tx.query('SELECT Child 1');
        await new Promise((resolve) => setTimeout(resolve, 10)); // simulate delay
        await txHost.tx.query('SELECT Child 2'); // ⚠️ throws here
    });

const parentTransaction = () =>
    txHost.withTransaction(async () => {
        await txHost.tx.query('SELECT Parent 1');
        childTransaction(); // ❌ not awaited
        // parent transaction ends here
    });

await parentTransaction();
// Child transaction still running after parent committed
```

**Expected Failure:**

```
Error: Transaction already finished
```

**Query Log:**

```sql
BEGIN TRANSACTION;
SELECT Parent 1
SELECT Child 1
COMMIT TRANSACTION; -- Parent commits while child still active
-- Child tries: SELECT Child 2 -- FAILS
```

### 3.2 Root Cause Analysis

#### Current Behavior (Line 172 in transaction-host.ts)

```typescript
case Propagation.Required:
    if (this.isTransactionActive()) {
        return this.cls.run({ ifNested: 'inherit' }, fn); // ⚠️
    }
```

**What `ifNested: 'inherit'` Does:**

- Reuses parent CLS context **including transaction reference**
- Child and parent share same transaction instance
- Parent can complete and commit, invalidating shared transaction
- Child continues executing with **invalid** (committed) transaction

#### Expected Behavior (Spring REQUIRED)

**Correct semantics:**

1. Child **participates** in parent transaction
2. Child **cannot outlive** parent transaction scope
3. Parent **waits** for child before committing (if child is awaited)
4. Non-awaited children should either:
    - **Option A:** Be isolated in separate context (fail independently)
    - **Option B:** Be tracked and prevented from outliving parent

### 3.3 ifNested Modes in ClsService

**Source:** `nestjs-cls` core package

| Mode       | Behavior                          | Use Case                        |
| ---------- | --------------------------------- | ------------------------------- |
| `inherit`  | Reuses parent context             | Sharing state within same scope |
| `reuse`    | Reuses context or creates new     | Default behavior                |
| `isolated` | Creates independent child context | **Proposed fix for Required**   |

**Key Insight:** Current implementation conflates "transaction participation" (Spring) with "context inheritance" (CLS).

---

## 4. Propagation Mode Semantics

### 4.1 Semantic Specification

#### REQUIRED

**Standard Semantics (Spring):**

- Join existing transaction if present
- Create new transaction if absent
- Rollback marks entire transaction for rollback
- Commit controlled by outermost transaction

**Current nestjs-cls Behavior:**

- ✅ Correctly creates transaction if absent
- ⚠️ **Incorrectly** allows child to outlive parent (uses `inherit`)
- ❌ No lifecycle tracking for non-awaited children

**Proposed nestjs-cls Behavior:**

- Use `ifNested: 'inherit'` for **awaited** children (transaction participation)
- Use `ifNested: 'isolated'` for context isolation **or** track child lifecycle
- Throw error if parent attempts to commit with active children

#### REQUIRES_NEW

**Standard Semantics (Spring):**

- Always create new independent transaction
- Suspend outer transaction
- Inner transaction commits/rolls back independently
- Resume outer transaction after inner completes

**Current nestjs-cls Behavior:**

- ✅ Creates new transaction via `runWithTransaction()`
- ⚠️ Uses `ifNested: 'inherit'`, but creates new transaction instance
- ❌ Does not "suspend" outer transaction (both can run concurrently)

**Proposed nestjs-cls Behavior:**

- Use `ifNested: 'isolated'` to create independent context
- No changes needed for transaction creation (already correct)

#### NESTED

**Standard Semantics (Spring/TypeORM):**

- Create savepoint within existing transaction
- Rollback to savepoint on inner failure
- Outer rollback undoes everything including savepoints

**Current nestjs-cls Behavior:**

- ✅ Delegates to adapter's `wrapWithNestedTransaction()`
- ✅ Uses savepoints (e.g., `SAVEPOINT nested_transaction;`)
- ✅ Restores parent transaction on completion (line 251)

**Assessment:** **No changes needed** (correct implementation)

#### NOT_SUPPORTED

**Standard Semantics (Spring):**

- Run without transaction
- Suspend existing transaction if present

**Current nestjs-cls Behavior:**

- ✅ Clears transaction via `setTxInstance(undefined)`
- ✅ Resumes parent transaction on completion

**Assessment:** **No changes needed**

#### MANDATORY

**Standard Semantics (Spring):**

- Require existing transaction or throw `TransactionNotActiveError`

**Current nestjs-cls Behavior:**

- ✅ Throws `TransactionNotActiveError` if none active
- ✅ Executes directly without creating new context

**Assessment:** **No changes needed**

#### NEVER

**Standard Semantics (Spring):**

- Throw `TransactionAlreadyActiveError` if transaction exists

**Current nestjs-cls Behavior:**

- ✅ Throws `TransactionAlreadyActiveError` if active

**Assessment:** **No changes needed**

#### SUPPORTS

**Standard Semantics (Spring):**

- Use transaction if exists
- Continue without transaction if absent

**Current nestjs-cls Behavior:**

- ✅ Uses transaction if active (executes directly)
- ✅ Runs without transaction if not active

**Assessment:** **No changes needed**

---

## 5. Decision Tables

### 5.1 Propagation Mode Behavior Matrix

| Propagation       | Transaction Exists? | Creates New TX?   | Joins Parent TX? | Independent Commit? | ifNested Mode | Notes                 |
| ----------------- | ------------------- | ----------------- | ---------------- | ------------------- | ------------- | --------------------- |
| **REQUIRED**      | No                  | ✅ Yes            | N/A              | ✅ Yes              | `inherit`     | Default mode          |
| **REQUIRED**      | Yes                 | ❌ No             | ✅ Yes           | ❌ No               | `inherit`     | **⚠️ Problem area**   |
| **REQUIRES_NEW**  | No                  | ✅ Yes            | N/A              | ✅ Yes              | `inherit`     | Should be `isolated`  |
| **REQUIRES_NEW**  | Yes                 | ✅ Yes            | ❌ No            | ✅ Yes              | `inherit`     | Should be `isolated`  |
| **NESTED**        | No                  | ✅ Yes            | N/A              | ✅ Yes              | `inherit`     | Behaves like REQUIRED |
| **NESTED**        | Yes                 | ❌ No (savepoint) | ✅ Yes           | ❌ No               | `inherit`     | Correct               |
| **NOT_SUPPORTED** | No                  | ❌ No             | N/A              | N/A                 | `inherit`     | Correct               |
| **NOT_SUPPORTED** | Yes                 | ❌ No (suspends)  | ❌ No            | N/A                 | `inherit`     | Correct               |
| **MANDATORY**     | No                  | ❌ Throws         | N/A              | N/A                 | N/A           | Correct               |
| **MANDATORY**     | Yes                 | ❌ No             | ✅ Yes           | ❌ No               | None (direct) | Correct               |
| **NEVER**         | No                  | ❌ No             | N/A              | N/A                 | `inherit`     | Correct               |
| **NEVER**         | Yes                 | ❌ Throws         | N/A              | N/A                 | N/A           | Correct               |
| **SUPPORTS**      | No                  | ❌ No             | N/A              | N/A                 | `inherit`     | Correct               |
| **SUPPORTS**      | Yes                 | ❌ No             | ✅ Yes           | ❌ No               | None (direct) | Correct               |

**Legend:**

- ✅ Yes: Feature implemented correctly
- ❌ No: Expected behavior
- ⚠️ Problem area: Requires fix

### 5.2 Non-Awaited Transaction Decision Table

| Scenario                | Parent TX | Child TX (non-awaited) | Current Behavior                       | Expected Behavior            |
| ----------------------- | --------- | ---------------------- | -------------------------------------- | ---------------------------- |
| REQUIRED + REQUIRED     | Active    | Inherits parent        | ❌ Parent commits, child fails         | ⚠️ Error or isolated context |
| REQUIRED + REQUIRES_NEW | Active    | Creates new            | ❌ Both can finish independently       | ✅ Correct (independent)     |
| REQUIRES_NEW + REQUIRED | Active    | Creates new parent     | ❌ Outer commits, child's parent fails | ⚠️ Error or isolated context |
| NESTED + NESTED         | Active    | Creates savepoint      | ❌ Parent releases savepoint           | ⚠️ Error or track savepoint  |

**Key Insight:** Non-awaited transactions are **inherently unsafe** and should either:

1. Be explicitly **forbidden** (throw error at runtime)
2. Use **isolated contexts** (fail independently)
3. Track **child lifecycle** and prevent parent commit

---

## 6. Sequence Diagrams

### 6.1 REQUIRED with Awaited Child (Correct)

```
┌─────────┐                  ┌─────────────┐                  ┌──────────┐
│ Caller  │                  │ Transaction │                  │ Database │
│         │                  │   Host      │                  │          │
└────┬────┘                  └──────┬──────┘                  └────┬─────┘
     │                              │                              │
     │ withTransaction(parent)      │                              │
     ├─────────────────────────────>│                              │
     │                              │ BEGIN TRANSACTION            │
     │                              ├─────────────────────────────>│
     │                              │                              │
     │                              │ withTransaction(child)       │
     │                              │ [TX active, use REQUIRED]    │
     │                              │<─────────┐                   │
     │                              │          │                   │
     │                              │ cls.run({ifNested:'inherit'})│
     │                              │          │                   │
     │                              │ await childFn()              │
     │                              │          │                   │
     │                              │<─────────┘                   │
     │                              │                              │
     │                              │ COMMIT TRANSACTION           │
     │                              ├─────────────────────────────>│
     │<─────────────────────────────┤                              │
     │                              │                              │
```

**Notes:**

- Child executes within parent CLS context
- Child awaited before parent commits
- ✅ **Correct behavior**

### 6.2 REQUIRED with Non-Awaited Child (Problem)

```
┌─────────┐                  ┌─────────────┐                  ┌──────────┐
│ Caller  │                  │ Transaction │                  │ Database │
│         │                  │   Host      │                  │          │
└────┬────┘                  └──────┬──────┘                  └────┬─────┘
     │                              │                              │
     │ withTransaction(parent)      │                              │
     ├─────────────────────────────>│                              │
     │                              │ BEGIN TRANSACTION            │
     │                              ├─────────────────────────────>│
     │                              │                              │
     │                              │ withTransaction(child)       │
     │                              │ [TX active, use REQUIRED]    │
     │                              │<─────────┐                   │
     │                              │          │                   │
     │                              │ cls.run({ifNested:'inherit'})│
     │                              │          │                   │
     │                              │ childFn() // ⚠️ NOT AWAITED  │
     │                              │          │                   │
     │                              │<─────────┘                   │
     │                              │                              │
     │                              │ COMMIT TRANSACTION           │
     │                              ├─────────────────────────────>│
     │<─────────────────────────────┤                              │
     │                              │                              │
     │                              │ [Child still executing]      │
     │                              │ ❌ query() FAILS             │
     │                              │ Error: Transaction finished  │
     │                              │                              │
```

**Notes:**

- Child not awaited, parent commits immediately
- Child still holds reference to committed transaction
- ❌ **Failure scenario** (Issue #196)

### 6.3 REQUIRED with Isolated Child (Proposed)

```
┌─────────┐                  ┌─────────────┐                  ┌──────────┐
│ Caller  │                  │ Transaction │                  │ Database │
│         │                  │   Host      │                  │          │
└────┬────┘                  └──────┬──────┘                  └────┬─────┘
     │                              │                              │
     │ withTransaction(parent)      │                              │
     ├─────────────────────────────>│                              │
     │                              │ BEGIN TRANSACTION (parent)   │
     │                              ├─────────────────────────────>│
     │                              │                              │
     │                              │ withTransaction(child)       │
     │                              │ [TX active, use REQUIRED]    │
     │                              │<─────────┐                   │
     │                              │          │                   │
     │                              │ cls.run({ifNested:'isolated'})
     │                              │          │                   │
     │                              │ BEGIN TRANSACTION (child)    │
     │                              │          ├──────────────────>│
     │                              │          │                   │
     │                              │ childFn() // NOT AWAITED     │
     │                              │          │                   │
     │                              │<─────────┘                   │
     │                              │                              │
     │                              │ COMMIT TRANSACTION (parent)  │
     │                              ├─────────────────────────────>│
     │<─────────────────────────────┤                              │
     │                              │                              │
     │                              │ [Child in isolated context]  │
     │                              │ ✅ query() SUCCEEDS          │
     │                              │ COMMIT TRANSACTION (child)   │
     │                              ├─────────────────────────────>│
     │                              │                              │
```

**Notes:**

- Child creates isolated context and new transaction
- Parent and child transactions independent
- ✅ **No failure** (child survives parent commit)

---

## 7. Proposed Solutions

### 7.1 Option A: Forbid Non-Awaited Transactions (Strictest)

**Implementation:**

- Add lifecycle tracking to `TransactionHost`
- Track active child transactions per parent
- Throw error if parent commits with active children

**Pros:**

- Enforces correct async/await usage
- Prevents hard-to-debug errors
- Aligns with best practices (see Spring + @Async warnings)

**Cons:**

- Breaking change (currently "works" despite corruption risk)
- Requires runtime tracking overhead

**Code Example:**

```typescript
private runWithTransaction(options: any, fn: Function) {
    const childrenTracker = new Set<Promise<any>>();
    return this.cls.run({ ifNested: 'inherit' }, () => {
        // Store tracker in CLS
        this.cls.set('__tx_children__', childrenTracker);

        return this._options
            .wrapWithTransaction(options, fn, this.setTxInstance.bind(this))
            .finally(async () => {
                // Wait for all children
                const children = this.cls.get('__tx_children__') || new Set();
                if (children.size > 0) {
                    throw new Error(
                        `Transaction cannot commit: ${children.size} non-awaited child transaction(s) still active`
                    );
                }
                this.setTxInstance(undefined);
            });
    });
}
```

### 7.2 Option B: Isolated Contexts for Non-Awaited (Permissive)

**Implementation:**

- Use `ifNested: 'isolated'` for `REQUIRES_NEW` and optionally `REQUIRED`
- Child transactions fail independently

**Pros:**

- No breaking change
- Simple implementation
- Child failures don't affect parent

**Cons:**

- Deviates from Spring REQUIRED semantics
- Non-awaited children create independent transactions (unexpected)

**Code Example:**

```typescript
case Propagation.Required:
    if (this.isTransactionActive()) {
        // Use isolated to prevent context corruption
        return this.cls.run({ ifNested: 'isolated' }, () =>
            this.runWithTransaction(options, fn)
        );
    } else {
        return this.runWithTransaction(options, fn);
    }
```

### 7.3 Option C: Hybrid Approach (Recommended)

**Implementation:**

- Keep `ifNested: 'inherit'` for `REQUIRED` (correct for awaited children)
- Add lifecycle validation at commit time
- Provide escape hatch via new propagation mode `RequiredIsolated`

**Pros:**

- Maintains Spring semantics for correct usage
- Catches errors at commit (clear error message)
- Provides alternative for fire-and-forget transactions

**Cons:**

- Most complex implementation
- Requires new propagation mode

**Code Example:**

```typescript
enum Propagation {
    // ... existing modes

    /**
     * Like REQUIRED, but creates isolated context for non-awaited scenarios.
     * Use when you intentionally fire-and-forget a transaction.
     */
    RequiredIsolated = 'REQUIRED_ISOLATED',
}

private decidePropagationAndRun(propagation: string, options: any, fn: Function) {
    switch (propagation) {
        case Propagation.Required:
            if (this.isTransactionActive()) {
                return this.runInParentTransaction(fn); // With lifecycle checks
            } else {
                return this.runWithTransaction(options, fn);
            }

        case Propagation.RequiredIsolated:
            return this.cls.run({ ifNested: 'isolated' }, () =>
                this.runWithTransaction(options, fn)
            );
    }
}
```

### 7.4 Recommendation

**Adopt Option C (Hybrid Approach)** for v7.0:

1. **Short-term (v7.0):**
    - Keep `ifNested: 'inherit'` for `REQUIRED`
    - Add runtime validation warning (not error) for non-awaited children
    - Document the issue in README with examples

2. **Medium-term (v7.1):**
    - Promote warning to error (breaking change)
    - Add `Propagation.RequiredIsolated` for legitimate fire-and-forget use cases

3. **Long-term (v8.0):**
    - Consider adapter-level support for transaction lifecycle hooks
    - Implement distributed transaction support if needed

---

## 8. References

### Spring Framework

- [Transaction Propagation Documentation](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)
- [Propagation API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html)
- [Baeldung: Transaction Propagation and Isolation](https://www.baeldung.com/spring-transactional-propagation-isolation)
- [Marco Behler: @Transactional In-Depth](https://www.marcobehler.com/guides/spring-transaction-management-transactional-in-depth)
- [DZone: Spring Transaction Propagation](https://dzone.com/articles/spring-transaction-propagation)

### TypeORM

- [Advanced Transaction Management with NestJS & TypeORM](https://medium.com/@dev.muhammet.ozen/advanced-transaction-management-with-nestjs-typeorm-43a839363491)
- [TypeORM Transactions (DeepWiki)](https://deepwiki.com/typeorm/typeorm/5.4-transactions)
- [TypeORM QueryRunner (DeepWiki)](https://deepwiki.com/typeorm/typeorm/7.2-query-runners)
- [TypeORM Issue #10209: Nested transaction bugs](https://github.com/typeorm/typeorm/issues/10209)
- [TypeORM Commit: Add nested transaction support](https://github.com/typeorm/typeorm/commit/6523526003bab74a0df8f7d578790c1728b26057)

### Async Transaction Management

- [DZone: Spring @Transactional and @Async](https://dzone.com/articles/mastering-spring-synchronizing-transactional-and-a)
- [DEV.to: Handling Async Execution with Transactions in Spring](https://dev.to/arashariani/handling-asynchronous-execution-with-transactions-in-spring-a-common-pitfall-and-how-to-solve-it-5ah4)

### nestjs-cls Internal

- `packages/transactional/src/lib/transaction-host.ts`
- `packages/transactional/src/lib/propagation.ts`
- `packages/transactional/test/propagation.spec.ts`
- `packages/transactional/test/edge-cases/nested-non-awaited-transaction.spec.ts`

---

## Appendix A: Glossary

| Term                          | Definition                                                    |
| ----------------------------- | ------------------------------------------------------------- |
| **Physical Transaction**      | Actual database transaction (BEGIN/COMMIT/ROLLBACK)           |
| **Logical Transaction**       | Application-level transaction scope (may map to physical)     |
| **Transaction Participation** | Reusing existing physical transaction                         |
| **Context Inheritance**       | Reusing parent CLS context (may share transaction)            |
| **Context Isolation**         | Creating independent child CLS context                        |
| **Savepoint**                 | JDBC/SQL marker for partial rollback within transaction       |
| **ifNested**                  | ClsService parameter controlling context inheritance behavior |

---

## Appendix B: Test Coverage Requirements

To validate correct implementation, tests must cover:

### Required Tests (Issue #12 scope)

1. **Propagation.Required + awaited child:** Parent and child share transaction
2. **Propagation.Required + non-awaited child:** Error or isolated context
3. **Propagation.RequiresNew + non-awaited child:** Both transactions succeed
4. **Propagation.Nested + non-awaited child:** Savepoint handling
5. **3+ nesting levels:** Deep nesting with mixed propagation modes
6. **Race conditions:** Parent completes, child active, new sibling starts

### Performance Tests

- **Lifecycle tracking overhead:** <5ms per transaction
- **1000+ nested transactions:** No memory leaks

---

**Document Status:** ✅ **COMPLETED**
**Next Steps:** Proceed to Issue #12 (transaction isolation implementation)
