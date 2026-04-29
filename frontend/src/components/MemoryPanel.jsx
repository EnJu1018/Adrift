import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Clock3,
  Copy,
  Eye,
  Lock,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { useState } from 'react';

const visibilityLabels = {
  private: '私人',
  friends: '朋友',
  public: '公開'
};

const moodLabels = {
  calm: '平靜',
  joy: '喜悅',
  sad: '低落',
  wonder: '驚奇',
  anxious: '焦慮',
  nostalgic: '懷舊',
  other: '其他'
};

const moodIcons = {
  calm: '○',
  joy: '✦',
  sad: '◌',
  wonder: '◇',
  anxious: '△',
  nostalgic: '◐',
  other: '•'
};

const userCodePattern = /^[a-zA-Z0-9_-]{4,20}$/;

export default function MemoryPanel({
  user,
  diaries,
  friends,
  friendRequests,
  onNewDiary,
  onSelectDiary,
  onSearchUser,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  locating
}) {
  const [activeTab, setActiveTab] = useState('memories');
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [busyAction, setBusyAction] = useState('');

  const visibleDiaries = diaries || [];
  const friendList = friends || [];
  const requests = friendRequests || [];
  const mine = visibleDiaries.filter((diary) => diary.user?._id === user?.id || diary.user?.id === user?.id);
  const publicCount = mine.filter((diary) => diary.visibility === 'public').length;
  const privateCount = mine.filter((diary) => diary.visibility === 'private').length;
  const friendsCount = mine.filter((diary) => diary.visibility === 'friends').length;
  const recent = [...visibleDiaries]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  async function copyUserCode() {
    if (!user?.userCode) return;

    try {
      await navigator.clipboard.writeText(user.userCode);
      showMessage('已複製使用者 ID');
    } catch {
      showMessage('無法複製使用者 ID，請手動選取複製', 'error');
    }
  }

  async function searchUser(event) {
    event.preventDefault();
    const normalized = searchCode.trim();

    if (!normalized) {
      setSearchResult(null);
      showMessage('請輸入使用者 ID', 'error');
      return;
    }

    if (!userCodePattern.test(normalized)) {
      setSearchResult(null);
      showMessage('使用者 ID 只能包含英文、數字、底線、減號，長度需為 4 到 20 字元', 'error');
      return;
    }

    try {
      setBusyAction('search');
      setSearchResult(null);
      const result = await onSearchUser(normalized);
      setSearchResult(result);
      showMessage('搜尋成功');
    } catch (error) {
      setSearchResult(null);
      showMessage(error.message || '找不到使用者', 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function sendRequest() {
    if (!searchResult?._id) return;

    try {
      setBusyAction('request');
      const payload = await onSendFriendRequest(searchResult._id);
      showMessage(payload.message || '好友邀請已送出');
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function acceptRequest(requestId) {
    try {
      setBusyAction(`accept-${requestId}`);
      const payload = await onAcceptFriendRequest(requestId);
      showMessage(payload.message || '已成為好友');
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function rejectRequest(requestId) {
    try {
      setBusyAction(`reject-${requestId}`);
      const payload = await onRejectFriendRequest(requestId);
      showMessage(payload.message || '已拒絕好友邀請');
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setBusyAction('');
    }
  }

  function showMessage(nextMessage, type = 'success') {
    setMessage(nextMessage);
    setMessageType(type);
  }

  return (
    <motion.aside
      className="memory-panel glass"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <header className="memory-header">
        <div>
          <p className="eyebrow">Memory Log</p>
          <h2>{user?.name || 'Adrift'} 的日記</h2>
        </div>
        <button className="icon-button" onClick={onNewDiary} disabled={locating} aria-label="新增日記">
          {locating ? <span className="button-spinner" /> : <Plus size={18} />}
        </button>
      </header>

      <section className="profile-card">
        <div className="avatar-orb">{(user?.name || 'A').slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{user?.name}</strong>
          <span>@{user?.userCode || '尚未設定'}</span>
        </div>
        <button className="icon-button" onClick={copyUserCode} disabled={!user?.userCode} aria-label="複製使用者 ID">
          <Copy size={16} />
        </button>
      </section>

      <div className="panel-tabs">
        <button className={activeTab === 'memories' ? 'active' : ''} onClick={() => setActiveTab('memories')}>
          <Sparkles size={15} />
          日記
        </button>
        <button className={activeTab === 'social' ? 'active' : ''} onClick={() => setActiveTab('social')}>
          <Users size={15} />
          好友
          {requests.length > 0 && <span>{requests.length}</span>}
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {message && (
          <motion.p
            className={`form-message ${messageType}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {messageType === 'error' ? <X size={16} /> : <Check size={16} />}
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeTab === 'memories' ? (
          <motion.div
            key="memories"
            className="panel-scroll"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="memory-stats">
              <article>
                <span>{mine.length}</span>
                <p>我的日記</p>
              </article>
              <article>
                <span>{visibleDiaries.length}</span>
                <p>可見記憶</p>
              </article>
            </div>

            <div className="visibility-grid">
              <span>
                <Lock size={15} />
                私人 {privateCount}
              </span>
              <span>
                <Users size={15} />
                朋友 {friendsCount}
              </span>
              <span>
                <Eye size={15} />
                公開 {publicCount}
              </span>
            </div>

            <section className="memory-section">
              <div className="section-title">
                <Clock3 size={16} />
                <span>最近日記</span>
              </div>

              {recent.length > 0 ? (
                <div className="memory-list">
                  {recent.map((diary) => (
                    <button key={diary._id} className="memory-item" onClick={() => onSelectDiary(diary)}>
                      <span className="memory-dot">{moodIcons[diary.mood?.type] || '•'}</span>
                      <div>
                        <strong>{moodLabels[diary.mood?.type] || diary.mood?.type || '心情'}</strong>
                        <p>{diary.text}</p>
                        <small>
                          @{diary.user?.userCode || 'unknown'} · {visibilityLabels[diary.visibility] || diary.visibility} ·{' '}
                          {new Date(diary.createdAt).toLocaleString()}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-memory">
                  <Sparkles size={18} />
                  <p>還沒有日記，去新增一筆吧</p>
                </div>
              )}
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="social"
            className="panel-scroll social-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <form className="social-search" onSubmit={searchUser}>
              <label>
                搜尋使用者 ID
                <div className="inline-control">
                  <input
                    value={searchCode}
                    onChange={(event) => setSearchCode(event.target.value)}
                    placeholder="friend_001"
                  />
                  <button className="icon-button" type="submit" disabled={Boolean(busyAction)} aria-label="搜尋好友">
                    {busyAction === 'search' ? <span className="button-spinner" /> : <Search size={16} />}
                  </button>
                </div>
              </label>
            </form>

            {messageType === 'error' && message === '找不到此使用者' && (
              <p className="quiet-note">找不到使用者</p>
            )}

            {searchResult && (
              <article className="person-card">
                <div className="avatar-orb small">{searchResult.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{searchResult.name}</strong>
                  <span>@{searchResult.userCode}</span>
                </div>
                <button className="chip-button" onClick={sendRequest} disabled={Boolean(busyAction)}>
                  {busyAction === 'request' ? <span className="button-spinner" /> : <UserPlus size={15} />}
                  邀請
                </button>
              </article>
            )}

            <section className="social-section">
              <div className="section-title">
                <UserPlus size={16} />
                <span>收到的邀請</span>
              </div>
              {requests.length > 0 ? (
                requests.map((request) => (
                  <article className="person-card" key={request.requestId}>
                    <div className="avatar-orb small">{request.from.name.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <strong>{request.from.name}</strong>
                      <span>@{request.from.userCode}</span>
                    </div>
                    <div className="person-actions">
                      <button
                        className="icon-button"
                        onClick={() => acceptRequest(request.requestId)}
                        disabled={Boolean(busyAction)}
                      >
                        {busyAction === `accept-${request.requestId}` ? <span className="button-spinner" /> : <Check size={15} />}
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => rejectRequest(request.requestId)}
                        disabled={Boolean(busyAction)}
                      >
                        {busyAction === `reject-${request.requestId}` ? <span className="button-spinner" /> : <X size={15} />}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="quiet-note">目前沒有新的好友邀請。</p>
              )}
            </section>

            <section className="social-section">
              <div className="section-title">
                <Users size={16} />
                <span>好友列表</span>
              </div>
              {friendList.length > 0 ? (
                friendList.map((friend) => (
                  <article className="person-card" key={friend._id}>
                    <div className="avatar-orb small">{friend.name.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <strong>{friend.name}</strong>
                      <span>@{friend.userCode}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="quiet-note">還沒有好友，去搜尋吧</p>
              )}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
