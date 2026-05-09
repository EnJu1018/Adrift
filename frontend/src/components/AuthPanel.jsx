import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Eye, EyeOff, LogIn, MapPinned, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EMAIL_PATTERN, USER_CODE_PATTERN } from '../constants/app.js';

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

  const pageCopy = isRegister
    ? {
        eyebrow: 'Adrift',
        title: 'Begin your drift with the first page.',
        body: '開啟第一篇日記，成為漂流的起點。',
        cardTitle: '建立帳號',
        cardSubtitle: '開始記錄你的地圖日記',
        submit: '註冊帳號',
        loading: '註冊中...',
        switchText: '已經有帳號？',
        switchAction: '返回登入',
        switchPath: '/login'
      }
    : {
        eyebrow: 'Adrift',
        title: 'A quiet place for memories left along the way.',
        body: '一個安放旅途中留下回憶的安靜角落。',
        cardTitle: '歡迎回來',
        cardSubtitle: '登入你的 Adrift 帳號',
        submit: '登入',
        loading: '登入中...',
        switchText: '還沒有帳號？',
        switchAction: '開啟漂流之旅',
        switchPath: '/register'
      };

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
      const name = values.name.trim();
      if (!name) return '請輸入使用者名稱';
      if (name.length < 2 || name.length > 30) return '使用者名稱長度需為 2 到 30 字元';
    }

    if (field === 'userCode' && isRegister) {
      if (!userCode) return '請輸入使用者 ID';
      if (!USER_CODE_PATTERN.test(userCode)) return '使用者 ID 只能包含英文、數字、底線、減號，長度需為 4 到 20 字元';
    }

    if (field === 'email') {
      if (!email) return '請輸入 Email';
      if (!EMAIL_PATTERN.test(email)) return 'Email 格式不正確';
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
      // Parent renders API errors inside this card.
    }
  }

  const visibleMessage = error || successMessage || notice;

  return (
    <motion.section
      className="auth-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <AuthBrand copy={pageCopy} isRegister={isRegister} />

      <motion.aside
        className="auth-card glass"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-card-header">
          <div>
            <p className="eyebrow">{isRegister ? 'Register' : 'Login'}</p>
            <h1>{pageCopy.cardTitle}</h1>
            <p>{pageCopy.cardSubtitle}</p>
          </div>
        </div>

        <form className="auth-form new-auth-form" onSubmit={submit} noValidate>
          <AnimatePresence mode="popLayout">
            {isRegister && (
              <motion.div className="auth-field-stack" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <AuthInput
                  label="使用者名稱"
                  value={form.name}
                  onChange={(value) => updateField('name', value)}
                  onBlur={() => blurField('name')}
                  placeholder="你的名字"
                  invalid={shouldShow('name')}
                  error={errors.name}
                />
                <AuthInput
                  label="使用者 ID"
                  value={form.userCode}
                  onChange={(value) => updateField('userCode', value)}
                  onBlur={() => blurField('userCode')}
                  placeholder="arren_123"
                  invalid={shouldShow('userCode')}
                  error={errors.userCode}
                  hint="這是你的公開好友搜尋 ID，朋友可以用它找到你。"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AuthInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => updateField('email', value)}
            onBlur={() => blurField('email')}
            placeholder="you@example.com"
            invalid={shouldShow('email')}
            error={errors.email}
          />

          <PasswordInput
            label="密碼"
            value={form.password}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
            onChange={(value) => updateField('password', value)}
            onBlur={() => blurField('password')}
            placeholder={isRegister ? '至少 6 個字元' : '請輸入密碼'}
            invalid={shouldShow('password')}
            error={errors.password}
          />

          <AnimatePresence mode="popLayout">
            {isRegister && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <PasswordInput
                  label="確認密碼"
                  value={form.confirmPassword}
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((current) => !current)}
                  onChange={(value) => updateField('confirmPassword', value)}
                  onBlur={() => blurField('confirmPassword')}
                  placeholder="再次輸入密碼"
                  invalid={shouldShow('confirmPassword')}
                  error={errors.confirmPassword}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <button className="primary-button auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="button-spinner dark" /> : isRegister ? <UserPlus size={17} /> : <LogIn size={17} />}
            {loading ? pageCopy.loading : pageCopy.submit}
          </button>

          <AnimatePresence mode="popLayout">
            {visibleMessage && (
              <motion.p
                className={error ? 'auth-inline-message error' : 'auth-inline-message success'}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                {visibleMessage}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="auth-switch">
            {pageCopy.switchText}
            <button type="button" onClick={() => onNavigate(pageCopy.switchPath)}>
              {pageCopy.switchAction}
            </button>
          </p>
        </form>
      </motion.aside>
    </motion.section>
  );
}

function AuthBrand({ copy, isRegister }) {
  return (
    <motion.section
      className="auth-brand-panel"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.62, ease: 'easeOut' }}
    >
      <div className="auth-floating-light one" />
      <div className="auth-floating-light two" />
      <div className="auth-floating-light three" />

      <h1>{isRegister ? 'Start drifting.' : 'Adrift'}</h1>
      <p className="auth-brand-english">{copy.title}</p>
      <p className="auth-brand-body">{copy.body}</p>

      <div className="auth-brand-note glass">
        <MapPinned size={18} />
        <span>Memory, mood, place, and people. All in one quiet map.</span>
      </div>

    </motion.section>
  );
}

function AuthInput({ label, type = 'text', value, onChange, onBlur, placeholder, invalid, error, hint }) {
  return (
    <label className="auth-input">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={invalid}
      />
      {hint && <small className="field-hint">{hint}</small>}
      {invalid && <span className="field-error">{error}</span>}
    </label>
  );
}

function PasswordInput({ label, value, visible, onToggle, onChange, onBlur, placeholder, invalid, error }) {
  return (
    <label className="auth-input">
      {label}
      <span className="password-control">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-invalid={invalid}
        />
        <button type="button" onClick={onToggle} aria-label="切換密碼顯示">
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
      {invalid && <span className="field-error">{error}</span>}
    </label>
  );
}
