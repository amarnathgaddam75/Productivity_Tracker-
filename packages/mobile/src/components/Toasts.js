import { useStore } from '../config';
import { KIND_STYLE } from './kindStyle';

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-lg flex-col gap-2 px-4 pt-3" aria-live="polite">
      {toasts.slice(-2).map((t) => {
        const { icon: Icon, cls } = KIND_STYLE[t.kind] || KIND_STYLE.summary;
        return (
          <button key={t.id} onClick={() => dismiss(t.id)} className="card pointer-events-auto flex animate-slide-down items-center gap-3 p-3 text-left shadow-xl">
            <span className={`flex h-9 w-9 shrink-0 animate-pop items-center justify-center rounded-xl ${cls}`}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="truncate text-xs text-slate-500">{t.body}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
