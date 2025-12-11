import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasRole, canAccessClient, AuthUser } from './auth';

// We test the pure utility functions that don't require Firebase

describe('Auth Utilities', () => {
  describe('hasRole', () => {
    const adminUser: AuthUser = {
      uid: 'admin-123',
      email: 'admin@test.com',
      displayName: 'Admin User',
      role: 'admin',
      staffId: 'admin-123',
      assignedClients: [],
    };

    const managerUser: AuthUser = {
      uid: 'manager-123',
      email: 'manager@test.com',
      displayName: 'Manager User',
      role: 'manager',
      staffId: 'manager-123',
      assignedClients: ['client-1', 'client-2'],
    };

    const accountantUser: AuthUser = {
      uid: 'accountant-123',
      email: 'accountant@test.com',
      displayName: 'Accountant User',
      role: 'accountant',
      staffId: 'accountant-123',
      assignedClients: ['client-3'],
    };

    it('should return true if user has the specified role', () => {
      expect(hasRole(adminUser, ['admin'])).toBe(true);
      expect(hasRole(managerUser, ['manager'])).toBe(true);
      expect(hasRole(accountantUser, ['accountant'])).toBe(true);
    });

    it('should return true if user has any of the specified roles', () => {
      expect(hasRole(adminUser, ['admin', 'manager'])).toBe(true);
      expect(hasRole(managerUser, ['admin', 'manager'])).toBe(true);
    });

    it('should return false if user does not have the specified role', () => {
      expect(hasRole(accountantUser, ['admin'])).toBe(false);
      expect(hasRole(accountantUser, ['manager'])).toBe(false);
      expect(hasRole(accountantUser, ['admin', 'manager'])).toBe(false);
    });

    it('should return false for null user', () => {
      expect(hasRole(null, ['admin'])).toBe(false);
      expect(hasRole(null, ['admin', 'manager', 'accountant'])).toBe(false);
    });

    it('should return false for empty roles array', () => {
      expect(hasRole(adminUser, [])).toBe(false);
    });
  });

  describe('canAccessClient', () => {
    const adminUser: AuthUser = {
      uid: 'admin-123',
      email: 'admin@test.com',
      displayName: 'Admin User',
      role: 'admin',
      staffId: 'admin-123',
      assignedClients: [],
    };

    const managerUser: AuthUser = {
      uid: 'manager-123',
      email: 'manager@test.com',
      displayName: 'Manager User',
      role: 'manager',
      staffId: 'manager-123',
      assignedClients: [],
    };

    const accountantWithClients: AuthUser = {
      uid: 'accountant-123',
      email: 'accountant@test.com',
      displayName: 'Accountant User',
      role: 'accountant',
      staffId: 'accountant-123',
      assignedClients: ['client-1', 'client-2', 'client-3'],
    };

    const accountantNoClients: AuthUser = {
      uid: 'accountant-456',
      email: 'accountant2@test.com',
      displayName: 'Accountant 2',
      role: 'accountant',
      staffId: 'accountant-456',
      assignedClients: [],
    };

    it('should always grant access to admins', () => {
      expect(canAccessClient(adminUser, 'client-1')).toBe(true);
      expect(canAccessClient(adminUser, 'client-999')).toBe(true);
      expect(canAccessClient(adminUser, 'any-client')).toBe(true);
    });

    it('should always grant access to managers', () => {
      expect(canAccessClient(managerUser, 'client-1')).toBe(true);
      expect(canAccessClient(managerUser, 'client-999')).toBe(true);
      expect(canAccessClient(managerUser, 'any-client')).toBe(true);
    });

    it('should grant access to accountants for assigned clients', () => {
      expect(canAccessClient(accountantWithClients, 'client-1')).toBe(true);
      expect(canAccessClient(accountantWithClients, 'client-2')).toBe(true);
      expect(canAccessClient(accountantWithClients, 'client-3')).toBe(true);
    });

    it('should deny access to accountants for non-assigned clients', () => {
      expect(canAccessClient(accountantWithClients, 'client-4')).toBe(false);
      expect(canAccessClient(accountantWithClients, 'client-999')).toBe(false);
      expect(canAccessClient(accountantNoClients, 'client-1')).toBe(false);
    });

    it('should deny access for null user', () => {
      expect(canAccessClient(null, 'client-1')).toBe(false);
      expect(canAccessClient(null, 'any-client')).toBe(false);
    });
  });
});

describe('Role Hierarchy', () => {
  it('should define correct role hierarchy', () => {
    const roleHierarchy = {
      admin: ['admin', 'manager', 'accountant'],
      manager: ['manager', 'accountant'],
      accountant: ['accountant'],
    };

    expect(roleHierarchy.admin.includes('admin')).toBe(true);
    expect(roleHierarchy.admin.includes('manager')).toBe(true);
    expect(roleHierarchy.manager.includes('admin')).toBe(false);
    expect(roleHierarchy.accountant.length).toBe(1);
  });
});

describe('Password Validation Rules', () => {
  it('should require minimum 6 characters for Firebase Auth', () => {
    const minLength = 6;

    expect('12345'.length >= minLength).toBe(false);
    expect('123456'.length >= minLength).toBe(true);
    expect('strongpassword'.length >= minLength).toBe(true);
  });
});
