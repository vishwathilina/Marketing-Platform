'use client';

import { useState, useCallback, useEffect } from 'react';
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
    const [currentDate, setCurrentDate] = useState('');

    useEffect(() => {
        setCurrentDate(new Date().toLocaleString('en-US'));
    }, []);

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
        <div className="bg-[#f3f6f5] text-[#1a3840] font-sans flex items-center justify-center py-12">
            <div className="w-full max-w-5xl mx-auto p-8">
                {/* Header */}
                <div className="flex items-center space-x-4 mb-8">
                    <Link
                        href="/dashboard"
                        className="p-2 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#1a3840]" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-[#1a3840]">New Project</h1>
                        <p className="text-[#3c5d64] text-lg mt-1">Upload a video to analyze with AI</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-100 border border-red-300 text-red-700 text-sm w-full max-w-5xl">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column: Project Information */}
                        <div className="bg-white  p-8 shadow-sm border border-gray-100 flex flex-col justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-[#113a40] mb-6">Project Information</h2>
                                
                                <div className="mb-8">
                                    <label className="block text-[#113a40] font-semibold text-lg mb-2">
                                        Project Title
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-[#c4d4d0] rounded-xl focus:outline-none focus:border-[#679a90] focus:ring-1 focus:ring-[#679a90] text-[#1a3840] placeholder-gray-400"
                                        placeholder="e.g., Q1 Campaign Ad"
                                        disabled={uploading}
                                    />
                                </div>

                                <div className="space-y-3 text-[#7a8a89] text-base font-medium">
                                    <p>The Process setup is very simple</p>
                                    <p>upload the video</p>
                                    <p>wait till the decomposing happence</p>
                                    <p>edit the description if needed</p>
                                    <p>run simulation</p>
                                </div>
                            </div>
                            
                            <div className="mt-8 text-[#889b97] text-sm">
                                {currentDate}
                            </div>
                        </div>

                        {/* Right Column: Video Source */}
                        <div className="flex flex-col gap-6">
                            <div className="bg-white  p-8 shadow-sm border border-gray-100 flex-1 flex flex-col">
                                <h2 className="text-2xl font-bold text-[#113a40] mb-6">Video Source</h2>
                                
                                <div className="flex-1">
                                    {file ? (
                                        <div className="h-full border border-[#c4d4d0] bg-gray-50 rounded-xl p-6 flex flex-col justify-center relative">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-12 h-12 rounded-lg bg-[#e2ecea] flex items-center justify-center">
                                                        <FileVideo className="w-6 h-6 text-[#1a3840]" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-lg text-[#1a3840] truncate max-w-[200px]">
                                                            {file.name}
                                                        </p>
                                                        <p className="text-[#647c77]">
                                                            {formatFileSize(file.size)}
                                                        </p>
                                                    </div>
                                                </div>
                                                {!uploading && (
                                                    <button
                                                        type="button"
                                                        onClick={removeFile}
                                                        className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                                                    >
                                                        <X className="w-5 h-5 text-[#1a3840]" />
                                                    </button>
                                                )}
                                            </div>

                                            {uploading && (
                                                <div className="mt-6">
                                                    <div className="h-2 rounded-full border border-gray-200 bg-gray-100 overflow-hidden">
                                                        <div
                                                            className="h-full bg-[#679a90] transition-all duration-500 ease-out"
                                                            style={{ width: `${uploadProgress}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-sm text-[#647c77] mt-2 font-medium">
                                                        Uploading... {Math.round(uploadProgress)}%
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div
                                            {...getRootProps()}
                                            className={`
                                                h-full border border-dashed rounded-xl p-8 flex flex-col justify-center items-center text-center cursor-pointer
                                                transition-colors duration-200 min-h-[250px]
                                                ${isDragActive
                                                    ? 'border-[#679a90] bg-[#f0f6f4]'
                                                    : 'border-[#c4d4d0] hover:border-[#679a90] hover:bg-gray-50'
                                                }
                                            `}
                                        >
                                            <input {...getInputProps()} />
                                            <Upload className="w-10 h-10 text-[#0c4a4a] mb-4" />
                                            <p className="text-xl font-bold text-[#113a40] mb-2">
                                                {isDragActive
                                                    ? 'Drop your video here'
                                                    : 'Drag & drop your video'}
                                            </p>
                                            <p className="text-[#647c77] text-base">
                                                or click to browse (MP4, MOV,<br />WebM, max 500MB)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <button
                                type="submit"
                                disabled={uploading || !file || !title.trim()}
                                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] text-lg font-semibold text-white transition hover:bg-[#0b5f59] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        
                                        Create Project
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
