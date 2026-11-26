export const ORG_ROLES = [
  'owner',
  'admin',
  'technician',
  'attendant',
  'viewer',
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const PERMISSIONS = [
  'org:manage',
  'modules:manage',
  'users:manage',
  'customers:read',
  'customers:write',
  'os:read',
  'os:write',
  'os:approve_quote',
  'inbox:read',
  'inbox:reply',
  'inbox:handoff',
  'ai:use_copilot',
  'ai:approve_sensitive',
  'finance:read',
  'finance:write',
  'inventory:read',
  'inventory:write',
  'pos:sell',
  'fiscal:manage',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== 'org:manage'),
  technician: [
    'customers:read',
    'os:read',
    'os:write',
    'inventory:read',
    'inbox:read',
    'inbox:reply',
    'inbox:handoff',
    'ai:use_copilot',
  ],
  attendant: [
    'customers:read',
    'customers:write',
    'os:read',
    'os:write',
    'inventory:read',
    'pos:sell',
    'inbox:read',
    'inbox:reply',
    'inbox:handoff',
    'finance:read',
    'ai:use_copilot',
  ],
  viewer: ['customers:read', 'os:read', 'inventory:read', 'inbox:read'],
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
