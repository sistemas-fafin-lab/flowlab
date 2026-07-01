import React from 'react';
import { SkeletonListItem } from 'inventory-system';

// List/card placeholder shown while request or product lists load.
export const Stacked = () => (
  <div className="space-y-4 p-1">
    <SkeletonListItem />
    <SkeletonListItem />
  </div>
);
