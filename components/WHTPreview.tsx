import React, { useState, useEffect } from 'react';
import { AccountingResponse } from '../types';
import { FileText, Printer, Save, MapPin, Building, CreditCard, User, CalendarDays, Hash } from 'lucide-react';

interface Props {
  data: AccountingResponse;
  onChange?: (updatedData: AccountingResponse) => void;
}

const WHTPreview: React.FC<Props> = ({ data, onChange }) => {
  const [formData, setFormData] = useState(data);
  const [whtDetails, setWhtDetails] = useState(data.tax_compliance.wht_details || {
      book_number: '1',
      doc_number: data.header_data.inv_number,
      payment_date: data.header_data.issue_date,
      condition: 1
  });

  useEffect(() => {
    setFormData(data);
    if(data.tax_compliance.wht_details) {
        setWhtDetails(data.tax_compliance.wht_details);
    }
  }, [data]);

  // Sync internal wht details to parent
  useEffect(() => {
     const newData = { ...formData };
     newData.tax_compliance.wht_details = whtDetails;
     // Avoid infinite loop if no change, but simpler to just let parent handle debounce if needed
     // Here we just trigger if onChange is present
  }, [whtDetails]);

  const updateParent = (newData: AccountingResponse) => {
      setFormData(newData);
      if (onChange) onChange(newData);
  }

  const handleChange = (section: string, field: string, value: any) => {
    const newData = { ...formData };
    if (section === 'counterparty') {
        newData.parties.counterparty = { ...newData.parties.counterparty, [field]: value };
    } else if (section === 'compliance') {
        newData.tax_compliance = { ...newData.tax_compliance, [field]: value };
    }
    newData.tax_compliance.wht_details = whtDetails; // Ensure details are carried over
    updateParent(newData);
  };

  const handleDetailChange = (field: string, value: any) => {
      const newDetails = { ...whtDetails, [field]: value };
      setWhtDetails(newDetails);
      
      const newData = { ...formData };
      newData.tax_compliance.wht_details = newDetails;
      updateParent(newData);
  };

  if (!formData.tax_compliance.wht_flag) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
            <FileText size={48} className="mb-4 opacity-30" />
            <p className="font-medium">รายการนี้ไม่ต้องหัก ณ ที่จ่าย (No WHT required)</p>
            <button 
                onClick={() => handleChange('compliance', 'wht_flag', true)}
                className="mt-4 text-blue-600 text-sm hover:underline font-medium"
            >
                + เพิ่มรายการหัก ณ ที่จ่าย (Force Add WHT)
            </button>
        </div>
    );
  }

  const whtRate = formData.tax_compliance.wht_rate || 3;
  const taxableAmount = formData.financials.subtotal;
  const taxAmount = (taxableAmount * whtRate) / 100;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] overflow-hidden text-sm h-full flex flex-col">
        {/* Paper Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
            <div>
                <h3 className="font-bold text-slate-800 text-lg">หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)</h3>
                <p className="text-xs text-slate-400">ตรวจสอบความถูกต้องก่อนพิมพ์ (Review before print)</p>
            </div>
            <div className="flex gap-2">
                 <select 
                    value={formData.tax_compliance.wht_code || 'PND53'}
                    onChange={(e) => handleChange('compliance', 'wht_code', e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2 focus:ring-2 focus:ring-blue-100 outline-none font-medium"
                 >
                    <option value="PND3">ภ.ง.ด.3 (บุคคลธรรมดา)</option>
                    <option value="PND53">ภ.ง.ด.53 (นิติบุคคล)</option>
                 </select>
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors shadow-sm text-xs font-bold">
                    <Printer size={14} /> พิมพ์แบบ
                </button>
            </div>
        </div>

        {/* Paper Body - Editable */}
        <div className="p-8 space-y-8 overflow-y-auto bg-slate-50/30 flex-1">
            
            {/* Header: Book No / Running No / Date */}
            <div className="flex justify-between items-start gap-4">
                 <div className="flex gap-4">
                     <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm w-24">
                         <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">เล่มที่ (Book)</label>
                         <input type="text" value={whtDetails.book_number} onChange={(e) => handleDetailChange('book_number', e.target.value)} className="w-full text-xs font-mono font-bold text-slate-700 outline-none" />
                     </div>
                     <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm w-32">
                         <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">เลขที่ (No.)</label>
                         <input type="text" value={whtDetails.doc_number} onChange={(e) => handleDetailChange('doc_number', e.target.value)} className="w-full text-xs font-mono font-bold text-slate-700 outline-none" />
                     </div>
                 </div>
                 <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm w-40">
                         <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1 flex items-center gap-1"><CalendarDays size={10}/> วันที่จ่าย (Date)</label>
                         <input type="date" value={whtDetails.payment_date} onChange={(e) => handleDetailChange('payment_date', e.target.value)} className="w-full text-xs font-mono font-bold text-slate-700 outline-none bg-transparent" />
                 </div>
            </div>

            {/* 1. Payer (User's Client) - Read Only usually, but good to display clearly */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative group">
                <span className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-blue-600 border border-blue-100 rounded-full">1. ผู้มีหน้าที่หักภาษี (Payer)</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">ชื่อบริษัท (Company Name)</label>
                        <div className="font-bold text-slate-800">{formData.parties.client_company.name}</div>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">เลขผู้เสียภาษี (Tax ID)</label>
                        <div className="font-mono text-slate-600">{formData.parties.client_company.tax_id}</div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">ที่อยู่ (Address)</label>
                        <div className="text-slate-600 text-xs">{formData.parties.client_company.address || "ที่อยู่ตาม ภ.พ.20"}</div>
                    </div>
                </div>
            </div>

            {/* 2. Payee (Vendor) - Fully Editable */}
            <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm relative ring-4 ring-blue-50">
                <span className="absolute -top-3 left-4 bg-blue-600 px-3 py-0.5 text-xs font-bold text-white rounded-full">2. ผู้ถูกหักภาษี (Payee)</span>
                <div className="grid grid-cols-1 gap-4 mt-2">
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><User size={10}/> ชื่อผู้ถูกหัก (Name)</label>
                        <input 
                            type="text" 
                            value={formData.parties.counterparty.name}
                            onChange={(e) => handleChange('counterparty', 'name', e.target.value)}
                            className="w-full font-bold text-slate-800 border-b border-slate-200 focus:border-blue-500 outline-none py-1 bg-transparent placeholder-slate-300"
                            placeholder="ระบุชื่อผู้ถูกหัก..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><CreditCard size={10}/> เลขผู้เสียภาษี (Tax ID)</label>
                             <input 
                                type="text" 
                                value={formData.parties.counterparty.tax_id}
                                onChange={(e) => handleChange('counterparty', 'tax_id', e.target.value)}
                                className="w-full font-mono text-slate-800 border-b border-slate-200 focus:border-blue-500 outline-none py-1 bg-transparent"
                            />
                        </div>
                        <div>
                             <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Building size={10}/> สาขา (Branch)</label>
                             <input 
                                type="text" 
                                value={formData.parties.counterparty.branch || '00000'}
                                onChange={(e) => handleChange('counterparty', 'branch', e.target.value)}
                                className="w-full font-mono text-slate-800 border-b border-slate-200 focus:border-blue-500 outline-none py-1 bg-transparent"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><MapPin size={10}/> ที่อยู่ (Address)</label>
                        <textarea 
                            value={formData.parties.counterparty.address || ''}
                            onChange={(e) => handleChange('counterparty', 'address', e.target.value)}
                            className="w-full text-slate-600 text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-100 outline-none bg-slate-50 focus:bg-white resize-none h-16"
                            placeholder="ระบุที่อยู่..."
                        />
                    </div>
                </div>
            </div>

            {/* 3. Calculations */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3 border-r border-slate-200">ประเภทเงินได้ (Income Type)</th>
                            <th className="px-4 py-3 border-r border-slate-200 text-center w-24">วันที่จ่าย</th>
                            <th className="px-4 py-3 border-r border-slate-200 text-right w-32">จำนวนเงิน</th>
                            <th className="px-4 py-3 border-r border-slate-200 text-center w-20">อัตรา %</th>
                            <th className="px-4 py-3 text-right w-32">ภาษีที่หัก</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="px-4 py-3 border-r border-slate-100">
                                <input 
                                    type="text" 
                                    defaultValue="ค่าบริการ / จ้างทำของ (Service Fee)"
                                    className="w-full text-xs text-slate-700 outline-none bg-transparent font-medium"
                                />
                            </td>
                            <td className="px-4 py-3 border-r border-slate-100 text-center text-slate-600">
                                {whtDetails.payment_date}
                            </td>
                            <td className="px-4 py-3 border-r border-slate-100 text-right font-mono text-slate-700">
                                {taxableAmount.toLocaleString('th-TH', {minimumFractionDigits: 2})}
                            </td>
                            <td className="px-4 py-3 border-r border-slate-100 text-center">
                                <input 
                                    type="number"
                                    value={whtRate}
                                    onChange={(e) => handleChange('compliance', 'wht_rate', parseFloat(e.target.value))}
                                    className="w-full text-center text-xs font-bold text-blue-600 outline-none bg-blue-50 rounded px-1 py-0.5"
                                />
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 bg-slate-50">
                                {taxAmount.toLocaleString('th-TH', {minimumFractionDigits: 2})}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* 4. Payment Conditions */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
                 <label className="text-[10px] font-bold text-slate-400 uppercase block mb-3">เงื่อนไขการหักภาษี (Conditions)</label>
                 <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="wht_condition" 
                            checked={whtDetails.condition === 1} 
                            onChange={() => handleDetailChange('condition', 1)}
                            className="text-blue-600 focus:ring-blue-500"
                           />
                          <span className="text-sm text-slate-700">(1) หัก ณ ที่จ่าย (Withheld at source)</span>
                      </label>
                       <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="wht_condition" 
                            checked={whtDetails.condition === 2} 
                            onChange={() => handleDetailChange('condition', 2)}
                            className="text-blue-600 focus:ring-blue-500"
                           />
                          <span className="text-sm text-slate-700">(2) ออกภาษีให้ (Paid by payer)</span>
                      </label>
                 </div>
            </div>
            
            <div className="flex justify-end pt-4">
                 <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1">ยอดภาษีที่หักนำส่ง (Total Tax Withheld)</p>
                    <p className="text-3xl font-bold text-slate-800 tracking-tight">{taxAmount.toLocaleString('th-TH', {minimumFractionDigits: 2})} <span className="text-sm font-normal text-slate-500">THB</span></p>
                 </div>
            </div>
        </div>
    </div>
  );
};

export default WHTPreview;