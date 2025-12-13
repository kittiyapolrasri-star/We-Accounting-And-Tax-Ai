import React, { useState, useRef } from 'react';
import { Upload, FileText, Check, AlertTriangle, X, RefreshCw, Download, Link } from 'lucide-react';
import {
  parseBankStatement,
  convertToBankTransactions,
  readFileAsText,
  ParsedBankRow,
  BankFormat,
} from '../services/bankFeed';
import { BankTransaction } from '../types';

interface Props {
  clientId: string;
  onImport: (transactions: Omit<BankTransaction, 'id'>[]) => Promise<void>;
  existingTransactions?: BankTransaction[];
}

const BankImport: React.FC<Props> = ({ clientId, onImport, existingTransactions = [] }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedBankRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<BankFormat>('AUTO');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setParseErrors([]);
    setParsedData(null);
    setImportStatus('idle');

    try {
      const content = await readFileAsText(file);
      const result = parseBankStatement(content, selectedFormat);

      if (result.success) {
        setParsedData(result.transactions);
        // Select all rows by default
        setSelectedRows(new Set(result.transactions.map((_, i) => i)));

        if (result.bankName) {
          console.log(`Detected bank format: ${result.bankName}`);
        }
      } else {
        setParseErrors(result.errors);
      }
    } catch (error) {
      setParseErrors(['ไม่สามารถอ่านไฟล์ได้ กรุณาลองใหม่']);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData || selectedRows.size === 0) return;

    setIsUploading(true);
    setImportStatus('idle');

    try {
      const selectedTransactions = parsedData.filter((_, i) => selectedRows.has(i));
      const transactions = convertToBankTransactions(selectedTransactions, clientId);

      await onImport(transactions);
      setImportStatus('success');

      // Clear data after successful import
      setTimeout(() => {
        setParsedData(null);
        setSelectedRows(new Set());
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    } catch (error) {
      setImportStatus('error');
      setParseErrors(['นำเข้าข้อมูลไม่สำเร็จ กรุณาลองใหม่']);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleRow = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  const toggleAll = () => {
    if (!parsedData) return;
    if (selectedRows.size === parsedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(parsedData.map((_, i) => i)));
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  };

  const totalSelected = parsedData
    ? parsedData
        .filter((_, i) => selectedRows.has(i))
        .reduce((sum, row) => sum + row.deposit - row.withdrawal, 0)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">นำเข้ารายการธนาคาร</h3>
          <p className="text-sm text-slate-500">
            อัพโหลดไฟล์ CSV จาก Internet Banking
          </p>
        </div>

        <select
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value as BankFormat)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2"
        >
          <option value="AUTO">ตรวจจับอัตโนมัติ</option>
          <option value="SCB">SCB (ไทยพาณิชย์)</option>
          <option value="KBANK">KBANK (กสิกร)</option>
          <option value="BBL">BBL (กรุงเทพ)</option>
          <option value="KTB">KTB (กรุงไทย)</option>
          <option value="BAY">BAY (กรุงศรี)</option>
        </select>
      </div>

      {/* Upload Zone */}
      {!parsedData && (
        <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          {isUploading ? (
            <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-3" />
          ) : (
            <Upload className="w-10 h-10 text-slate-400 mb-3" />
          )}
          <span className="text-slate-600 font-medium">
            {isUploading ? 'กำลังอ่านไฟล์...' : 'คลิกหรือลากไฟล์มาวางที่นี่'}
          </span>
          <span className="text-xs text-slate-400 mt-1">
            รองรับไฟล์ CSV จาก SCB, KBANK, BBL, KTB, BAY
          </span>
        </label>
      )}

      {/* Parse Errors */}
      {parseErrors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">พบข้อผิดพลาด</p>
              {parseErrors.map((error, i) => (
                <p key={i} className="text-sm text-red-600 mt-1">{error}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {importStatus === 'success' && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-800">
              นำเข้าข้อมูลสำเร็จ {selectedRows.size} รายการ
            </p>
          </div>
        </div>
      )}

      {/* Parsed Data Preview */}
      {parsedData && parsedData.length > 0 && (
        <div className="mt-4">
          {/* Summary */}
          <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-4">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  พบ {parsedData.length} รายการ
                </p>
                <p className="text-xs text-slate-500">
                  เลือก {selectedRows.size} รายการ | รวม {formatAmount(totalSelected)} บาท
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setParsedData(null);
                  setSelectedRows(new Set());
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === parsedData.length}
                      onChange={toggleAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-slate-600">วันที่</th>
                  <th className="px-3 py-2 text-left text-slate-600">รายละเอียด</th>
                  <th className="px-3 py-2 text-right text-slate-600">ถอน</th>
                  <th className="px-3 py-2 text-right text-slate-600">ฝาก</th>
                  <th className="px-3 py-2 text-right text-slate-600">คงเหลือ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedData.map((row, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-slate-50 ${selectedRows.has(index) ? 'bg-blue-50/50' : ''}`}
                    onClick={() => toggleRow(index)}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(index)}
                        onChange={() => toggleRow(index)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString('th-TH', {
                        day: '2-digit',
                        month: 'short',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2 text-slate-800 max-w-xs truncate">
                      {row.description}
                    </td>
                    <td className="px-3 py-2 text-right text-red-600 font-mono">
                      {row.withdrawal > 0 ? formatAmount(row.withdrawal) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-mono">
                      {row.deposit > 0 ? formatAmount(row.deposit) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 font-mono">
                      {formatAmount(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Import Button */}
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => {
                setParsedData(null);
                setSelectedRows(new Set());
              }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleImport}
              disabled={selectedRows.size === 0 || isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              นำเข้า {selectedRows.size} รายการ
            </button>
          </div>
        </div>
      )}

      {/* Existing Transactions Summary */}
      {existingTransactions.length > 0 && !parsedData && (
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h4 className="text-sm font-medium text-slate-700 mb-3">
            รายการที่นำเข้าแล้ว ({existingTransactions.length} รายการ)
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">รอจับคู่</p>
              <p className="text-lg font-bold text-amber-600">
                {existingTransactions.filter(t => t.status === 'unmatched').length}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">จับคู่แล้ว</p>
              <p className="text-lg font-bold text-emerald-600">
                {existingTransactions.filter(t => t.status === 'matched').length}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">ยอดรวม</p>
              <p className="text-lg font-bold text-slate-800">
                {formatAmount(
                  existingTransactions.reduce((sum, t) => sum + t.amount, 0)
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankImport;
