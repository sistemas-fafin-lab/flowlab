import { useEffect, useState } from 'react';
import { getSlaStatus, ITPriority, SlaContext, SlaStatus } from '../utils/itSla';

const TICK_INTERVAL_MS = 60_000;

export function useSlaStatus(
  createdAt: string,
  priority: ITPriority,
  options?: Omit<SlaContext, 'now'>
): SlaStatus {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return getSlaStatus(createdAt, priority, options);
}
