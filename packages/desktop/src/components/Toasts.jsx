import { X } from 'lucide-react';
import { useStore } from '../config.js';
import { KIND_STYLE } from './notificationStyle.js';

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const { icon: Icon, cls } = KIND_STYLE[t.kind] || KIND_STYLE.summary;
        return (
          <div key={t.id} className="card pointer-events-auto flex animate-slide-in gap-3 p-4 shadow-lg">
            <span className={`flex h-9 w-9 shrink-0 animate-pop items-center justify-center rounded-xl ${cls}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t.body}</div>
            </div>
            <button className="icon-btn h-6 w-6" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
