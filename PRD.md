# Product Requirements Document (PRD)
## Project Name: Loan Collection Tracker

### 1. Project Overview
**Loan Collection Tracker** is a comprehensive, web-based dashboard application designed to manage, track, and analyze loan collections, EMI (Equated Monthly Installment) payments, and financial settlement processes. The system provides role-based access to financial data, allowing users to upload data, view high-level metrics, generate pivot reports based on geography and teams, and maintain a secure audit trail of activities.

### 2. Objectives & Goals
*   **Centralize Data:** Provide a single source of truth for all loan collection and EMI data.
*   **Enhance Visibility:** Offer real-time analytical dashboards and pivot tables to track performance across different cities and collection teams.
*   **Improve Efficiency:** Automate data ingestion (via Excel/CSV uploads) and data export.
*   **Ensure Accountability:** Implement strict Role-Based Access Control (RBAC) and maintain an immutable audit log of user actions.

### 3. User Roles & Permissions
The system uses a robust permission model (`PermissionGate`) to control access to different views. Expected roles (inferred from common enterprise structures):
*   **Admin:** Full access to all modules, including settings, audit logs, and user management.
*   **Manager/Supervisor:** Access to dashboard, matrix, and pivot reports to oversee team and city-wide performance.
*   **Collection Agent:** Access limited to data entry and basic metrics relevant to their assigned portfolio.

### 4. Core Features & Modules

#### 4.1. Authentication & Security
*   **Login Module (`/login`):** Secure entry point utilizing `AuthContext` to manage session state.
*   **Role-Based Access Control (RBAC):** Every route is protected by a `ProtectedRoute` wrapper and a `PermissionGate` component checking against predefined constants (`constants/permissions.ts`).

#### 4.2. Dashboard & Analytics (`/dashboard`)
*   **High-Level Metrics:** Displays key performance indicators (KPIs) such as total collections, outstanding amounts, and settlement rates using `StatCard` components.
*   **Visualizations:** Integrates `recharts` to render interactive charts for trend analysis over time.

#### 4.3. Data Management (`/data-entry`)
*   **Data Upload:** Utilizes an `UploadZone` component for bulk data ingestion.
*   **File Parsing:** Uses the `xlsx` library and `fileParser.ts` to process uploaded spreadsheets (Excel/CSV).
*   **Manual Entry:** Forms built with `react-hook-form` and `zod` for strict schema validation.
*   **Data Export:** Allows users to export filtered data to spreadsheets via `exporter.ts`.

#### 4.4. Reporting & Pivots
*   **City Pivot (`/city-pivot`):** Aggregates collection performance by geographical regions/cities.
*   **Team Pivot (`/team-pivot`):** Analyzes collection efficiency and metrics grouped by collection teams or individual agents.
*   **City-Team Matrix (`/matrix`):** A cross-tabular report mapping team performance against specific city portfolios.
*   **Data Engine:** Relies on `calculations.ts` and `pivots.ts` to perform complex data aggregations and transformations on the client side.

#### 4.5. System Administration
*   **Settings (`/settings`):** Application configuration and user preference management.
*   **Audit Log (`/audit`):** A dedicated view to track system changes, data uploads, and user activities for compliance.

### 5. Business Logic & System Rules

#### 5.1. Financial Calculation Engine (`calculations.ts`)
*   **Total Collections:** Dynamically calculates based on `DAC`, `ECS`, and `Special` inputs.
*   **Paid/Unpaid Status:** Flags an account as "Paid" if collections meet/exceed 1 EMI, if the entire Principal Outstanding (POS) / Foreclosure is cleared, or via Settlement approvals.
*   **Risk Metrics:** Evaluates "Rollback" conditions by checking if collections fall short of a 2x EMI threshold, warning of account delinquency regression.

#### 5.2. Aggregation Logic (`pivots.ts`)
*   **City & State Grouping:** Groups raw rows by geography, calculating POS recovery percentages and comparing them against dynamic `stateTargets`.
*   **Bucket Grouping:** Analyzes performance not just by executive, but strictly within their Beginning of Month Bucket (`bom_bkt`) tier.
*   **Matrix Intersections:** Generates 2D arrays mapping specific agents against specific cities, strictly filtering by bucket inputs.

### 6. Technical Architecture
#### 6.1. Tech Stack
*   **Frontend Framework:** React 18 with Vite.
*   **Language:** TypeScript (Strict typing for robust enterprise code).
*   **Styling:** Tailwind CSS with a custom design system configured via CSS variables (`index.css`).
*   **Component Library:** shadcn/ui (Radix UI primitives + Tailwind).
*   **State Management:** React Context API (`AuthContext`, `DataContext`).
*   **Routing:** React Router v6 (`react-router-dom`).
*   **Data Fetching/Caching:** TanStack React Query (`@tanstack/react-query`).

#### 6.2. Key Libraries
*   **recharts:** Data visualization (charts/graphs).
*   **react-hook-form & zod:** Form state management and schema validation.
*   **xlsx:** Excel file reading and writing.
*   **date-fns:** Date formatting and manipulation.
*   **sonner:** Toast notifications for user feedback.
*   **lucide-react:** Consistent iconography across the application.

### 7. UI/UX Guidelines
*   **Design Language:** A modern, data-dense, yet clean aesthetic characterized by the `DM Mono` (for data/numbers) and `Syne` (for headings) font families.
*   **Theming:** Supports a comprehensive color system (variables for primary, secondary, destructive, success, info, warning) tailored for financial dashboards.
*   **Responsiveness:** Fully responsive interface managed via Tailwind utility classes and customized hooks (`use-mobile.tsx`).
*   **Feedback:** Immediate user feedback provided via the `sonner` toast system for actions like successful uploads, errors, and authentication events.

### 8. Future Considerations / Extensibility
*   **Backend Integration:** The current architecture abstracts data logic (`DataContext`), making it ready to plug into a scalable backend API (e.g., Node.js/Express, Firebase, or Supabase).
*   **Real-time Updates:** Potential to integrate WebSockets for live collection tracking.
*   **Advanced Exporting:** PDF report generation capabilities.
