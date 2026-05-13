import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_GAP = 8;
const MENU_MAX_HEIGHT = 240;
const MENU_MIN_HEIGHT = 132;
const VIEWPORT_PADDING = 12;
const OPTION_HEIGHT = 38;

export default function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled = false,
  error = '',
  size = 'md',
  fullWidth = true,
  icon = null,
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState(null);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const selected = normalizedOptions.find((option) => option.value === value);

  function updatePlacement() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const estimatedHeight = Math.min(MENU_MAX_HEIGHT, normalizedOptions.length * OPTION_HEIGHT + 12);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_PADDING;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_PADDING;
    const openUp = spaceBelow < Math.min(estimatedHeight, 180) && spaceAbove > spaceBelow;
    const availableHeight = Math.max(MENU_MIN_HEIGHT, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
    const renderedHeight = Math.min(estimatedHeight, availableHeight);
    const width = Math.min(rect.width, window.innerWidth - VIEWPORT_PADDING * 2);
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, rect.left),
      Math.max(VIEWPORT_PADDING, window.innerWidth - VIEWPORT_PADDING - width)
    );

    setPlacement({
      left,
      top: openUp ? Math.max(VIEWPORT_PADDING, rect.top - MENU_GAP - renderedHeight) : Math.min(window.innerHeight - VIEWPORT_PADDING - renderedHeight, rect.bottom + MENU_GAP),
      width,
      maxHeight: availableHeight,
      openUp
    });
  }

  useEffect(() => {
    if (!open) return;

    updatePlacement();

    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    function syncPosition() {
      updatePlacement();
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [open, normalizedOptions.length]);

  function selectOption(nextValue) {
    onChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div className={`ui-select-field ${fullWidth ? 'full' : ''} ${className}`} ref={containerRef}>
      {label && <span className="ui-select-label">{label}</span>}
      <button
        ref={triggerRef}
        className={`ui-select-trigger ${size} ${open ? 'open' : ''} ${error ? 'invalid' : ''}`}
        type="button"
        onClick={() => {
          if (disabled) return;
          updatePlacement();
          setOpen((current) => !current);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="ui-select-value">
          {selected?.icon || icon ? <span className="ui-select-icon">{selected?.icon || icon}</span> : null}
          <span>{selected?.label || placeholder}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
          <ChevronDown size={15} />
        </motion.span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && placement && (
            <motion.div
              ref={menuRef}
              className={`ui-select-menu ${size} ${placement.openUp ? 'open-up' : ''}`}
              style={{
                left: placement.left,
                top: placement.top,
                width: placement.width,
                maxHeight: placement.maxHeight
              }}
              initial={{ opacity: 0, y: placement.openUp ? 4 : -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: placement.openUp ? 4 : -4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              role="listbox"
            >
              {normalizedOptions.map((option) => (
                <button
                  key={option.value}
                  className={option.value === value ? 'active' : ''}
                  type="button"
                  onClick={() => selectOption(option.value)}
                  role="option"
                  aria-selected={option.value === value}
                >
                  {option.icon && <span className="ui-select-icon">{option.icon}</span>}
                  <span>{option.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function normalizeOptions(options = []) {
  return options.map((option) => {
    if (typeof option === 'string') {
      return { value: option, label: option };
    }

    if (Array.isArray(option)) {
      return { value: option[0], label: option[1] };
    }

    return option;
  });
}
