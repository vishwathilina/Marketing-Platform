/** @type {import('next').NextConfig} */
const backendProxyUrl = (process.env.BACKEND_PROXY_URL || 'http://127.0.0.1:8011').replace(/\/$/, '');
const nextConfig = {
    reactStrictMode: true,
    // Disable keep-alive connection pooling for the internal rewrite proxy.
    // On Windows, pooled sockets to the backend get torn down (by Uvicorn's
    // keep-alive timeout, or by the OS) without Next.js noticing, and the
    // next reused request fails with ECONNRESET / "socket hang up".
    // Forcing a fresh connection per proxied request avoids this entirely.
    httpAgentOptions: {
        keepAlive: false,
    },
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