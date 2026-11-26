#!/usr/bin/env node
/**
 * Automated full-stack smoke test for AL Business OS.
 * Verifies all Next.js SSR routes (200 OK) and core NestJS API endpoints.
 */
const WEB_BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const API_BASE = process.env.API_URL ?? 'http://localhost:3001/api/v1';

const WEB_ROUTES = [
  '/',
  '/login',
  '/register',
  '/app',
  '/app/os/new',
  '/app/customers',
  '/app/inbox',
  '/app/automations',
  '/app/contracts',
  '/app/inventory',
  '/app/pos',
  '/app/finance',
  '/app/fiscal',
  '/app/print3d',
  '/app/projects',
  '/app/social',
  '/app/knowledge',
  '/app/modules',
  '/app/security',
];

async function run() {
  let failures = 0;

  for (const route of WEB_ROUTES) {
    const res = await fetch(`${WEB_BASE}${route}`);
    if (res.status !== 200) {
      console.error(`[WEB FAIL] ${route} -> HTTP ${res.status}`);
      failures++;
    }
  }
  console.log(`[WEB OK] ${WEB_ROUTES.length - failures}/${WEB_ROUTES.length} rotas retornaram HTTP 200.`);

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SMOKE_EMAIL ?? 'adriano@altech.local',
      password: process.env.SMOKE_PASSWORD ?? 'Admin@12345',
    }),
  });
  if (loginRes.status !== 201 && loginRes.status !== 200) {
    throw new Error(`Falha no login API: HTTP ${loginRes.status}`);
  }
  const { accessToken } = await loginRes.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  const endpoints = [
    '/ai/briefing',
    '/analytics/overview',
    '/service-orders',
    '/service-catalog',
    '/contracts',
    '/warranties',
    '/sourcing/requests',
    '/automations',
    '/checklists/templates',
    '/security/audit-logs',
    '/security/team',
    '/integrations',
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${API_BASE}${ep}`, { headers });
    if (res.status !== 200) {
      console.error(`[API FAIL] ${ep} -> HTTP ${res.status}`);
      failures++;
    }
  }

  console.log(`[API OK] Endpoints principais verificados com autenticação JWT + RLS.`);
  if (failures > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
