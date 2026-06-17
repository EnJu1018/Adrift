import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toastMotion } from '../constants/animations.js';

const icons = {
  success: <CheckCircle2 size={17} />,
  error: <XCircle size={17} />,
  warning: <AlertTriangle size={17} />,
  info: <Info size={17} />
};

export default function ToastViewport({ toast, onDismiss, className = '' }) {
  if (typeof document === 'undefined') return null;

  const type = toast?.type || 'info';
  const isError = type === 'error';

  return createPortal(
    <div className={`toast-viewport ${className}`.trim()} aria-live={isError ? 'assertive' : 'polite'}>
      <AnimatePresence>
        {toast?.message && (
          <motion.div
            key={toast.id || toast.message}
            className={`app-toast ${type}`}
            role={isError ? 'alert' : 'status'}
            {...toastMotion}
          >
            <span className="app-toast-icon">{icons[type] || icons.info}</span>
            <p>{toast.message}</p>
            <button type="button" onClick={onDismiss} aria-label="關閉提示">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
