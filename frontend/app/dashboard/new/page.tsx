'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { Zap, ArrowLeft, Upload, FileVideo, Loader2, X } from 'lucide-react';
import { projectsApi } from '@/lib/api';

export default function NewProjectPage() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            setError('');
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv'],
        },
        maxFiles: 1,
        maxSize: 500 * 1024 * 1024, // 500MB
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('Please enter a project title');
            return;
        }

        if (!file) {
            setError('Please upload a video file');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('video', file);

            // Simulate progress (actual progress would require XHR)
            const progressInterval = setInterval(() => {
                setUploadProgress((prev) => Math.min(prev + 10, 90));
            }, 500);

            const project = await projectsApi.create(formData);

            clearInterval(progressInterval);
            setUploadProgress(100);

            router.push(`/dashboard/project/${project.id}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create project');
        } finally {
            setUploading(false);
        }
    };

    const removeFile = () => {
        setFile(null);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center space-x-4 mb-8">
                    <Link
                        href="/dashboard"
                        className="p-2 rounded-xl glass hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">New Project</h1>
                        <p className="text-white/60">Upload a video to analyze with AI</p>
                    </div>
                </div>

                {/* Form */}
                <div className="glass-card rounded-2xl p-8">
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Project Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="input-field"
                                placeholder="e.g., Q1 Campaign Ad"
                                disabled={uploading}
                            />
                        </div>

                        {/* Video Upload */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Video File
                            </label>

                            {file ? (
                                <div className="glass rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                                                <FileVideo className="w-5 h-5 text-primary-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium truncate max-w-xs">
                                                    {file.name}
                                                </p>
                                                <p className="text-sm text-white/40">
                                                    {formatFileSize(file.size)}
                                                </p>
                                            </div>
                                        </div>
                                        {!uploading && (
                                            <button
                                                type="button"
                                                onClick={removeFile}
                                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                            >
                                                <X className="w-5 h-5 text-white/60" />
                                            </button>
                                        )}
                                    </div>

                                    {uploading && (
                                        <div className="mt-4">
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-bar-fill"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                            <p className="text-sm text-white/60 mt-2">
                                                Uploading... {uploadProgress}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    {...getRootProps()}
                                    className={`
                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                    transition-colors duration-200
                    ${isDragActive
                                            ? 'border-primary-500 bg-primary-500/10'
                                            : 'border-white/20 hover:border-white/40'
                                        }
                  `}
                                >
                                    <input {...getInputProps()} />
                                    <Upload className="w-12 h-12 text-white/40 mx-auto mb-4" />
                                    <p className="text-lg font-medium mb-1">
                                        {isDragActive
                                            ? 'Drop your video here'
                                            : 'Drag & drop your video'}
                                    </p>
                                    <p className="text-white/60 text-sm">
                                        or click to browse (MP4, MOV, WebM, max 500MB)
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={uploading || !file || !title.trim()}
                            className="w-full btn-primary py-4 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Zap className="w-5 h-5 mr-2" />
                                    Create Project
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
