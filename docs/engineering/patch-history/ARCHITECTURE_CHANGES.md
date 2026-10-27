# Architecture Changes & Single Source of Truth

## System Layer Mapping

Mahavtaar Ledger now adheres to a clean, decoupled architecture:

```
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│   (/src/pages, /src/components, /src/components/layout)│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│              Reactive State & Context Layer            │
│   (DataContext, AuthContext, ThemeContext, Hooks)      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Domain Service Layer                 │
│  (/src/lib/calculations.ts, /src/lib/pivots.ts,        │
│   /src/lib/targets.ts, /src/lib/integrityChecker.ts)   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│             Repository & Persistence Layer             │
│  (/src/lib/repositories/*, /src/lib/db.ts, Dexie DB)   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│            Offline Sync & P2P Mesh Subsystem           │
│  (/src/lib/sync/syncEngine.ts, crdtEngine.ts, WebRTC)  │
└────────────────────────────────────────────────────────┘
```

## Developer Navigation Guide

| Domain / Capability | Authoritative Source File | Test Verification |
|---|---|---|
| Financial & Recovery Calculations | `/src/lib/calculations.ts` | `/src/lib/__tests__/calculations.test.ts` |
| City & Team Pivot Matrices | `/src/lib/pivots.ts` | `/src/lib/__tests__/pivots.test.ts` |
| Target Resolution & Pacing | `/src/lib/targets.ts` | `/src/lib/__tests__/targets.test.ts` |
| File Parser (CSV/XLSX) | `/src/lib/fileParser.ts` | `/src/lib/__tests__/fileParser.test.ts` |
| Formatted Excel Exporting | `/src/lib/exporter.ts` | `/src/lib/__tests__/exporter.test.ts` |
| Cryptographic Audit & Integrity | `/src/lib/integrityChecker.ts` | `/src/lib/__tests__/integrityChecker.test.ts` |
| Authentication & PBKDF2 Crypto | `/src/lib/authCrypto.ts` | `/src/lib/__tests__/authCrypto.test.ts` |
| Role-Based Permissions & Guard | `/src/lib/authorization.ts` | `/src/lib/__tests__/authorization.test.ts` |
| Offline-First P2P Sync & CRDT | `/src/lib/sync/syncEngine.ts` | `/src/lib/__tests__/syncCrdt.test.ts` |
| IndexedDB Repositories | `/src/lib/repositories/*.ts` | `/src/lib/__tests__/repositories.test.ts` |
