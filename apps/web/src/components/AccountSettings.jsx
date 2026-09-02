import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Lock,
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
  { id: 'profile', label: '個人檔案', icon: UserRound },
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
const maxAvatarBytes = 10 * 1024 * 1024;
const avatarCropSize = 300;
const avatarOutputSize = 512;

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
  const [editingField, setEditingField] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [emailForm, setEmailForm] = useState({ email: user?.email || '', password: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmText: '' });
  const [avatarDraft, setAvatarDraft] = useState({ file: null, url: '', meta: null });
  const [avatarError, setAvatarError] = useState('');
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [loadingAction, setLoadingAction] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState(emptyPasswords);
  const avatarInputRef = useRef(null);
  const cropDragRef = useRef(null);

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

  useEffect(() => () => {
    if (avatarDraft.url) URL.revokeObjectURL(avatarDraft.url);
  }, [avatarDraft.url]);

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

  function startEditing(field) {
    setEditingField(field);
    setSubmitted((current) => ({ ...current, [field]: false }));
  }

  function cancelEditing() {
    setEditingField('');
    setName(user?.name || '');
    setEmailForm({ email: user?.email || '', password: '' });
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setErrors({});
    setTouched({});
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
    if (!file) return { error: '請選擇頭貼圖片', dimensions: null };
    if (!allowedAvatarTypes.includes(file.type)) return { error: '頭貼僅支援 JPG、PNG、WebP', dimensions: null };
    if (file.size > maxAvatarBytes) return { error: '頭貼檔案不可超過 10MB', dimensions: null };

    const dimensions = await getImageDimensions(file);
    if (dimensions.width < 128 || dimensions.height < 128) {
      return { error: '圖片尺寸太小，請上傳至少 128x128 的圖片', dimensions };
    }

    return { error: '', dimensions };
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    setAvatarError('');

    if (!file) return;

    const validation = await validateAvatarFile(file);
    if (validation.error) {
      resetAvatarDraft();
      setAvatarError(validation.error);
      event.target.value = '';
      return;
    }

    resetAvatarDraft();
    const url = URL.createObjectURL(file);
    setAvatarDraft({
      file,
      url,
      meta: {
        name: file.name,
        size: formatFileSize(file.size),
        dimensions: validation.dimensions
      }
    });
    setAvatarZoom(1);
    setAvatarOffset({ x: 0, y: 0 });
    setAvatarCropOpen(true);
  }

  function resetAvatarDraft() {
    setAvatarDraft((current) => {
      if (current.url) URL.revokeObjectURL(current.url);
      return { file: null, url: '', meta: null };
    });
    setAvatarZoom(1);
    setAvatarOffset({ x: 0, y: 0 });
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  }

  function closeAvatarCrop() {
    setAvatarCropOpen(false);
    resetAvatarDraft();
  }

  function beginCropDrag(event) {
    event.preventDefault();
    const point = getPointerPoint(event);
    cropDragRef.current = {
      startX: point.x,
      startY: point.y,
      originX: avatarOffset.x,
      originY: avatarOffset.y
    };
    window.addEventListener('pointermove', handleCropDrag);
    window.addEventListener('pointerup', endCropDrag, { once: true });
  }

  function handleCropDrag(event) {
    const drag = cropDragRef.current;
    if (!drag) return;
    setAvatarOffset({
      x: clamp(drag.originX + event.clientX - drag.startX, -avatarCropSize, avatarCropSize),
      y: clamp(drag.originY + event.clientY - drag.startY, -avatarCropSize, avatarCropSize)
    });
  }

  function endCropDrag() {
    cropDragRef.current = null;
    window.removeEventListener('pointermove', handleCropDrag);
  }

  async function submitCroppedAvatar() {
    if (!avatarDraft.file || !avatarDraft.url) return;

    try {
      setLoadingAction('avatar');
      const blob = await createCroppedAvatarBlob(avatarDraft.url, avatarOffset, avatarZoom);
      const croppedFile = new File([blob], `avatar-${Date.now()}.webp`, { type: 'image/webp' });
      const formData = new FormData();
      formData.append('avatar', croppedFile);
      const payload = await onUpdateAvatar(formData);
      setAvatarCropOpen(false);
      resetAvatarDraft();
      showToast(payload.message || '頭貼已更新');
    } catch (error) {
      setAvatarError(error.message || '頭貼更新失敗');
    } finally {
      setLoadingAction('');
    }
  }

  async function removeAvatar() {
    try {
      setLoadingAction('remove-avatar');
      const payload = await onDeleteAvatar();
      resetAvatarDraft();
      showToast(payload.message || '頭貼已移除');
    } catch (error) {
      setAvatarError(error.message || '移除頭貼失敗');
    } finally {
      setLoadingAction('');
    }
  }

  async function submitName(event) {
    event.preventDefault();
    setSubmitted((current) => ({ ...current, name: true }));
    if (!applyErrors({ name: validateName() })) return;

    try {
      setLoadingAction('name');
      const payload = await onUpdateName(name.trim());
      setEditingField('');
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
      setEditingField('');
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
      setEditingField('');
      showToast(payload.message || '密碼已更新');
    } catch (error) {
      showToast(error.message || '更新密碼失敗', 'error');
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
        <header className="settings-page-header">
          <div>
            <p className="eyebrow">Account Settings</p>
            <h1 className="settings-page-title">帳號設定</h1>
            <p className="settings-page-subtitle">管理你的個人資料、頭貼與帳號安全</p>
          </div>
          <button className="chip-button" type="button" onClick={onBack}>
            返回地圖
          </button>
        </header>

        <div className="settings-layout">
          <aside className="settings-sidebar glass">
            <div className="settings-profile-card">
              <UserAvatar user={user} size="xl" />
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
              title="個人檔案"
              description="你的公開名稱、頭貼與好友搜尋 ID。"
              visible={activeSection === 'profile'}
            >
              <div className="settings-profile-summary">
                <div className="settings-avatar-feature">
                  <UserAvatar user={user} size="xxl" />
                  <div>
                    <strong>頭貼</strong>
                    <span>讓好友更容易認出你。支援 JPG、PNG、WebP，最大 10MB。</span>
                    {avatarError && <em className="field-error">{avatarError}</em>}
                  </div>
                </div>
                <div className="settings-avatar-actions">
                  <input
                    ref={avatarInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                  />
                  <button className="secondary-button" type="button" onClick={() => avatarInputRef.current?.click()}>
                    <Upload size={16} />
                    上傳新頭貼
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
              </div>

              <div className="settings-row-list">
                <SettingsRow
                  label="使用者名稱"
                  value={user?.name || '尚未設定'}
                  actionLabel="編輯"
                  onAction={() => startEditing('name')}
                  isEditing={editingField === 'name'}
                >
                  <form className="settings-inline-edit" onSubmit={submitName} noValidate>
                    <label>
                      <span className="visually-hidden">使用者名稱</span>
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
                    <InlineActions
                      loading={loadingAction === 'name'}
                      disabled={!nameDirty || loadingAction === 'name'}
                      onCancel={cancelEditing}
                    />
                  </form>
                </SettingsRow>

                <SettingsRow
                  label="Email"
                  value={user?.email || '尚未設定'}
                  actionLabel="編輯"
                  onAction={() => startEditing('email')}
                  isEditing={editingField === 'email'}
                >
                  <form className="settings-inline-edit email-edit" onSubmit={submitEmail} noValidate>
                    <label>
                      <span>Email</span>
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
                      <span>目前密碼</span>
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
                    <InlineActions
                      loading={loadingAction === 'email'}
                      disabled={!emailDirty || !emailForm.password || loadingAction === 'email'}
                      onCancel={cancelEditing}
                      saveLabel="更新"
                    />
                  </form>
                </SettingsRow>

                <SettingsRow
                  label="使用者 ID"
                  value={`@${user?.userCode || '尚未設定'}`}
                  actionLabel="複製"
                  actionIcon={<Copy size={14} />}
                  onAction={copyUserCode}
                  actionDisabled={!user?.userCode}
                />
                <SettingsRow label="角色" value={roleLabel} />
                <SettingsRow label="加入日期" value={joinedAt} />
              </div>
            </SettingsCard>

            <SettingsCard
              id="security"
              icon={<Shield size={19} />}
              title="帳號安全"
              description="密碼不會直接顯示，點擊編輯後才開啟修改表單。"
              visible={activeSection === 'security'}
            >
              <div className="settings-row-list">
                <SettingsRow
                  label="修改密碼"
                  value="建議定期更新密碼，保護你的日記與好友連結。"
                  actionLabel="編輯"
                  onAction={() => startEditing('password')}
                  isEditing={editingField === 'password'}
                >
                  <form className="settings-inline-edit password-edit" onSubmit={submitPassword} noValidate>
                    <label>
                      <span>目前密碼</span>
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
                      <span>新密碼</span>
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
                      <span>確認新密碼</span>
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
                    <InlineActions
                      loading={loadingAction === 'password'}
                      disabled={loadingAction === 'password'}
                      onCancel={cancelEditing}
                      saveLabel="更新密碼"
                    />
                  </form>
                </SettingsRow>
              </div>
            </SettingsCard>

            <SettingsCard
              id="danger"
              icon={<AlertTriangle size={19} />}
              title="危險區域"
              description="刪除帳號後，你的個人資料與日記資料可能無法復原。"
              visible={activeSection === 'danger'}
              danger
            >
              <form className="settings-danger-panel" onSubmit={submitDelete} noValidate>
                <div>
                  <strong>刪除帳號</strong>
                  <span>這是不可逆操作，請確認後再進行。</span>
                </div>
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
        {avatarCropOpen && (
          <motion.div className="modal-backdrop" {...modalBackdropMotion}>
            <motion.div className="avatar-crop-modal" {...modalPopMotion}>
              <header>
                <div>
                  <h3>調整頭貼</h3>
                  <p>拖曳圖片調整位置，使用滑桿調整縮放。</p>
                </div>
                <button className="icon-button" type="button" onClick={closeAvatarCrop} aria-label="關閉頭貼調整">
                  <X size={18} />
                </button>
              </header>

              <div className="avatar-crop-stage">
                <div
                  className="avatar-crop-frame"
                  onPointerDown={beginCropDrag}
                  role="presentation"
                >
                  {avatarDraft.url && (
                    <img
                      src={avatarDraft.url}
                      alt=""
                      draggable="false"
                      style={{
                        ...getAvatarPreviewStyle(avatarDraft.meta?.dimensions),
                        transform: `translate(calc(-50% + ${avatarOffset.x}px), calc(-50% + ${avatarOffset.y}px)) scale(${avatarZoom})`
                      }}
                    />
                  )}
                  <span className="avatar-crop-mask" />
                </div>
                {avatarDraft.url && (
                  <div className="avatar-original-preview" aria-hidden="true">
                    <img src={avatarDraft.url} alt="" draggable="false" />
                    <span>原圖預覽</span>
                  </div>
                )}
                {avatarDraft.meta && (
                  <div className="avatar-file-meta">
                    <Check size={15} />
                    <span>{avatarDraft.meta.name}</span>
                    <small>{avatarDraft.meta.size}</small>
                  </div>
                )}
              </div>

              <label className="avatar-zoom-control">
                <span>縮放</span>
                <input
                  className="mood-intensity-slider"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={avatarZoom}
                  onChange={(event) => setAvatarZoom(Number(event.target.value))}
                  style={{ '--slider-progress': `${((avatarZoom - 1) / 2) * 100}%` }}
                />
              </label>

              {avatarError && <span className="field-error">{avatarError}</span>}

              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={closeAvatarCrop}>
                  取消
                </button>
                <button className="primary-button" type="button" onClick={submitCroppedAvatar} disabled={loadingAction === 'avatar'}>
                  {loadingAction === 'avatar' && <span className="button-spinner dark" />}
                  儲存頭貼
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

function SettingsRow({ label, value, actionLabel, actionIcon, onAction, actionDisabled, isEditing, children }) {
  return (
    <div className={`settings-row ${isEditing ? 'is-editing' : ''}`}>
      <span className="settings-row-label">{label}</span>
      <div className="settings-row-value">
        {isEditing ? children : <strong title={typeof value === 'string' ? value : undefined}>{value}</strong>}
      </div>
      {!isEditing && actionLabel && (
        <button className="settings-row-action" type="button" onClick={onAction} disabled={actionDisabled}>
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function InlineActions({ loading, disabled, onCancel, saveLabel = '儲存' }) {
  return (
    <div className="settings-inline-actions">
      <button className="ghost-button" type="button" onClick={onCancel}>
        取消
      </button>
      <button className="primary-button" type="submit" disabled={disabled}>
        {loading && <span className="button-spinner dark" />}
        {saveLabel}
      </button>
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

function createCroppedAvatarBlob(imageUrl, offset, zoom) {
  return loadImage(imageUrl).then((image) => {
    const canvas = document.createElement('canvas');
    canvas.width = avatarOutputSize;
    canvas.height = avatarOutputSize;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('無法建立頭貼裁切畫布');
    }

    context.fillStyle = '#f8fcff';
    context.fillRect(0, 0, avatarOutputSize, avatarOutputSize);

    const baseScale = Math.min(avatarCropSize / image.naturalWidth, avatarCropSize / image.naturalHeight);
    const displayWidth = image.naturalWidth * baseScale * zoom;
    const displayHeight = image.naturalHeight * baseScale * zoom;
    const ratio = avatarOutputSize / avatarCropSize;
    const drawX = (avatarCropSize / 2 + offset.x - displayWidth / 2) * ratio;
    const drawY = (avatarCropSize / 2 + offset.y - displayHeight / 2) * ratio;
    const drawWidth = displayWidth * ratio;
    const drawHeight = displayHeight * ratio;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, avatarOutputSize, avatarOutputSize);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('頭貼裁切失敗'));
        },
        'image/webp',
        0.9
      );
    });
  });
}

function getAvatarPreviewStyle(dimensions) {
  if (!dimensions?.width || !dimensions?.height) {
    return {
      width: `${avatarCropSize}px`,
      height: `${avatarCropSize}px`
    };
  }

  const baseScale = Math.min(avatarCropSize / dimensions.width, avatarCropSize / dimensions.height);

  return {
    width: `${dimensions.width * baseScale}px`,
    height: `${dimensions.height * baseScale}px`
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('無法讀取頭貼圖片'));
    image.src = src;
  });
}

function getPointerPoint(event) {
  return { x: event.clientX, y: event.clientY };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
