
import React, { useState, useMemo } from 'react';
import { DocumentRecord, Client, PostedGLEntry, PublishedReport } from '../types';
import { Printer, Download, Filter, FileText, CheckCircle2, AlertTriangle, ChevronDown, ListFilter, Zap, ArrowRight, X, Eye, FileDigit, Code, Share2, Calculator, FileDown } from 'lucide-react';
import {
    generateVATReportPDF,
    generateWHTSummaryPDF,
    generatePP30SummaryPDF,
    TaxFormData,
    VATReportItem,
    WHTReportItem
} from '../utils/pdfExport';

interface Props {
    documents: DocumentRecord[];
    clients: Client[];
    glEntries?: PostedGLEntry[];
    onPostJournal?: (entries: PostedGLEntry[]) => void;
    onPublishReport?: (clientId: string, report: PublishedReport) => void;
}

const TaxReporting: React.FC<Props> = ({ documents, clients, glEntries = [], onPostJournal, onPublishReport }) => {
    const [selectedClient, setSelectedClient] = useState<string>(clients[0]?.id || '');
    const [activeTab, setActiveTab] = useState<'vat' | 'pnd3' | 'pnd53'>('vat');
    const [showClosingWizard, setShowClosingWizard] = useState(false);
    const [closingSuccess, setClosingSuccess] = useState(false);

    // --- DATA ENGINE ---
    // Filter documents based on selection
    const filteredDocs = documents.filter(d => {
        const client = clients.find(c => c.id === selectedClient);
        return client ? d.client_name === client.name : false;
    });

    const vatDocs = filteredDocs.filter(d => d.ai_data?.tax_compliance.is_full_tax_invoice);
    const whtDocs = filteredDocs.filter(d => d.ai_data?.tax_compliance.wht_flag);

    const pnd3Docs = whtDocs.filter(d => d.ai_data?.tax_compliance.wht_code === 'PND3');
    const pnd53Docs = whtDocs.filter(d => !d.ai_data?.tax_compliance.wht_code || d.ai_data?.tax_compliance.wht_code === 'PND53');

    // --- CALCULATE TOTALS ---
    const currentDocs = activeTab === 'vat' ? vatDocs : activeTab === 'pnd3' ? pnd3Docs : pnd53Docs;

    const taxStats = useMemo(() => {
        const stats = {
            count: currentDocs.length,
            totalBase: 0,
            totalTax: 0
        };

        currentDocs.forEach(d => {
            if (d.ai_data) {
                stats.totalBase += d.ai_data.financials.subtotal || 0;
                if (activeTab === 'vat') {
                    stats.totalTax += d.ai_data.financials.vat_amount || 0;
                } else {
                    // For WHT, calculate based on rate
                    const rate = d.ai_data.tax_compliance.wht_rate || 3;
                    stats.totalTax += ((d.ai_data.financials.subtotal || 0) * rate) / 100;
                }
            }
        });
        return stats;
    }, [currentDocs, activeTab]);

    // --- VAT CLOSING LOGIC ---
    // 1. Calculate Output VAT from GL (Credit Side of 21540)
    const outputVat = useMemo(() => {
        if (!glEntries) return 0;
        return glEntries
            .filter(e => e.clientId === selectedClient && e.account_code === '21540')
            .reduce((sum, e) => sum + (e.credit - e.debit), 0);
    }, [glEntries, selectedClient]);

    // 2. Input VAT from Approved Documents (Or GL 11540)
    // Using Documents gives us more granularity for the report list
    const inputVat = activeTab === 'vat' ? taxStats.totalTax : 0;

    const vatPayable = outputVat - inputVat;

    const handleClosePeriod = () => {
        if (onPostJournal) {
            const closingDate = new Date().toISOString().split('T')[0];
            // Create Systematic VAT Closing Entry
            const vatEntries: PostedGLEntry[] = [
                {
                    id: `VAT-OUT-${Date.now()}`,
                    clientId: selectedClient,
                    date: closingDate,
                    doc_no: 'JV-VAT-FEB24',
                    description: 'ปิดบัญชีภาษีขาย (Close Output VAT)',
                    account_code: '21540',
                    account_name: 'ภาษีขาย (Output VAT)',
                    debit: outputVat,
                    credit: 0,
                    system_generated: true
                },
                {
                    id: `VAT-IN-${Date.now()}`,
                    clientId: selectedClient,
                    date: closingDate,
                    doc_no: 'JV-VAT-FEB24',
                    description: 'ปิดบัญชีภาษีซื้อ (Close Input VAT)',
                    account_code: '11540',
                    account_name: 'ภาษีซื้อ (Input VAT)',
                    debit: 0,
                    credit: inputVat,
                    system_generated: true
                }
            ];

            // Balancing Figure
            if (vatPayable > 0) {
                vatEntries.push({
                    id: `VAT-PAY-${Date.now()}`,
                    clientId: selectedClient,
                    date: closingDate,
                    doc_no: 'JV-VAT-FEB24',
                    description: 'ตั้งเจ้าหนี้กรมสรรพากร (VAT Payable)',
                    account_code: '21500',
                    account_name: 'เจ้าหนี้กรมสรรพากร (VAT Payable)',
                    debit: 0,
                    credit: vatPayable,
                    system_generated: true
                });
            } else if (vatPayable < 0) {
                vatEntries.push({
                    id: `VAT-REF-${Date.now()}`,
                    clientId: selectedClient,
                    date: closingDate,
                    doc_no: 'JV-VAT-FEB24',
                    description: 'ตั้งลูกหนี้กรมสรรพากร (VAT Refundable)',
                    account_code: '11590',
                    account_name: 'ลูกหนี้กรมสรรพากร (VAT Refundable)',
                    debit: Math.abs(vatPayable),
                    credit: 0,
                    system_generated: true
                });
            }

            onPostJournal(vatEntries);
        }

        setClosingSuccess(true);
        setTimeout(() => {
            setShowClosingWizard(false);
            setClosingSuccess(false);
        }, 2000);
    };

    const handlePublishToPortal = () => {
        if (onPublishReport) {
            const reportTitle = activeTab === 'vat' ? 'รายงานภาษีมูลค่าเพิ่ม (ภ.พ.30) ประจำเดือน' : 'หนังสือรับรองการหักภาษี ณ ที่จ่าย';
            const newReport: PublishedReport = {
                id: `REP-${Date.now()}`,
                title: `${reportTitle} ก.พ. 67`,
                type: activeTab === 'vat' ? 'Tax Return' : 'Management Report',
                generated_date: new Date().toISOString().split('T')[0],
                download_url: '#'
            };
            onPublishReport(selectedClient, newReport);
        }
    };

    // Get current client and period info for PDF export
    const getCurrentFormData = (): TaxFormData => {
        const client = clients.find(c => c.id === selectedClient);
        const now = new Date();
        const thaiMonths = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        const buddhistYear = now.getFullYear() + 543;

        return {
            companyName: client?.name || 'บริษัท ตัวอย่าง จำกัด',
            companyTaxId: client?.tax_id || '0-0000-00000-00-0',
            companyAddress: client?.address,
            period: `${thaiMonths[now.getMonth()]} ${buddhistYear}`,
            year: buddhistYear.toString()
        };
    };

    // Convert documents to VAT report items
    const getVATItems = (): VATReportItem[] => {
        return vatDocs.map(doc => ({
            date: doc.ai_data?.header_data.issue_date || '',
            docNo: doc.ai_data?.header_data.inv_number || '',
            counterpartyName: doc.ai_data?.parties.counterparty.name || '',
            counterpartyTaxId: doc.ai_data?.parties.counterparty.tax_id || '',
            baseAmount: doc.ai_data?.financials.subtotal || 0,
            vatAmount: doc.ai_data?.financials.vat_amount || 0
        }));
    };

    // Convert documents to WHT report items
    const getWHTItems = (formType: 'PND3' | 'PND53'): WHTReportItem[] => {
        const docs = formType === 'PND3' ? pnd3Docs : pnd53Docs;
        return docs.map(doc => {
            // Determine income type based on WHT rate
            const whtRate = doc.ai_data?.tax_compliance.wht_rate || 3;
            let incomeType = 'ค่าบริการ';
            if (whtRate === 1) incomeType = 'ค่าโฆษณา';
            else if (whtRate === 2) incomeType = 'ค่าขนส่ง';
            else if (whtRate === 5) incomeType = 'ค่าเช่า';
            else if (whtRate === 10) incomeType = 'เงินปันผล';

            return {
                date: doc.ai_data?.header_data.issue_date || '',
                docNo: doc.ai_data?.header_data.inv_number || '',
                payeeName: doc.ai_data?.parties.counterparty.name || '',
                payeeTaxId: doc.ai_data?.parties.counterparty.tax_id || '',
                incomeType,
                whtRate,
                baseAmount: doc.ai_data?.financials.subtotal || 0,
                whtAmount: ((doc.ai_data?.financials.subtotal || 0) * whtRate) / 100
            };
        });
    };

    // Handle PDF export based on active tab
    const handleExportPDF = () => {
        const formData = getCurrentFormData();

        if (activeTab === 'vat') {
            // Export VAT input report and PP30 summary
            const vatItems = getVATItems();
            generateVATReportPDF(formData, vatItems, 'input');

            // Also generate PP30 summary
            setTimeout(() => {
                generatePP30SummaryPDF(formData, outputVat, inputVat, [], vatItems);
            }, 500);
        } else if (activeTab === 'pnd3') {
            const whtItems = getWHTItems('PND3');
            generateWHTSummaryPDF(formData, whtItems, 'PND3');
        } else if (activeTab === 'pnd53') {
            const whtItems = getWHTItems('PND53');
            generateWHTSummaryPDF(formData, whtItems, 'PND53');
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Clean Minimal Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-100 rounded-xl">
                            <FileText size={24} className="text-slate-700" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">รายงานภาษี & ปิดงบ</h1>
                            <p className="text-sm text-slate-500">จัดการภาษีและปิดงบประจำเดือน</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none min-w-[200px]"
                        >
                            {clients.length === 0 && <option value="">ไม่มีลูกค้า</option>}
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-auto">
                {/* Closing Wizard Overlay */}
                {showClosingWizard && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95">
                            {!closingSuccess ? (
                                <>
                                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        <Zap className="text-amber-500" /> ปิดบัญชีภาษีมูลค่าเพิ่ม (VAT Closing)
                                    </h3>
                                    <div className="space-y-4 mb-8">
                                        <div className="flex justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                                            <div>
                                                <span className="text-blue-700 font-bold block text-sm">ภาษีขาย (Output VAT)</span>
                                                <span className="text-xs text-blue-500">จากบัญชีแยกประเภท 21540</span>
                                            </div>
                                            <span className="font-bold font-mono text-lg">{outputVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                            <div>
                                                <span className="text-emerald-700 font-bold block text-sm">ภาษีซื้อ (Input VAT)</span>
                                                <span className="text-xs text-emerald-500">จากรายงานภาษีซื้อ (เอกสาร)</span>
                                            </div>
                                            <span className="font-bold font-mono text-lg">{inputVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="border-t border-slate-200 pt-4 flex justify-between px-3">
                                            <span className="text-slate-800 font-bold flex items-center gap-2">
                                                <Calculator size={16} /> {vatPayable > 0 ? 'ภาษีที่ต้องชำระ (Payable)' : 'ภาษีชำระเกิน (Refundable)'}
                                            </span>
                                            <span className={`font-bold text-xl ${vatPayable > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {Math.abs(vatPayable).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setShowClosingWizard(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">ยกเลิก</button>
                                        <button onClick={handleClosePeriod} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">ยืนยันปิดงวด</button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">บันทึกรายการปิดบัญชีสำเร็จ</h3>
                                    <p className="text-slate-500">ระบบได้สร้าง JV สำหรับปิดภาษีเรียบร้อยแล้ว</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
                    {/* Tabs */}
                    <div className="border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50">
                        <div className="flex gap-6">
                            <button onClick={() => setActiveTab('vat')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'vat' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>VAT (ภ.พ.30)</button>
                            <button onClick={() => setActiveTab('pnd3')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'pnd3' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>WHT (ภ.ง.ด.3)</button>
                            <button onClick={() => setActiveTab('pnd53')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'pnd53' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>WHT (ภ.ง.ด.53)</button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100 hover:bg-emerald-100">
                                <FileDown size={14} /> Export PDF
                            </button>
                            <button onClick={() => setShowClosingWizard(true)} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100 hover:bg-amber-100">
                                <Zap size={14} /> Close Period
                            </button>
                            <button onClick={handlePublishToPortal} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-100">
                                <Share2 size={14} /> Publish Report
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-6 p-6 border-b border-slate-100">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase">Total Documents</p>
                            <p className="text-2xl font-bold text-slate-800">{taxStats.count}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase">Tax Base (ยอดซื้อ/ฐานภาษี)</p>
                            <p className="text-2xl font-bold text-slate-800">{taxStats.totalBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase">Tax Amount (ภาษี)</p>
                            <p className="text-2xl font-bold text-blue-600">{taxStats.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Doc No</th>
                                    <th className="px-6 py-3">Counterparty</th>
                                    <th className="px-6 py-3 text-right">Base Amount</th>
                                    <th className="px-6 py-3 text-right">Tax Amount</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {currentDocs.length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">ไม่พบเอกสารในงวดนี้</td></tr>
                                ) : currentDocs.map(doc => (
                                    <tr key={doc.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 text-slate-600">{doc.ai_data?.header_data.issue_date}</td>
                                        <td className="px-6 py-3 font-medium text-slate-700">{doc.ai_data?.header_data.inv_number}</td>
                                        <td className="px-6 py-3 text-slate-600">{doc.ai_data?.parties.counterparty.name}</td>
                                        <td className="px-6 py-3 text-right font-mono text-slate-600">
                                            {doc.ai_data?.financials.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">
                                            {activeTab === 'vat'
                                                ? doc.ai_data?.financials.vat_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                                                : ((doc.ai_data?.financials.subtotal || 0) * (doc.ai_data?.tax_compliance.wht_rate || 3) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                            }
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-bold border border-emerald-100">
                                                Included
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaxReporting;
