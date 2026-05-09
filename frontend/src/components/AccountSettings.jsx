import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Trash2,
  UserRound
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EMAIL_PATTERN } from '../constants/app.js';

const passwordVisibility = {
  emailPassword: false,
  currentPassword: false,
  newPassword: false,
  confirmPassword: false,
  deletePassword: false
};

export default function AccountSettings({ user, onBack, onUpdateName, onUpdateEmail, onUpdatePassword, onDeleteAccount }) {
  const [activeSection, setActiveSection] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [emailForm, setEmailForm] = useState({ email: user?.email || '', password: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmText: '' });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [loadingAction, setLoadingAction] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState(passwordVisibility);

  const joinedAt = useMemo(() => {
    if (!user?.createdAt) return '尚未同步';
    return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(
      new Date(user.createdAt)
    );
  }, [user?.createdAt]);

  useEffect(() => {
    setName(user?.name || '');
    setEmailForm((current) => ({ ...current, email: user?.email || '' }));
  }, [user?.name, user?.email]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  function toggleSection(section) {
    setActiveSection((current) => (current === section ? '' : section));
    setMessage('');
  }

  function showMessage(text, type = 'success', shouldCollapse = true) {
    setMessage(text);
    setMessageType(type);
    if (type === 'success' && shouldCollapse) {
      window.setTimeout(() => setActiveSection(''), 420);
    }
  }

  async function copyUserCode() {
    if (!user?.userCode) return;

    try {
      await navigator.clipboard.writeText(user.userCode);
      showMessage('已複製使用者 ID', 'success', false);
    } catch {
      showMessage('無法複製使用者 ID', 'error', false);
    }
  }

  function updateError(field, value) {
    setErrors((current) => {
      const next = { ...current };
      if (value) next[field] = value;
      else delete next[field];
      return next;
    });
  }

  function applyErrors(nextErrors) {
    setErrors((current) => {
      const next = { ...current };
      Object.entries(nextErrors).forEach(([field, value]) => {
        if (value) next[field] = value;
        else delete next[field];
      });
      return next;
    });
    return Object.values(nextErrors).every((value) => !value);
  }

  function shouldShow(field, group) {
    return Boolean(errors[field] && (touched[field] || submitted[group]));
  }

  function markBlur(field, validator) {
    setTouched((current) => ({ ...current, [field]: true }));
    updateError(field, validator());
  }

  function togglePassword(field) {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  }

  function validateName(value = name) {
    const trimmed = value.trim();
    if (!trimmed) return '使用者名稱不可為空';
    if (trimmed.length < 2 || trimmed.length > 30) return '使用者名稱長度需為 2 到 30 字元';
    return '';
  }

  function validateEmail(value = emailForm.email) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return '請輸入 Email';
    if (!EMAIL_PATTERN.test(trimmed)) return 'Email 格式不正確';
    return '';
  }

  function validateRequiredPassword(value) {
    if (!value) return '請輸入目前密碼';
    return '';
  }

  function validateNewPassword(value = passwordForm.newPassword) {
    if (!value || value.length < 6) return '新密碼至少需要 6 個字元';
    return '';
  }

  function validateConfirmPassword(value = passwordForm.confirmPassword, nextPassword = passwordForm.newPassword) {
    if (value !== nextPassword) return '兩次輸入的新密碼不一致';
    return '';
  }

  function validateConfirmText(value = deleteForm.confirmText) {
    if (value !== 'DELETE') return '請輸入 DELETE 確認刪除帳號';
    return '';
  }

  async function submitName(event) {
    event.preventDefault();
    setSubmitted((current) => ({ ...current, name: true }));
    if (!applyErrors({ name: validateName() })) return;

    try {
      setLoadingAction('name');
      const payload = await onUpdateName(name.trim());
      showMessage(payload.message || '使用者名稱已更新');
    } catch (error) {
      showMessage(error.message || '更新名稱失敗', 'error', false);
    } finally {
      setLoadingAction('');
    }
  }

  async function submitEmail(event) {
    event.preventDefault();
    setSubmitted((current) => ({ ...current, email: true }));
    const nextErrors = {
      email: validateEmail(),
      emailPassword: validateRequiredPassword(emailForm.password)
    };
    if (!applyErrors(nextErrors)) return;

    try {
      setLoadingAction('email');
      const nextEmail = emailForm.email.trim().toLowerCase();
      const payload = await onUpdateEmail({ email: nextEmail, password: emailForm.password });
      setEmailForm({ email: nextEmail, password: '' });
      showMessage(payload.message || 'Email 已更新');
    } catch (error) {
      showMessage(error.message || '更新 Email 失敗', 'error', false);
    } finally {
      setLoadingAction('');
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    setSubmitted((current) => ({ ...current, password: true }));
    const nextErrors = {
      currentPassword: validateRequiredPassword(passwordForm.currentPassword),
      newPassword: validateNewPassword(),
      confirmPassword: validateConfirmPassword()
    };
    if (!applyErrors(nextErrors)) return;

    try {
      setLoadingAction('password');
      const payload = await onUpdatePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showMessage(payload.message || '密碼已更新');
    } catch (error) {
      showMessage(error.message || '更新密碼失敗', 'error', false);
    } finally {
      setLoadingAction('');
    }
  }

  async function submitDelete(event) {
    event.preventDefault();
    setSubmitted((current) => ({ ...current, delete: true }));
    const nextErrors = {
      deletePassword: validateRequiredPassword(deleteForm.password),
      confirmText: validateConfirmText()
    };
    if (!applyErrors(nextErrors)) return;

    try {
      setLoadingAction('delete');
      await onDeleteAccount(deleteForm);
    } catch (error) {
      showMessage(error.message || '刪除帳號失敗', 'error', false);
      setLoadingAction('');
    }
  }

  return (
    <motion.aside
      className="settings-panel glass"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.42, ease: 'easeOut' }}
    >
      <header className="settings-header">
        <div>
          <p className="eyebrow">Account Settings</p>
          <h2>帳號設定</h2>
        </div>
        <button className="chip-button" onClick={onBack}>
          返回
        </button>
      </header>

      <AnimatePresence mode="popLayout">
        {message && (
          <motion.p
            className={`form-message ${messageType}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {messageType === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="settings-scroll">
        <section className="settings-static-section">
          <div className="section-title">
            <UserRound size={16} />
            <span>基本資料</span>
          </div>
          <div className="account-facts compact">
            <span>使用者名稱</span>
            <strong title={user?.name}>{user?.name || '尚未設定'}</strong>
            <span>使用者 ID</span>
            <span className="account-value-row">
              <strong>@{user?.userCode || '尚未設定'}</strong>
              <button className="copy-mini-button" type="button" onClick={copyUserCode} disabled={!user?.userCode}>
                <Copy size={13} />
                複製
              </button>
            </span>
            <span>Email</span>
            <strong title={user?.email}>{user?.email || '尚未設定'}</strong>
            <span>加入日期</span>
            <strong>{joinedAt}</strong>
          </div>
        </section>

        <AccordionSection
          id="name"
          icon={<UserRound size={16} />}
          title="修改名稱"
          activeSection={activeSection}
          onToggle={toggleSection}
        >
          <form className="settings-form" onSubmit={submitName} noValidate>
            <label>
              新名稱
              <input
                value={name}
                onChange={(event) => {
                  const value = event.target.value;
                  setName(value);
                  if (!validateName(value)) updateError('name', '');
                }}
                onBlur={() => markBlur('name', validateName)}
                aria-invalid={shouldShow('name', 'name')}
                placeholder="新的使用者名稱"
              />
              {shouldShow('name', 'name') && <span className="field-error">{errors.name}</span>}
            </label>
            <button className="primary-button" disabled={loadingAction === 'name'}>
              {loadingAction === 'name' && <span className="button-spinner dark" />}
              儲存
            </button>
          </form>
        </AccordionSection>

        <AccordionSection
          id="email"
          icon={<Mail size={16} />}
          title="修改 Email"
          activeSection={activeSection}
          onToggle={toggleSection}
        >
          <form className="settings-form" onSubmit={submitEmail} noValidate>
            <label>
              新 Email
              <input
                type="email"
                value={emailForm.email}
                onChange={(event) => {
                  const value = event.target.value;
                  setEmailForm((current) => ({ ...current, email: value }));
                  if (!validateEmail(value)) updateError('email', '');
                }}
                onBlur={() => markBlur('email', validateEmail)}
                aria-invalid={shouldShow('email', 'email')}
                placeholder="newemail@gmail.com"
              />
              {shouldShow('email', 'email') && <span className="field-error">{errors.email}</span>}
            </label>
            <label>
              目前密碼
              <PasswordInput
                visible={visiblePasswords.emailPassword}
                onToggle={() => togglePassword('emailPassword')}
                value={emailForm.password}
                onChange={(event) => {
                  setEmailForm((current) => ({ ...current, password: event.target.value }));
                  if (event.target.value) updateError('emailPassword', '');
                }}
                onBlur={() => markBlur('emailPassword', () => validateRequiredPassword(emailForm.password))}
                placeholder="目前密碼"
                invalid={shouldShow('emailPassword', 'email')}
              />
              {shouldShow('emailPassword', 'email') && <span className="field-error">{errors.emailPassword}</span>}
            </label>
            <button className="primary-button" disabled={loadingAction === 'email'}>
              {loadingAction === 'email' && <span className="button-spinner dark" />}
              更新 Email
            </button>
          </form>
        </AccordionSection>

        <AccordionSection
          id="password"
          icon={<Lock size={16} />}
          title="修改密碼"
          activeSection={activeSection}
          onToggle={toggleSection}
        >
          <form className="settings-form" onSubmit={submitPassword} noValidate>
            <label>
              目前密碼
              <PasswordInput
                visible={visiblePasswords.currentPassword}
                onToggle={() => togglePassword('currentPassword')}
                value={passwordForm.currentPassword}
                onChange={(event) => {
                  setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }));
                  if (event.target.value) updateError('currentPassword', '');
                }}
                onBlur={() => markBlur('currentPassword', () => validateRequiredPassword(passwordForm.currentPassword))}
                placeholder="目前密碼"
                invalid={shouldShow('currentPassword', 'password')}
              />
              {shouldShow('currentPassword', 'password') && <span className="field-error">{errors.currentPassword}</span>}
            </label>
            <label>
              新密碼
              <PasswordInput
                visible={visiblePasswords.newPassword}
                onToggle={() => togglePassword('newPassword')}
                value={passwordForm.newPassword}
                onChange={(event) => {
                  const value = event.target.value;
                  setPasswordForm((current) => ({ ...current, newPassword: value }));
                  if (!validateNewPassword(value)) updateError('newPassword', '');
                  if (!validateConfirmPassword(passwordForm.confirmPassword, value)) updateError('confirmPassword', '');
                }}
                onBlur={() => markBlur('newPassword', validateNewPassword)}
                placeholder="至少 6 個字元"
                invalid={shouldShow('newPassword', 'password')}
              />
              {shouldShow('newPassword', 'password') && <span className="field-error">{errors.newPassword}</span>}
            </label>
            <label>
              確認新密碼
              <PasswordInput
                visible={visiblePasswords.confirmPassword}
                onToggle={() => togglePassword('confirmPassword')}
                value={passwordForm.confirmPassword}
                onChange={(event) => {
                  const value = event.target.value;
                  setPasswordForm((current) => ({ ...current, confirmPassword: value }));
                  if (!validateConfirmPassword(value)) updateError('confirmPassword', '');
                }}
                onBlur={() => markBlur('confirmPassword', validateConfirmPassword)}
                placeholder="再次輸入新密碼"
                invalid={shouldShow('confirmPassword', 'password')}
              />
              {shouldShow('confirmPassword', 'password') && <span className="field-error">{errors.confirmPassword}</span>}
            </label>
            <button className="primary-button" disabled={loadingAction === 'password'}>
              {loadingAction === 'password' && <span className="button-spinner dark" />}
              更新密碼
            </button>
          </form>
        </AccordionSection>

        <AccordionSection
          id="delete"
          icon={<Trash2 size={16} />}
          title="危險區域"
          danger
          activeSection={activeSection}
          onToggle={toggleSection}
        >
          <form className="settings-form" onSubmit={submitDelete} noValidate>
            <label>
              目前密碼
              <PasswordInput
                visible={visiblePasswords.deletePassword}
                onToggle={() => togglePassword('deletePassword')}
                value={deleteForm.password}
                onChange={(event) => {
                  setDeleteForm((current) => ({ ...current, password: event.target.value }));
                  if (event.target.value) updateError('deletePassword', '');
                }}
                onBlur={() => markBlur('deletePassword', () => validateRequiredPassword(deleteForm.password))}
                placeholder="目前密碼"
                invalid={shouldShow('deletePassword', 'delete')}
              />
              {shouldShow('deletePassword', 'delete') && <span className="field-error">{errors.deletePassword}</span>}
            </label>
            <label>
              輸入 DELETE
              <input
                value={deleteForm.confirmText}
                onChange={(event) => {
                  const value = event.target.value;
                  setDeleteForm((current) => ({ ...current, confirmText: value }));
                  if (!validateConfirmText(value)) updateError('confirmText', '');
                }}
                onBlur={() => markBlur('confirmText', validateConfirmText)}
                aria-invalid={shouldShow('confirmText', 'delete')}
                placeholder="DELETE"
              />
              {shouldShow('confirmText', 'delete') && <span className="field-error">{errors.confirmText}</span>}
            </label>
            <button className="danger-button" disabled={loadingAction === 'delete'}>
              {loadingAction === 'delete' && <span className="button-spinner" />}
              刪除帳號
            </button>
          </form>
        </AccordionSection>
      </div>
    </motion.aside>
  );
}

function PasswordInput({ visible, onToggle, value, onChange, onBlur, placeholder, invalid }) {
  return (
    <span className="password-control">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={invalid}
      />
      <button type="button" onClick={onToggle} aria-label="??????">
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </span>
  );
}

function AccordionSection({ id, icon, title, danger = false, activeSection, onToggle, children }) {
  const open = activeSection === id;

  return (
    <section className={`settings-section ${open ? 'open' : ''} ${danger ? 'danger-zone' : ''}`}>
      <button className="settings-section-header" type="button" onClick={() => onToggle(id)} aria-expanded={open}>
        <span className="section-title">
          {icon}
          <span>{title}</span>
        </span>
        <motion.span
          className="settings-chevron"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <ChevronRight size={17} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={id}
            className="settings-section-body"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <div className="settings-section-content">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
