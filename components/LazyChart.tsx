/**
 * Lazy Chart Component
 * โหลด chart แบบ lazy เพื่อประสิทธิภาพที่ดีขึ้น
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

export interface LazyChartProps {
    renderChart: () => React.ReactNode;
    height?: number | string;
    loadingMessage?: string;
    className?: string;
    threshold?: number; // Intersection observer threshold
}

/**
 * LazyChart - โหลด chart เมื่อ element เข้ามาใน viewport
 */
export const LazyChart: React.FC<LazyChartProps> = ({
    renderChart,
    height = 300,
    loadingMessage = 'กำลังโหลดกราฟ...',
    className = '',
    threshold = 0.1
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [threshold]);

    useEffect(() => {
        if (isVisible && !isLoaded) {
            // Small delay to ensure smooth loading
            const timer = setTimeout(() => {
                setIsLoaded(true);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isVisible, isLoaded]);

    return (
        <div
            ref={containerRef}
            className={`relative ${className}`}
            style={{ minHeight: height }}
        >
            {!isLoaded ? (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-slate-50 rounded-xl"
                    style={{ height }}
                >
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm">{loadingMessage}</span>
                    </div>
                </div>
            ) : (
                renderChart()
            )}
        </div>
    );
};

// ============================================================================
// Chart Container with Loading State
// ============================================================================

export interface ChartContainerProps {
    title: string;
    subtitle?: string;
    isLoading?: boolean;
    isEmpty?: boolean;
    emptyMessage?: string;
    error?: string;
    onRetry?: () => void;
    children: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
    title,
    subtitle,
    isLoading = false,
    isEmpty = false,
    emptyMessage = 'ไม่มีข้อมูลแสดง',
    error,
    onRetry,
    children,
    actions,
    className = ''
}) => {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-slate-800">{title}</h3>
                    {subtitle && (
                        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
                    )}
                </div>
                {actions && <div>{actions}</div>}
            </div>

            {/* Content */}
            <div className="relative min-h-[200px]">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="text-sm text-slate-500">กำลังโหลดข้อมูล...</span>
                        </div>
                    </div>
                ) : error ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <p className="text-red-600">{error}</p>
                            {onRetry && (
                                <button
                                    onClick={onRetry}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                >
                                    ลองอีกครั้ง
                                </button>
                            )}
                        </div>
                    </div>
                ) : isEmpty ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                                <span className="text-2xl">📊</span>
                            </div>
                            <p className="text-slate-500">{emptyMessage}</p>
                        </div>
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
};

// ============================================================================
// Simple Bar Chart (No external dependencies)
// ============================================================================

export interface BarData {
    label: string;
    value: number;
    color?: string;
}

export interface SimpleBarChartProps {
    data: BarData[];
    height?: number;
    showValues?: boolean;
    formatValue?: (value: number) => string;
    className?: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
    data,
    height = 200,
    showValues = true,
    formatValue = (v) => v.toLocaleString('th-TH'),
    className = ''
}) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className={`flex items-end gap-2 ${className}`} style={{ height }}>
            {data.map((item, index) => {
                const barHeight = (item.value / maxValue) * 100;
                const color = item.color || getDefaultColor(index);

                return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="flex-1 w-full flex flex-col justify-end">
                            {showValues && (
                                <span className="text-xs text-slate-600 text-center mb-1">
                                    {formatValue(item.value)}
                                </span>
                            )}
                            <div
                                className="w-full rounded-t-lg transition-all duration-500"
                                style={{
                                    height: `${barHeight}%`,
                                    backgroundColor: color,
                                    minHeight: item.value > 0 ? 4 : 0
                                }}
                            />
                        </div>
                        <span className="text-xs text-slate-500 mt-2 text-center truncate w-full">
                            {item.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================================
// Simple Pie/Donut Chart
// ============================================================================

export interface PieData {
    label: string;
    value: number;
    color?: string;
}

export interface SimplePieChartProps {
    data: PieData[];
    size?: number;
    donut?: boolean;
    donutWidth?: number;
    showLegend?: boolean;
    formatValue?: (value: number, percent: number) => string;
    className?: string;
}

export const SimplePieChart: React.FC<SimplePieChartProps> = ({
    data,
    size = 200,
    donut = false,
    donutWidth = 40,
    showLegend = true,
    formatValue = (v, p) => `${p.toFixed(1)}%`,
    className = ''
}) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const radius = size / 2;
    const center = size / 2;

    let currentAngle = -90; // Start from top

    const segments = data.map((item, index) => {
        const percent = total > 0 ? (item.value / total) * 100 : 0;
        const angle = (percent / 100) * 360;
        const color = item.color || getDefaultColor(index);

        const startAngle = currentAngle;
        currentAngle += angle;

        return {
            ...item,
            percent,
            color,
            startAngle,
            endAngle: currentAngle
        };
    });

    const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees * Math.PI) / 180;
        return {
            x: centerX + r * Math.cos(angleInRadians),
            y: centerY + r * Math.sin(angleInRadians)
        };
    };

    const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
        const start = polarToCartesian(x, y, r, endAngle);
        const end = polarToCartesian(x, y, r, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

        return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${x} ${y} Z`;
    };

    return (
        <div className={`flex items-center gap-6 ${className}`}>
            <svg width={size} height={size}>
                {segments.map((segment, index) => (
                    <path
                        key={index}
                        d={describeArc(center, center, radius - 5, segment.startAngle, segment.endAngle)}
                        fill={segment.color}
                        className="transition-all duration-300 hover:opacity-80"
                    />
                ))}
                {donut && (
                    <circle
                        cx={center}
                        cy={center}
                        r={radius - donutWidth}
                        fill="white"
                    />
                )}
            </svg>

            {showLegend && (
                <div className="space-y-2">
                    {segments.map((segment, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: segment.color }}
                            />
                            <span className="text-sm text-slate-600">
                                {segment.label}
                            </span>
                            <span className="text-sm text-slate-400">
                                {formatValue(segment.value, segment.percent)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Utilities
// ============================================================================

const DEFAULT_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
];

function getDefaultColor(index: number): string {
    return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

export default {
    LazyChart,
    ChartContainer,
    SimpleBarChart,
    SimplePieChart
};
