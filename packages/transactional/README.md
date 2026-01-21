# @nestjs-cls/transactional

A "Transactional" plugin for nestjs-cls that provides a generic interface that can be used to wrap any function call in a CLS-enabled transaction by storing the transaction reference in the CLS context.

The transaction reference can be then retrieved in any other service and refer to the same transaction without having to pass it around.

The plugin is designed to be database-agnostic and can be used with any database library that supports transactions (via adapters). At the expense of using a minimal wrapper, it deliberately does not require any monkey-patching of the underlying library.

### ➡️ [Go to the documentation website](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional) 📖

---

## Transaction Propagation Modes

The transactional plugin supports 7 propagation modes inspired by Spring Framework's `@Transactional`:

### REQUIRED (Default)

**Behavior:** Reuse the existing transaction or create a new one if none exists.

```typescript
@Transactional() // or @Transactional(Propagation.Required)
async createUser(user: User) {
    // Joins parent transaction if exists, otherwise creates new one
    return this.userRepository.save(user);
}
```

**Semantics:**

- **No transaction exists:** Creates a new transaction
- **Transaction exists:** Participates in the existing transaction (shares the same physical transaction)
- **Commit:** Controlled by outermost transaction
- **Rollback:** Any nested rollback marks entire transaction for rollback

**⚠️ Important:** When using nested `REQUIRED` transactions, **always await** child transactions. Non-awaited children may outlive the parent, causing "Transaction already finished" errors. See [Non-Awaited Transactions](#non-awaited-transactions) section below.

### REQUIRES_NEW

**Behavior:** Always create a new independent transaction, suspending the existing one.

```typescript
@Transactional(Propagation.RequiresNew)
async sendNotification(userId: string) {
    // Always creates independent transaction
    // Parent transaction is suspended until this completes
    await this.notificationRepository.create({ userId });
}
```

**Semantics:**

- **No transaction exists:** Creates a new transaction
- **Transaction exists:** Suspends parent transaction, creates new independent transaction
- **Commit:** Commits independently of parent transaction
- **Rollback:** Parent transaction unaffected by child rollback

**Use Case:** Audit logging, notifications, or operations that should succeed even if parent fails.

### NESTED

**Behavior:** Create a subtransaction (savepoint) if the adapter supports it; otherwise behaves like REQUIRED.

```typescript
@Transactional(Propagation.Nested)
async processPayment(order: Order) {
    // Creates savepoint if supported (e.g., PostgreSQL, MySQL)
    await this.paymentRepository.charge(order);
}
```

**Semantics:**

- **No transaction exists:** Creates a new transaction (behaves like REQUIRED)
- **Transaction exists:** Creates a **savepoint** (if supported by adapter)
- **Commit:** Releases savepoint; committed with parent transaction
- **Rollback:** Rolls back to savepoint; parent transaction can continue

**Limitations:**

- Requires adapter support (check adapter documentation)
- Uses database savepoints (e.g., `SAVEPOINT nested_transaction;`)
- Parent rollback undoes nested transactions

### NOT_SUPPORTED

**Behavior:** Run without a transaction, suspending any existing one.

```typescript
@Transactional(Propagation.NotSupported)
async performReadOnlyQuery() {
    // Runs without transaction, even if parent transaction exists
    return this.userRepository.find();
}
```

**Semantics:**

- **No transaction exists:** Runs without transaction
- **Transaction exists:** Suspends transaction, runs without transaction
- **Commit/Rollback:** Not applicable (no transaction)

**Use Case:** Read-only operations that don't need transactional guarantees.

### MANDATORY

**Behavior:** Require an existing transaction or throw an error.

```typescript
@Transactional(Propagation.Mandatory)
async updateAccount(accountId: string) {
    // Requires existing transaction, otherwise throws TransactionNotActiveError
    return this.accountRepository.update(accountId);
}
```

**Semantics:**

- **No transaction exists:** Throws `TransactionNotActiveError`
- **Transaction exists:** Participates in existing transaction

**Use Case:** Operations that must be part of a larger transaction (e.g., financial operations).

### NEVER

**Behavior:** Throw an error if a transaction exists.

```typescript
@Transactional(Propagation.Never)
async sendEmail(email: string) {
    // Throws TransactionAlreadyActiveError if transaction exists
    await this.emailService.send(email);
}
```

**Semantics:**

- **No transaction exists:** Runs without transaction
- **Transaction exists:** Throws `TransactionAlreadyActiveError`

**Use Case:** Operations that should never run in a transaction (e.g., sending emails, external API calls).

### SUPPORTS

**Behavior:** Use an existing transaction if present, otherwise continue without one.

```typescript
@Transactional(Propagation.Supports)
async findUser(userId: string) {
    // Uses transaction if exists, otherwise runs without
    return this.userRepository.findOne(userId);
}
```

**Semantics:**

- **No transaction exists:** Runs without transaction
- **Transaction exists:** Participates in existing transaction

**Use Case:** Flexible operations that work both with and without transactions.

---

## Non-Awaited Transactions

**⚠️ Critical:** Non-awaited nested transactions can cause undefined behavior and "Transaction already finished" errors.

### The Problem

```typescript
@Transactional()
async parentTransaction() {
    await this.doWork(1);

    // ❌ BAD: Child transaction not awaited
    this.childTransaction(); // Fires and forgets

    // Parent transaction commits here
    // Child still running → FAILS with "Transaction already finished"
}

@Transactional()
async childTransaction() {
    await this.doWork(2);
}
```

**Why it fails:**

1. Parent transaction starts
2. Child transaction starts (shares same transaction with `Propagation.Required`)
3. Parent finishes and commits transaction
4. Child tries to use committed transaction → **Error**

### Solutions

#### Solution 1: Always Await (Recommended)

```typescript
@Transactional()
async parentTransaction() {
    await this.doWork(1);
    await this.childTransaction(); // ✅ GOOD: Child awaited
}
```

#### Solution 2: Use REQUIRES_NEW for Fire-and-Forget

```typescript
@Transactional()
async parentTransaction() {
    await this.doWork(1);

    // ✅ GOOD: Child creates independent transaction
    this.childTransactionIsolated(); // Can safely fire-and-forget
}

@Transactional(Propagation.RequiresNew)
async childTransactionIsolated() {
    await this.doWork(2);
}
```

#### Solution 3: Track Promises Explicitly

```typescript
@Transactional()
async parentTransaction() {
    await this.doWork(1);

    const childPromise = this.childTransaction();

    // ✅ GOOD: Wait before commit
    await Promise.allSettled([childPromise]);
}
```

### Future Improvements

In v7.1+, the library will detect non-awaited child transactions and:

- **v7.0:** Emit warnings in development mode
- **v7.1:** Throw errors at commit time (breaking change)
- **v8.0:** Introduce `Propagation.RequiredIsolated` for legitimate fire-and-forget scenarios

**Tracking Issue:** [#12](https://github.com/tjsasakifln/nestjs-cls/issues/12)

---

## Propagation Mode Comparison

| Mode              | Creates TX if None | Joins Existing TX   | Independent Commit | Throws if No TX | Throws if TX Exists |
| ----------------- | ------------------ | ------------------- | ------------------ | --------------- | ------------------- |
| **REQUIRED**      | ✅ Yes             | ✅ Yes              | ❌ No              | ❌ No           | ❌ No               |
| **REQUIRES_NEW**  | ✅ Yes             | ❌ No (creates new) | ✅ Yes             | ❌ No           | ❌ No               |
| **NESTED**        | ✅ Yes             | ✅ Yes (savepoint)  | ❌ No              | ❌ No           | ❌ No               |
| **NOT_SUPPORTED** | ❌ No              | ❌ No (suspends)    | N/A                | ❌ No           | ❌ No               |
| **MANDATORY**     | ❌ No              | ✅ Yes              | ❌ No              | ✅ Yes          | ❌ No               |
| **NEVER**         | ❌ No              | N/A                 | N/A                | ❌ No           | ✅ Yes              |
| **SUPPORTS**      | ❌ No              | ✅ Yes              | ❌ No              | ❌ No           | ❌ No               |

---

## Advanced Topics

### Nested Transaction Lifecycle

Transactions follow Spring Framework semantics for nested scenarios:

```typescript
@Transactional() // Outer transaction
async processOrder(order: Order) {
    // BEGIN TRANSACTION
    await this.validateOrder(order);

    try {
        await this.chargePayment(order); // NESTED (savepoint)
    } catch (e) {
        // Payment failed, but order validation still valid
        // Rolls back to savepoint
    }

    await this.notifyCustomer(order); // REQUIRES_NEW (independent)

    // COMMIT TRANSACTION (outer)
}

@Transactional(Propagation.Nested)
async chargePayment(order: Order) {
    // SAVEPOINT nested_transaction
    await this.paymentService.charge(order.total);
    // RELEASE SAVEPOINT (on success)
    // or ROLLBACK TO SAVEPOINT (on failure)
}

@Transactional(Propagation.RequiresNew)
async notifyCustomer(order: Order) {
    // Suspends outer transaction
    // BEGIN TRANSACTION (independent)
    await this.emailService.send(order.customerEmail);
    // COMMIT TRANSACTION (independent)
    // Resumes outer transaction
}
```

### Transaction Options

Adapter-specific options can be passed to transactions:

```typescript
@Transactional<TransactionAdapterTypeORM>({
    isolationLevel: 'SERIALIZABLE',
})
async transferFunds(from: string, to: string, amount: number) {
    // Runs with SERIALIZABLE isolation level
    await this.debit(from, amount);
    await this.credit(to, amount);
}
```

**Note:** Options are ignored when joining existing transactions with `REQUIRED`, `SUPPORTS`, or `MANDATORY` propagation modes.

---

## Additional Resources

- **Documentation:** [https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)
- **Research Document:** [`docs/research/transaction-propagation-semantics.md`](../../docs/research/transaction-propagation-semantics.md)
- **Spring Framework Reference:** [Transaction Propagation](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)

---

## License

MIT License - See LICENSE file for details.
