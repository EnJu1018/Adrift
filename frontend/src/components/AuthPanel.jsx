import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Compass, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const emailPattern = /^\S+@\S+\.\S+$/;
const userCodePattern = /^[a-zA-Z0-9_-]{4,20}$/;

export default function AuthPanel({
  mode,
  onAuth,
  onNavigate,
  onClearError,
  onClearNotice,
  onRegisterSuccess,
  loading,
  error,
  notice
}) {
  const isRegister = mode === 'register';
  const [form, setForm] = useState({
    name: '',
    userCode: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const title = useMemo(() => (isRegister ? '建立漂流身份' : '回到 Adrift'), [isRegister]);

  useEffect(() => {
    setFieldErrors({});
    setSuccessMessage('');
    onClearError?.();
  }, [mode]);

  function updateField(field, value) {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setFieldErrors((current) => {
      const nextErrors = { ...current, [field]: validateField(field, nextForm) };

      if (field === 'password' && isRegister) {
        nextErrors.confirmPassword = validateField('confirmPassword', nextForm);
      }

      Object.keys(nextErrors).forEach((key) => {
        if (!nextErrors[key]) {
          delete nextErrors[key];
        }
      });

      return nextErrors;
    });
    setSuccessMessage('');
    onClearError?.();
    onClearNotice?.();
  }

  function validateField(field, values = form) {
    const email = values.email.trim();
    const password = values.password;
    const userCode = values.userCode.trim();

    if (field === 'name' && isRegister && !values.name.trim()) {
      return '請輸入使用者名稱';
    }

    if (field === 'userCode' && isRegister) {
      if (!userCode) return '請輸入使用者 ID';
      if (!userCodePattern.test(userCode)) return '使用者 ID 只能包含英文、數字、底線、減號，長度需為 4 到 20 字元';
    }

    if (field === 'email') {
      if (!email) return '請輸入 Email';
      if (!emailPattern.test(email)) return 'Email 格式不正確';
    }

    if (field === 'password') {
      if (!password) return '請輸入密碼';
      if (isRegister && password.length < 6) return '密碼至少需要 6 個字元';
    }

    if (field === 'confirmPassword' && isRegister && values.confirmPassword !== password) {
      return '兩次輸入的密碼不一致';
    }

    return '';
  }

  function validate() {
    const fields = isRegister ? ['name', 'userCode', 'email', 'password', 'confirmPassword'] : ['email', 'password'];
    const errors = fields.reduce((result, field) => {
      const message = validateField(field);
      if (message) result[field] = message;
      return result;
    }, {});

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    setSuccessMessage('');

    if (!validate()) return;

    try {
      const payload = await onAuth(mode, {
        name: form.name.trim(),
        userCode: form.userCode.trim(),
        email: form.email.trim(),
        password: form.password
      });

      if (isRegister && payload?.success) {
        const message = payload.message || '註冊成功，請登入';
        setSuccessMessage(message);
        onRegisterSuccess?.(message);
        onNavigate('/login');
        setForm((current) => ({
          ...current,
          password: '',
          confirmPassword: ''
        }));
      }
    } catch {
      // Error is rendered from the parent state.
    }
  }

  const visibleMessage = error || successMessage || notice;

  return (
    <motion.aside
      className="auth-panel glass"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.28, ease: 'easeIn' } }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      <div className="brand-lockup">
        <span className="brand-mark">
          <Compass size={22} />
        </span>
        <div>
          <p className="eyebrow">Adrift</p>
          <h1>{title}</h1>
        </div>
      </div>

      <form className="auth-form" onSubmit={submit} noValidate>
        <AnimatePresence mode="popLayout">
          {visibleMessage && (
            <motion.p
              className={error ? 'form-message error' : 'form-message success'}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              {visibleMessage}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {isRegister && (
            <motion.label
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              使用者名稱
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="你的名字"
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </motion.label>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {isRegister && (
            <motion.label
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              使用者 ID
              <input
                value={form.userCode}
                onChange={(event) => updateField('userCode', event.target.value)}
                placeholder="ID"
                aria-invalid={Boolean(fieldErrors.userCode)}
              />
              <small className="field-hint">建立後無法更改</small>
              {fieldErrors.userCode && <span className="field-error">{fieldErrors.userCode}</span>}
            </motion.label>
          )}
        </AnimatePresence>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>

        <label>
          密碼
          <span className="password-control">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder={isRegister ? '至少 6 個字元' : '請輸入密碼'}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label="切換密碼顯示">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>

        <AnimatePresence mode="popLayout">
          {isRegister && (
            <motion.label
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              確認密碼
              <span className="password-control">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(event) => updateField('confirmPassword', event.target.value)}
                  placeholder="再次輸入密碼"
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label="切換確認密碼顯示"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
              {fieldErrors.confirmPassword && <span className="field-error">{fieldErrors.confirmPassword}</span>}
            </motion.label>
          )}
        </AnimatePresence>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? <span className="button-spinner dark" /> : isRegister ? <UserPlus size={17} /> : <LogIn size={17} />}
          {loading ? '驗證中...' : isRegister ? '註冊帳號' : '登入'}
        </button>

        <p className="auth-switch">
          {isRegister ? '已經有帳號？' : '還沒有帳號？'}
          <button type="button" onClick={() => onNavigate(isRegister ? '/login' : '/register')}>
            {isRegister ? '返回登入' : '註冊帳號'}
          </button>
        </p>
      </form>
    </motion.aside>
  );
}
