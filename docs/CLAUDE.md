# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flow LAB is a comprehensive enterprise inventory and request management system built with React, TypeScript, Supabase, and Vite. It manages product inventory, stock movements, various request types (purchase, payment, maintenance, IT), quotations, billing, and user permissions in a Brazilian Portuguese interface.

## Common Development Commands

### Development
- `npm run dev` - Start Vite development server
- `npm run dev:vite` - Alternative Vite dev command
- `npm run dev:api` - Start Vercel dev server for API routes
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

### Database
- Database migrations are in `supabase/migrations/` with format `YYYYMMDDHHMMSS_description.sql`
- Run migrations via Supabase dashboard or CLI: `supabase db push`

### Environment Setup
- Copy `.env.example` to `.env` and configure Supabase credentials
- For Vercel deployment, set environment variables in Vercel dashboard
- Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Optional analytics: `UMAMI_BASE_URL`, `UMAMI_USER`, `UMAMI_PASS`, `UMAMI_TIMEZONE`

## High-Level Architecture

### Authentication & Authorization

The system uses a **dual permission system** combining legacy roles with a dynamic custom role system:

**Legacy Roles** (fallback):
- `admin` - Full access to all features
- `operator` - Most permissions except user management and IT
- `requester` - Limited to viewing and creating requests

**Custom Roles System**:
- Tables: `custom_roles` and `user_profiles` (with `custom_role_id`)
- Custom roles can have any combination of permissions from `ALL_PERMISSION_KEYS`
- When a user has a custom role, it overrides legacy role permissions
- Permission checking via `hasPermission(permissions: string[], permission: string)` in `src/utils/permissions.ts`

**Auth Flow**:
1. `useAuth()` hook in `src/hooks/useAuth.ts` manages session state
2. On auth change, loads user profile with custom role data from Supabase
3. Routes protected by `<ProtectedRoute>` component in `App.tsx`
4. Permissions checked before accessing protected routes

### Modular Architecture

The application uses a **bounded context** approach with isolated modules:

**Modules Structure** (`src/modules/`):
- `quotations/` - Complete quotation workflow with state machine
- `messaging/` - WhatsApp/messaging integration infrastructure  
- `faturamento/` - Billing/invoicing module
- Each module exports types, hooks, components, and services via `index.ts`

**Quotations Module**:
- State machine-based workflow (`workflow/stateMachine.ts`)
- Types domain-specific (`types/index.ts`)
- Custom hooks for business logic (`hooks/`)
- Corporate UI components
- Includes approval workflows, audit trails, PDF generation

**Messaging Module**:
- Service layer with `MessagingService` and `MessageProcessor`
- Provider pattern for WhatsApp integration (WAHA)
- Configuration components for provider settings

### Database Schema

**Core Tables**:
- `products` - Inventory items with categories (general/technical)
- `stock_movements` - All stock transactions with reasons
- `requests` - Purchase/material requests with approval workflow
- `user_profiles` - User data with role and custom_role_id
- `custom_roles` - Dynamic role definitions with permissions array
- `suppliers` - Supplier management
- `quotations` & `quotation_items` - Quotation workflow
- `payment_requests` - Payment/expense requests
- `maintenance_requests` - Maintenance ticketing system
- `it_requests` - IT service management with Kanban
- `request_periods` - Time-based request window control

**Key Relationships**:
- Users have one-to-one relationship with user_profiles
- user_profiles optionally link to custom_roles
- Products link to suppliers via supplier_id
- Requests link to suppliers and have request items
- Quotations link to requests and have multiple quotation_items from suppliers
- Stock movements can reference requests

### UI/UX Patterns

**Design System** (documented in `docs/GUIA_IDENTIDADE_VISUAL.md`):
- **Primary Colors**: Blue 500-900, Indigo 500-800 gradients
- **Components**: TailwindCSS with custom classes in `src/index.css`
- **Animations**: Custom keyframes (fade-in, scale-in, shimmer, blob)
- **Responsive**: Mobile-first with breakpoints at sm/md/lg/xl

**Component Patterns**:
- Modal structure: overlay + container with header/body/footer
- Protected routes wrapper for authorization
- Custom hooks for data fetching and state management
- Status badges with color coding
- Glassmorphism effects for cards and modals

**Internationalization**:
- Interface is entirely in Brazilian Portuguese
- Date/time formats configured for Brazilian locale
- Currency formatting in BRL (R$)

### Request Type System

The system handles multiple request types with distinct workflows:

1. **Purchase Requests** (`requests` table, type: 'SC'/'SM')
   - Service (SC) vs Material (SM) categories
   - Approval workflow with status transitions
   - Can include attachments and signatures

2. **Payment Requests** (`payment_requests` table)
   - Types: PAGAMENTO, REEMBOLSO, ADIANTAMENTO
   - Multiple payment methods: PIX, DINHEIRO, BOLETO, CAJU, SOLIDES
   - PDF attachment support
   - Approval workflow with rejection reasons

3. **Maintenance Requests** (`maintenance_requests` table)
   - Priority levels: urgent, priority, common
   - Status workflow: pending → in_progress → completed/cancelled
   - Image attachments for issue documentation
   - Links to inventory items used in maintenance

4. **IT Requests** (`it_requests` table)
   - Kanban board interface for task management
   - Tag system for categorization
   - Assignment and completion workflow

### Storage & File Management

**Supabase Storage**:
- Bucket `request-attachments` for request file uploads
- Public bucket with RLS policies for authenticated uploads and public reads
- Supports PDF, PNG, JPEG (max 10MB)
- Files referenced via URL in database records

### Analytics Integration

**Umami Analytics** (self-hosted):
- API proxy in `api/umami.ts` for Vercel deployment
- Dev server middleware in `vite.config.ts` for local development
- Hook `useUmamiAnalytics` in `src/hooks/useUmamiAnalytics.ts`
- Environment variables for Umami instance configuration

## Key Patterns to Follow

### Permission Checking
```typescript
import { hasPermission } from './utils/permissions';

// In components
if (!hasPermission(userPermissions, 'canManageProducts')) {
  return <AccessDenied />;
}
```

### Data Fetching with Hooks
```typescript
// Custom hooks pattern for Supabase queries
const { data, loading, error } = useInventory();
const { user, userProfile, permissions } = useAuth();
```

### Status Badges
```typescript
// Use consistent status badge patterns
const statusConfig = {
  pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Aprovado', className: 'bg-green-100 text-green-800' },
  // ... other statuses
};
```

### Modal Structure
```typescript
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
  <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
    {/* Header */}
    <div className="px-6 py-5 border-b border-gray-100">...</div>
    {/* Body */}
    <div className="px-6 py-5">...</div>
    {/* Footer */}
    <div className="px-6 py-4 bg-gray-50 rounded-b-2xl">...</div>
  </div>
</div>
```

## Development Notes

### TypeScript Configuration
- Uses ES modules with `"module": "ESNext"`
- Path aliases configured: `types/*`, `utils/*`, `hooks/*`, `components/*`
- Strict mode disabled for easier migration (`"strict": false`)

### Deployment
- Vercel for hosting (configured in `vercel.json`)
- API routes in `api/` directory as Vercel serverless functions
- Supabase for database and auth
- Environment variables must be set in Vercel dashboard for production

### Request Period Control
- Time-based restrictions for request creation
- Configured via `RequestPeriodConfig` component
- Checks current day against `start_day` and `end_day` in `request_periods` table
- Applied in request components to block creation outside allowed periods

### Custom Role System
- Allows fine-grained permission control beyond legacy roles
- Users can be assigned custom roles via `UserManagement` component
- Custom roles have `permissions` array with permission strings
- Fallback to legacy role permissions if no custom role assigned

## Important Files

- `src/App.tsx` - Main routing and protected route logic
- `src/hooks/useAuth.ts` - Authentication and user profile management
- `src/utils/permissions.ts` - Permission system and role definitions
- `src/lib/supabase.ts` - Supabase client configuration
- `src/lib/database.types.ts` - TypeScript types from Supabase schema
- `src/types/index.ts` - Application type definitions
- `src/index.css` - Custom Tailwind utilities and animations
- `api/umami.ts` - Analytics API proxy for Vercel
- `vite.config.ts` - Vite configuration with dev middleware

## Documentation

- `docs/Resumo-Sistema-Inventario.md` - System overview and features
- `docs/GUIA_IDENTIDADE_VISUAL.md` - Complete design system documentation
- `docs/CONFIGURAR_STORAGE_REQUESTS.md` - Storage bucket setup guide
- `docs/CONTROLE_PERIODOS_SOLICITACOES.md` - Request period control implementation guide