
import React, { useState, useEffect } from 'react';
import { DocumentRecord, Staff, Client } from '../types';
import { Search, Folder, FileText, ChevronRight, Home, Filter, Grid, List, CheckSquare, Square, Trash2, FileCheck, FolderOpen } from 'lucide-react';

interface Props {
    documents: DocumentRecord[];
    clients: Client[];
    staff: Staff[];
    onReview?: (doc: DocumentRecord) => void;
    onBatchApprove?: (docIds: string[]) => void;
    onBatchDelete?: (docIds: string[]) => void;
}

// Helper to structure flat list into hierarchical tree
// Structure: Client -> Year -> Month -> Docs
const buildHierarchy = (docs: DocumentRecord[], clients: Client[]) => {
    const tree: any = {};

    docs.forEach(doc => {
        const clientName = doc.client_name || 'Unassigned';
        const date = new Date(doc.uploaded_at);
        const year = date.getFullYear().toString();
        // Use Thai Month
        const month = date.toLocaleDateString('th-TH', { month: 'long' });

        if (!tree[clientName]) tree[clientName] = {};
        if (!tree[clientName][year]) tree[clientName][year] = {};
        if (!tree[clientName][year][month]) tree[clientName][year][month] = [];

        tree[clientName][year][month].push(doc);
    });
    return tree;
};

const SmartDocumentArchive: React.FC<Props> = ({ documents, clients, staff, onReview, onBatchApprove, onBatchDelete }) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [currentPath, setCurrentPath] = useState<string[]>([]); // [] = Root, ['Client A'] = Client Level, etc.
    const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    const hierarchy = buildHierarchy(documents, clients);

    // Determine what to show based on path
    const getCurrentItems = () => {
        if (searchTerm) {
            // Flat search result
            return documents.filter(d =>
                d.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.client_name.toLowerCase().includes(searchTerm.toLowerCase())
            ).map(d => ({ type: 'file', data: d }));
        }

        let currentLevel = hierarchy;
        // Traverse
        for (const p of currentPath) {
            if (currentLevel[p]) {
                currentLevel = currentLevel[p];
            } else {
                return [];
            }
        }

        if (Array.isArray(currentLevel)) {
            return currentLevel.map(doc => ({ type: 'file', data: doc }));
        } else {
            return Object.keys(currentLevel).map(key => ({
                type: 'folder',
                name: key,
                count: countDocsInFolder(currentLevel[key])
            }));
        }
    };

    const countDocsInFolder = (node: any): number => {
        if (Array.isArray(node)) return node.length;
        let count = 0;
        Object.values(node).forEach(child => count += countDocsInFolder(child));
        return count;
    };

    const handleNavigate = (name: string) => {
        setCurrentPath([...currentPath, name]);
    };

    const handleBreadcrumb = (index: number) => {
        setCurrentPath(currentPath.slice(0, index));
    };

    const currentItems = getCurrentItems();

    const toggleSelectDoc = (id: string) => {
        const newSet = new Set(selectedDocs);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedDocs(newSet);
    };

    const handleApproveSelected = () => {
        if (onBatchApprove && selectedDocs.size > 0) {
            onBatchApprove(Array.from(selectedDocs));
            setSelectedDocs(new Set()); // Clear selection after action
        }
    };

    return (
        <div className="animate-in fade-in duration-500 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">ระบบจัดเก็บเอกสารดิจิทัล (Smart Archive)</h2>
                    <p className="text-slate-500">จัดการเอกสารจำนวนมากแยกตามลูกค้าและงวดบัญชี</p>
                </div>

                {/* Bulk Actions */}
                {selectedDocs.size > 0 && (
                    <div className="flex gap-2 animate-in slide-in-from-right fade-in">
                        <button
                            onClick={() => {
                                if (window.confirm(`ต้องการลบเอกสาร ${selectedDocs.size} รายการ?`)) {
                                    if (onBatchDelete) {
                                        onBatchDelete(Array.from(selectedDocs));
                                    }
                                    setSelectedDocs(new Set());
                                }
                            }}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <Trash2 size={16} /> ลบ ({selectedDocs.size})
                        </button>
                        <button
                            onClick={handleApproveSelected}
                            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 flex items-center gap-2"
                        >
                            <FileCheck size={16} /> อนุมัติ & บันทึกบัญชี ({selectedDocs.size})
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 flex gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                        {/* Breadcrumbs */}
                        <button
                            onClick={() => setCurrentPath([])}
                            className={`p-2 rounded-lg hover:bg-slate-50 ${currentPath.length === 0 ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-500'}`}
                        >
                            <Home size={18} />
                        </button>
                        {currentPath.map((crumb, idx) => (
                            <div key={idx} className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
                                <ChevronRight size={14} className="text-slate-300" />
                                <button
                                    onClick={() => handleBreadcrumb(idx + 1)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${idx === currentPath.length - 1 ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {crumb}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="ค้นหาเอกสาร..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-slate-700 placeholder-slate-400"
                            />
                        </div>
                        <div className="h-8 w-px bg-slate-100 mx-1"></div>
                        <div className="flex bg-slate-50 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <List size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Grid size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
                    {/* GRID VIEW */}
                    {viewMode === 'grid' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {currentItems.map((item: any, idx) => (
                                item.type === 'folder' ? (
                                    <div
                                        key={idx}
                                        onClick={() => handleNavigate(item.name)}
                                        className="group bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer transition-all flex flex-col items-center text-center aspect-square justify-center relative"
                                    >
                                        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                            <Folder size={32} />
                                        </div>
                                        <span className="font-semibold text-slate-700 text-sm truncate w-full px-2">{item.name}</span>
                                        <span className="text-xs text-slate-400 mt-1">{item.count} รายการ</span>
                                    </div>
                                ) : (
                                    <div
                                        key={item.data.id}
                                        className={`group bg-white p-4 rounded-2xl border transition-all flex flex-col relative
                                    ${selectedDocs.has(item.data.id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-100 hover:border-blue-300 hover:shadow-md'}
                                `}
                                    >
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleSelectDoc(item.data.id); }}
                                            className="absolute top-3 right-3 text-slate-300 hover:text-blue-600"
                                        >
                                            {selectedDocs.has(item.data.id) ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                                        </button>

                                        <div
                                            className="flex-1 flex flex-col items-center justify-center cursor-pointer py-4"
                                            onClick={() => onReview && item.data.status !== 'processing' && onReview(item.data)}
                                        >
                                            <FileText size={40} className="text-slate-300 mb-3 group-hover:text-blue-400 transition-colors" />
                                            <span className="text-sm font-medium text-slate-700 text-center line-clamp-2 w-full break-words leading-tight">
                                                {item.data.filename}
                                            </span>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
                                            <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                                {item.data.status === 'approved' ? 'อนุมัติแล้ว' :
                                                    item.data.status === 'pending_review' ? 'รอตรวจ' : item.data.status}
                                            </span>
                                            <span className="text-xs font-bold text-slate-700">
                                                {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(item.data.amount)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    )}

                    {/* LIST VIEW */}
                    {viewMode === 'list' && (
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                    <tr>
                                        <th className="px-6 py-3 w-12"></th>
                                        <th className="px-6 py-3">ชื่อเอกสาร</th>
                                        <th className="px-6 py-3">ประเภท</th>
                                        {currentPath.length > 0 && <th className="px-6 py-3 text-right">ยอดเงิน (THB)</th>}
                                        <th className="px-6 py-3">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {currentItems.map((item: any, idx) => (
                                        <tr
                                            key={idx}
                                            className={`hover:bg-blue-50/50 transition-colors cursor-pointer group ${item.type === 'file' && selectedDocs.has(item.data.id) ? 'bg-blue-50' : ''}`}
                                            onClick={() => item.type === 'folder' ? handleNavigate(item.name) : (onReview && onReview(item.data))}
                                        >
                                            <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                {item.type === 'file' && (
                                                    <button onClick={() => toggleSelectDoc(item.data.id)} className="text-slate-300 hover:text-blue-600">
                                                        {selectedDocs.has(item.data.id) ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    {item.type === 'folder' ? (
                                                        <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center">
                                                            <Folder size={16} />
                                                        </div>
                                                    ) : (
                                                        <FileText size={20} className="text-slate-400" />
                                                    )}
                                                    <span className={`font-medium ${item.type === 'folder' ? 'text-slate-800' : 'text-slate-600'}`}>
                                                        {item.type === 'folder' ? item.name : item.data.filename}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-slate-500">
                                                {item.type === 'folder' ? 'Directory' : item.data.ai_data?.header_data.doc_type || 'Unknown'}
                                            </td>
                                            {currentPath.length > 0 && (
                                                <td className="px-6 py-3 text-right font-mono text-slate-700">
                                                    {item.type === 'folder' ? '-' : item.data.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                                </td>
                                            )}
                                            <td className="px-6 py-3">
                                                {item.type === 'folder' ? (
                                                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{item.count} รายการ</span>
                                                ) : (
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${item.data.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                                        item.data.status === 'pending_review' ? 'bg-amber-50 text-amber-600' :
                                                            'bg-slate-50 text-slate-500'
                                                        }`}>
                                                        {item.data.status === 'approved' ? 'บันทึกแล้ว' :
                                                            item.data.status === 'pending_review' ? 'รอตรวจสอบ' : item.data.status}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {currentItems.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 flex flex-col items-center">
                                                <FolderOpen size={48} className="mb-4 opacity-20" />
                                                <p>ไม่พบเอกสารในโฟลเดอร์นี้</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmartDocumentArchive;
