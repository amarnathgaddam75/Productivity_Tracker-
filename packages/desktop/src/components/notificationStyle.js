import { CheckCircle2, AlarmClock, Hourglass, PartyPopper, ClipboardList } from 'lucide-react';

export const KIND_STYLE = {
  completed: { icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  warning: { icon: Hourglass, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  overtime: { icon: AlarmClock, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  goal: { icon: PartyPopper, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  summary: { icon: ClipboardList, cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-300' },
};
