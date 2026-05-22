import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
// Mirrors the NavigationItem interface defined in Layout.tsx.
interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  category?: string;
  subItems?: NavigationItem[];
}

interface CollapsedFlyoutMenuProps {
  item: NavigationItem;
  isActive: boolean;
  subItems: NavigationItem[];
  isSubItemActive: (href: string) => boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const CollapsedFlyoutMenu: React.FC<CollapsedFlyoutMenuProps> = ({
  item,
  isActive,
  subItems,
  isSubItemActive,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Timer helpers ──────────────────────────────────────────────────────────
  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, [cancelClose]);

  // ── Trigger events ─────────────────────────────────────────────────────────
  const handleTriggerEnter = useCallback(() => {
    cancelClose();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.right + 8, // 8px gap between sidebar and flyout
      });
    }
    setIsOpen(true);
  }, [cancelClose]);

  // ── Recalculate position on scroll/resize ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const recalc = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({ top: rect.top, left: rect.right + 8 });
      }
    };

    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [isOpen]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // ── Portal ─────────────────────────────────────────────────────────────────
  const portal = ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && coords && (
        <motion.div
          className="fixed z-[9999] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl rounded-2xl p-2 min-w-[200px] flex flex-col gap-1"
          style={{ top: coords.top, left: coords.left }}
          initial={{ opacity: 0, x: -10, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {/* Section header */}
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
            {item.name}
          </div>

          {/* Sub-items */}
          {subItems.map((subItem) => {
            const active = isSubItemActive(subItem.href);
            return (
              <Link
                key={subItem.name}
                to={subItem.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <subItem.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{subItem.name}</span>
              </Link>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );

  // ── Trigger button ─────────────────────────────────────────────────────────
  return (
    <>
      <button
        ref={triggerRef}
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={scheduleClose}
        className={`flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
      </button>
      {portal}
    </>
  );
};
