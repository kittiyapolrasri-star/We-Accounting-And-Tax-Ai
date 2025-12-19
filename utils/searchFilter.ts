/**
 * Search and Filter Utilities
 * ฟังก์ชันช่วยสำหรับการค้นหาและกรองข้อมูล
 */

import { useMemo, useState, useCallback, useEffect } from 'react';

// ============================================================================
// SEARCH UTILITIES
// ============================================================================

/**
 * ค้นหาข้อความใน object (deep search)
 */
export function searchInObject(obj: unknown, searchTerm: string): boolean {
    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase().trim();

    if (typeof obj === 'string') {
        return obj.toLowerCase().includes(term);
    }

    if (typeof obj === 'number') {
        return obj.toString().includes(term);
    }

    if (Array.isArray(obj)) {
        return obj.some(item => searchInObject(item, term));
    }

    if (obj && typeof obj === 'object') {
        return Object.values(obj).some(value => searchInObject(value, term));
    }

    return false;
}

/**
 * ค้นหาใน fields ที่ระบุเท่านั้น
 */
export function searchInFields<T>(
    item: T,
    searchTerm: string,
    fields: (keyof T)[]
): boolean {
    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase().trim();

    return fields.some(field => {
        const value = item[field];
        if (typeof value === 'string') {
            return value.toLowerCase().includes(term);
        }
        if (typeof value === 'number') {
            return value.toString().includes(term);
        }
        return false;
    });
}

/**
 * Fuzzy search - ค้นหาแบบยืดหยุ่น
 */
export function fuzzySearch(text: string, pattern: string): boolean {
    if (!pattern) return true;

    const lowerText = text.toLowerCase();
    const lowerPattern = pattern.toLowerCase().trim();

    // Exact match first
    if (lowerText.includes(lowerPattern)) return true;

    // Check if all characters in pattern appear in text in order
    let patternIdx = 0;
    for (let i = 0; i < lowerText.length && patternIdx < lowerPattern.length; i++) {
        if (lowerText[i] === lowerPattern[patternIdx]) {
            patternIdx++;
        }
    }

    return patternIdx === lowerPattern.length;
}

// ============================================================================
// FILTER UTILITIES
// ============================================================================

export type FilterOperator =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'greater_than'
    | 'less_than'
    | 'greater_or_equal'
    | 'less_or_equal'
    | 'between'
    | 'in'
    | 'not_in'
    | 'is_empty'
    | 'is_not_empty';

export interface FilterCondition<T> {
    field: keyof T;
    operator: FilterOperator;
    value: unknown;
    value2?: unknown; // For 'between' operator
}

/**
 * Apply single filter condition
 */
export function applyFilter<T>(item: T, condition: FilterCondition<T>): boolean {
    const fieldValue = item[condition.field];
    const { operator, value, value2 } = condition;

    switch (operator) {
        case 'equals':
            return fieldValue === value;

        case 'not_equals':
            return fieldValue !== value;

        case 'contains':
            if (typeof fieldValue === 'string' && typeof value === 'string') {
                return fieldValue.toLowerCase().includes(value.toLowerCase());
            }
            return false;

        case 'not_contains':
            if (typeof fieldValue === 'string' && typeof value === 'string') {
                return !fieldValue.toLowerCase().includes(value.toLowerCase());
            }
            return true;

        case 'starts_with':
            if (typeof fieldValue === 'string' && typeof value === 'string') {
                return fieldValue.toLowerCase().startsWith(value.toLowerCase());
            }
            return false;

        case 'ends_with':
            if (typeof fieldValue === 'string' && typeof value === 'string') {
                return fieldValue.toLowerCase().endsWith(value.toLowerCase());
            }
            return false;

        case 'greater_than':
            return (fieldValue as number) > (value as number);

        case 'less_than':
            return (fieldValue as number) < (value as number);

        case 'greater_or_equal':
            return (fieldValue as number) >= (value as number);

        case 'less_or_equal':
            return (fieldValue as number) <= (value as number);

        case 'between':
            const numValue = fieldValue as number;
            return numValue >= (value as number) && numValue <= (value2 as number);

        case 'in':
            if (Array.isArray(value)) {
                return value.includes(fieldValue);
            }
            return false;

        case 'not_in':
            if (Array.isArray(value)) {
                return !value.includes(fieldValue);
            }
            return true;

        case 'is_empty':
            return fieldValue === null || fieldValue === undefined || fieldValue === '';

        case 'is_not_empty':
            return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';

        default:
            return true;
    }
}

/**
 * Apply multiple filter conditions (AND logic)
 */
export function applyFilters<T>(item: T, conditions: FilterCondition<T>[]): boolean {
    return conditions.every(condition => applyFilter(item, condition));
}

// ============================================================================
// SORT UTILITIES
// ============================================================================

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
    field: keyof T;
    direction: SortDirection;
}

/**
 * Sort array by field
 */
export function sortBy<T>(items: T[], config: SortConfig<T>): T[] {
    const { field, direction } = config;
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
        const valueA = a[field];
        const valueB = b[field];

        if (valueA === valueB) return 0;
        if (valueA === null || valueA === undefined) return 1;
        if (valueB === null || valueB === undefined) return -1;

        if (typeof valueA === 'string' && typeof valueB === 'string') {
            return valueA.localeCompare(valueB, 'th') * multiplier;
        }

        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return (valueA - valueB) * multiplier;
        }

        if (valueA instanceof Date && valueB instanceof Date) {
            return (valueA.getTime() - valueB.getTime()) * multiplier;
        }

        return String(valueA).localeCompare(String(valueB)) * multiplier;
    });
}

/**
 * Sort by multiple fields
 */
export function sortByMultiple<T>(items: T[], configs: SortConfig<T>[]): T[] {
    return [...items].sort((a, b) => {
        for (const config of configs) {
            const { field, direction } = config;
            const multiplier = direction === 'asc' ? 1 : -1;

            const valueA = a[field];
            const valueB = b[field];

            if (valueA === valueB) continue;
            if (valueA === null || valueA === undefined) return 1;
            if (valueB === null || valueB === undefined) return -1;

            if (typeof valueA === 'string' && typeof valueB === 'string') {
                return valueA.localeCompare(valueB, 'th') * multiplier;
            }

            if (typeof valueA === 'number' && typeof valueB === 'number') {
                return (valueA - valueB) * multiplier;
            }

            return String(valueA).localeCompare(String(valueB)) * multiplier;
        }
        return 0;
    });
}

// ============================================================================
// HOOKS
// ============================================================================

interface UseSearchOptions<T> {
    searchFields?: (keyof T)[];
    debounceMs?: number;
}

/**
 * Hook สำหรับการค้นหา
 */
export function useSearch<T>(
    items: T[],
    options: UseSearchOptions<T> = {}
): {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filteredItems: T[];
    isSearching: boolean;
} {
    const { searchFields, debounceMs = 300 } = options;
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Debounce search term
    useEffect(() => {
        if (searchTerm !== debouncedTerm) {
            setIsSearching(true);
        }

        const timer = setTimeout(() => {
            setDebouncedTerm(searchTerm);
            setIsSearching(false);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [searchTerm, debounceMs, debouncedTerm]);

    const filteredItems = useMemo(() => {
        if (!debouncedTerm) return items;

        return items.filter(item => {
            if (searchFields) {
                return searchInFields(item, debouncedTerm, searchFields);
            }
            return searchInObject(item, debouncedTerm);
        });
    }, [items, debouncedTerm, searchFields]);

    return {
        searchTerm,
        setSearchTerm,
        filteredItems,
        isSearching
    };
}

interface UseFilterAndSortOptions<T> {
    initialSort?: SortConfig<T>;
}

/**
 * Hook สำหรับ filter และ sort รวมกัน
 */
export function useFilterAndSort<T>(
    items: T[],
    options: UseFilterAndSortOptions<T> = {}
): {
    filters: FilterCondition<T>[];
    addFilter: (filter: FilterCondition<T>) => void;
    removeFilter: (field: keyof T) => void;
    clearFilters: () => void;
    sortConfig: SortConfig<T> | null;
    setSortConfig: (config: SortConfig<T> | null) => void;
    toggleSort: (field: keyof T) => void;
    processedItems: T[];
} {
    const [filters, setFilters] = useState<FilterCondition<T>[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(
        options.initialSort || null
    );

    const addFilter = useCallback((filter: FilterCondition<T>) => {
        setFilters(prev => {
            const existing = prev.findIndex(f => f.field === filter.field);
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = filter;
                return updated;
            }
            return [...prev, filter];
        });
    }, []);

    const removeFilter = useCallback((field: keyof T) => {
        setFilters(prev => prev.filter(f => f.field !== field));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters([]);
    }, []);

    const toggleSort = useCallback((field: keyof T) => {
        setSortConfig(prev => {
            if (prev?.field === field) {
                if (prev.direction === 'asc') {
                    return { field, direction: 'desc' };
                }
                return null; // Remove sort
            }
            return { field, direction: 'asc' };
        });
    }, []);

    const processedItems = useMemo(() => {
        let result = items;

        // Apply filters
        if (filters.length > 0) {
            result = result.filter(item => applyFilters(item, filters));
        }

        // Apply sort
        if (sortConfig) {
            result = sortBy(result, sortConfig);
        }

        return result;
    }, [items, filters, sortConfig]);

    return {
        filters,
        addFilter,
        removeFilter,
        clearFilters,
        sortConfig,
        setSortConfig,
        toggleSort,
        processedItems
    };
}

export default {
    searchInObject,
    searchInFields,
    fuzzySearch,
    applyFilter,
    applyFilters,
    sortBy,
    sortByMultiple,
    useSearch,
    useFilterAndSort
};
