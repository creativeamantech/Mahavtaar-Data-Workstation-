# Mahavtaar Ledger — Patch Consolidation & Technical-Debt Elimination

## Executive Overview

This archive documents the complete consolidation and formal retirement of historical developmental patch scripts (`.cjs`, `.sh`, `.js`, `.py`, `.patch`) from the Mahavtaar Ledger workspace into the permanent, test-backed architectural core.

### Architectural Standard
All critical financial algorithms, multi-dimensional pivot aggregations, peer-to-peer CRDT sync engines, SHA-256 audit chaining, and role-based operational permissions are permanently located in modular, strictly typed TypeScript libraries under `/src/lib/` and `/src/domains/` with comprehensive unit and regression test coverage.

### Documentation Index
- **[PATCH_INVENTORY.md](./PATCH_INVENTORY.md)**: Exhaustive catalogue of all historical patch and fix scripts.
- **[CONSOLIDATION_MATRIX.md](./CONSOLIDATION_MATRIX.md)**: Classification, risk profile, permanent architectural destination, and test coverage for each subsystem.
- **[BUSINESS_RULE_REGISTRY.md](./BUSINESS_RULE_REGISTRY.md)**: Financial mathematics, recovery criteria, rollback definitions, and pivot algorithms preserved with zero drift.
- **[RETIRED_PATCH_REPORT.md](./RETIRED_PATCH_REPORT.md)**: Proof of safe retirement and verification that no runtime dependency remains on historical scripts.
- **[ARCHITECTURE_CHANGES.md](./ARCHITECTURE_CHANGES.md)**: Map of subsystem responsibilities and architectural layers.
