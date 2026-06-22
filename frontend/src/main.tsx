import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { setApiBaseUrl } from "@toolshare/shared";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import "./styles.css";

// Point the shared API client at the backend. In production VITE_API_URL is
// baked in as "/api" (same-origin, proxied by nginx to the backend container);
// in dev the compose env sets it to http://localhost:4000/api. Without this the
// client keeps its hardcoded localhost:4000 default and every request from a
// non-localhost browser fails with "Netzwerkfehler".
const apiBaseUrl =
  ((import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL as string | undefined) ??
  "http://localhost:4000/api";
setApiBaseUrl(apiBaseUrl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
