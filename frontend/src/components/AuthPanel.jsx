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
  const [form, setForm] = useState({ name: '', userCode: '', email: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const title = useMemo(() => (isRegister ? '建立漂流身份' : '回到 Adrift'), [isRegister]);

  useEffect(() => {
    setTouched({});
    setSubmitted(false);
    setErrors({});
    setSuccessMessage('');
    onClearError?.();
  }, [mode]);

  function updateField(field, value) {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setSuccessMessage('');
    onClearError?.();
    onClearNotice?.();

    setErrors((current) => {
      const next = { ...current };
      const message = validateField(field, nextForm);

      if (!message) delete next[field];
      if (field === 'password' && !validateField('confirmPassword', nextForm)) delete next.confirmPassword;

      return next;
    });
  }

  function blurField(field) {
    setTouched((current) => ({ ...current, [field]: true }));
    const message = validateField(field);
    setErrors((current) => {
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function shouldShow(field) {
    return Boolean(errors[field] && (touched[field] || submitted));
  }

  function validateField(field, values = form) {
    const email = values.email.trim();
    const password = values.password;
    const userCode = values.userCode.trim();

    if (field === 'name' && isRegister) {
      if (!values.name.trim()) return '請輸入使用者名稱';
      if (values.name.trim().length < 2 || values.name.trim().length > 30) return '使用者名稱長度需為 2 到 30 字元';
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

  function validateForm() {
    const fields = isRegister ? ['name', 'userCode', 'email', 'password', 'confirmPassword'] : ['email', 'password'];
    const nextErrors = fields.reduce((result, field) => {
      const message = validateField(field);
      if (message) result[field] = message;
      return result;
    }, {});

    setErrors(nextErrors);
    setTouched(fields.reduce((result, field) => ({ ...result, [field]: true }), {}));
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitted(true);
    setSuccessMessage('');

    if (!validateForm()) return;

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
        setForm((current) => ({ ...current, password: '', confirmPassword: '' }));
      }
    } catch {
      // Parent renders API error.
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
            <motion.label initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              使用者名稱
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                onBlur={() => blurField('name')}
                placeholder="你的名字"
                aria-invalid={shouldShow('name')}
              />
              {shouldShow('name') && <span className="field-error">{errors.name}</span>}
            </motion.label>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {isRegister && (
            <motion.label initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              使用者 ID
              <input
                value={form.userCode}
                onChange={(event) => updateField('userCode', event.target.value)}
                onBlur={() => blurField('userCode')}
                placeholder="arren_123"
                aria-invalid={shouldShow('userCode')}
              />
              <small className="field-hint">這是你的公開好友搜尋 ID，建立後可讓朋友用它找到你。</small>
              {shouldShow('userCode') && <span className="field-error">{errors.userCode}</span>}
            </motion.label>
          )}
        </AnimatePresence>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            onBlur={() => blurField('email')}
            placeholder="you@example.com"
            aria-invalid={shouldShow('email')}
          />
          {shouldShow('email') && <span className="field-error">{errors.email}</span>}
        </label>

        <label>
          密碼
          <span className="password-control">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              onBlur={() => blurField('password')}
              placeholder={isRegister ? '至少 6 個字元' : '請輸入密碼'}
              aria-invalid={shouldShow('password')}
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label="切換密碼顯示">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
          {shouldShow('password') && <span className="field-error">{errors.password}</span>}
        </label>

        <AnimatePresence mode="popLayout">
          {isRegister && (
            <motion.label initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              確認密碼
              <span className="password-control">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(event) => updateField('confirmPassword', event.target.value)}
                  onBlur={() => blurField('confirmPassword')}
                  placeholder="再次輸入密碼"
                  aria-invalid={shouldShow('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label="切換確認密碼顯示"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
              {shouldShow('confirmPassword') && <span className="field-error">{errors.confirmPassword}</span>}
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
