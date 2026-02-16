"use client";

import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { BackendRetryListener } from "@/components/BackendRetryListener";

function KeyboardShortcuts() {
  useKeyboardShortcuts();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BackendRetryListener />
        <KeyboardShortcuts />
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
