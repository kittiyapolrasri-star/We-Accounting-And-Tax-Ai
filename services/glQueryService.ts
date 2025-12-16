/**
 * GL Query Service with Caching and Optimization
 * บริการสำหรับ query GL entries อย่างมีประสิทธิภาพ
 */

import { PostedGLEntry } from '../types';

// ============================================================================
// Cache Management
// ============================================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

class QueryCache<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private maxSize: number;

    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if expired
        if (Date.now() > entry.timestamp + entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    set(key: string, data: T, ttl: number = 60000): void {
        // Evict old entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    invalidate(pattern?: string): void {
        if (!pattern) {
            this.cache.clear();
            return;
        }

        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    size(): number {
        return this.cache.size;
    }
}

// Global cache instances
const glEntryCache = new QueryCache<PostedGLEntry[]>(50);
const aggregateCache = new QueryCache<unknown>(100);

// ============================================================================
// Query Options
// ============================================================================

export interface GLQueryOptions {
    clientId?: string;
    dateFrom?: string;
    dateTo?: string;
    accountCodes?: string[];
    minAmount?: number;
    maxAmount?: number;
    searchTerm?: string;
    limit?: number;
    offset?: number;
    sortBy?: keyof PostedGLEntry;
    sortDirection?: 'asc' | 'desc';
    useCache?: boolean;
    cacheTTL?: number;
}

export interface GLQueryResult {
    entries: PostedGLEntry[];
    total: number;
    hasMore: boolean;
    fromCache: boolean;
    queryTime: number;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Generate cache key from query options
 */
function generateCacheKey(options: GLQueryOptions): string {
    return JSON.stringify({
        c: options.clientId,
        df: options.dateFrom,
        dt: options.dateTo,
        ac: options.accountCodes,
        min: options.minAmount,
        max: options.maxAmount,
        s: options.searchTerm,
        l: options.limit,
        o: options.offset,
        sb: options.sortBy,
        sd: options.sortDirection,
    });
}

/**
 * Query GL entries with filtering, sorting, and pagination
 */
export function queryGLEntries(
    allEntries: PostedGLEntry[],
    options: GLQueryOptions = {}
): GLQueryResult {
    const startTime = Date.now();
    const {
        clientId,
        dateFrom,
        dateTo,
        accountCodes,
        minAmount,
        maxAmount,
        searchTerm,
        limit = 100,
        offset = 0,
        sortBy = 'date',
        sortDirection = 'desc',
        useCache = true,
        cacheTTL = 60000,
    } = options;

    // Check cache
    const cacheKey = generateCacheKey(options);
    if (useCache) {
        const cached = glEntryCache.get(cacheKey);
        if (cached) {
            return {
                entries: cached.slice(offset, offset + limit),
                total: cached.length,
                hasMore: offset + limit < cached.length,
                fromCache: true,
                queryTime: Date.now() - startTime,
            };
        }
    }

    // Filter entries
    let filtered = allEntries;

    if (clientId) {
        filtered = filtered.filter(e => e.clientId === clientId);
    }

    if (dateFrom) {
        filtered = filtered.filter(e => e.date >= dateFrom);
    }

    if (dateTo) {
        filtered = filtered.filter(e => e.date <= dateTo);
    }

    if (accountCodes && accountCodes.length > 0) {
        filtered = filtered.filter(e => accountCodes.includes(e.account_code));
    }

    if (minAmount !== undefined) {
        filtered = filtered.filter(e => {
            const amount = e.debit || e.credit || 0;
            return amount >= minAmount;
        });
    }

    if (maxAmount !== undefined) {
        filtered = filtered.filter(e => {
            const amount = e.debit || e.credit || 0;
            return amount <= maxAmount;
        });
    }

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(e =>
            e.description.toLowerCase().includes(term) ||
            e.doc_no.toLowerCase().includes(term) ||
            e.account_code.includes(term) ||
            e.account_name.toLowerCase().includes(term)
        );
    }

    // Sort entries
    const sorted = [...filtered].sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        if (aValue === bValue) return 0;
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        const comparison = aValue < bValue ? -1 : 1;
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Cache full result
    if (useCache) {
        glEntryCache.set(cacheKey, sorted, cacheTTL);
    }

    // Apply pagination
    const paginated = sorted.slice(offset, offset + limit);

    return {
        entries: paginated,
        total: sorted.length,
        hasMore: offset + limit < sorted.length,
        fromCache: false,
        queryTime: Date.now() - startTime,
    };
}

// ============================================================================
// Aggregation Functions
// ============================================================================

export interface GLAggregation {
    totalDebit: number;
    totalCredit: number;
    balance: number;
    entryCount: number;
    byAccount: Record<string, { debit: number; credit: number; count: number; name: string }>;
    byDate: Record<string, { debit: number; credit: number; count: number }>;
    byMonth: Record<string, { debit: number; credit: number; count: number }>;
}

/**
 * Aggregate GL entries
 */
export function aggregateGLEntries(
    entries: PostedGLEntry[],
    options: { useCache?: boolean; cacheTTL?: number } = {}
): GLAggregation {
    const { useCache = true, cacheTTL = 120000 } = options;

    // Generate cache key based on entry IDs
    const cacheKey = `agg:${entries.length}:${entries[0]?.id || ''}:${entries[entries.length - 1]?.id || ''}`;

    if (useCache) {
        const cached = aggregateCache.get(cacheKey) as GLAggregation | null;
        if (cached) return cached;
    }

    const result: GLAggregation = {
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
        entryCount: entries.length,
        byAccount: {},
        byDate: {},
        byMonth: {},
    };

    for (const entry of entries) {
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;

        result.totalDebit += debit;
        result.totalCredit += credit;

        // By account
        if (!result.byAccount[entry.account_code]) {
            result.byAccount[entry.account_code] = {
                debit: 0,
                credit: 0,
                count: 0,
                name: entry.account_name,
            };
        }
        result.byAccount[entry.account_code].debit += debit;
        result.byAccount[entry.account_code].credit += credit;
        result.byAccount[entry.account_code].count++;

        // By date
        if (!result.byDate[entry.date]) {
            result.byDate[entry.date] = { debit: 0, credit: 0, count: 0 };
        }
        result.byDate[entry.date].debit += debit;
        result.byDate[entry.date].credit += credit;
        result.byDate[entry.date].count++;

        // By month
        const month = entry.date.substring(0, 7);
        if (!result.byMonth[month]) {
            result.byMonth[month] = { debit: 0, credit: 0, count: 0 };
        }
        result.byMonth[month].debit += debit;
        result.byMonth[month].credit += credit;
        result.byMonth[month].count++;
    }

    result.balance = result.totalDebit - result.totalCredit;

    if (useCache) {
        aggregateCache.set(cacheKey, result, cacheTTL);
    }

    return result;
}

// ============================================================================
// Trial Balance
// ============================================================================

export interface TrialBalanceEntry {
    accountCode: string;
    accountName: string;
    openingDebit: number;
    openingCredit: number;
    periodDebit: number;
    periodCredit: number;
    closingDebit: number;
    closingCredit: number;
}

/**
 * Generate trial balance from GL entries
 */
export function generateTrialBalance(
    entries: PostedGLEntry[],
    periodStart: string,
    periodEnd: string
): TrialBalanceEntry[] {
    const accountBalances: Map<string, {
        name: string;
        beforeDebit: number;
        beforeCredit: number;
        periodDebit: number;
        periodCredit: number;
    }> = new Map();

    for (const entry of entries) {
        if (!accountBalances.has(entry.account_code)) {
            accountBalances.set(entry.account_code, {
                name: entry.account_name,
                beforeDebit: 0,
                beforeCredit: 0,
                periodDebit: 0,
                periodCredit: 0,
            });
        }

        const balance = accountBalances.get(entry.account_code)!;
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;

        if (entry.date < periodStart) {
            balance.beforeDebit += debit;
            balance.beforeCredit += credit;
        } else if (entry.date >= periodStart && entry.date <= periodEnd) {
            balance.periodDebit += debit;
            balance.periodCredit += credit;
        }
    }

    // Convert to array and calculate closing balances
    const result: TrialBalanceEntry[] = [];

    for (const [code, balance] of accountBalances) {
        const openingBalance = balance.beforeDebit - balance.beforeCredit;
        const periodBalance = balance.periodDebit - balance.periodCredit;
        const closingBalance = openingBalance + periodBalance;

        result.push({
            accountCode: code,
            accountName: balance.name,
            openingDebit: openingBalance >= 0 ? openingBalance : 0,
            openingCredit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
            periodDebit: balance.periodDebit,
            periodCredit: balance.periodCredit,
            closingDebit: closingBalance >= 0 ? closingBalance : 0,
            closingCredit: closingBalance < 0 ? Math.abs(closingBalance) : 0,
        });
    }

    // Sort by account code
    result.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return result;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Process entries in batches to avoid blocking UI
 */
export async function processEntriesInBatches<T>(
    entries: PostedGLEntry[],
    processor: (batch: PostedGLEntry[]) => T[],
    batchSize: number = 1000,
    onProgress?: (processed: number, total: number) => void
): Promise<T[]> {
    const results: T[] = [];
    const total = entries.length;

    for (let i = 0; i < total; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchResults = processor(batch);
        results.push(...batchResults);

        if (onProgress) {
            onProgress(Math.min(i + batchSize, total), total);
        }

        // Yield to main thread
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    return results;
}

// ============================================================================
// Cache Management API
// ============================================================================

export function invalidateGLCache(clientId?: string): void {
    if (clientId) {
        glEntryCache.invalidate(clientId);
        aggregateCache.invalidate(clientId);
    } else {
        glEntryCache.invalidate();
        aggregateCache.invalidate();
    }
}

export function getCacheStats(): { glCacheSize: number; aggregateCacheSize: number } {
    return {
        glCacheSize: glEntryCache.size(),
        aggregateCacheSize: aggregateCache.size(),
    };
}

export default {
    queryGLEntries,
    aggregateGLEntries,
    generateTrialBalance,
    processEntriesInBatches,
    invalidateGLCache,
    getCacheStats,
};
