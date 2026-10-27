# Patch Inventory & Subsystem Mapping

## Discovery Summary
- Total Historical Scripts Discovered: 277
- Scope of Historical Files: Temporary prototype text-replacers, emergency hotfixes, UI layout tweaks, and test utilities created during initial development iterations.
- Active References in Runtime / Build Config: **0**
- Consolidated Architectural Target: 100% migrated to `/src/lib/`, `/src/components/`, `/src/contexts/`, `/src/pages/`, and `/src/types/`.

## Script Classification Breakdown

| Category | Count | Example Scripts | Architectural Target | Status |
|---|---|---|---|---|
| **Business Logic** | 45 | `patch_dash_collection.cjs`, `fix_band.cjs`, `fix_drr_display.cjs`, `patch_targets.cjs` | `/src/lib/calculations.ts`, `/src/lib/pivots.ts`, `/src/lib/targets.ts` | Consolidated & Test-Covered |
| **UI & Layout** | 78 | `fix_mobile_header.cjs`, `fix_sidebar.cjs`, `patch_bandexplorer.cjs`, `fix_teampivot.cjs` | `/src/components/layout/`, `/src/pages/`, `/src/components/ui/` | Consolidated |
| **Data & Storage** | 18 | `patch_db.cjs`, `patch_fileparser.cjs`, `patch_exporter.cjs`, `test_dexie.cjs` | `/src/lib/db.ts`, `/src/lib/fileParser.ts`, `/src/lib/exporter.ts` | Consolidated |
| **Security & Auth** | 18 | `patch_auth.cjs`, `patch_permissions.cjs`, `patch_stored_user.cjs` | `/src/lib/authorization.ts`, `/src/lib/authCrypto.ts`, `/src/contexts/AuthContext.tsx` | Consolidated & Audited |
| **Sync & Replication**| 1 | `patch_livemon_1.cjs` | `/src/lib/sync/syncEngine.ts`, `/src/lib/sync/crdtEngine.ts` | Consolidated |
| **Performance** | 2 | `patch_debounce.cjs`, `patch_data_explorer_speed.cjs` | Virtualized DataGrid, React Memoization, Dexie IndexedDB indices | Consolidated |
| **Temporary & Debug** | 115 | `test_upload.cjs`, `peek.cjs`, `replace.cjs`, `simulate.cjs`, `patch1.sh` | Unit test fixtures in `/src/lib/__tests__/` | Retired |

## Key Historical Patch Chains & Resolutions

1. **Dashboard Calculations Chain**:
   - `patch_dash_collection.cjs` -> `patch_dash_pct.cjs` -> `patch_dashboard.cjs` -> `fix_dashboard_newline.cjs`
   - *Resolution*: Unified in pure mathematical calculation functions in `/src/lib/calculations.ts` and `/src/lib/pivots.ts` with Vitest unit tests.

2. **Pivot Matrix Aggregation Chain**:
   - `update_city_pivot.cjs` -> `fix_citypivot_totals.cjs` -> `patch_citypivot_tfoot.cjs` -> `fix_teampivot_cells.cjs`
   - *Resolution*: Canonical pivot calculators (`buildCityPivot`, `buildTeamPivot`, `buildCrossTab`, `computeDailyRequiredPOS`) in `/src/lib/pivots.ts`.

3. **Data Explorer & Filtering Chain**:
   - `patch_data_explorer.cjs` -> `patch_data_explorer2.cjs` -> `patch_data_explorer3.cjs` -> `patch_data_explorer_clean_filters.cjs`
   - *Resolution*: Modular component structure with `/src/components/explorer/` and `/src/pages/DataExplorer.tsx` utilizing strict types from `/src/types/domain.ts`.

4. **Multi-Role Security & Permissions Chain**:
   - `patch_auth.cjs` -> `patch_permissions.cjs` -> `patch_perms_strict.cjs` -> `patch_auth_context.cjs`
   - *Resolution*: Cryptographic PBKDF2/SHA-256 security in `/src/lib/authCrypto.ts`, permission matrix in `/src/constants/permissions.ts`, and permission enforcement in `/src/lib/authorization.ts`.
