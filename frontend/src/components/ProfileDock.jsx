import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, LogOut, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function ProfileDock({
  user,
  diaries,
  friends,
  friendRequests,
  forceOpen,
  onOpen,
  onClose,
  onLogout
}) {
  const [open, setOpen] = useState(Boolean(forceOpen));
  const [message, setMessage] = useState('');

  useEffect(() => {
    setOpen(Boolean(forceOpen));
  }, [forceOpen]);

  const stats = useMemo(() => {
    const mine = (diaries || []).filter((diary) => diary.user?._id === user?.id || diary.user?.id === user?.id);

    return {
      diaryCount: mine.length,
      publicCount: mine.filter((diary) => diary.visibility === 'public').length,
      friendCount: friends?.length || 0,
      requestCount: friendRequests?.length || 0
    };
  }, [diaries, friendRequests, friends, user?.id]);

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
      setMessage('已複製使用者 ID');
    } catch {
      setMessage('無法複製，請手動選取 ID');
    }
  }

  if (!user) return null;

  return (
    <div className="profile-dock">
      <AnimatePresence>
        {open && (
          <motion.section
            className="profile-popover glass"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <header>
              <div className="profile-identity">
                <span className="avatar-orb">{(user.name || 'A').slice(0, 1).toUpperCase()}</span>
                <div>
                  <p className="eyebrow">Profile</p>
                  <h2>{user.name}</h2>
                  <span>@{user.userCode || '尚未設定'}</span>
                </div>
              </div>
              <button className="icon-button" onClick={toggleOpen} aria-label="關閉 Profile">
                <X size={16} />
              </button>
            </header>

            <div className="profile-id-row">
              <span>{user.userCode || '尚未設定使用者 ID'}</span>
              <button className="chip-button" onClick={copyUserCode} disabled={!user.userCode}>
                <Copy size={15} />
                複製 ID
              </button>
            </div>

            {message && (
              <motion.p className="form-message success" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                <Check size={15} />
                {message}
              </motion.p>
            )}

            <div className="profile-stats">
              <article>
                <strong>{stats.diaryCount}</strong>
                <span>我的日記</span>
              </article>
              <article>
                <strong>{stats.publicCount}</strong>
                <span>公開</span>
              </article>
              <article>
                <strong>{stats.friendCount}</strong>
                <span>好友</span>
              </article>
              <article>
                <strong>{stats.requestCount}</strong>
                <span>邀請</span>
              </article>
            </div>

            <button className="danger-button profile-logout" onClick={() => onLogout?.()}>
              <LogOut size={16} />
              Logout
            </button>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        className="profile-fab glass"
        onClick={toggleOpen}
        whileTap={{ scale: 0.96 }}
        aria-label="開啟 Profile"
      >
        <span className="avatar-orb small">{(user.name || 'A').slice(0, 1).toUpperCase()}</span>
        <span>
          <strong>{user.name}</strong>
          <small>Profile</small>
        </span>
        <UserRound size={17} />
      </motion.button>
    </div>
  );
}
