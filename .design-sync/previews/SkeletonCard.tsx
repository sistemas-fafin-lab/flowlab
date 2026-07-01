import React from 'react';
import { SkeletonCard } from 'inventory-system';

// Stat/summary card placeholder shown while dashboard cards load.
export const Grid = () => (
  <div className="grid grid-cols-2 gap-4 p-1">
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
  </div>
);
