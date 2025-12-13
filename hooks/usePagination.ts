import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

// ==================================
// CURSOR-BASED PAGINATION (Firestore)
// ==================================

export interface CursorPaginationOptions<T> {
  pageSize?: number;
  fetchFn: (cursor?: string, pageSize?: number) => Promise<{
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
  }>;
}

export interface CursorPaginationResult<T> {
  data: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useCursorPagination = <T>(
  options: CursorPaginationOptions<T>
): CursorPaginationResult<T> => {
  const { pageSize = 20, fetchFn } = options;
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsLoading(true);
      setCursor(undefined);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const result = await fetchFn(isRefresh ? undefined : cursor, pageSize);

      if (isRefresh) {
        setData(result.data);
      } else {
        setData(prev => [...prev, ...result.data]);
      }

      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [cursor, pageSize, fetchFn]);

  useEffect(() => {
    fetchData(true);
  }, []);

  const loadMore = useCallback(async () => {
    if (!isLoadingMore && hasMore) {
      await fetchData(false);
    }
  }, [isLoadingMore, hasMore, fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    data,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  };
};

// ==================================
// INFINITE SCROLL HOOK
// ==================================

export const useInfiniteScroll = (
  callback: () => void,
  options: { threshold?: number; enabled?: boolean } = {}
) => {
  const { threshold = 200, enabled = true } = options;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          callback();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [callback, threshold, enabled]);

  return sentinelRef;
};

// ==================================
// OFFSET-BASED PAGINATION (Original)
// ==================================

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

interface PaginationResult<T> {
  // Current page data
  data: T[];

  // Pagination state
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;

  // Navigation functions
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;

  // Page size control
  setPageSize: (size: number) => void;

  // Info helpers
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startIndex: number;
  endIndex: number;

  // Page numbers for pagination UI
  pageNumbers: number[];
}

/**
 * Custom hook for client-side pagination
 * Handles large datasets efficiently by only computing visible items
 */
export const usePagination = <T>(
  items: T[],
  initialPageSize: number = 20,
  maxPageButtons: number = 5
): PaginationResult<T> => {
  const [state, setState] = useState<PaginationState>({
    currentPage: 1,
    pageSize: initialPageSize,
    totalItems: items.length,
  });

  // Update total items when items array changes
  useMemo(() => {
    if (items.length !== state.totalItems) {
      setState(prev => ({
        ...prev,
        totalItems: items.length,
        // Reset to page 1 if current page would be out of bounds
        currentPage: Math.min(prev.currentPage, Math.ceil(items.length / prev.pageSize) || 1),
      }));
    }
  }, [items.length, state.totalItems, state.pageSize]);

  const totalPages = Math.ceil(state.totalItems / state.pageSize) || 1;

  // Calculate current page data
  const data = useMemo(() => {
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    return items.slice(startIndex, endIndex);
  }, [items, state.currentPage, state.pageSize]);

  // Navigation functions
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setState(prev => ({ ...prev, currentPage: validPage }));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(state.currentPage + 1);
  }, [state.currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(state.currentPage - 1);
  }, [state.currentPage, goToPage]);

  const firstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const lastPage = useCallback(() => {
    goToPage(totalPages);
  }, [totalPages, goToPage]);

  const setPageSize = useCallback((size: number) => {
    setState(prev => ({
      ...prev,
      pageSize: size,
      currentPage: 1, // Reset to first page when changing page size
    }));
  }, []);

  // Calculate page numbers for pagination UI
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];

    if (totalPages <= maxPageButtons) {
      // Show all pages if total is less than max buttons
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      let startPage = Math.max(1, state.currentPage - Math.floor(maxPageButtons / 2));
      let endPage = startPage + maxPageButtons - 1;

      if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - maxPageButtons + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  }, [state.currentPage, totalPages, maxPageButtons]);

  // Calculate indices for display
  const startIndex = (state.currentPage - 1) * state.pageSize + 1;
  const endIndex = Math.min(state.currentPage * state.pageSize, state.totalItems);

  return {
    data,
    currentPage: state.currentPage,
    pageSize: state.pageSize,
    totalPages,
    totalItems: state.totalItems,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setPageSize,
    hasNextPage: state.currentPage < totalPages,
    hasPrevPage: state.currentPage > 1,
    startIndex,
    endIndex,
    pageNumbers,
  };
};

/**
 * Pagination UI Component Props
 */
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageNumbers: number[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export default usePagination;
