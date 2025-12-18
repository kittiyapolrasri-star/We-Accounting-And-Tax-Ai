import React, { useState } from 'react';
import { FixedAsset, PostedGLEntry, Client } from '../types';
import { Monitor, Car, Building2, HardDrive, Plus, Zap, Calculator, CheckCircle2, X, Save, Download, FileSpreadsheet } from 'lucide-react';
import { exportFixedAssetsPDF, exportFixedAssetsExcel } from '../services/comprehensiveExport';

interface Props {
    assets: FixedAsset[];
    clientId: string;
    clientName?: string;
    clientTaxId?: string;
    onAddAsset: (asset: FixedAsset) => void;
    onPostJournal?: (entries: PostedGLEntry[]) => void;
}

const FixedAssetRegister: React.FC<Props> = ({ assets, clientId, clientName = 'Company', clientTaxId = '0000000000000', onAddAsset, onPostJournal }) => {
    const [processing, setProcessing] = useState(false);
    const [posted, setPosted] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // New Asset Form State
    const [newAsset, setNewAsset] = useState<Partial<FixedAsset>>({
        category: 'Equipment',
        useful_life_years: 5,
        residual_value: 1
    });

    const totalDepre = assets.reduce((sum, a) => sum + a.current_month_depreciation, 0);

    const calculateMonthlyDepreciation = (cost: number, residual: number, years: number) => {
        if (!years || years === 0) return 0;
        const annualDepre = (cost - residual) / years;
        return annualDepre / 12;
    };

    const handleAddAsset = () => {
        if (!newAsset.asset_code || !newAsset.name || !newAsset.cost) return;

        const monthlyDepre = calculateMonthlyDepreciation(
            Number(newAsset.cost),
            Number(newAsset.residual_value || 1),
            Number(newAsset.useful_life_years || 5)
        );

        const assetToAdd: FixedAsset = {
            id: `FA-${Date.now()}`,
            clientId: clientId,
            asset_code: newAsset.asset_code,
            name: newAsset.name,
            category: newAsset.category as any,
            acquisition_date: newAsset.acquisition_date || new Date().toISOString().split('T')[0],
            cost: Number(newAsset.cost),
            residual_value: Number(newAsset.residual_value || 1),
            useful_life_years: Number(newAsset.useful_life_years || 5),
            accumulated_depreciation_bf: 0,
            current_month_depreciation: monthlyDepre
        };

        onAddAsset(assetToAdd);
        setShowAddModal(false);
        setNewAsset({ category: 'Equipment', useful_life_years: 5, residual_value: 1 }); // Reset
    };

    const handlePostDepreciation = () => {
        setProcessing(true);

        // Generate GL Entries dynamically based on asset categories
        const entries: PostedGLEntry[] = [];
        const date = new Date().toISOString().split('T')[0];
        const docNo = `DEPRE-${new Date().toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' }).replace('/', '')}`;

        // 1. Debit Expense
        entries.push({
            id: `GL-DEPRE-DR-${Date.now()}`,
            clientId: clientId,
            date: date,
            doc_no: docNo,
            description: 'บันทึกค่าเสื่อมราคาประจำเดือน (Depreciation Expense)',
            account_code: '52600',
            account_name: 'ค่าเสื่อมราคา (Depreciation Expense)',
            debit: totalDepre,
            credit: 0,
            system_generated: true
        });

        // 2. Credit Accum Depre (Grouped by Category)
        const accumMap: Record<string, number> = {};
        assets.forEach(a => {
            const accCode = a.category === 'Vehicle' ? '12501' : a.category === 'Building' ? '12201' : '12401';
            if (!accumMap[accCode]) accumMap[accCode] = 0;
            accumMap[accCode] += a.current_month_depreciation;
        });

        Object.entries(accumMap).forEach(([code, amount], idx) => {
            let accName = 'ค่าเสื่อมราคาสะสม-เครื่องใช้สนง.';
            if (code === '12501') accName = 'ค่าเสื่อมราคาสะสม-ยานพาหนะ';
            if (code === '12201') accName = 'ค่าเสื่อมราคาสะสม-อาคาร';

            entries.push({
                id: `GL-DEPRE-CR-${Date.now()}-${idx}`,
                clientId: clientId,
                date: date,
                doc_no: docNo,
                description: 'บันทึกค่าเสื่อมราคาประจำเดือน',
                account_code: code,
                account_name: accName,
                debit: 0,
                credit: amount,
                system_generated: true
            });
        });

        setTimeout(() => {
            if (onPostJournal) onPostJournal(entries);
            setProcessing(false);
            setPosted(true);
        }, 1500);
    };

    const getIcon = (category: string) => {
        switch (category) {
            case 'Equipment': return <Monitor size={16} />;
            case 'Vehicle': return <Car size={16} />;
            case 'Building': return <Building2 size={16} />;
            case 'Software': return <HardDrive size={16} />;
            default: return <Monitor size={16} />;
        }
    };

    const calculateNBV = (asset: FixedAsset) => {
        return asset.cost - asset.accumulated_depreciation_bf - asset.current_month_depreciation;
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-500 relative">

            {/* ADD ASSET MODAL */}
            {showAddModal && (
                <div className="absolute inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">เพิ่มทรัพย์สินถาวร (New Fixed Asset)</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">รหัสทรัพย์สิน</label>
                                    <input type="text" className="w-full border border-slate-200 rounded p-2 text-sm" placeholder="e.g., 12400-004"
                                        value={newAsset.asset_code || ''} onChange={e => setNewAsset({ ...newAsset, asset_code: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">ประเภท</label>
                                    <select className="w-full border border-slate-200 rounded p-2 text-sm"
                                        value={newAsset.category} onChange={e => setNewAsset({ ...newAsset, category: e.target.value as any })}>
                                        <option value="Equipment">Equipment (เครื่องใช้สนง.)</option>
                                        <option value="Vehicle">Vehicle (ยานพาหนะ)</option>
                                        <option value="Building">Building (อาคาร)</option>
                                        <option value="Software">Software (โปรแกรม)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อทรัพย์สิน</label>
                                <input type="text" className="w-full border border-slate-200 rounded p-2 text-sm" placeholder="ระบุชื่อรายการ..."
                                    value={newAsset.name || ''} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">วันที่ได้มา</label>
                                    <input type="date" className="w-full border border-slate-200 rounded p-2 text-sm"
                                        value={newAsset.acquisition_date || ''} onChange={e => setNewAsset({ ...newAsset, acquisition_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">ราคาทุน (Cost)</label>
                                    <input type="number" className="w-full border border-slate-200 rounded p-2 text-sm text-right" placeholder="0.00"
                                        value={newAsset.cost || ''} onChange={e => setNewAsset({ ...newAsset, cost: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">อายุการใช้งาน (ปี)</label>
                                    <input type="number" className="w-full border border-slate-200 rounded p-2 text-sm text-right"
                                        value={newAsset.useful_life_years} onChange={e => setNewAsset({ ...newAsset, useful_life_years: parseFloat(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">มูลค่าซาก</label>
                                    <input type="number" className="w-full border border-slate-200 rounded p-2 text-sm text-right"
                                        value={newAsset.residual_value} onChange={e => setNewAsset({ ...newAsset, residual_value: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                            <div className="pt-4">
                                <button onClick={handleAddAsset} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                                    <Save size={18} /> บันทึกทรัพย์สิน
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Building2 className="text-blue-600" size={20} />
                        ทะเบียนทรัพย์สินถาวร (Fixed Asset Register)
                    </h3>
                    <p className="text-sm text-slate-500">จัดการค่าเสื่อมราคาและสินทรัพย์ของกิจการ (Straight-Line Method)</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => exportFixedAssetsPDF(clientName, clientTaxId, assets)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Download size={16} /> Export PDF
                    </button>
                    <button
                        onClick={() => exportFixedAssetsExcel(assets, clientName)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <FileSpreadsheet size={16} /> Export Excel
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors shadow-sm text-slate-600"
                    >
                        <Plus size={16} /> New Asset
                    </button>
                    <button
                        onClick={handlePostDepreciation}
                        disabled={posted}
                        className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-bold shadow-md transition-all ${posted ? 'bg-emerald-500 cursor-default' : 'bg-slate-800 hover:bg-slate-900'}`}
                    >
                        {posted ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                        {posted ? 'Posted' : 'Run Depreciation'}
                    </button>
                </div>
            </div>

            <div className="p-6 overflow-auto">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Assets Cost</p>
                        <p className="text-2xl font-bold text-slate-800">{assets.reduce((sum, a) => sum + a.cost, 0).toLocaleString()} THB</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Monthly Depreciation</p>
                        <p className="text-2xl font-bold text-amber-600">{totalDepre.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Net Book Value</p>
                        <p className="text-2xl font-bold text-emerald-600">
                            {assets.reduce((sum, a) => sum + calculateNBV(a), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
                        </p>
                    </div>
                </div>

                {/* Asset Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Asset Code</th>
                                <th className="px-6 py-4">Asset Name</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-right">Cost</th>
                                <th className="px-6 py-4 text-center">Life (Yrs)</th>
                                <th className="px-6 py-4 text-right">Depre/Mo</th>
                                <th className="px-6 py-4 text-right">Accum. Depre</th>
                                <th className="px-6 py-4 text-right">NBV</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {assets.map(asset => (
                                <tr key={asset.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">{asset.asset_code}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                                {getIcon(asset.category)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-700">{asset.name}</p>
                                                <p className="text-[10px] text-slate-400">{asset.category}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs">{asset.acquisition_date}</td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-700">{asset.cost.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center text-slate-600">{asset.useful_life_years}</td>
                                    <td className="px-6 py-4 text-right font-mono text-amber-600 font-semibold">{asset.current_month_depreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-500">{(asset.accumulated_depreciation_bf + asset.current_month_depreciation).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4 text-right font-mono text-emerald-600 font-bold">{calculateNBV(asset).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Journal Preview */}
                {processing || posted ? (
                    <div className="mt-8 animate-in slide-in-from-bottom-4">
                        <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold">
                            <Calculator size={18} />
                            {processing ? 'Generating Journal Entry...' : 'Automated Journal Entry (Generated)'}
                        </div>
                        <div className={`p-6 rounded-xl border border-blue-200 bg-blue-50 relative overflow-hidden ${processing ? 'opacity-70' : ''}`}>
                            {processing && (
                                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                            <div className="space-y-2 font-mono text-sm">
                                <div className="flex justify-between">
                                    <span className="text-blue-800">Dr. 52600 - ค่าเสื่อมราคา (Depreciation Expense)</span>
                                    <span className="font-bold">{totalDepre.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between pl-8">
                                    <span className="text-slate-600">Cr. 12x01 - ค่าเสื่อมราคาสะสม (Accumulated Depreciation)</span>
                                    <span>{totalDepre.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            {posted && (
                                <div className="mt-4 pt-4 border-t border-blue-200 flex items-center gap-2 text-emerald-600 text-sm font-bold">
                                    <CheckCircle2 size={16} /> บันทึกบัญชีเรียบร้อยแล้ว (Posted to GL)
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default FixedAssetRegister;