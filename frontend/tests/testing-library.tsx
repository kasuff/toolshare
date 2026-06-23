import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render as rtlRender,
  type RenderOptions,
  type RenderResult
} from "@testing-library/react-original";
import type { ReactElement, ReactNode } from "react";

export * from "@testing-library/react-original";

export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return rtlRender(ui, { wrapper: Wrapper, ...options });
}
