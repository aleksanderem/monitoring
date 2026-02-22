# Batch 6 Implementation Plan — R26 (OAuth), R24 (API), R33 (Languages), R29 (PWA)

> **For Claude:** Each task is a standalone worktree agent. Agent must implement code + tests + commit.

**Goal:** Complete 4 Tier 3 items. R26 adds GitHub/Microsoft OAuth. R24 adds public REST API. R33 adds DE/ES/FR translations. R29 adds PWA manifest and mobile optimizations.

**Architecture:** All 4 items are fully independent — no cross-dependencies.

---

## Task 1: R26 — OAuth Expansion (GitHub, Microsoft)

**Goal:** Add GitHub and Microsoft OAuth providers to Convex Auth, alongside existing Google.

### Files to Modify
- `convex/auth.ts` — add GitHub and Microsoft providers
- `src/app/(auth)/sign-in/page.tsx` — add GitHub/Microsoft sign-in buttons
- `src/app/(auth)/sign-up/page.tsx` — add GitHub/Microsoft sign-up buttons
- `src/messages/en/auth.json` — OAuth button translations
- `src/messages/pl/auth.json` — OAuth button translations

### Files to Create
- `src/test/integration/r26-oauth-expansion.test.tsx`

### Backend (convex/auth.ts)
Add to imports:
```typescript
import GitHub from "@auth/core/providers/github";
import MicrosoftEntraId from "@auth/core/providers/microsoft-entra-id";
```

Add to providers array after Google:
```typescript
GitHub,
MicrosoftEntraId({
  clientId: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
}),
```

### Frontend Changes
- Add GitHub sign-in button (dark, with GitHub icon) on sign-in and sign-up pages
- Add Microsoft sign-in button (blue, with Microsoft icon) on sign-in and sign-up pages
- Use existing OAuth button pattern from Google sign-in button
- Add translations: signInWithGithub, signInWithMicrosoft

### Tests (8+)
- Auth config has GitHub provider
- Auth config has Microsoft provider
- Sign-in page renders GitHub button
- Sign-in page renders Microsoft button
- Sign-up page renders GitHub button
- Sign-up page renders Microsoft button
- Auth translations exist for GitHub
- Auth translations exist for Microsoft

---

## Task 2: R24 — Public API & Documentation

**Goal:** Add REST API endpoints using Next.js API routes with API key authentication middleware. Rate limiting per key.

### Files to Create
- `src/app/api/v1/domains/route.ts` — list domains
- `src/app/api/v1/domains/[domainId]/keywords/route.ts` — list keywords for domain
- `src/app/api/v1/domains/[domainId]/positions/route.ts` — list positions for domain
- `src/lib/api/middleware.ts` — API key auth + rate limiting middleware
- `src/app/(public)/api-docs/page.tsx` — API documentation page
- `src/test/integration/r24-public-api.test.tsx`

### Files to Modify
- `src/messages/en/common.json` — API docs translations
- `src/messages/pl/common.json` — API docs translations

### API Key Middleware (src/lib/api/middleware.ts)
```typescript
import { ConvexHttpClient } from "convex/browser";

export interface ApiContext {
  organizationId: string;
  keyId: string;
  scopes: string[];
}

export async function authenticateApiKey(request: Request): Promise<ApiContext | Response> {
  const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!apiKey) {
    return Response.json({ error: "API key required" }, { status: 401 });
  }
  // Validate key against Convex userAPIKeys table
  // Return org context or error response
}

export function checkScope(context: ApiContext, required: string): boolean {
  return context.scopes.includes(required) || context.scopes.includes("*");
}
```

### API Endpoints
Each endpoint:
1. Calls authenticateApiKey middleware
2. Checks required scope
3. Queries Convex via HTTP client
4. Returns JSON with standard envelope: `{ data: [...], meta: { total, page, limit } }`

GET /api/v1/domains — requires scope: "domains:read"
GET /api/v1/domains/:id/keywords — requires scope: "keywords:read"
GET /api/v1/domains/:id/positions — requires scope: "positions:read"

### API Docs Page
Simple public page listing:
- Authentication (X-API-Key header)
- Available endpoints with request/response examples
- Rate limits (100 requests per minute per key)
- Error format

### Tests (12+)
- API middleware rejects missing key
- API middleware rejects invalid key
- Domains endpoint returns JSON envelope
- Domains endpoint requires auth
- Keywords endpoint requires auth
- Keywords endpoint requires scope
- Positions endpoint returns data
- API docs page renders
- API docs shows authentication section
- API docs shows endpoints section
- Rate limit headers present
- Error response format is correct

---

## Task 3: R33 — Multi-Language Expansion (DE, ES, FR)

**Goal:** Add German, Spanish, and French translations. Locale-aware formatting.

### Files to Create
- `src/messages/de/` — all 18 translation files (copy from EN, translate to German)
- `src/messages/es/` — all 18 translation files (copy from EN, translate to Spanish)
- `src/messages/fr/` — all 18 translation files (copy from EN, translate to French)
- `src/test/integration/r33-multi-language.test.tsx`

### Files to Modify
- `src/i18n/request.ts` or equivalent — add de, es, fr to supported locales
- `next.config.ts` or `src/middleware.ts` — add locale routing for de, es, fr

### Translation Files to Create (per locale)
Copy all files from `src/messages/en/` and translate:
admin.json, aiResearch.json, auth.json, backlinks.json, common.json, competitors.json, domains.json, generators.json, jobs.json, keywords.json, nav.json, onboarding.json, onsite.json, projects.json, search.json, settings.json, share.json, strategy.json

### i18n Config Updates
Add 'de', 'es', 'fr' to the supported locales array wherever EN/PL are defined.

### Tests (10+)
- German locale directory exists with all translation files
- Spanish locale directory exists with all translation files
- French locale directory exists with all translation files
- Each DE file has same keys as EN
- Each ES file has same keys as EN
- Each FR file has same keys as EN
- i18n config includes 'de' locale
- i18n config includes 'es' locale
- i18n config includes 'fr' locale
- No missing translation keys across locales

---

## Task 4: R29 — Mobile Optimization & PWA

**Goal:** Add PWA manifest, service worker stub, and mobile-optimized navigation components.

### Files to Create
- `public/manifest.json` — PWA manifest
- `public/sw.js` — Service worker (basic cache-first for static assets)
- `src/components/layout/MobileBottomNav.tsx` — Bottom navigation for mobile
- `src/test/integration/r29-mobile-pwa.test.tsx`

### Files to Modify
- `src/app/layout.tsx` — add manifest link and theme-color meta
- `src/messages/en/common.json` — mobile nav translations
- `src/messages/pl/common.json` — mobile nav translations

### PWA Manifest (public/manifest.json)
```json
{
  "name": "doseo - SEO Monitoring",
  "short_name": "doseo",
  "description": "SEO monitoring & strategy platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#7f56d9",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker (public/sw.js)
Basic cache-first strategy for static assets (/icons, /fonts), network-first for API calls. Simple ~30 line implementation.

### MobileBottomNav Component
- Fixed bottom bar visible only on mobile (hidden md:hidden pattern)
- 4-5 main navigation items: Dashboard, Domains, Keywords, Settings
- Active state indicator
- Uses next/navigation for routing

### Layout Changes
Add to `<head>`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#7f56d9" />
<meta name="mobile-web-app-capable" content="yes" />
```

### Tests (10+)
- Manifest file exists and is valid JSON
- Manifest has required PWA fields (name, short_name, start_url, display, icons)
- Service worker file exists
- MobileBottomNav renders navigation items
- MobileBottomNav highlights active route
- MobileBottomNav has proper mobile visibility classes
- Layout includes manifest link
- Layout includes theme-color meta
- Mobile nav translations exist (EN)
- Mobile nav translations exist (PL)

---

## Agent Team Plan

All 4 tasks are independent:

| Agent | Task | Scope |
|-------|------|-------|
| r26-agent | R26 OAuth | auth.ts providers, sign-in/up buttons, tests |
| r24-agent | R24 API | REST endpoints, middleware, docs page, tests |
| r33-agent | R33 Languages | DE/ES/FR translations, i18n config, tests |
| r29-agent | R29 PWA | manifest, service worker, mobile nav, tests |

No cross-dependencies.
