import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LogIn,
  Mail,
  UserPlus
} from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { motionTokens } from '../constants/animations.js';
import { EMAIL_PATTERN, USER_CODE_PATTERN } from '../constants/app.js';
import ButtonFeedback from './ui/ButtonFeedback.jsx';

const STEP = {
  EMAIL: 'email',
  LOGIN_PASSWORD: 'loginPassword',
  REGISTER_PROFILE: 'registerProfile',
  REGISTER_PASSWORD: 'registerPassword'
};

export default function AuthPanel({ onAuth, onClearError, onClearNotice, loading, error, notice }) {
  const [step, setStep] = useState(STEP.EMAIL);
  const [direction, setDirection] = useState(1);
  const formRef = useRef(null);
  const requestPending = useRef(false);
  const requestVersion = useRef(0);
  const composing = useRef(false);
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState({ name: '', userCode: '', email: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [stepError, setStepError] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const visibleMessage = stepError || error || (step === STEP.EMAIL ? notice : '');

  useEffect(() => () => { requestVersion.current++; }, []);

  function validateField(field, values = form) {
    const email = values.email.trim();
    const name = values.name.trim();
    const userCode = values.userCode.trim();

    if (field === 'email') {
      if (!email) return '請輸入 Email';
      if (!EMAIL_PATTERN.test(email)) return 'Email 格式不正確';
    }

    if (field === 'name') {
      if (!name) return '請輸入使用者名稱';
      if (name.length < 2 || name.length > 30) return '使用者名稱長度需為 2 到 30 字元';
    }

    if (field === 'userCode') {
      if (!userCode) return '請輸入使用者 ID';
      if (!USER_CODE_PATTERN.test(userCode)) return '使用者 ID 需為 4 到 20 個英文、數字、底線或減號';
    }

    if (field === 'password') {
      if (!values.password) return '請輸入密碼';
      if (mode === 'register' && values.password.length < 8) return '密碼至少需要 8 個字元';
    }

    if (field === 'confirmPassword') {
      if (!values.confirmPassword) return '請再次輸入密碼';
      if (values.confirmPassword !== values.password) return '兩次輸入的密碼不一致';
    }

    return '';
  }

  function updateField(field, value) {
    if (field === 'email') {
      requestVersion.current++;
      requestPending.current = false;
      setIsCheckingEmail(false);
    }
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setStepError('');
    onClearError?.();
    onClearNotice?.();

    if (field === 'email' && mode) {
      setMode(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setForm({ ...nextForm, password: '', confirmPassword: '' });
    }

    if (touched[field] || submitted) {
      setErrors((current) => ({ ...current, [field]: validateField(field, nextForm) }));
    }
  }

  function blurField(field) {
    if (!submitted && !touched[field]) return;
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateField(field) }));
  }

  function validateFields(fields) {
    const nextErrors = Object.fromEntries(fields.map((field) => [field, validateField(field)]).filter(([, message]) => message));
    setErrors(nextErrors);
    setTouched((current) => ({ ...current, ...Object.fromEntries(fields.map((field) => [field, true])) }));
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) formRef.current?.elements.namedItem(firstInvalid)?.focus();
    return Object.keys(nextErrors).length === 0;
  }

  function moveTo(nextStep, nextDirection = 1) {
    setDirection(nextDirection);
    setStep(nextStep);
    setSubmitted(false);
    setErrors({});
    setStepError('');
    onClearError?.();
  }

  async function submit(event) {
    event.preventDefault();
    if (composing.current || loading || requestPending.current) return;
    setSubmitted(true);
    setStepError('');
    onClearError?.();

    if (step === STEP.EMAIL) {
      if (!validateFields(['email'])) return;

      const email = form.email.trim().toLowerCase();
      setForm((current) => ({ ...current, email }));
      setIsCheckingEmail(true);
      requestPending.current = true;
      const version = ++requestVersion.current;

      try {
        const payload = await api.checkEmail(email);
        if (version !== requestVersion.current) return;
        const nextMode = payload.exists ? 'login' : 'register';
        setMode(nextMode);
        moveTo(nextMode === 'login' ? STEP.LOGIN_PASSWORD : STEP.REGISTER_PROFILE);
      } catch (requestError) {
        if (version === requestVersion.current) setStepError(requestError.message || '無法確認 Email，請稍後再試');
      } finally {
        if (version === requestVersion.current) {
          requestPending.current = false;
          setIsCheckingEmail(false);
        }
      }
      return;
    }

    if (step === STEP.REGISTER_PROFILE) {
      if (validateFields(['name', 'userCode'])) moveTo(STEP.REGISTER_PASSWORD);
      return;
    }

    const fields = step === STEP.REGISTER_PASSWORD ? ['password', 'confirmPassword'] : ['password'];
    if (!validateFields(fields)) return;

    try {
      requestPending.current = true;
      await onAuth(mode, {
        name: form.name.trim(),
        userCode: form.userCode.trim().toLowerCase(),
        email: form.email,
        password: form.password
      });
    } catch (requestError) {
      if (mode === 'register' && requestError.message?.includes('使用者 ID')) {
        moveTo(STEP.REGISTER_PROFILE, -1);
        setTouched({ userCode: true });
        setErrors({ userCode: requestError.message });
      } else {
        setStepError(requestError.message || '暫時無法完成，請稍後再試');
      }
    } finally {
      requestPending.current = false;
    }
  }

  function goBack() {
    if (loading || requestPending.current) return;
    moveTo(step === STEP.REGISTER_PASSWORD ? STEP.REGISTER_PROFILE : STEP.EMAIL, -1);
  }

  const copy = getStepCopy(step);

  return (
    <section className="auth-page">
      <AuthBrand />

      <aside className="auth-card">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
        <AuthStep key={step} direction={direction}>
        <div className="auth-card-header">
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        <div className="auth-account-slot">
        {step !== STEP.EMAIL && (
          <div className="auth-selected-email">
            <Mail size={16} />
            <span>{form.email}</span>
          </div>
        )}
        </div>

        <form ref={formRef} className="auth-form new-auth-form" onSubmit={submit} noValidate aria-busy={loading || isCheckingEmail}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={event => {
            if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
          }}>
            <div className="auth-step-fields">
              {step === STEP.EMAIL && (
                <AuthInput label="Email" type="email" value={form.email} onChange={(value) => updateField('email', value)} onBlur={() => blurField('email')} placeholder="you@example.com" invalid={Boolean(errors.email && (touched.email || submitted))} error={errors.email} autoComplete="email" autoFocus />
              )}

              {step === STEP.LOGIN_PASSWORD && (
                <PasswordInput label="密碼" value={form.password} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} onChange={(value) => updateField('password', value)} onBlur={() => blurField('password')} placeholder="請輸入密碼" invalid={Boolean(errors.password && (touched.password || submitted))} error={errors.password} autoComplete="current-password" autoFocus />
              )}

              {step === STEP.REGISTER_PROFILE && (
                <>
                  <AuthInput label="使用者名稱" value={form.name} onChange={(value) => updateField('name', value)} onBlur={() => blurField('name')} placeholder="你的名字" invalid={Boolean(errors.name && (touched.name || submitted))} error={errors.name} autoComplete="name" autoFocus />
                  <AuthInput label="使用者 ID" value={form.userCode} onChange={(value) => updateField('userCode', value)} onBlur={() => blurField('userCode')} placeholder="arren_123" invalid={Boolean(errors.userCode && (touched.userCode || submitted))} error={errors.userCode} hint="朋友可以用這組 ID 找到你。" autoComplete="username" />
                </>
              )}

              {step === STEP.REGISTER_PASSWORD && (
                <>
                  <PasswordInput label="密碼" value={form.password} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} onChange={(value) => updateField('password', value)} onBlur={() => blurField('password')} placeholder="至少 8 個字元" invalid={Boolean(errors.password && (touched.password || submitted))} error={errors.password} autoComplete="new-password" autoFocus />
                  <PasswordInput label="確認密碼" value={form.confirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} onChange={(value) => updateField('confirmPassword', value)} onBlur={() => blurField('confirmPassword')} placeholder="再次輸入密碼" invalid={Boolean(errors.confirmPassword && (touched.confirmPassword || submitted))} error={errors.confirmPassword} autoComplete="new-password" />
                </>
              )}
            </div>

          <div className="auth-actions">
            {step !== STEP.EMAIL && (
              <button className="auth-back-button motion-soft-press" type="button" onClick={goBack} disabled={loading}>
                <ArrowLeft size={16} />
                返回
              </button>
            )}
            <button className="primary-button auth-submit motion-soft-press" type="submit" disabled={loading || isCheckingEmail}>
              <ButtonFeedback busy={loading || isCheckingEmail} label={copy.action} busyLabel={isCheckingEmail ? '確認中...' : copy.loading}
                icon={step === STEP.LOGIN_PASSWORD ? <LogIn size={17} /> : step === STEP.REGISTER_PASSWORD ? <UserPlus size={17} /> : <ArrowRight size={17} />} />
            </button>
          </div>

            <div className="auth-message-slot">
            {visibleMessage && (
              <p className={`auth-inline-message ${stepError || error ? 'error' : 'success'}`} role={stepError || error ? 'alert' : 'status'}>
                {stepError || error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                {visibleMessage}
              </p>
            )}
            </div>
        </form>
        </AuthStep>
        </AnimatePresence>
      </aside>
    </section>
  );
}

function getStepCopy(step) {
  if (step === STEP.LOGIN_PASSWORD) return { title: '歡迎回來', subtitle: '輸入密碼，回到你的城市記憶。', action: '登入', loading: '登入中...' };
  if (step === STEP.REGISTER_PROFILE) return { title: '建立帳號', subtitle: '先讓 Adrift 認識你。', action: '下一步', loading: '處理中...' };
  if (step === STEP.REGISTER_PASSWORD) return { title: '設定密碼', subtitle: '完成最後一步，開始留下第一個足跡。', action: '建立帳號', loading: '建立中...' };
  return { title: '歡迎來到 Adrift', subtitle: '輸入 Email，繼續你的漂流足跡。', action: '下一步', loading: '確認中...' };
}

function AuthBrand() {
  return (
    <section className="auth-brand-panel">
      <p className="eyebrow">Adrift 漂流足跡</p>
      <h2>把生活，<br /><span className="auth-brand-line">留在發生的地方。</span></h2>
      <p className="auth-brand-body">在地圖上記錄地點、心情與故事，讓每段生活軌跡慢慢成為自己的城市記憶。</p>
    </section>
  );
}

function AuthStep({ children, direction }) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  const root = useRef(null);
  useLayoutEffect(() => {
    root.current?.querySelector('[data-auth-focus]')?.focus({ preventScroll: true });
  }, []);
  return <motion.div ref={root} className="auth-step" inert={!present ? true : undefined}
    custom={direction} initial={reduced ? false : 'enter'} animate="active" exit="exit"
    variants={{
      enter: direction => ({ opacity: 0, x: reduced ? 0 : direction * motionTokens.distance.base }),
      active: { opacity: 1, x: 0 },
      exit: direction => ({ opacity: 0, x: reduced ? 0 : -direction * motionTokens.distance.base,
        transition: { duration: reduced ? 0 : motionTokens.duration.quick } })
    }} transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease: motionTokens.ease.softOut }}>
    {children}
  </motion.div>;
}

function AuthInput({ label, type = 'text', value, onChange, onBlur, placeholder, invalid, error, hint, autoComplete, autoFocus }) {
  const id = useId();
  const name = type === 'email' ? 'email' : autoComplete === 'name' ? 'name' : 'userCode';
  return (
    <label className="auth-input">
      <span>{label}</span>
      <input name={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} aria-invalid={invalid} aria-describedby={invalid || hint ? `${id}-message` : undefined} autoComplete={autoComplete} data-auth-focus={autoFocus || undefined} />
      <span id={`${id}-message`} className="auth-validation" data-invalid={invalid} aria-live="polite">{invalid ? error : hint}</span>
    </label>
  );
}

function PasswordInput({ label, value, visible, onToggle, onChange, onBlur, placeholder, invalid, error, autoComplete, autoFocus }) {
  const id = useId();
  return (
    <label className="auth-input">
      <span>{label}</span>
      <span className="password-control">
        <input name={label === '確認密碼' ? 'confirmPassword' : 'password'} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} aria-invalid={invalid} aria-describedby={invalid ? `${id}-message` : undefined} autoComplete={autoComplete} data-auth-focus={autoFocus || undefined} />
        <button className="motion-soft-press" type="button" onClick={onToggle} aria-pressed={visible} aria-label={visible ? '隱藏密碼' : '顯示密碼'}>
          <span className="auth-password-icon" data-visible={visible} aria-hidden="true">
            <Eye size={17} /><EyeOff size={17} />
          </span>
        </button>
      </span>
      <span id={`${id}-message`} className="auth-validation" data-invalid={invalid} aria-live="polite">{invalid ? error : ''}</span>
    </label>
  );
}
