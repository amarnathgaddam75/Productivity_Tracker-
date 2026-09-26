import { CheckCircle2, AlarmClock, Hourglass, PartyPopper, ClipboardList, BellRing, Sparkles } from 'lucide-react';

export const KIND_STYLE = {
  completed: { icon: CheckCircle2, cls: 'border border-emerald-300/30 text-emerald-300' },
  warning: { icon: Hourglass, cls: 'border border-amber-300/30 text-amber-300' },
  overtime: { icon: AlarmClock, cls: 'border border-rose-300/30 text-rose-300' },
  goal: { icon: PartyPopper, cls: 'border border-violet-300/30 text-violet-300' },
  summary: { icon: ClipboardList, cls: 'border border-brand-300/30 text-brand-300' },
  reminder: { icon: BellRing, cls: 'border border-cyan-300/30 text-cyan-300' },
  assistant: { icon: Sparkles, cls: 'border border-brand-300/30 text-brand-200' },
};
