import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import AuthProvider from './AuthProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Cipamingkis Maps',
    template: '%s · Cipamingkis Maps',
  },
  description: 'Real-time monitoring dashboard Perum Jasa Tirta II — Cipamingkis',
  applicationName: 'Cipamingkis Maps',
  authors: [{ name: 'iLookAi' }],
  keywords: ['Cipamingkis', 'Jasa Tirta II', 'monitoring', 'bendung', 'irigasi'],
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💧</text></svg>',
  },
};

// 🔥 Viewport export terpisah (Next 14+)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // maxScale tidak di-set → aksesibilitas tetap baik (user bisa zoom)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a1a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.className} ${inter.variable} min-h-screen antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>

        {/* 🔔 Global Toast Container — responsif di HP & desktop */}
        <Toaster
          position="top-center"
          gutter={8}
          reverseOrder={false}
          containerStyle={{
            top: 12,
            left: 12,
            right: 12,
          }}
          toastOptions={{
            duration: 4000,
            style: {
              maxWidth: 'calc(100vw - 24px)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '13px',
              lineHeight: 1.4,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            },
            success: {
              style: {
                background: '#065f46',
                color: '#fff',
              },
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 6000,
              style: {
                background: '#7f1d1d',
                color: '#fff',
              },
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
            loading: {
              style: {
                background: '#1e293b',
                color: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}