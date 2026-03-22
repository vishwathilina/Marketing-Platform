'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, getStoredToken } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const { setUser } = useAuthStore();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.email || !formData.password) {
            setError('Please fill all the fields');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await authApi.login(formData.email, formData.password);
            if (!getStoredToken()) {
                throw new Error('Token was not stored after login');
            }
            const user = await authApi.getMe();
            console.log("user response:", user);
            setUser(user);

            // Set user response as cookie
            document.cookie = `user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=86400`;

            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-cover bg-center p-4"
            style={{ backgroundImage: "url('/bg.jpg')" }}
        >
            <div className="w-full max-w-[1100px] min-h-[650px] rounded-3xl shadow-2xl flex overflow-hidden">
                <div className="w-1/2 relative text-white p-10 flex-col justify-between bg-white/5 backdrop-blur-sm border-r border-white/10 hidden md:flex">
                    <div className="font-bold text-4xl">*</div>

                    <div>
                        <h1 className="text-4xl font-bold leading-tight">
                            <br /> YOUR NEXT AD STRATEGY <br /> STARTS HERE
                        </h1>

                        <p className="mt-4 text-sm text-gray-200 max-w-sm">
                            Log in to discover powerful AI insights, analyze upcoming ads, and make
                            smarter marketing decisions. Turn data into results before your ads even
                            go live.
                        </p>

                        <p className="mt-2 text-sm text-gray-300">Your success begins here.</p>
                    </div>
                </div>

                <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white/50 backdrop-blur-md">
                    <div className="w-full max-w-sm">
                        <h2 className="text-3xl font-bold text-gray-800">WELCOME BACK!</h2>

                        <p className="text-gray-500 mb-8">Welcome back! Please enter your details.</p>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-400 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin}>
                            <label className="text-sm text-gray-600">Email</label>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="w-full mt-1 mb-4 p-3 text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />

                            <label className="text-sm text-gray-600">Password</label>
                            <input
                                type="password"
                                placeholder="********"
                                className="w-full mt-1 mb-4 p-3 text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData({ ...formData, password: e.target.value })
                                }
                            />



                            <button
                                type="submit"
                                className="w-full bg-teal-800 text-white p-3 rounded-lg font-semibold hover:bg-teal-900 disabled:bg-teal-800/50"
                                disabled={loading}
                            >
                                {loading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </form>

                        <p className="text-center text-sm text-gray-500 mt-6">
                            Don't have an account?{' '}
                            <Link href="/register" className="text-teal-700 font-semibold">
                                Sign up
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
