import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dropdownMotion, dropdownTransition } from '../../constants/animations.js';

const MENU_GAP = 8;
const MENU_MAX_HEIGHT = 240;
const VIEWPORT_PADDING = 12;
const OPTION_HEIGHT = 44;

export default function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled = false,
  busy = false,
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
  const menuId = useId();
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const selected = normalizedOptions.find((option) => option.value === value);

  useEffect(() => {
    if (disabled || busy) setOpen(false);
  }, [disabled, busy]);

  function updatePlacement() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const estimatedHeight = Math.min(MENU_MAX_HEIGHT, normalizedOptions.length * OPTION_HEIGHT + 12);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_PADDING;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_PADDING;
    const openUp = spaceBelow < Math.min(estimatedHeight, 180) && spaceAbove > spaceBelow;
    const availableHeight = Math.max(OPTION_HEIGHT, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
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
    if (!open) {
      if (menuRef.current) menuRef.current.inert = true;
      return;
    }

    updatePlacement();
    if (menuRef.current) {
      menuRef.current.inert = false;
      const selectedItem = menuRef.current.querySelector('button[aria-selected="true"]:not(:disabled)');
      (selectedItem || menuRef.current.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
    }

    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function syncPosition() {
      updatePlacement();
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [open, normalizedOptions.length]);

  function selectOption(nextValue) {
    if (disabled || busy) return;
    onChange?.(nextValue);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function handleKey(event) {
    if (disabled || busy) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    } else if (event.key === 'Tab' && open) {
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { updatePlacement(); setOpen(true); return; }
      const items = [...menuRef.current.querySelectorAll('button:not(:disabled)')];
      if (!items.length) return;
      const current = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus({ preventScroll: true });
      items[next].scrollIntoView({ block: 'nearest' });
    }
  }

  return (
    <div className={`ui-select-field ${fullWidth ? 'full' : ''} ${className}`} ref={containerRef} onKeyDown={handleKey}>
      {label && <span className="ui-select-label">{label}</span>}
      <button
        ref={triggerRef}
        className={`ui-select-trigger motion-soft-press ${size} ${open ? 'open' : ''} ${error ? 'invalid' : ''}`}
        type="button"
        onClick={() => {
          if (disabled || busy) return;
          updatePlacement();
          setOpen((current) => !current);
        }}
        disabled={disabled}
        aria-disabled={disabled || busy}
        aria-busy={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label || placeholder}
      >
        <span className="ui-select-value">
          {selected?.icon || icon ? <span className="ui-select-icon">{selected?.icon || icon}</span> : null}
          <span>{selected?.label || placeholder}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={dropdownTransition}>
          <ChevronDown size={15} />
        </motion.span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && placement && (
            <motion.div
              ref={menuRef}
              id={menuId}
              className={`ui-select-menu ${size} ${placement.openUp ? 'open-up' : ''}`}
              style={{
                left: placement.left,
                top: placement.top,
                width: placement.width,
                maxHeight: placement.maxHeight
              }}
              {...dropdownMotion(placement.openUp)}
              role="listbox"
              aria-label={label || placeholder}
            >
              {normalizedOptions.map((option) => (
                <button
                  key={option.value}
                  className={`motion-soft-press ${option.value === value ? 'active' : ''}`}
                  type="button"
                  onClick={() => selectOption(option.value)}
                  role="option"
                  tabIndex={-1}
                  disabled={option.disabled}
                  aria-selected={option.value === value}
                >
                  {option.icon && <span className="ui-select-icon">{option.icon}</span>}
                  <span>{option.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        triggerRef.current?.closest('dialog') || document.body
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
