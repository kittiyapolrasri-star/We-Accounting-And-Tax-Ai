import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
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
  firstPage?: () => void;
  lastPage?: () => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageNumbers,
  hasNextPage,
  hasPrevPage,
  startIndex,
  endIndex,
  totalItems,
  goToPage,
  nextPage,
  prevPage,
  firstPage,
  lastPage,
  pageSize = 20,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
}) => {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white border-t border-slate-200">
      {/* Info */}
      <div className="text-sm text-slate-600">
        แสดง <span className="font-medium">{startIndex}</span> -{' '}
        <span className="font-medium">{endIndex}</span> จาก{' '}
        <span className="font-medium">{totalItems}</span> รายการ
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Page Size Selector */}
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2 mr-4">
            <label className="text-sm text-slate-600">แสดง:</label>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-slate-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {/* First Page */}
          {firstPage && (
            <button
              onClick={firstPage}
              disabled={!hasPrevPage}
              className="p-1.5 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="หน้าแรก"
            >
              <ChevronsLeft size={18} />
            </button>
          )}

          {/* Previous */}
          <button
            onClick={prevPage}
            disabled={!hasPrevPage}
            className="p-1.5 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="หน้าก่อนหน้า"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {pageNumbers[0] > 1 && (
              <>
                <button
                  onClick={() => goToPage(1)}
                  className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100 text-sm transition-colors"
                >
                  1
                </button>
                {pageNumbers[0] > 2 && (
                  <span className="px-2 text-slate-400">...</span>
                )}
              </>
            )}

            {pageNumbers.map((page) => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  page === currentPage
                    ? 'bg-blue-600 text-white border border-blue-600'
                    : 'border border-slate-300 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="px-2 text-slate-400">...</span>
                )}
                <button
                  onClick={() => goToPage(totalPages)}
                  className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100 text-sm transition-colors"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>

          {/* Next */}
          <button
            onClick={nextPage}
            disabled={!hasNextPage}
            className="p-1.5 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="หน้าถัดไป"
          >
            <ChevronRight size={18} />
          </button>

          {/* Last Page */}
          {lastPage && (
            <button
              onClick={lastPage}
              disabled={!hasNextPage}
              className="p-1.5 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="หน้าสุดท้าย"
            >
              <ChevronsRight size={18} />
            </button>
          )}
        </nav>
      </div>
    </div>
  );
};

export default Pagination;
