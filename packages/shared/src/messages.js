// Curated motivational messages, grouped by how the day is going.

export const MESSAGES = {
  start: [
    'Every big accomplishment starts with the decision to try.',
    'Small steps every day add up to big results.',
    'Start where you are. Use what you have. Do what you can.',
    'The secret of getting ahead is getting started.',
    'Focus on progress, not perfection.',
    'Plan the work, then work the plan.',
  ],
  progress: [
    "You're building momentum — keep it rolling!",
    'Nice pace. One task at a time gets it all done.',
    'Consistency beats intensity. Keep showing up.',
    "You're halfway up the mountain. The view is getting better.",
    'Deep work is a superpower. You are using it.',
    'Keep going — future you will be grateful.',
  ],
  strong: [
    'Outstanding focus today. You are on fire! 🔥',
    'Crushing it! Your effort is paying off.',
    'This is what a productive day looks like.',
    "You're turning plans into results. Brilliant work.",
    'Excellent execution — almost everything is done!',
  ],
  complete: [
    'Everything done! Take a well-earned break. 🎉',
    'All tasks complete. Celebrate the win!',
    'Mission accomplished. Rest is part of the process.',
    'A perfect day of execution. Be proud of yourself.',
  ],
  rest: [
    'Rest is productive too. Recharge for tomorrow.',
    'Tomorrow is a fresh page. Make a plan and begin.',
    'Even slow progress is progress.',
  ],
};

/** Deterministic 32-bit string hash (FNV-1a). */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function messageCategory({ totalTasks, completedTasks, productivityScore, hoursWorked }) {
  if (totalTasks === 0) return hoursWorked > 0 ? 'progress' : 'start';
  if (completedTasks === totalTasks) return 'complete';
  if (productivityScore >= 70) return 'strong';
  if (completedTasks > 0 || hoursWorked > 0) return 'progress';
  return 'start';
}

/**
 * Picks a message from the category matching the report. `seed` keeps the pick
 * stable across re-renders (e.g. date key); change it to shuffle.
 */
export function pickMessage(report, seed = '') {
  const category = messageCategory(report);
  const list = MESSAGES[category];
  return { category, text: list[hash(`${category}:${seed}`) % list.length] };
}
