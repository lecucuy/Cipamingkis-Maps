'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,       // data dianggap fresh 30s — tidak refetch
        gcTime: 5 * 60_000,      // cache disimpan 5 menit
        refetchOnWindowFocus: false,  // ← STOP refetch tiap pindah tab
        refetchOnMount: false,         // ← STOP refetch tiap mount ulang
        retry: 1,                      // ← jangan retry 5x kalau 404/401
        retryDelay: (i) => Math.min(1000 * 2 ** i, 10_000),
      },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}