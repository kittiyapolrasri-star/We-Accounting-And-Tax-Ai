/**
 * Vitest Test Setup
 * Configures testing environment with mocks and utilities
 */

import { vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock Firebase
vi.mock('../services/firebase', () => ({
    db: null,
    storage: null,
    auth: null,
    isFirebaseConfigured: false,
}));

// Reset mocks between tests
beforeEach(() => {
    vi.clearAllMocks();
});
