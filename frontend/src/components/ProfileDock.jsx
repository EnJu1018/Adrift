import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, LogOut, Settings, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { modalPopMotion } from '../constants/animations.js';

export default function ProfileDock({ user, diaries, friends, forceOpen, onOpen, onClose, onSettings, onLogout }) {
  const [open, setOpen] = useState(Boolean(forceOpen));
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    setOpen(Boolean(forceOpen));
  }, [forceOpen]);

  const diaryCount = useMemo(() => {
    return (diaries || []).filter((diary) => diary.user?._id === user?.id || diary.user?.id === user?.id).length;
  }, [diaries, user?.id]);

  useEffect(() => {
    if (!copyMessage) return undefined;
    const timer = window.setTimeout(() => setCopyMessage(''), 2400);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  function toggleOpen() {
    if (open) {
      setOpen(false);
      onClose?.();
      return;
    }

    setOpen(true);
    onOpen?.();
  }

  async function copyUserCode() {
    if (!user?.userCode) return;

    try {
      await navigator.clipboard.writeText(user.userCode);
      setCopyMessage('已複製使用者 ID');
    } catch {
      setCopyMessage('無法複製使用者 ID');
    }
  }

  if (!user) return null;

  return (
    <div className="profile-dock">
      <AnimatePresence>
        {open && (
          <motion.section
            className="profile-popover glass"
            {...modalPopMotion}
          >
            <header>
              <div>
                <p className="eyebrow">Account</p>
                <h2>帳號摘要</h2>
              </div>
              <button className="icon-button" onClick={toggleOpen} aria-label="關閉帳號卡片">
                <X size={16} />
              </button>
            </header>

            <div className="profile-summary">
              <span>名稱</span>
              <strong>{user.name || '未命名'}</strong>
              <span>使用者 ID</span>
              <span className="summary-value-row">
                <strong>@{user.userCode || '尚未設定'}</strong>
                <button className="copy-mini-button" type="button" onClick={copyUserCode} disabled={!user.userCode}>
                  <Copy size={13} />
                  複製
                </button>
              </span>
              <span>Email</span>
              <strong title={user.email}>{user.email || '尚未設定'}</strong>
              <span>好友</span>
              <strong>{friends?.length || 0}</strong>
              <span>日記</span>
              <strong>{diaryCount}</strong>
            </div>

            <AnimatePresence>
              {copyMessage && (
                <motion.p
                  className={`form-message ${copyMessage.startsWith('無法') ? 'error' : 'success'} compact`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  <Check size={14} />
                  {copyMessage}
                </motion.p>
              )}
            </AnimatePresence>

            <button className="primary-button compact profile-settings-button" onClick={onSettings}>
              <Settings size={15} />
              帳號設定
            </button>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.div className="profile-fab glass" initial={false} whileHover={{ y: -1 }}>
        <button className="profile-trigger" type="button" onClick={toggleOpen} aria-label="開啟帳號卡片">
          <span className="avatar-orb small">{(user.name || 'A').slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{user.name || 'Account'}</strong>
            <small>@{user.userCode || 'user'}</small>
          </span>
        </button>
        <button className="profile-logout-button" type="button" onClick={onLogout} aria-label="Logout">
          <LogOut size={17} />
          <span>Logout</span>
        </button>
      </motion.div>
    </div>
  );
}
