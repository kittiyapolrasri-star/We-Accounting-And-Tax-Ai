/**
 * Virtual List Component
 * Render รายการจำนวนมากอย่างมีประสิทธิภาพ (Virtual Scrolling)
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

export interface VirtualListProps<T> {
    items: T[];
    itemHeight: number;
    containerHeight: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    overscan?: number; // จำนวน items ที่ render เพิ่มเติมนอกเหนือ viewport
    className?: string;
    onEndReached?: () => void; // Called when scrolled near the end
    endReachedThreshold?: number; // Distance from end to trigger onEndReached
}

export function VirtualList<T>({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    overscan = 3,
    className = '',
    onEndReached,
    endReachedThreshold = 200
}: VirtualListProps<T>): React.ReactElement {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [hasCalledEndReached, setHasCalledEndReached] = useState(false);

    // Total height of all items
    const totalHeight = items.length * itemHeight;

    // Calculate visible range
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
        items.length - 1,
        Math.floor((scrollTop + containerHeight) / itemHeight)
    );

    // Add overscan
    const startIndex = Math.max(0, visibleStart - overscan);
    const endIndex = Math.min(items.length - 1, visibleEnd + overscan);

    // Get visible items
    const visibleItems = useMemo(() => {
        const result: { item: T; index: number; style: React.CSSProperties }[] = [];

        for (let i = startIndex; i <= endIndex; i++) {
            result.push({
                item: items[i],
                index: i,
                style: {
                    position: 'absolute',
                    top: i * itemHeight,
                    left: 0,
                    right: 0,
                    height: itemHeight
                }
            });
        }

        return result;
    }, [items, startIndex, endIndex, itemHeight]);

    // Handle scroll
    const handleScroll = useCallback((e: Event) => {
        const target = e.target as HTMLDivElement;
        setScrollTop(target.scrollTop);

        // Check if near end
        if (onEndReached && !hasCalledEndReached) {
            const distanceFromEnd = totalHeight - (target.scrollTop + containerHeight);
            if (distanceFromEnd < endReachedThreshold) {
                setHasCalledEndReached(true);
                onEndReached();
            }
        }
    }, [totalHeight, containerHeight, endReachedThreshold, onEndReached, hasCalledEndReached]);

    // Reset hasCalledEndReached when items change
    useEffect(() => {
        setHasCalledEndReached(false);
    }, [items.length]);

    // Add scroll listener
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll, { passive: true });
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    return (
        <div
            ref={containerRef}
            className={`overflow-auto ${className}`}
            style={{ height: containerHeight }}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                {visibleItems.map(({ item, index, style }) => (
                    <div key={index} style={style}>
                        {renderItem(item, index)}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// Virtual Table
// ============================================================================

export interface VirtualTableColumn<T> {
    key: keyof T | string;
    header: string;
    width?: number | string;
    render?: (item: T, index: number) => React.ReactNode;
    className?: string;
}

export interface VirtualTableProps<T> {
    items: T[];
    columns: VirtualTableColumn<T>[];
    rowHeight?: number;
    containerHeight?: number;
    onRowClick?: (item: T, index: number) => void;
    selectedIndex?: number;
    className?: string;
}

export function VirtualTable<T>({
    items,
    columns,
    rowHeight = 48,
    containerHeight = 400,
    onRowClick,
    selectedIndex,
    className = ''
}: VirtualTableProps<T>): React.ReactElement {
    const renderRow = useCallback((item: T, index: number) => (
        <div
            className={`flex items-center border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedIndex === index ? 'bg-blue-50' : ''
                } ${onRowClick ? 'cursor-pointer' : ''}`}
            style={{ height: rowHeight }}
            onClick={() => onRowClick?.(item, index)}
        >
            {columns.map((column, colIdx) => {
                const value = column.key in (item as object)
                    ? (item as Record<string, unknown>)[column.key as string]
                    : null;

                return (
                    <div
                        key={colIdx}
                        className={`px-4 truncate ${column.className || ''}`}
                        style={{ width: column.width || 'auto', flex: column.width ? 'none' : 1 }}
                    >
                        {column.render
                            ? column.render(item, index)
                            : String(value ?? '')}
                    </div>
                );
            })}
        </div>
    ), [columns, rowHeight, onRowClick, selectedIndex]);

    return (
        <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="flex items-center bg-slate-50 border-b border-slate-200 font-medium text-sm text-slate-600">
                {columns.map((column, idx) => (
                    <div
                        key={idx}
                        className={`px-4 py-3 ${column.className || ''}`}
                        style={{ width: column.width || 'auto', flex: column.width ? 'none' : 1 }}
                    >
                        {column.header}
                    </div>
                ))}
            </div>

            {/* Virtual List Body */}
            {items.length > 0 ? (
                <VirtualList
                    items={items}
                    itemHeight={rowHeight}
                    containerHeight={containerHeight}
                    renderItem={renderRow}
                    overscan={5}
                />
            ) : (
                <div className="py-12 text-center text-slate-500">
                    ไม่พบข้อมูล
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Infinite Scroll List
// ============================================================================

export interface InfiniteScrollProps<T> {
    items: T[];
    loadMore: () => Promise<void>;
    hasMore: boolean;
    isLoading: boolean;
    renderItem: (item: T, index: number) => React.ReactNode;
    containerHeight?: number;
    itemHeight: number;
    loadingComponent?: React.ReactNode;
    endMessage?: React.ReactNode;
    className?: string;
}

export function InfiniteScrollList<T>({
    items,
    loadMore,
    hasMore,
    isLoading,
    renderItem,
    containerHeight = 600,
    itemHeight,
    loadingComponent,
    endMessage,
    className = ''
}: InfiniteScrollProps<T>): React.ReactElement {
    const handleEndReached = useCallback(() => {
        if (hasMore && !isLoading) {
            loadMore();
        }
    }, [hasMore, isLoading, loadMore]);

    return (
        <div className={className}>
            <VirtualList
                items={items}
                itemHeight={itemHeight}
                containerHeight={containerHeight}
                renderItem={renderItem}
                onEndReached={handleEndReached}
                endReachedThreshold={itemHeight * 3}
            />

            {isLoading && (
                loadingComponent || (
                    <div className="py-4 text-center text-slate-500">
                        กำลังโหลด...
                    </div>
                )
            )}

            {!hasMore && items.length > 0 && (
                endMessage || (
                    <div className="py-4 text-center text-slate-400 text-sm">
                        แสดงข้อมูลทั้งหมดแล้ว
                    </div>
                )
            )}
        </div>
    );
}

export default VirtualList;
