/**
 * Batch Upload Component
 * อัปโหลดหลายไฟล์พร้อมกันพร้อม progress tracking
 */

import React, { useState, useCallback } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2, FileText, Image, File } from 'lucide-react';
import { validateFile, formatFileSize } from '../utils/imageUtils';

export interface UploadFile {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
    result?: unknown;
}

export interface BatchUploadProps {
    onUpload: (file: File) => Promise<unknown>;
    onComplete?: (results: UploadFile[]) => void;
    maxFiles?: number;
    maxSizeMB?: number;
    allowedTypes?: string[];
    className?: string;
}

export const BatchUpload: React.FC<BatchUploadProps> = ({
    onUpload,
    onComplete,
    maxFiles = 20,
    maxSizeMB = 10,
    allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
    className = ''
}) => {
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Add files to queue
    const addFiles = useCallback((newFiles: FileList | File[]) => {
        const fileArray = Array.from(newFiles);

        // Check max files limit
        if (files.length + fileArray.length > maxFiles) {
            alert(`สามารถอัปโหลดได้สูงสุด ${maxFiles} ไฟล์`);
            return;
        }

        const uploadFiles: UploadFile[] = fileArray.map(file => {
            const validation = validateFile(file, { maxSizeMB, allowedTypes });
            return {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                status: validation.isValid ? 'pending' : 'error',
                progress: 0,
                error: validation.errors.join(', ') || undefined
            };
        });

        setFiles(prev => [...prev, ...uploadFiles]);
    }, [files.length, maxFiles, maxSizeMB, allowedTypes]);

    // Remove file from queue
    const removeFile = useCallback((id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    }, []);

    // Clear all files
    const clearFiles = useCallback(() => {
        setFiles([]);
    }, []);

    // Start uploading
    const startUpload = useCallback(async () => {
        const pendingFiles = files.filter(f => f.status === 'pending');
        if (pendingFiles.length === 0) return;

        setIsUploading(true);

        for (const uploadFile of pendingFiles) {
            // Update status to uploading
            setFiles(prev => prev.map(f =>
                f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
            ));

            try {
                // Simulate progress (since we can't track real upload progress without XHR)
                const progressInterval = setInterval(() => {
                    setFiles(prev => prev.map(f =>
                        f.id === uploadFile.id && f.progress < 90
                            ? { ...f, progress: f.progress + 10 }
                            : f
                    ));
                }, 200);

                // Actual upload
                const result = await onUpload(uploadFile.file);

                clearInterval(progressInterval);

                // Update status to success
                setFiles(prev => prev.map(f =>
                    f.id === uploadFile.id
                        ? { ...f, status: 'success', progress: 100, result }
                        : f
                ));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'อัปโหลดล้มเหลว';

                // Update status to error
                setFiles(prev => prev.map(f =>
                    f.id === uploadFile.id
                        ? { ...f, status: 'error', progress: 0, error: errorMessage }
                        : f
                ));
            }
        }

        setIsUploading(false);

        // Call onComplete callback
        if (onComplete) {
            onComplete(files);
        }
    }, [files, onUpload, onComplete]);

    // Handle drag events
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            addFiles(e.dataTransfer.files);
        }
    }, [addFiles]);

    // Get icon for file type
    const getFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) {
            return <Image size={20} className="text-blue-500" />;
        }
        if (file.type === 'application/pdf') {
            return <FileText size={20} className="text-red-500" />;
        }
        return <File size={20} className="text-slate-500" />;
    };

    // Calculate overall progress
    const overallProgress = files.length > 0
        ? Math.round(files.reduce((sum, f) => sum + f.progress, 0) / files.length)
        : 0;

    const successCount = files.filter(f => f.status === 'success').length;
    const errorCount = files.filter(f => f.status === 'error').length;
    const pendingCount = files.filter(f => f.status === 'pending').length;

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
            >
                <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 mb-2">
                    ลากไฟล์มาวางที่นี่ หรือ
                </p>
                <label className="inline-block">
                    <input
                        type="file"
                        multiple
                        accept={allowedTypes.join(',')}
                        onChange={(e) => e.target.files && addFiles(e.target.files)}
                        className="hidden"
                        disabled={isUploading}
                    />
                    <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                        เลือกไฟล์
                    </span>
                </label>
                <p className="text-sm text-slate-500 mt-4">
                    รองรับ: {allowedTypes.map(t => t.split('/')[1]).join(', ')} (สูงสุด {maxSizeMB}MB/ไฟล์, {maxFiles} ไฟล์)
                </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {/* Header with overall progress */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-800">
                                ไฟล์ทั้งหมด ({files.length})
                            </span>
                            <div className="flex items-center gap-4 text-sm">
                                {successCount > 0 && (
                                    <span className="text-green-600">✓ สำเร็จ {successCount}</span>
                                )}
                                {errorCount > 0 && (
                                    <span className="text-red-600">✗ ล้มเหลว {errorCount}</span>
                                )}
                                {pendingCount > 0 && (
                                    <span className="text-slate-600">รอดำเนินการ {pendingCount}</span>
                                )}
                            </div>
                        </div>
                        {isUploading && (
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${overallProgress}%` }}
                                />
                            </div>
                        )}
                    </div>

                    {/* File items */}
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {files.map(uploadFile => (
                            <div key={uploadFile.id} className="p-3 flex items-center gap-3">
                                {/* Icon */}
                                {getFileIcon(uploadFile.file)}

                                {/* File info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">
                                        {uploadFile.file.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {formatFileSize(uploadFile.file.size)}
                                        {uploadFile.error && (
                                            <span className="text-red-500 ml-2">{uploadFile.error}</span>
                                        )}
                                    </p>
                                </div>

                                {/* Status/Progress */}
                                <div className="flex items-center gap-2">
                                    {uploadFile.status === 'pending' && (
                                        <span className="text-xs text-slate-500">รอ</span>
                                    )}
                                    {uploadFile.status === 'uploading' && (
                                        <>
                                            <Loader2 size={16} className="animate-spin text-blue-600" />
                                            <span className="text-xs text-blue-600">{uploadFile.progress}%</span>
                                        </>
                                    )}
                                    {uploadFile.status === 'success' && (
                                        <CheckCircle2 size={16} className="text-green-600" />
                                    )}
                                    {uploadFile.status === 'error' && (
                                        <AlertCircle size={16} className="text-red-500" />
                                    )}
                                </div>

                                {/* Remove button */}
                                {!isUploading && uploadFile.status !== 'uploading' && (
                                    <button
                                        onClick={() => removeFile(uploadFile.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-slate-200 flex justify-between">
                        <button
                            onClick={clearFiles}
                            disabled={isUploading}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 disabled:opacity-50 transition-colors"
                        >
                            ล้างทั้งหมด
                        </button>
                        <button
                            onClick={startUpload}
                            disabled={isUploading || pendingCount === 0}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    กำลังอัปโหลด...
                                </>
                            ) : (
                                <>
                                    <Upload size={16} />
                                    อัปโหลด ({pendingCount} ไฟล์)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchUpload;
