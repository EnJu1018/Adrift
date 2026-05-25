import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Trash2,
  Upload,
  UserRound,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { modalBackdropMotion, modalPopMotion, pageFadeUp } from '../constants/animations.js';
import { EMAIL_PATTERN } from '../constants/app.js';
import ToastViewport from './ToastViewport.jsx';
import UserAvatar from './UserAvatar.jsx';

const sections = [
  { id: 'profile', label: '個人資料', icon: UserRound },
  { id: 'avatar', label: '頭貼', icon: Camera },
  { id: 'security', label: '帳號安全', icon: Lock },
  { id: 'danger', label: '危險區域', icon: AlertTriangle }
];

const emptyPasswords = {
  emailPassword: false,
  currentPassword: false,
  newPassword: false,
  confirmPassword: false,
  deletePassword: false
};

const allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxAvatarBytes = 2 * 1024 * 1024;

export default function AccountSettings({
  user,
  onBack,
  onUpdateName,
  onUpdateEmail,
  onUpdatePassword,
  onUpdateAvatar,
  onDeleteAvatar,
  onDeleteAccount
}) {
  const [activeSection, setActiveSection] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [emailForm, setEmailForm] = useState({ email: user?.email || '', password: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmText: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [avatarMeta, setAvatarMeta] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [loadingAction, setLoadingAction] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState(emptyPasswords);
  const avatarInputRef = useRef(null);

  const joinedAt = useMemo(() => {
    if (!user?.createdAt) return '尚未同步';
    return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(
      new Date(user.createdAt)
    );
  }, [user?.createdAt]);

  const roleLabel = user?.role === 'owner' ? 'Owner' : user?.role === 'admin' ? 'Admin' : 'User';
  const nameDirty = name.trim() !== (user?.name || '');
  const emailDirty = emailForm.email.trim().toLowerCase() !== (user?.email || '');

  useEffect(() => {
    setName(user?.name || '');
    setEmailForm((current) => ({ ...current, email: user?.email || '' }));
  }, [user?.name, user?.email]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), toast.type === 'error' ? 3200 : 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function showToast(message, type = 'success') {
    setToast({ id: `${Date.now()}-${message}`, message, type });
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
    return value ? '' : '請輸入目前密碼';
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

  async function copyUserCode() {
    if (!user?.userCode) return;

    try {
      await navigator.clipboard.writeText(user.userCode);
      showToast('已複製使用者 ID');
    } catch {
      showToast('無法複製使用者 ID', 'error');
    }
  }

  async function validateAvatarFile(file) {
    if (!file) return '請選擇頭貼圖片';
    if (!allowedAvatarTypes.includes(file.type)) return '頭貼僅支援 JPG、PNG、WebP';
    if (file.size > maxAvatarBytes) return '頭貼檔案不可超過 2MB';

    const dimensions = await getImageDimensions(file);
    if (dimensions.width < 128 || dimensions.height < 128) {
      return '圖片尺寸太小，請上傳至少 128x128 的圖片';
    }

    return '';
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    setAvatarError('');

    if (!file) return;

    const error = await validateAvatarFile(file);
    if (error) {
      setAvatarFile(null);
      setAvatarMeta(null);
      setAvatarError(error);
      event.target.value = '';
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarMeta({
      name: file.name,
      size: formatFileSize(file.size)
    });
  }

  function clearAvatarDraft() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview('');
    setAvatarMeta(null);
    setAvatarError('');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  }

  async function submitName(event) {
    event.preventDefault();
    setSubmitted((current) => ({ ...current, name: true }));
    if (!applyErrors({ name: validateName() })) return;

    try {
      setLoadingAction('name');
      const payload = await onUpdateName(name.trim());
      showToast(payload.message || '使用者名稱已更新');
    } catch (error) {
      showToast(error.message || '更新名稱失敗', 'error');
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
      showToast(payload.message || 'Email 已更新');
    } catch (error) {
      showToast(error.message || '更新 Email 失敗', 'error');
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
      showToast(payload.message || '密碼已更新');
    } catch (error) {
      showToast(error.message || '更新密碼失敗', 'error');
    } finally {
      setLoadingAction('');
    }
  }

  async function submitAvatar() {
    if (!avatarFile) return;

    const error = await validateAvatarFile(avatarFile);
    if (error) {
      setAvatarError(error);
      return;
    }

    try {
      setLoadingAction('avatar');
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const payload = await onUpdateAvatar(formData);
      clearAvatarDraft();
      showToast(payload.message || '頭貼已更新');
    } catch (uploadError) {
      setAvatarError(uploadError.message || '頭貼更新失敗');
    } finally {
      setLoadingAction('');
    }
  }

  async function removeAvatar() {
    try {
      setLoadingAction('remove-avatar');
      const payload = await onDeleteAvatar();
      clearAvatarDraft();
      showToast(payload.message || '頭貼已移除');
    } catch (error) {
      setAvatarError(error.message || '移除頭貼失敗');
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
    setDeleteConfirmOpen(true);
  }

  async function confirmDeleteAccount() {
    try {
      setLoadingAction('delete');
      await onDeleteAccount(deleteForm);
    } catch (error) {
      showToast(error.message || '刪除帳號失敗', 'error');
      setLoadingAction('');
      setDeleteConfirmOpen(false);
    }
  }

  return (
    <motion.section className="settings-page" {...pageFadeUp}>
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />

      <div className="settings-page-content">
        <header className="settings-page-hero">
          <div>
            <p className="eyebrow">Account Settings</p>
            <h1>帳號設定</h1>
            <span>管理你的個人資料、頭貼與帳號安全。</span>
          </div>
          <button className="chip-button" type="button" onClick={onBack}>
            返回地圖
          </button>
        </header>

        <div className="settings-layout">
          <aside className="settings-sidebar glass">
            <div className="settings-profile-card">
              <UserAvatar user={user} src={avatarPreview} size="xl" />
              <div>
                <strong>{user?.name || '使用者'}</strong>
                <span>@{user?.userCode || 'user'}</span>
              </div>
              <span className={`nav-role-badge ${user?.role || 'user'}`}>{roleLabel}</span>
            </div>

            <nav aria-label="帳號設定分類">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    className={activeSection === section.id ? 'active' : ''}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                  >
                    <Icon size={17} />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="settings-main">
            <SettingsCard
              id="profile"
              icon={<UserRound size={19} />}
              title="個人資料"
              description="你的公開名稱、Email 與好友搜尋 ID。"
              visible={activeSection === 'profile'}
            >
              <div className="settings-info-grid">
                <InfoItem label="使用者名稱" value={user?.name || '尚未設定'} />
                <InfoItem label="Email" value={user?.email || '尚未設定'} />
                <InfoItem
                  label="使用者 ID"
                  value={`@${user?.userCode || '尚未設定'}`}
                  action={
                    <button className="copy-mini-button" type="button" onClick={copyUserCode} disabled={!user?.userCode}>
                      <Copy size={13} />
                      複製
                    </button>
                  }
                />
                <InfoItem label="角色" value={roleLabel} />
                <InfoItem label="加入日期" value={joinedAt} />
              </div>

              <form className="settings-form wide" onSubmit={submitName} noValidate>
                <label>
                  使用者名稱
                  <input
                    value={name}
                    onChange={(event) => {
                      const value = event.target.value;
                      setName(value);
                      if (!validateName(value)) updateError('name', '');
                    }}
                    onBlur={() => markBlur('name', validateName)}
                    aria-invalid={shouldShow('name', 'name')}
                    placeholder="你的顯示名稱"
                  />
                  {shouldShow('name', 'name') && <span className="field-error">{errors.name}</span>}
                </label>
                <button className="primary-button" disabled={!nameDirty || loadingAction === 'name'}>
                  {loadingAction === 'name' && <span className="button-spinner dark" />}
                  儲存名稱
                </button>
              </form>

              <form className="settings-form wide" onSubmit={submitEmail} noValidate>
                <label>
                  Email
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
                    placeholder="修改 Email 需輸入目前密碼"
                    invalid={shouldShow('emailPassword', 'email')}
                  />
                  {shouldShow('emailPassword', 'email') && <span className="field-error">{errors.emailPassword}</span>}
                </label>
                <button className="primary-button" disabled={!emailDirty || !emailForm.password || loadingAction === 'email'}>
                  {loadingAction === 'email' && <span className="button-spinner dark" />}
                  更新 Email
                </button>
              </form>
            </SettingsCard>

            <SettingsCard
              id="avatar"
              icon={<Camera size={19} />}
              title="用戶頭貼"
              description="上傳一張清楚的個人頭貼，會同步顯示在 Navbar、好友與動態中。"
              visible={activeSection === 'avatar'}
            >
              <div className="avatar-settings-card">
                <div className="avatar-preview-wrap">
                  <UserAvatar user={user} src={avatarPreview} size="xxl" />
                  <span>圓形預覽</span>
                </div>
                <div className="avatar-upload-panel">
                  <strong>支援 JPG、PNG、WebP，最大 2MB。</strong>
                  <p>建議使用 512x512 圖片；最小尺寸為 128x128。</p>
                  <input
                    ref={avatarInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                  />
                  <div className="avatar-action-row">
                    <button className="secondary-button" type="button" onClick={() => avatarInputRef.current?.click()}>
                      <Upload size={16} />
                      選擇圖片
                    </button>
                    {user?.avatar && (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={removeAvatar}
                        disabled={loadingAction === 'remove-avatar'}
                      >
                        {loadingAction === 'remove-avatar' ? <span className="button-spinner" /> : <X size={16} />}
                        移除頭貼
                      </button>
                    )}
                  </div>
                  {avatarMeta && (
                    <div className="avatar-file-meta">
                      <Check size={15} />
                      <span>{avatarMeta.name}</span>
                      <small>{avatarMeta.size}</small>
                    </div>
                  )}
                  {avatarError && <span className="field-error">{avatarError}</span>}
                  <div className="avatar-save-row">
                    <button className="primary-button" type="button" onClick={submitAvatar} disabled={!avatarFile || loadingAction === 'avatar'}>
                      {loadingAction === 'avatar' && <span className="button-spinner dark" />}
                      儲存頭貼
                    </button>
                    <button className="ghost-button" type="button" onClick={clearAvatarDraft} disabled={!avatarFile}>
                      取消選取
                    </button>
                  </div>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              id="security"
              icon={<Shield size={19} />}
              title="帳號安全"
              description="定期更新密碼，保護你的日記與好友連結。"
              visible={activeSection === 'security'}
            >
              <form className="settings-form security-form" onSubmit={submitPassword} noValidate>
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
            </SettingsCard>

            <SettingsCard
              id="danger"
              icon={<AlertTriangle size={19} />}
              title="危險區域"
              description="刪除帳號後，你的個人資料與日記資料可能無法復原。"
              visible={activeSection === 'danger'}
              danger
            >
              <form className="settings-form danger-form" onSubmit={submitDelete} noValidate>
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
                  輸入 DELETE 確認
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
                  <Trash2 size={16} />
                  刪除帳號
                </button>
              </form>
            </SettingsCard>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {deleteConfirmOpen && (
          <motion.div className="modal-backdrop" {...modalBackdropMotion}>
            <motion.div className="confirm-modal settings-delete-modal" {...modalPopMotion}>
              <div className="modal-icon danger">
                <Trash2 size={20} />
              </div>
              <h3>刪除帳號？</h3>
              <p>刪除後，你的個人資料、好友關係與日記資料可能無法復原。</p>
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setDeleteConfirmOpen(false)}>
                  取消
                </button>
                <button className="danger-button" type="button" onClick={confirmDeleteAccount} disabled={loadingAction === 'delete'}>
                  {loadingAction === 'delete' && <span className="button-spinner" />}
                  確認刪除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function SettingsCard({ id, icon, title, description, visible, danger = false, children }) {
  return (
    <motion.section
      id={`settings-${id}`}
      className={`settings-card glass ${visible ? 'visible' : 'hidden'} ${danger ? 'danger-zone' : ''}`}
      {...pageFadeUp}
    >
      <header className="settings-card-header">
        <div>
          <span className="settings-card-icon">{icon}</span>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
      </header>
      <div className="settings-card-body">{children}</div>
    </motion.section>
  );
}

function InfoItem({ label, value, action }) {
  return (
    <div className="settings-info-item">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
      {action}
    </div>
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
      <button type="button" onClick={onToggle} aria-label={visible ? '隱藏密碼' : '顯示密碼'}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </span>
  );
}

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('無法讀取圖片尺寸'));
    };
    image.src = url;
  }).catch(() => ({ width: 0, height: 0 }));
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
