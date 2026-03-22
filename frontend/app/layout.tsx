import type { Metadata } from 'next';
import './globals2.css';
import 'leaflet/dist/leaflet.css';
import { Providers } from './providers';

export const metadata: Metadata = {
    title: 'AgentSociety - AI Marketing Simulation',
    description: 'Simulate 1000+ AI agents reacting to your advertisements before launch',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="font-sans antialiased">
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
