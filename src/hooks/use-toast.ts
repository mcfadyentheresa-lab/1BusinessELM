import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

let listeners: Array<(toasts: Toast[]) => void> = [];
let toastQueue: Toast[] = [];

function notifyListeners() {
  listeners.forEach((l) => l([...toastQueue]));
}

export function toast(opts: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  toastQueue = [...toastQueue, { ...opts, id }];
  notifyListeners();
  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    notifyListeners();
  }, 5000);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(toastQueue);

  const subscribe = useCallback(() => {
    const listener = (t: Toast[]) => setToasts(t);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  // Subscribe on mount
  useState(() => {
    const unsub = subscribe();
    return unsub;
  });

  const dismiss = useCallback((id: string) => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    notifyListeners();
  }, []);

  return { toast, toasts, dismiss };
}
