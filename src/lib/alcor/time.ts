// Pure countdown helpers for Alcor farm incentives (unix seconds).

export function isIncentiveExpired(endTimestamp: number, now: number = Math.floor(Date.now() / 1000)): boolean {
  if (endTimestamp <= 0) return false;
  return endTimestamp <= now;
}

export function formatRemainingDays(
  endTimestamp: number,
  now: number = Math.floor(Date.now() / 1000),
): { label: string; isUrgent: boolean; isExpired: boolean } {
  if (endTimestamp <= 0) return { label: '—', isUrgent: false, isExpired: false };
  if (endTimestamp <= now) return { label: 'Ended', isUrgent: false, isExpired: true };

  const secondsLeft = endTimestamp - now;
  const daysLeft = Math.floor(secondsLeft / 86400);
  const hoursLeft = Math.floor((secondsLeft % 86400) / 3600);

  if (daysLeft > 7) return { label: `${daysLeft}d`, isUrgent: false, isExpired: false };
  if (daysLeft > 0) return { label: `${daysLeft}d ${hoursLeft}h`, isUrgent: true, isExpired: false };
  return { label: `${hoursLeft}h`, isUrgent: true, isExpired: false };
}

export function formatDetailedCountdown(endTimestamp: number, now: number = Math.floor(Date.now() / 1000)): string {
  if (endTimestamp <= 0) return 'Unknown end time';
  if (endTimestamp <= now) return 'Farm has ended';

  const secondsLeft = endTimestamp - now;
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);

  const endDate = new Date(endTimestamp * 1000);
  const dateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (days > 0) return `${days}d ${hours}h ${minutes}m (${dateStr} ${timeStr})`;
  if (hours > 0) return `${hours}h ${minutes}m (${dateStr} ${timeStr})`;
  return `${minutes}m (${dateStr} ${timeStr})`;
}

/** Stable per-stake key: one position can be staked to several incentives. */
export function getIncentiveKey(farm: { positionId: number; incentiveId: number }): string {
  return `${farm.positionId}-${farm.incentiveId}`;
}
