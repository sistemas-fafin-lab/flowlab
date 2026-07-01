// Design-system entry barrel for the Flow LAB DS sync.
//
// flowlab is an APP, not a component library, so there is no published dist/
// entry. This barrel re-exports the scoped set of genuinely reusable,
// presentational primitives as NAMED exports, which the converter bundles into
// window.FlowLabDS.*. Default-exported components are re-exported under their
// own names; PageLoadingSkeleton's reusable atoms are pulled from its named
// exports (its own default export is a registry object, not a component).
//
// To add/remove a primitive: edit this list AND the matching componentSrcMap
// entry in .design-sync/config.json (both must agree, or discovery and the
// bundle desync).

export { default as ConfirmDialog } from '../src/components/ConfirmDialog';
export { default as InputDialog } from '../src/components/InputDialog';
export { default as Notification } from '../src/components/Notification';
export { default as DetailModal } from '../src/components/DetailModal';
export { default as SignatureViewModal } from '../src/components/SignatureViewModal';

export {
  SkeletonCard,
  SkeletonListItem,
  SkeletonFilters,
  LoadingSpinner,
} from '../src/components/PageLoadingSkeleton';
