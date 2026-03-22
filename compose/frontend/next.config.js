/** @type {import('next').NextConfig} */
const backendProxyUrl = (process.env.BACKEND_PROXY_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${backendProxyUrl}/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
