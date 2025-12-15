/**
 * Period Query Service - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    extractPeriod,
    addPeriodFields,
} from '../services/periodQueryService';

// ============================================================================
// extractPeriod Tests
// ============================================================================

describe('extractPeriod', () => {
    it('should extract year, month, period from ISO date', () => {
        const result = extractPeriod('2024-12-15T10:30:00Z');
        expect(result.year).toBe(2024);
        expect(result.month).toBe('12');
        expect(result.period).toBe('2024-12');
    });

    it('should handle January correctly', () => {
        const result = extractPeriod('2024-01-05');
        expect(result.year).toBe(2024);
        expect(result.month).toBe('01');
        expect(result.period).toBe('2024-01');
    });

    it('should handle date without time', () => {
        const result = extractPeriod('2024-06-20');
        expect(result.year).toBe(2024);
        expect(result.month).toBe('06');
    });
});

// ============================================================================
// addPeriodFields Tests
// ============================================================================

describe('addPeriodFields', () => {
    it('should add period fields to record with uploaded_at', () => {
        const record = {
            id: 'D001',
            uploaded_at: '2024-12-15T10:00:00Z',
        };

        const result = addPeriodFields(record);
        expect(result.year).toBe(2024);
        expect(result.month).toBe('12');
        expect(result.period).toBe('2024-12');
        expect(result.id).toBe('D001');
    });

    it('should add period fields to record with date', () => {
        const record = {
            id: 'GL001',
            date: '2024-03-20',
        };

        const result = addPeriodFields(record);
        expect(result.year).toBe(2024);
        expect(result.month).toBe('03');
        expect(result.period).toBe('2024-03');
    });

    it('should use current date if no date field exists', () => {
        const record = {
            id: 'X001',
            uploaded_at: new Date().toISOString(), // Use current date
        };

        const result = addPeriodFields(record);
        const now = new Date();
        expect(result.year).toBe(now.getFullYear());
    });
});
