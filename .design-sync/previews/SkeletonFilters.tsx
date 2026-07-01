import React from 'react';
import { SkeletonFilters } from 'inventory-system';

// Filter-bar placeholder shown above a list/table while filters load.
export const Default = () => (
  <div className="p-1">
    <SkeletonFilters />
  </div>
);
