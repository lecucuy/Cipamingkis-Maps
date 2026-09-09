// components/Notification.tsx
import { toast, ToastOptions } from 'react-hot-toast';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface NotificationOptions extends ToastOptions {
  duration?: number;
}

export function showNotification(
  message: string,
  type: ToastType = 'info',
  options?: NotificationOptions
) {
  const defaultOptions: ToastOptions = {
    duration: 4000,
    position: 'top-right',
    style: {
      borderRadius: '12px',
      background: '#1a1a2e',
      color: '#fff',
      padding: '12px 20px',
      fontSize: '14px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
    },
    icon: getIcon(type),
    ...options,
  };

  switch (type) {
    case 'success':
      toast.success(message, defaultOptions);
      break;
    case 'error':
      toast.error(message, { ...defaultOptions, duration: 6000 });
      break;
    case 'warning':
      toast(message, {
        ...defaultOptions,
        icon: '⚠️',
        style: { ...defaultOptions.style, background: '#f59e0b' },
      });
      break;
    default:
      toast(message, defaultOptions);
      break;
  }
}

function getIcon(type: ToastType): string | undefined {
  switch (type) {
    case 'success': return '✅';
    case 'error': return '❌';
    case 'warning': return '⚠️';
    default: return 'ℹ️';
  }
}

/**
 * Untuk notifikasi dengan aksi (contoh: tombol undo)
 */
export function showActionNotification(
  message: string,
  actionLabel: string,
  onAction: () => void,
  type: ToastType = 'info'
) {
  toast.custom(
    (t) => (
      <div
        className={`px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm flex items-center gap-3 border ${
          type === 'success'
            ? 'bg-green-900/90 border-green-500 text-white'
            : type === 'error'
            ? 'bg-red-900/90 border-red-500 text-white'
            : 'bg-blue-900/90 border-blue-500 text-white'
        }`}
      >
        <span>{message}</span>
        <button
          onClick={() => {
            onAction();
            toast.dismiss(t.id);
          }}
          className="px-3 py-1 text-xs font-medium bg-white/20 rounded-lg hover:bg-white/30 transition"
        >
          {actionLabel}
        </button>
      </div>
    ),
    { duration: 8000 }
  );
}