/**
 * ClientECommerceSettings.tsx
 * 
 * UI Component สำหรับตั้งค่า E-Commerce Platform ของแต่ละ Client
 * 
 * Features:
 * - เลือก Platform ที่ต้องการเชื่อม
 * - เลือก Mode: API หรือ Manual Import
 * - กรอก API Credentials (ถ้าใช้ API)
 * - Test Connection
 * - ดูสถานะการเชื่อมต่อ
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    ShoppingCart, Settings, Check, X, AlertCircle, Loader2,
    Link2, Unlink, ChevronDown, ChevronUp, Eye, EyeOff,
    ExternalLink, HelpCircle, RefreshCw, FileSpreadsheet, Upload, Save
} from 'lucide-react';
import {
    clientECommerceManager,
    ClientECommerceSettings as SettingsType,
    PLATFORM_REQUIREMENTS,
    ConnectionMode
} from '../services/clientECommerceManager';
import { Platform, PLATFORM_CONFIG } from '../services/ecommercePlatforms';

interface Props {
    clientId: string;
    clientName: string;
    onSave?: (settings: SettingsType) => void;
    onClose?: () => void;
}

const ClientECommerceSettings: React.FC<Props> = ({
    clientId,
    clientName,
    onSave,
    onClose
}) => {
    const [settings, setSettings] = useState<SettingsType | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState<Platform | null>(null);
    const [expandedPlatform, setExpandedPlatform] = useState<Platform | null>(null);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [testResults, setTestResults] = useState<Record<Platform, { success: boolean; message: string } | null>>({} as any);
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    // Temporary credentials storage for unsaved changes
    const [tempCredentials, setTempCredentials] = useState<Record<Platform, Record<string, string>>>({} as any);

    // Load settings
    useEffect(() => {
        loadSettings();
    }, [clientId]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            let loadedSettings = await clientECommerceManager.getSettings(clientId);
            if (!loadedSettings) {
                loadedSettings = clientECommerceManager.createDefaultSettings(clientId);
            }
            setSettings(loadedSettings);
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    // Toggle platform
    const handleTogglePlatform = useCallback(async (platform: Platform, enabled: boolean) => {
        if (!settings) return;

        const requirement = PLATFORM_REQUIREMENTS[platform];
        const defaultMode: ConnectionMode = requirement.modes.includes('api') ? 'api' : 'manual';

        const newSettings = await clientECommerceManager.togglePlatform(
            clientId,
            platform,
            enabled,
            defaultMode
        );
        setSettings(newSettings);
        setUnsavedChanges(true);
    }, [settings, clientId]);

    // Change mode
    const handleModeChange = useCallback((platform: Platform, mode: ConnectionMode) => {
        if (!settings) return;

        const newSettings = { ...settings };
        if (newSettings.platforms[platform]) {
            newSettings.platforms[platform]!.mode = mode;
            newSettings.platforms[platform]!.syncStatus = mode === 'api' ? 'disconnected' : 'manual';
            newSettings.platforms[platform]!.updatedAt = new Date().toISOString();
        }
        setSettings(newSettings);
        setUnsavedChanges(true);
    }, [settings]);

    // Update temp credentials
    const handleCredentialChange = useCallback((platform: Platform, key: string, value: string) => {
        setTempCredentials(prev => ({
            ...prev,
            [platform]: {
                ...(prev[platform] || {}),
                [key]: value
            }
        }));
        setUnsavedChanges(true);
    }, []);

    // Save all changes
    const handleSave = async () => {
        if (!settings) return;

        setSaving(true);
        try {
            // Apply temp credentials to settings
            for (const [platform, creds] of Object.entries(tempCredentials)) {
                if (Object.keys(creds).length > 0) {
                    await clientECommerceManager.saveCredentials(
                        clientId,
                        platform as Platform,
                        creds
                    );
                }
            }

            // Save main settings
            await clientECommerceManager.saveSettings(settings);

            setUnsavedChanges(false);
            setTempCredentials({} as any);

            if (onSave) {
                const finalSettings = await clientECommerceManager.getSettings(clientId);
                onSave(finalSettings!);
            }
        } catch (error) {
            console.error('Error saving:', error);
        } finally {
            setSaving(false);
        }
    };

    // Test connection
    const handleTestConnection = async (platform: Platform) => {
        setTesting(platform);
        setTestResults(prev => ({ ...prev, [platform]: null }));

        try {
            // First save credentials
            if (tempCredentials[platform]) {
                await clientECommerceManager.saveCredentials(
                    clientId,
                    platform,
                    tempCredentials[platform]
                );
            }

            const result = await clientECommerceManager.testConnection(clientId, platform);
            setTestResults(prev => ({ ...prev, [platform]: result }));

            if (result.success) {
                // Reload settings to get updated status
                await loadSettings();
            }
        } catch (error: any) {
            setTestResults(prev => ({
                ...prev,
                [platform]: { success: false, message: error.message || 'Test failed' }
            }));
        } finally {
            setTesting(null);
        }
    };

    // Get current credentials (merged temp with saved)
    const getCredentialValue = (platform: Platform, key: string): string => {
        if (tempCredentials[platform]?.[key] !== undefined) {
            return tempCredentials[platform][key];
        }
        return (settings?.platforms[platform]?.credentials as any)?.[key] || '';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 size={32} className="text-blue-600 animate-spin" />
            </div>
        );
    }

    const platforms = Object.entries(PLATFORM_REQUIREMENTS) as [Platform, typeof PLATFORM_REQUIREMENTS[Platform]][];

    return (
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                        <ShoppingCart className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">ตั้งค่า E-Commerce</h2>
                        <p className="text-sm text-orange-100">{clientName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {unsavedChanges && (
                        <span className="text-xs text-orange-100 bg-orange-600/50 px-2 py-1 rounded-full">
                            มีการเปลี่ยนแปลง
                        </span>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="text-white" size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {/* Instructions */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <HelpCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-blue-800">วิธีใช้งาน</h4>
                            <p className="text-sm text-blue-700 mt-1">
                                เลือก Platform ที่ลูกค้าใช้งาน แล้วเลือก<strong> Mode</strong>:
                            </p>
                            <ul className="text-xs text-blue-600 mt-2 space-y-1">
                                <li>• <strong>API Mode:</strong> เชื่อมต่อตรงกับระบบ - ดึงข้อมูลอัตโนมัติ (ต้องมี API Key)</li>
                                <li>• <strong>Manual Mode:</strong> นำเข้าข้อมูลจาก Excel/CSV ที่ Export จาก Platform</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Platform List */}
                <div className="space-y-4">
                    {platforms.map(([platform, requirement]) => {
                        const platformConfig = PLATFORM_CONFIG[platform];
                        const platformSettings = settings?.platforms[platform];
                        const isEnabled = platformSettings?.enabled ?? false;
                        const isExpanded = expandedPlatform === platform;
                        const currentMode = platformSettings?.mode ?? 'none';
                        const testResult = testResults[platform];

                        return (
                            <div
                                key={platform}
                                className={`border rounded-xl overflow-hidden transition-all ${isEnabled
                                        ? 'border-green-200 bg-green-50/50'
                                        : 'border-slate-200 bg-white'
                                    }`}
                            >
                                {/* Platform Header */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Logo */}
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                                style={{ backgroundColor: platformConfig.color }}
                                            >
                                                {requirement.name.charAt(0)}
                                            </div>

                                            {/* Info */}
                                            <div>
                                                <h3 className="font-bold text-slate-800">
                                                    {requirement.nameTh}
                                                    <span className="text-xs text-slate-400 ml-2">
                                                        ({requirement.name})
                                                    </span>
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {/* Mode badges */}
                                                    {requirement.modes.includes('api') && (
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">
                                                            API
                                                        </span>
                                                    )}
                                                    {requirement.modes.includes('manual') && (
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">
                                                            Manual
                                                        </span>
                                                    )}
                                                    {/* Status */}
                                                    {isEnabled && (
                                                        <span className={`px-2 py-0.5 text-[10px] rounded-full ${platformSettings?.syncStatus === 'connected'
                                                                ? 'bg-green-100 text-green-700'
                                                                : platformSettings?.syncStatus === 'manual'
                                                                    ? 'bg-amber-100 text-amber-700'
                                                                    : platformSettings?.syncStatus === 'error'
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {platformSettings?.syncStatus === 'connected' ? '✓ เชื่อมต่อแล้ว' :
                                                                platformSettings?.syncStatus === 'manual' ? 'Manual Import' :
                                                                    platformSettings?.syncStatus === 'error' ? 'Error' : 'รอตั้งค่า'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Toggle */}
                                            <button
                                                onClick={() => handleTogglePlatform(platform, !isEnabled)}
                                                className={`relative w-14 h-7 rounded-full transition-colors ${isEnabled ? 'bg-green-500' : 'bg-slate-300'
                                                    }`}
                                            >
                                                <span
                                                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${isEnabled ? 'translate-x-7' : ''
                                                        }`}
                                                />
                                            </button>

                                            {/* Expand */}
                                            {isEnabled && requirement.modes.length > 1 && (
                                                <button
                                                    onClick={() => setExpandedPlatform(isExpanded ? null : platform)}
                                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Settings */}
                                {isEnabled && (isExpanded || requirement.modes.length === 1) && (
                                    <div className="px-4 pb-4 border-t border-slate-100">
                                        {/* Mode Selection */}
                                        {requirement.modes.length > 1 && (
                                            <div className="mt-4">
                                                <p className="text-sm font-medium text-slate-700 mb-2">เลือกโหมดการเชื่อมต่อ:</p>
                                                <div className="flex gap-3">
                                                    {requirement.modes.includes('api') && (
                                                        <button
                                                            onClick={() => handleModeChange(platform, 'api')}
                                                            className={`flex-1 p-3 rounded-xl border-2 transition-all ${currentMode === 'api'
                                                                    ? 'border-blue-500 bg-blue-50'
                                                                    : 'border-slate-200 hover:border-blue-300'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Link2 size={18} className={currentMode === 'api' ? 'text-blue-600' : 'text-slate-400'} />
                                                                <span className={`font-medium ${currentMode === 'api' ? 'text-blue-700' : 'text-slate-600'}`}>
                                                                    API Mode
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                ดึงข้อมูลอัตโนมัติ
                                                            </p>
                                                        </button>
                                                    )}
                                                    {requirement.modes.includes('manual') && (
                                                        <button
                                                            onClick={() => handleModeChange(platform, 'manual')}
                                                            className={`flex-1 p-3 rounded-xl border-2 transition-all ${currentMode === 'manual'
                                                                    ? 'border-amber-500 bg-amber-50'
                                                                    : 'border-slate-200 hover:border-amber-300'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <FileSpreadsheet size={18} className={currentMode === 'manual' ? 'text-amber-600' : 'text-slate-400'} />
                                                                <span className={`font-medium ${currentMode === 'manual' ? 'text-amber-700' : 'text-slate-600'}`}>
                                                                    Manual Import
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                นำเข้าจาก Excel/CSV
                                                            </p>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* API Fields */}
                                        {currentMode === 'api' && requirement.apiFields.length > 0 && (
                                            <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
                                                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                                    <Settings size={16} />
                                                    ตั้งค่า API
                                                </h4>

                                                <div className="space-y-3">
                                                    {requirement.apiFields.map(field => (
                                                        <div key={field.key}>
                                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                {field.labelTh}
                                                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                                            </label>
                                                            <div className="relative">
                                                                <input
                                                                    type={field.type === 'password' && !showPasswords[`${platform}_${field.key}`] ? 'password' : 'text'}
                                                                    value={getCredentialValue(platform, field.key)}
                                                                    onChange={(e) => handleCredentialChange(platform, field.key, e.target.value)}
                                                                    placeholder={field.placeholder}
                                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                                                                />
                                                                {field.type === 'password' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowPasswords(prev => ({
                                                                            ...prev,
                                                                            [`${platform}_${field.key}`]: !prev[`${platform}_${field.key}`]
                                                                        }))}
                                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                                                                    >
                                                                        {showPasswords[`${platform}_${field.key}`] ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {field.helpTextTh && (
                                                                <p className="text-xs text-slate-500 mt-1">{field.helpTextTh}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* OAuth button */}
                                                {requirement.oauthSupported && (
                                                    <button
                                                        className="mt-4 w-full py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <ExternalLink size={16} />
                                                        เชื่อมต่อผ่าน OAuth (Recommended)
                                                    </button>
                                                )}

                                                {/* Test Connection */}
                                                <div className="mt-4 flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleTestConnection(platform)}
                                                        disabled={testing === platform}
                                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${testing === platform
                                                                ? 'bg-slate-100 text-slate-400'
                                                                : 'bg-slate-800 text-white hover:bg-slate-700'
                                                            }`}
                                                    >
                                                        {testing === platform ? (
                                                            <>
                                                                <Loader2 size={16} className="animate-spin" />
                                                                ทดสอบ...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RefreshCw size={16} />
                                                                ทดสอบการเชื่อมต่อ
                                                            </>
                                                        )}
                                                    </button>

                                                    {testResult && (
                                                        <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'
                                                            }`}>
                                                            {testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                                                            {testResult.message}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Setup Guide */}
                                                {requirement.setupGuideTh && (
                                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                        <p className="text-xs text-amber-700">
                                                            💡 {requirement.setupGuideTh}
                                                        </p>
                                                        {requirement.setupGuideUrl && (
                                                            <a
                                                                href={requirement.setupGuideUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-amber-600 hover:underline flex items-center gap-1 mt-1"
                                                            >
                                                                <ExternalLink size={12} />
                                                                เปิดคู่มือ Developer
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Manual Mode Info */}
                                        {currentMode === 'manual' && (
                                            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    <Upload size={20} className="text-amber-600 flex-shrink-0" />
                                                    <div>
                                                        <h4 className="font-semibold text-amber-800">Manual Import Mode</h4>
                                                        <p className="text-sm text-amber-700 mt-1">
                                                            ใช้เมนู "นำเข้ายอดขาย" เพื่อ import ข้อมูลจาก Excel/CSV ที่ Export จาก {requirement.nameTh}
                                                        </p>
                                                        <p className="text-xs text-amber-600 mt-2">
                                                            💡 วิธี Export: เข้า {requirement.nameTh} → รายงาน → ดาวน์โหลด Excel
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Manual only platforms */}
                                        {requirement.modes.length === 1 && requirement.modes[0] === 'manual' && (
                                            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                                <p className="text-sm text-slate-600">
                                                    ⚠️ {requirement.setupGuideTh}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                    {Object.values(settings?.platforms || {}).filter(p => p?.enabled).length} Platform เปิดใช้งาน
                </p>
                <div className="flex items-center gap-3">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                        >
                            ยกเลิก
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || !unsavedChanges}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${unsavedChanges
                                ? 'bg-orange-600 text-white hover:bg-orange-700'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {saving ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                บันทึก...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                บันทึกการตั้งค่า
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClientECommerceSettings;
