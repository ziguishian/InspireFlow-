// 简单的 Toast 通知系统

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

class ToastManager {
  private toasts: Toast[] = [];
  private listeners: Set<(toasts: Toast[]) => void> = new Set();

  subscribe(listener: (toasts: Toast[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(message: string, type: ToastType = 'info', duration: number = 3000) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const toast: Toast = { id, message, type, duration };
    
    this.toasts.push(toast);
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  remove(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }

  getToasts(): Toast[] {
    return [...this.toasts];
  }
}

export const toastManager = new ToastManager();

// 便捷方法
export const toast = {
  success: (message: string, duration?: number) => toastManager.show(message, 'success', duration),
  error: (message: string, duration?: number) => toastManager.show(message, 'error', duration),
  warning: (message: string, duration?: number) => toastManager.show(message, 'warning', duration),
  info: (message: string, duration?: number) => toastManager.show(message, 'info', duration),
};
