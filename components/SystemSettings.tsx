import React, { useState, useEffect } from 'react';
import {
    Settings, Building, Database, FileText, Save, Upload,
    Download, Bell, Globe, Palette, Moon, Sun,
    Check, RefreshCw, Key, Mail, Phone, Loader2, AlertCircle
} from 'lucide-react';
import { loadSettings, saveSettings, SystemSettingsData, defaultSettings } from '../services/settingsService';
import { useAuth } from '../contexts/AuthContext';

interface Props {
    onSave?: (settings: SystemSettingsData) => void;
}

const SystemSettings: React.FC<Props> = ({ onSave }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'general' | 'company' | 'notifications' | 'backup'>('general');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    const [settings, setSettings] = useState<SystemSettingsData>(defaultSettings);
    const [originalSettings, setOriginalSettings] = useState<SystemSettingsData>(defaultSettings);

    // โหลดการตั้งค่าจาก Firestore เมื่อเริ่มต้น
    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const loadedSettings = await loadSettings();
                setSettings(loadedSettings);
                setOriginalSettings(loadedSettings);
            } catch (error) {
                console.error('Failed to load settings:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
    useEffect(() => {
        const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
        setHasChanges(changed);
    }, [settings, originalSettings]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);

        try {
            const result = await saveSettings(settings, user?.uid);

            if (result.success) {
                setSaveSuccess(true);
                setOriginalSettings(settings);
                setHasChanges(false);
                setTimeout(() => setSaveSuccess(false), 3000);
                onSave?.(settings);
            } else {
                setSaveError(result.error || 'ไม่สามารถบันทึกได้');
            }
        } catch (error: any) {
            setSaveError(error.message || 'เกิดข้อผิดพลาด');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setSettings(originalSettings);
        setHasChanges(false);
    };

    const tabs = [
        { id: 'general', label: 'ทั่วไป', icon: Settings },
        { id: 'company', label: 'ข้อมูลบริษัท', icon: Building },
        { id: 'notifications', label: 'การแจ้งเตือน', icon: Bell },
        { id: 'backup', label: 'สำรองข้อมูล', icon: Database },
    ];

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">กำลังโหลดการตั้งค่า...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <Settings className="text-blue-600" size={28} />
                    ตั้งค่าระบบ
                </h1>
                <p className="text-slate-500 mt-1">จัดการการตั้งค่าระบบและข้อมูลสำนักงาน</p>
            </div>

            {/* Unsaved Changes Warning */}
            {hasChanges && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="text-amber-600" size={20} />
                    <span className="text-amber-700">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-200">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                {/* General Settings */}
                {activeTab === 'general' && (
                    <div className="p-6 space-y-6">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Globe size={20} />
                            การตั้งค่าทั่วไป
                        </h2>

                        <div className="grid grid-cols-2 gap-6">
                            {/* Language */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">ภาษา</label>
                                <select
                                    value={settings.language}
                                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="th">ไทย</option>
                                    <option value="en">English</option>
                                </select>
                            </div>

                            {/* Currency */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">สกุลเงินหลัก</label>
                                <select
                                    value={settings.currency}
                                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="THB">บาท (THB)</option>
                                    <option value="USD">US Dollar (USD)</option>
                                    <option value="EUR">Euro (EUR)</option>
                                </select>
                            </div>

                            {/* Fiscal Year Start */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">เดือนเริ่มต้นปีบัญชี</label>
                                <select
                                    value={settings.fiscalYearStart}
                                    onChange={(e) => setSettings({ ...settings, fiscalYearStart: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="01">มกราคม</option>
                                    <option value="04">เมษายน</option>
                                    <option value="07">กรกฎาคม</option>
                                    <option value="10">ตุลาคม</option>
                                </select>
                            </div>

                            {/* Theme */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">ธีม</label>
                                <div className="flex gap-2">
                                    {[
                                        { value: 'light', icon: Sun, label: 'สว่าง' },
                                        { value: 'dark', icon: Moon, label: 'มืด' },
                                        { value: 'auto', icon: Palette, label: 'อัตโนมัติ' },
                                    ].map((theme) => {
                                        const Icon = theme.icon;
                                        return (
                                            <button
                                                key={theme.value}
                                                type="button"
                                                onClick={() => setSettings({ ...settings, theme: theme.value as SystemSettingsData['theme'] })}
                                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${settings.theme === theme.value
                                                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                                                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <Icon size={16} />
                                                {theme.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Company Settings */}
                {activeTab === 'company' && (
                    <div className="p-6 space-y-6">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Building size={20} />
                            ข้อมูลสำนักงาน
                        </h2>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">ชื่อสำนักงาน</label>
                                <input
                                    type="text"
                                    value={settings.companyName}
                                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    <Key size={14} className="inline mr-1" /> เลขประจำตัวผู้เสียภาษี
                                </label>
                                <input
                                    type="text"
                                    value={settings.taxId}
                                    onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                                    placeholder="0-1234-56789-01-2"
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    <Phone size={14} className="inline mr-1" /> โทรศัพท์
                                </label>
                                <input
                                    type="tel"
                                    value={settings.phone}
                                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                    placeholder="02-123-4567"
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    <Mail size={14} className="inline mr-1" /> อีเมล
                                </label>
                                <input
                                    type="email"
                                    value={settings.email}
                                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                    placeholder="contact@company.com"
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">ที่อยู่</label>
                                <textarea
                                    rows={3}
                                    value={settings.address}
                                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                                    placeholder="ที่อยู่สำนักงาน..."
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Notification Settings */}
                {activeTab === 'notifications' && (
                    <div className="p-6 space-y-6">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Bell size={20} />
                            การแจ้งเตือน
                        </h2>

                        <div className="space-y-4">
                            {[
                                { key: 'email', label: 'แจ้งเตือนทางอีเมล', desc: 'รับการแจ้งเตือนผ่านอีเมล' },
                                { key: 'push', label: 'แจ้งเตือน Push', desc: 'รับการแจ้งเตือนผ่าน Browser' },
                                { key: 'taxDeadlines', label: 'กำหนดยื่นภาษี', desc: 'แจ้งเตือนก่อนถึงกำหนดยื่นภาษี' },
                                { key: 'documentProcessed', label: 'เอกสารประมวลผลเสร็จ', desc: 'แจ้งเมื่อ AI วิเคราะห์เอกสารเสร็จ' },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-slate-800">{item.label}</p>
                                        <p className="text-sm text-slate-500">{item.desc}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({
                                            ...settings,
                                            notifications: {
                                                ...settings.notifications,
                                                [item.key]: !settings.notifications[item.key as keyof typeof settings.notifications],
                                            },
                                        })}
                                        className={`w-12 h-6 rounded-full transition-colors ${settings.notifications[item.key as keyof typeof settings.notifications]
                                                ? 'bg-blue-600'
                                                : 'bg-slate-300'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${settings.notifications[item.key as keyof typeof settings.notifications]
                                                ? 'translate-x-6'
                                                : 'translate-x-0.5'
                                            }`} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Backup Settings */}
                {activeTab === 'backup' && (
                    <div className="p-6 space-y-6">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Database size={20} />
                            สำรองข้อมูล
                        </h2>

                        <div className="grid grid-cols-2 gap-6">
                            {/* Auto Backup Toggle */}
                            <div className="col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-slate-800">สำรองข้อมูลอัตโนมัติ</p>
                                    <p className="text-sm text-slate-500">ระบบจะสำรองข้อมูลตามรอบที่กำหนด</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSettings({
                                        ...settings,
                                        backup: { ...settings.backup, autoBackup: !settings.backup.autoBackup },
                                    })}
                                    className={`w-12 h-6 rounded-full transition-colors ${settings.backup.autoBackup ? 'bg-blue-600' : 'bg-slate-300'
                                        }`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${settings.backup.autoBackup ? 'translate-x-6' : 'translate-x-0.5'
                                        }`} />
                                </button>
                            </div>

                            {/* Frequency */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">ความถี่</label>
                                <select
                                    value={settings.backup.frequency}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        backup: { ...settings.backup, frequency: e.target.value as SystemSettingsData['backup']['frequency'] },
                                    })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="daily">ทุกวัน</option>
                                    <option value="weekly">ทุกสัปดาห์</option>
                                    <option value="monthly">ทุกเดือน</option>
                                </select>
                            </div>

                            {/* Retention */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">เก็บข้อมูล (วัน)</label>
                                <input
                                    type="number"
                                    value={settings.backup.retention}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        backup: { ...settings.backup, retention: parseInt(e.target.value) || 30 },
                                    })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Manual Backup/Restore Buttons */}
                            <div className="col-span-2 flex gap-4">
                                <button
                                    type="button"
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                                >
                                    <Download size={18} />
                                    สำรองข้อมูลทันที
                                </button>
                                <button
                                    type="button"
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                                >
                                    <Upload size={18} />
                                    กู้คืนจากไฟล์สำรอง
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end gap-4">
                {saveError && (
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle size={18} />
                        {saveError}
                    </div>
                )}
                {saveSuccess && (
                    <div className="flex items-center gap-2 text-green-600">
                        <Check size={18} />
                        บันทึกสำเร็จ
                    </div>
                )}
                {hasChanges && (
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-6 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                    >
                        ยกเลิกการเปลี่ยนแปลง
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={isSaving || !hasChanges}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
            </div>
        </div>
    );
};

export default SystemSettings;
