
import React, { useState, useEffect } from 'react';
import { DocumentRecord, Staff } from '../types';
import { Search, Filter, FileSearch, FileCheck, CheckSquare, Square, Check, Trash2, FileSpreadsheet, Download, Calendar } from 'lucide-react';

interface Props {
  documents: DocumentRecord[];
  staff: Staff[];
  onReview?: (doc: DocumentRecord) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onBatchApprove?: (docIds: string[]) => void; // New Prop
}

const DocumentList: React.FC<Props> = ({ documents, staff, onReview, onSelectionChange, onBatchApprove }) => {
  const [localDocs, setLocalDocs] = useState<DocumentRecord[]>(documents);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Sync props to local state & apply filters
  useEffect(() => {
    let filtered = documents;

    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(d => 
            d.filename.toLowerCase().includes(lowerSearch) || 
            d.client_name.toLowerCase().includes(lowerSearch) ||
            d.ai_data?.header_data.inv_number.toLowerCase().includes(lowerSearch)
        );
    }

    if (dateStart) {
        filtered = filtered.filter(d => d.uploaded_at >= dateStart);
    }
    if (dateEnd) {
        // Adjust end date to include the full day
        const endDate = new Date(dateEnd);
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(d => new Date(d.uploaded_at) <= endDate);
    }

    setLocalDocs(filtered);
  }, [documents, searchTerm, dateStart, dateEnd]);

  const toggleSelectAll = () => {
    if (selectedIds.size === localDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(localDocs.map(d => d.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Notify parent of selection changes (optional)
  useEffect(() => {
    if(onSelectionChange) {
        onSelectionChange(Array.from(selectedIds));
    }
  }, [selectedIds, onSelectionChange]);


  const getAssigneeName = (id: string | null) => {
    if (!id) return 'Unassigned';
    return staff.find(s => s.id === id)?.name || 'Unknown';
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleBatchExportExpress = () => {
      const selectedDocs = localDocs.filter(d => selectedIds.has(d.id));
      if (selectedDocs.length === 0) return;

      // Mock Express Import Format (Journal Voucher)
      // Format: Type,Date,DocNo,Desc,AccCode,AccName,Amount,DrCr
      let csvContent = "Type,Date,DocNo,Description,Account,Amount,Side\n";
      
      selectedDocs.forEach(doc => {
          const entry = doc.ai_data?.accounting_entry;
          const date = doc.ai_data?.header_data.issue_date || '';
          const docNo = doc.ai_data?.header_data.inv_number || '';
          
          if (entry) {
              entry.journal_lines.forEach(line => {
                  csvContent += `JV,${date},${docNo},"${entry.transaction_description}",${line.account_code},${line.amount},${line.account_side}\n`;
              });
          }
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `EXPRESS_BATCH_IMPORT_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleApproveSelected = () => {
      if (onBatchApprove && selectedIds.size > 0) {
          onBatchApprove(Array.from(selectedIds));
          setSelectedIds(new Set()); // Clear
      }
  };

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col relative">
       <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Documents <span className="text-lg font-normal text-slate-400">| ทะเบียนเอกสาร</span></h2>
          <p className="text-slate-500">Centralized ledger of all AI-processed files (รายการเอกสารที่ผ่านการประมวลผล).</p>
        </div>
        {selectedIds.size > 0 && (
             <div className="flex gap-2 animate-in slide-in-from-right fade-in">
                 <button 
                    onClick={handleBatchExportExpress}
                    className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                 >
                     <FileSpreadsheet size={16} /> Export Express ({selectedIds.size})
                 </button>
                 <button className="px-4 py-2 bg-slate-100 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-200 transition-colors flex items-center gap-2">
                     <Trash2 size={16} /> ลบ
                 </button>
                 <button 
                    onClick={handleApproveSelected}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                 >
                     <FileCheck size={16} /> Approve & Post ({selectedIds.size})
                 </button>
             </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col">
         {/* Toolbar */}
         <div className="p-4 border-b border-slate-200 flex gap-4 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
               <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
               <input 
                 type="text" 
                 placeholder="Search by client, invoice number (ค้นหา)..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
               />
            </div>
            
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              <Filter size={16} /> Filter
            </button>

            {showFilters && (
                <div className="flex items-center gap-2 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                        <Calendar size={14} className="text-slate-400"/>
                        <input 
                            type="date" 
                            className="bg-transparent text-sm text-slate-600 outline-none"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                        />
                        <span className="text-slate-400">-</span>
                        <input 
                            type="date" 
                            className="bg-transparent text-sm text-slate-600 outline-none"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                        />
                    </div>
                    {(dateStart || dateEnd) && (
                        <button onClick={() => { setDateStart(''); setDateEnd(''); }} className="text-xs text-red-500 hover:underline">Clear</button>
                    )}
                </div>
            )}
         </div>

         {/* Table */}
         <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">
                      <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                        {selectedIds.size > 0 && selectedIds.size === localDocs.length ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18} />}
                      </button>
                  </th>
                  <th className="px-6 py-4">Status (สถานะ)</th>
                  <th className="px-6 py-4">Date (วันที่)</th>
                  <th className="px-6 py-4">Client (ลูกค้า)</th>
                  <th className="px-6 py-4">File (ไฟล์)</th>
                  <th className="px-6 py-4 text-right">Amount (ยอดรวม)</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localDocs.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400">ไม่พบเอกสารตามเงื่อนไข</td></tr>
                ) : localDocs.map(doc => {
                  const isSelected = selectedIds.has(doc.id);
                  return (
                  <tr 
                    key={doc.id} 
                    className={`transition-colors group ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-4 text-center">
                        <button onClick={() => toggleSelectOne(doc.id)} className="text-slate-300 hover:text-blue-500">
                            {isSelected ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18} />}
                        </button>
                    </td>
                    <td className="px-6 py-4" onClick={() => onReview && doc.status !== 'processing' && onReview(doc)}>
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize border cursor-pointer
                        ${doc.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                          doc.status === 'pending_review' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                          doc.status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                          'bg-slate-100 text-slate-700 border-slate-200'}
                       `}>
                         {doc.status === 'approved' ? 'บันทึกแล้ว' : 
                          doc.status === 'pending_review' ? 'รอตรวจสอบ' : 
                          doc.status === 'processing' ? 'กำลังประมวลผล' : doc.status}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(doc.uploaded_at)}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{doc.client_name}</td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{doc.filename}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-700">
                      {new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(doc.amount)}
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white
                            ${doc.assigned_to ? 'bg-blue-500' : 'bg-slate-300'}
                          `}>
                            {getAssigneeName(doc.assigned_to).charAt(0)}
                          </div>
                          <span className="text-slate-600">{getAssigneeName(doc.assigned_to)}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       {doc.status === 'pending_review' && (
                           <button 
                                onClick={() => onReview && doc.status !== 'processing' && onReview(doc)}
                                className="text-blue-600 hover:text-blue-800 font-medium text-xs flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                           >
                               <FileSearch size={14} /> Review
                           </button>
                       )}
                       {doc.status === 'approved' && (
                           <span className="text-emerald-600 text-xs flex items-center gap-1">
                               <FileCheck size={14} /> Posted
                           </span>
                       )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default DocumentList;
