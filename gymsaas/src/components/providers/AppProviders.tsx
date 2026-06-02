"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { initAppCheckSafely } from "@/lib/firebase/client";

/**
 * Global client providers.
 *  - React Query with sane defaults: retries + timeouts prevent infinite
 *    loaders (env-safety rule). Failures surface as error states.
 *  - App Check initialized best-effort (safe no-op if unconfigured).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    void initAppCheckSafely();
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
