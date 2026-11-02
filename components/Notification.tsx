// components/Notification.tsx
import { toast, ToastOptions } from 'react-hot-toast';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface NotificationOptions extends ToastOptions {
  duration?: number;
}

/** Deteksi mobile sekali panggil (dipakai di luar hook) */
function isMobileScreen() {
  return typeof window !== 'undefined' && window.innerWidth < 640;
}

export function showNotification(
  message: string,
  type: ToastType = 'info',
  options?: NotificationOptions
) {
  const mobile = isMobileScreen();

  const defaultOptions: ToastOptions = {
    duration: type === 'error' ? 6000 : 4000,
    position: mobile ? 'top-center' : 'top-right',
    style: {
      borderRadius: '12px',
      background: '#1a1a2e',
      color: '#fff',
      padding: mobile ? '10px 14px' : '12px 20px',
      fontSize: mobile ? '13px' : '14px',
      lineHeight: 1.4,
      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      maxWidth: mobile ? 'calc(100vw - 24px)' : '420px',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
    },
    icon: getIcon(type),
    ...options,
  };

  switch (type) {
    case 'success':
      toast.success(message, defaultOptions);
      break;
    case 'error':
      toast.error(message, defaultOptions);
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
 * Notifikasi dengan aksi (contoh: tombol undo).
 * Responsive: di HP tombol turun ke bawah, di desktop sejajar.
 */
export function showActionNotification(
  message: string,
  actionLabel: string,
  onAction: () => void,
  type: ToastType = 'info'
) {
  const colorClass =
    type === 'success'
      ? 'bg-green-900/95 border-green-500'
      : type === 'error'
      ? 'bg-red-900/95 border-red-500'
      : 'bg-blue-900/95 border-blue-500';

  toast.custom(
    (t) => (
      <div
        className={`w-full max-w-[calc(100vw-24px)] sm:max-w-sm
                    px-3.5 sm:px-4 py-2.5 sm:py-3
                    rounded-xl shadow-2xl backdrop-blur-sm
                    flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3
                    border text-white ${colorClass}`}
      >
        <span className="text-[13px] sm:text-sm flex-1 break-words">
          {message}
        </span>
        <button
          onClick={() => {
            onAction();
            toast.dismiss(t.id);
          }}
          className="px-3 py-1.5 text-xs font-semibold
                     bg-white/20 rounded-lg hover:bg-white/30
                     transition whitespace-nowrap
                     self-start sm:self-auto"
        >
          {actionLabel}
        </button>
      </div>
    ),
    {
      duration: 8000,
      position: isMobileScreen() ? 'top-center' : 'top-right',
    }
  );
}