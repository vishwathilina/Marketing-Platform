# Frontend Guide

Next.js dashboard for project management, simulation control, and analytics visualization.

## Stack

- Next.js App Router
- TypeScript
- Axios for API requests
- Tailwind CSS

Key files:

- App layout/pages: [app](app)
- Shared components: [components](components)
- API client: [lib/api.ts](lib/api.ts)
- Rewrite config: [next.config.js](next.config.js)

## Development

Install:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Default local URL:

- http://localhost:3000

## API and Proxy Behavior

Frontend requests are made to /api/* in [lib/api.ts](lib/api.ts), then rewritten by Next.js.

Rewrite source:

- [next.config.js](next.config.js)

Current behavior:

- source: /api/:path*
- destination: ${BACKEND_PROXY_URL}/:path*
- fallback destination: http://127.0.0.1:8001

This avoids browser CORS complexity by using same-origin frontend calls and server-side rewrite proxying.

## Environment Variables

Common variables:

- NEXT_PUBLIC_API_URL
- BACKEND_PROXY_URL

Files:

- [.env.local](.env.local)
- [.env](.env)

Examples:

- Local compose: BACKEND_PROXY_URL=http://backend:7860
- Local host backend: BACKEND_PROXY_URL=http://127.0.0.1:8001
- Hosted backend: BACKEND_PROXY_URL=https://your-backend-space.hf.space

Important:

- Restart Next.js after changing env values or rewrites.

## API Client Structure

Defined in [lib/api.ts](lib/api.ts):

- authApi
- projectsApi
- simulationsApi
- agentsApi

Auth handling:

- Token stored in localStorage and cookie
- Axios request interceptor adds Bearer token
- 401 responses clear token and redirect to /login

## UI Areas

- Landing and auth pages: [app/page.tsx](app/page.tsx), [app/login/page.tsx](app/login/page.tsx), [app/register/page.tsx](app/register/page.tsx)
- Dashboard list: [app/dashboard/page.tsx](app/dashboard/page.tsx)
- Project detail and simulation flows: [app/dashboard/project/[id]/page.tsx](app/dashboard/project/[id]/page.tsx)
- Simulation detail view: [app/dashboard/project/[id]/simulation/[simId]/page.tsx](app/dashboard/project/[id]/simulation/[simId]/page.tsx)

## Troubleshooting

### ECONNREFUSED to 127.0.0.1:8001

Cause:

- BACKEND_PROXY_URL points to localhost but backend is not running there.

Fix:

- Set BACKEND_PROXY_URL to reachable backend host
- Restart frontend dev server

### Login works but API calls fail after auth

Check:

- Authorization header present in requests
- Token not expired
- Backend /auth/me endpoint reachable

### Rewrite not applied

Check:

- [next.config.js](next.config.js) syntax
- Dev server restart after config change
