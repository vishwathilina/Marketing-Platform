'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { ArrowLeft, Upload, FileVideo, FileImage, FileAudio, FileText, Loader2, X } from 'lucide-react';
import { projectsApi } from '@/lib/api';

type MediaSubtype =
    | 'video_ad'
    | 'print_ad'
    | 'display_banner'
    | 'ooh'
    | 'radio_ad'
    | 'streaming_audio_ad'
    | 'email_marketing'
    | 'blog_article';

const SUBTYPE_OPTIONS: {
    group: string;
    items: { value: MediaSubtype; label: string; modality: string }[];
}[] = [
    {
        group: 'Visual / Static',
        items: [
            { value: 'video_ad', label: 'Video ad', modality: 'video' },
            { value: 'print_ad', label: 'Print ad (magazine, flyer, brochure)', modality: 'image' },
            { value: 'display_banner', label: 'Display / banner ad', modality: 'image' },
            { value: 'ooh', label: 'Out-of-home (billboard, transit, poster)', modality: 'image' },
        ],
    },
    {
        group: 'Audio',
        items: [
            { value: 'radio_ad', label: 'Radio ad', modality: 'audio' },
            { value: 'streaming_audio_ad', label: 'Streaming audio ad', modality: 'audio' },
        ],
    },
    {
        group: 'Written / Text',
        items: [
            { value: 'email_marketing', label: 'Email marketing', modality: 'text' },
            { value: 'blog_article', label: 'Blog post / article', modality: 'text' },
        ],
    },
];

const ACCEPT_BY_SUBTYPE: Record<MediaSubtype, Record<string, string[]>> = {
    video_ad: { 'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv'] },
    print_ad: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'], 'application/pdf': ['.pdf'] },
    display_banner: {
        'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
        'application/pdf': ['.pdf'],
        'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv'],
    },
    ooh: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'], 'application/pdf': ['.pdf'] },
    radio_ad: { 'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.aac'] },
    streaming_audio_ad: { 'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.aac'] },
    email_marketing: {
        'text/plain': ['.txt'],
        'text/html': ['.html', '.htm'],
        'application/pdf': ['.pdf'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    blog_article: {
        'text/plain': ['.txt'],
        'text/html': ['.html', '.htm'],
        'application/pdf': ['.pdf'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
};

const MAX_SIZE_BY_SUBTYPE: Record<MediaSubtype, number> = {
    video_ad: 500 * 1024 * 1024,
    print_ad: 50 * 1024 * 1024,
    display_banner: 50 * 1024 * 1024,
    ooh: 50 * 1024 * 1024,
    radio_ad: 100 * 1024 * 1024,
    streaming_audio_ad: 100 * 1024 * 1024,
    email_marketing: 10 * 1024 * 1024,
    blog_article: 10 * 1024 * 1024,
};

const HINT_BY_SUBTYPE: Record<MediaSubtype, string> = {
    video_ad: 'MP4, MOV, WebM, AVI, MKV — max 500MB',
    print_ad: 'JPG, PNG, WebP, GIF, PDF — max 50MB',
    display_banner: 'Image, GIF, PDF, or short video — max 50MB',
    ooh: 'JPG, PNG, WebP, GIF, PDF — max 50MB',
    radio_ad: 'MP3, WAV, M4A, OGG, AAC — max 100MB',
    streaming_audio_ad: 'MP3, WAV, M4A, OGG, AAC — max 100MB',
    email_marketing: 'Paste copy below, or upload TXT, HTML, PDF, DOCX — max 10MB',
    blog_article: 'Paste copy below, or upload TXT, HTML, PDF, DOCX — max 10MB',
};

function modalityForSubtype(subtype: MediaSubtype): string {
    for (const group of SUBTYPE_OPTIONS) {
        const found = group.items.find((i) => i.value === subtype);
        if (found) return found.modality;
    }
    return 'video';
}

function FileIcon({ modality }: { modality: string }) {
    if (modality === 'image') return <FileImage className="w-6 h-6 text-[#1a3840]" />;
    if (modality === 'audio') return <FileAudio className="w-6 h-6 text-[#1a3840]" />;
    if (modality === 'text') return <FileText className="w-6 h-6 text-[#1a3840]" />;
    return <FileVideo className="w-6 h-6 text-[#1a3840]" />;
}

export default function NewProjectPage() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [mediaSubtype, setMediaSubtype] = useState<MediaSubtype>('video_ad');
    const [file, setFile] = useState<File | null>(null);
    const [textContent, setTextContent] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentDate, setCurrentDate] = useState('');

    const modality = modalityForSubtype(mediaSubtype);
    const isTextSubtype = modality === 'text';

    useEffect(() => {
        setCurrentDate(new Date().toLocaleString('en-US'));
    }, []);

    useEffect(() => {
        setFile(null);
        setTextContent('');
        setError('');
    }, [mediaSubtype]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            setError('');
        }
    }, []);

    const accept = useMemo(() => ACCEPT_BY_SUBTYPE[mediaSubtype], [mediaSubtype]);
    const maxSize = MAX_SIZE_BY_SUBTYPE[mediaSubtype];

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept,
        maxFiles: 1,
        maxSize,
        disabled: uploading,
    });

    const canSubmit =
        title.trim().length > 0 &&
        (isTextSubtype ? textContent.trim().length > 0 || !!file : !!file);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('Please enter a project title');
            return;
        }

        if (isTextSubtype) {
            if (!textContent.trim() && !file) {
                setError('Paste text content or upload a text file');
                return;
            }
        } else if (!file) {
            setError('Please upload a media file');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('media_subtype', mediaSubtype);

            // Prefer paste when both provided
            if (isTextSubtype && textContent.trim()) {
                formData.append('text_content', textContent.trim());
            } else if (file) {
                // Send under both names for compatibility with older backends
                formData.append('media', file);
                formData.append('video', file);
            }

            const progressInterval = setInterval(() => {
                setUploadProgress((prev) => Math.min(prev + 10, 90));
            }, 500);

            const project = await projectsApi.create(formData);

            clearInterval(progressInterval);
            setUploadProgress(100);

            router.push(`/dashboard/project/${project.id}`);
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            if (typeof detail === 'string') {
                setError(detail);
            } else if (Array.isArray(detail)) {
                setError(
                    detail
                        .map((item: any) => {
                            const field = Array.isArray(item?.loc)
                                ? item.loc.filter((p: unknown) => p !== 'body').join('.')
                                : '';
                            const msg = item?.msg || JSON.stringify(item);
                            return field ? `${field}: ${msg}` : msg;
                        })
                        .join('; ')
                );
            } else if (detail && typeof detail === 'object') {
                setError(detail.msg || JSON.stringify(detail));
            } else {
                setError(err.message || 'Failed to create project');
            }
        } finally {
            setUploading(false);
        }
    };

    const removeFile = () => setFile(null);

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="bg-[#f3f6f5] text-[#1a3840] font-sans flex items-center justify-center py-12">
            <div className="w-full max-w-5xl mx-auto p-8">
                <div className="flex items-center space-x-4 mb-8">
                    <Link
                        href="/dashboard"
                        className="p-2 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#1a3840]" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-[#1a3840]">New Project</h1>
                        <p className="text-[#3c5d64] text-lg mt-1">
                            Upload creative media for AI decomposition
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-100 border border-red-300 text-red-700 text-sm w-full max-w-5xl">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-8 shadow-sm border border-gray-100 flex flex-col justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-[#113a40] mb-6">Project Information</h2>

                                <div className="mb-6">
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

                                <div className="mb-6">
                                    <label className="block text-[#113a40] font-semibold text-lg mb-2">
                                        Creative Type
                                    </label>
                                    <select
                                        value={mediaSubtype}
                                        onChange={(e) => setMediaSubtype(e.target.value as MediaSubtype)}
                                        disabled={uploading}
                                        className="w-full px-4 py-3 bg-white border border-[#c4d4d0] rounded-xl focus:outline-none focus:border-[#679a90] focus:ring-1 focus:ring-[#679a90] text-[#1a3840]"
                                    >
                                        {SUBTYPE_OPTIONS.map((group) => (
                                            <optgroup key={group.group} label={group.group}>
                                                {group.items.map((item) => (
                                                    <option key={item.value} value={item.value}>
                                                        {item.label}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3 text-[#7a8a89] text-base font-medium">
                                    <p>Choose the creative type, then upload or paste the content.</p>
                                    <p>Wait for AI decomposition into a simulation brief.</p>
                                    <p>Edit the description if needed, then run the simulation.</p>
                                </div>
                            </div>

                            <div className="mt-8 text-[#889b97] text-sm">{currentDate}</div>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="bg-white p-8 shadow-sm border border-gray-100 flex-1 flex flex-col">
                                <h2 className="text-2xl font-bold text-[#113a40] mb-6">Creative Source</h2>

                                {isTextSubtype && (
                                    <div className="mb-4">
                                        <label className="block text-[#113a40] font-semibold mb-2">
                                            Paste content
                                        </label>
                                        <textarea
                                            value={textContent}
                                            onChange={(e) => setTextContent(e.target.value)}
                                            disabled={uploading}
                                            rows={8}
                                            placeholder="Paste email body, newsletter, or article text here..."
                                            className="w-full px-4 py-3 bg-white border border-[#c4d4d0] rounded-xl focus:outline-none focus:border-[#679a90] focus:ring-1 focus:ring-[#679a90] text-[#1a3840] placeholder-gray-400 resize-y"
                                        />
                                        <p className="text-sm text-[#647c77] mt-2">
                                            Or upload a file below. Pasted text is used if both are provided.
                                        </p>
                                    </div>
                                )}

                                <div className="flex-1">
                                    {file ? (
                                        <div className="h-full border border-[#c4d4d0] bg-gray-50 rounded-xl p-6 flex flex-col justify-center relative min-h-[160px]">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-12 h-12 rounded-lg bg-[#e2ecea] flex items-center justify-center">
                                                        <FileIcon modality={modality} />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-lg text-[#1a3840] truncate max-w-[200px]">
                                                            {file.name}
                                                        </p>
                                                        <p className="text-[#647c77]">{formatFileSize(file.size)}</p>
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
                                                transition-colors duration-200 min-h-[160px]
                                                ${
                                                    isDragActive
                                                        ? 'border-[#679a90] bg-[#f0f6f4]'
                                                        : 'border-[#c4d4d0] hover:border-[#679a90] hover:bg-gray-50'
                                                }
                                            `}
                                        >
                                            <input {...getInputProps()} />
                                            <Upload className="w-10 h-10 text-[#0c4a4a] mb-4" />
                                            <p className="text-xl font-bold text-[#113a40] mb-2">
                                                {isDragActive
                                                    ? 'Drop your file here'
                                                    : isTextSubtype
                                                      ? 'Drag & drop a text file'
                                                      : 'Drag & drop your media'}
                                            </p>
                                            <p className="text-[#647c77] text-base">{HINT_BY_SUBTYPE[mediaSubtype]}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={uploading || !canSubmit}
                                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] text-lg font-semibold text-white transition hover:bg-[#0b5f59] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>Create Project</>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
