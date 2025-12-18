import React, { useState } from 'react';
import { THAI_GL_CODES } from '../constants';
import { Folder, FolderOpen, Plus, Search, Edit2, MoreHorizontal, CheckCircle2, X, Save, Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { exportChartOfAccountsExcel } from '../services/comprehensiveExport';

interface Account {
    code: string;
    name: string;
}

interface AddEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (account: Account) => void;
    editingAccount?: Account | null;
}

const AddEditAccountModal: React.FC<AddEditModalProps> = ({ isOpen, onClose, onSave, editingAccount }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        code: editingAccount?.code || '',
        name: editingAccount?.name || ''
    });

    React.useEffect(() => {
        if (editingAccount) {
            setFormData({ code: editingAccount.code, name: editingAccount.name });
        } else {
            setFormData({ code: '', name: '' });
        }
    }, [editingAccount]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name) return;

        setLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate save
            onSave(formData);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <FolderOpen size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{editingAccount ? 'แก้ไขบัญชี' : 'เพิ่มบัญชีใหม่'}</h3>
                            <p className="text-xs text-slate-500">กรอกรายละเอียดบัญชีแยกประเภท</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            รหัสบัญชี <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.code}
                            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                            placeholder="เช่น 11100"
                            required
                            disabled={!!editingAccount}
                        />
                        <p className="text-xs text-slate-400 mt-1">รหัส 5 หลัก: 1=สินทรัพย์, 2=หนี้สิน, 3=ทุน, 4=รายได้, 5=ค่าใช้จ่าย</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            ชื่อบัญชี <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="เช่น เงินสด / Cash"
                            required
                        />
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ChartOfAccounts: React.FC = () => {
    const [accounts, setAccounts] = useState(THAI_GL_CODES);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    const categories = [
        { id: '1', label: 'สินทรัพย์ (Assets)', color: 'text-emerald-600 bg-emerald-50' },
        { id: '2', label: 'หนี้สิน (Liabilities)', color: 'text-amber-600 bg-amber-50' },
        { id: '3', label: 'ส่วนทุน (Equity)', color: 'text-purple-600 bg-purple-50' },
        { id: '4', label: 'รายได้ (Revenue)', color: 'text-blue-600 bg-blue-50' },
        { id: '5', label: 'ค่าใช้จ่าย (Expense)', color: 'text-red-600 bg-red-50' },
    ];

    const filteredAccounts = accounts.filter(acc => {
        const matchesSearch = acc.code.includes(searchTerm) || acc.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'all' || acc.code.startsWith(activeCategory);
        return matchesSearch && matchesCategory;
    });

    const handleAddAccount = () => {
        setEditingAccount(null);
        setShowModal(true);
    };

    const handleEditAccount = (account: Account) => {
        setEditingAccount(account);
        setShowModal(true);
    };

    const handleSaveAccount = (account: Account) => {
        if (editingAccount) {
            // Update existing
            setAccounts(prev => prev.map(acc => acc.code === account.code ? account : acc));
        } else {
            // Add new
            setAccounts(prev => [...prev, account]);
        }
        setShowModal(false);
        setEditingAccount(null);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <FolderOpen className="text-blue-600" size={20} />
                        ผังบัญชี (Chart of Accounts)
                    </h3>
                    <p className="text-sm text-slate-500">จัดการโครงสร้างบัญชีแยกประเภทมาตรฐาน TAS</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            const accountsForExport = accounts.map(acc => ({
                                code: acc.code,
                                name: acc.name,
                                type: acc.code.startsWith('1') ? 'Asset' :
                                    acc.code.startsWith('2') ? 'Liability' :
                                        acc.code.startsWith('3') ? 'Equity' :
                                            acc.code.startsWith('4') ? 'Revenue' : 'Expense',
                                parentCode: '',
                                isActive: true
                            }));
                            exportChartOfAccountsExcel(accountsForExport, 'Company');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200"
                    >
                        <FileSpreadsheet size={16} /> Export Excel
                    </button>
                    <button
                        onClick={handleAddAccount}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                    >
                        <Plus size={16} /> เพิ่มบัญชีใหม่
                    </button>
                </div>
            </div>

            <div className="p-4 border-b border-slate-100 bg-white flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    <button
                        onClick={() => setActiveCategory('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${activeCategory === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        ทั้งหมด ({accounts.length})
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${activeCategory === cat.id ? cat.color.replace('bg-', 'bg-opacity-100 text-white bg-') : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            style={activeCategory === cat.id ? { backgroundColor: cat.id === '1' ? '#059669' : cat.id === '2' ? '#d97706' : cat.id === '3' ? '#7c3aed' : cat.id === '4' ? '#2563eb' : '#dc2626', color: 'white' } : {}}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="ค้นหารหัสหรือชื่อบัญชี..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 w-32">Account Code</th>
                            <th className="px-6 py-4">Account Name (TH/EN)</th>
                            <th className="px-6 py-4 w-40">Class</th>
                            <th className="px-6 py-4 w-32 text-center">Status</th>
                            <th className="px-6 py-4 w-20"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredAccounts.map((acc) => {
                            const catId = acc.code.charAt(0);
                            const cat = categories.find(c => c.id === catId);
                            return (
                                <tr key={acc.code} className="hover:bg-slate-50 group">
                                    <td className="px-6 py-3 font-mono text-slate-600 font-medium">{acc.code}</td>
                                    <td className="px-6 py-3 font-medium text-slate-700">{acc.name}</td>
                                    <td className="px-6 py-3">
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${cat?.color || 'bg-slate-100 text-slate-500'}`}>
                                            {cat?.label.split(' ')[1].replace(/[()]/g, '') || 'Other'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                            <CheckCircle2 size={10} /> Active
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <button
                                            onClick={() => handleEditAccount(acc)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="แก้ไขบัญชี"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            <AddEditAccountModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingAccount(null); }}
                onSave={handleSaveAccount}
                editingAccount={editingAccount}
            />
        </div>
    );
};

export default ChartOfAccounts;