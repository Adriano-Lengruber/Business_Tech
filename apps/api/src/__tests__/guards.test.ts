import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../common/guards/auth-rbac-module.guard';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';

function makeMockContext(user: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

test('PermissionsGuard blocks technician from managing tenant modules', () => {
  const reflector = {
    getAllAndOverride: () => ['modules:manage'],
  } as unknown as Reflector;

  const guard = new PermissionsGuard(reflector);
  const techCtx = makeMockContext({
    userId: 'u-1',
    email: 'tech@altech.local',
    name: 'Tech',
    organizationId: '00000000-0000-0000-0000-000000000001',
    organizationName: 'AL Tech',
    role: 'technician',
  });

  assert.throws(() => guard.canActivate(techCtx), ForbiddenException);

  const ownerCtx = makeMockContext({
    userId: 'u-2',
    email: 'owner@altech.local',
    name: 'Owner',
    organizationId: '00000000-0000-0000-0000-000000000001',
    organizationName: 'AL Tech',
    role: 'owner',
  });

  assert.equal(guard.canActivate(ownerCtx), true);
});
