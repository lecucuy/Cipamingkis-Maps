import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import AuthProvider from './AuthProvider'; // 👈 import

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Cipamingkis Maps',
  description: 'Real-time monitoring dashb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💧</text></svg>" />
      </head>
      <body className={`${inter.className} overflow-hidden`}>
        <AuthProvider>   {/* 👈 BUNGKUS DENGAN AUTH PROVIDER */}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}