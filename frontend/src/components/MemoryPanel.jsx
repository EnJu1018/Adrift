import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Clock3,
  Eye,
  Lock,
  Plus,
  Search,
  Sparkles,
  Undo2,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDiaryTime } from '../utils/diaryTime.js';

const userCodePattern = /^[a-zA-Z0-9_-]{4,20}$/;

export default function MemoryPanel({
  user,
  diaries,
  friends,
  friendRequests,
  sentFriendRequests,
  selectedDiaryId,
  onNewDiary,
  onSelectDiary,
  onSearchUser,
  onSendFriendRequest,
  onCancelFriendRequest,
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
  const [timeNow, setTimeNow] = useState(() => Date.now());

  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(() => {
      setMessage('');
    }, messageType === 'success' ? 1800 : 2500);

    return () => window.clearTimeout(timer);
  }, [message, messageType]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeNow(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const visibleDiaries = diaries || [];
  const friendList = friends || [];
  const requests = friendRequests || [];
  const sentRequests = sentFriendRequests || [];
  const mine = visibleDiaries.filter((diary) => sameId(diary.user?._id || diary.user?.id, user?.id));
  const publicCount = mine.filter((diary) => diary.visibility === 'public').length;
  const privateCount = mine.filter((diary) => diary.visibility === 'private').length;
  const friendsCount = mine.filter((diary) => diary.visibility === 'friends').length;
  const recent = [...visibleDiaries]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const sentRequestForSearchResult = searchResult
    ? sentRequests.find((request) => sameId(request.to?._id, searchResult._id))
    : null;
  const searchResultIsFriend = searchResult
    ? friendList.some((friend) => sameId(friend._id, searchResult._id))
    : false;

  function showMessage(nextMessage, type = 'success') {
    setMessage(nextMessage);
    setMessageType(type);
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
      showMessage(error.message || '好友邀請送出失敗', 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function cancelRequest(requestId) {
    if (!requestId) return;

    try {
      setBusyAction(`cancel-${requestId}`);
      const payload = await onCancelFriendRequest(requestId);
      showMessage(payload.message || '好友邀請已收回');
    } catch (error) {
      showMessage(error.message || '收回好友邀請失敗', 'error');
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
      showMessage(error.message || '接受好友邀請失敗', 'error');
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
      showMessage(error.message || '拒絕好友邀請失敗', 'error');
    } finally {
      setBusyAction('');
    }
  }

  const toast = (
    <div className="panel-toast-layer" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.p
            className={`form-message ${messageType} panel-toast`}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {messageType === 'error' ? <X size={16} /> : <Check size={16} />}
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {createPortal(toast, document.body)}
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
            <h2>地圖日記</h2>
          </div>
          <button className="icon-button" onClick={onNewDiary} disabled={locating} aria-label="新增日記">
            {locating ? <span className="button-spinner" /> : <Plus size={18} />}
          </button>
        </header>

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
                    {recent.map((diary) => {
                      const title = getDiaryTitle(diary);
                      const authorCode = getDiaryAuthorCode(diary, user);

                      return (
                        <button
                          key={diary._id}
                          className={`memory-item compact ${sameId(selectedDiaryId, diary._id) ? 'selected' : ''}`}
                          onClick={() => onSelectDiary(diary)}
                          title={title}
                        >
                          <strong>{title}</strong>
                          <span className="memory-reactions-row">
                            <span>❤️ {diary.reactions?.understand || 0}</span>
                            <span>🤗 {diary.reactions?.hug || 0}</span>
                            <span>🌧 {diary.reactions?.relate || 0}</span>
                          </span>
                          <span className="memory-item-meta">
                            <span className="memory-author-line">
                              <span className="memory-author">@{authorCode}</span>
                            </span>
                            <time dateTime={diary.createdAt}>{formatDiaryTime(diary.createdAt, timeNow)}</time>
                          </span>
                        </button>
                      );
                    })}
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

              {messageType === 'error' && message === '找不到此使用者' && <p className="quiet-note">找不到使用者</p>}

              {searchResult && (
                <article className="person-card">
                  <div className="avatar-orb small">{searchResult.name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{searchResult.name}</strong>
                    <span>@{searchResult.userCode}</span>
                  </div>
                  {searchResultIsFriend ? (
                    <button className="chip-button" disabled>
                      已是好友
                    </button>
                  ) : sentRequestForSearchResult ? (
                    <div className="person-actions">
                      <button className="chip-button" disabled>
                        已送出邀請
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => cancelRequest(sentRequestForSearchResult.requestId)}
                        disabled={Boolean(busyAction)}
                        aria-label="收回好友邀請"
                      >
                        {busyAction === `cancel-${sentRequestForSearchResult.requestId}` ? (
                          <span className="button-spinner" />
                        ) : (
                          <Undo2 size={15} />
                        )}
                      </button>
                    </div>
                  ) : (
                    <button className="chip-button" onClick={sendRequest} disabled={Boolean(busyAction)}>
                      {busyAction === 'request' ? <span className="button-spinner" /> : <UserPlus size={15} />}
                      邀請
                    </button>
                  )}
                </article>
              )}

              <section className="social-section">
                <div className="section-title">
                  <Undo2 size={16} />
                  <span>已送出邀請</span>
                </div>
                {sentRequests.length > 0 ? (
                  sentRequests.map((request) => (
                    <article className="person-card" key={request.requestId}>
                      <div className="avatar-orb small">{request.to.name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>{request.to.name}</strong>
                        <span>@{request.to.userCode} · 等待對方回覆</span>
                        <small>{new Date(request.createdAt).toLocaleString()}</small>
                      </div>
                      <button
                        className="chip-button"
                        onClick={() => cancelRequest(request.requestId)}
                        disabled={Boolean(busyAction)}
                      >
                        {busyAction === `cancel-${request.requestId}` ? <span className="button-spinner" /> : <Undo2 size={15} />}
                        收回
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="quiet-note">目前沒有等待回覆的邀請。</p>
                )}
              </section>

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
                          aria-label="接受好友邀請"
                        >
                          {busyAction === `accept-${request.requestId}` ? <span className="button-spinner" /> : <Check size={15} />}
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => rejectRequest(request.requestId)}
                          disabled={Boolean(busyAction)}
                          aria-label="拒絕好友邀請"
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
    </>
  );
}

function getDiaryTitle(diary) {
  return diary?.title?.trim() || '（未命名日記）';
}

function getDiaryAuthorCode(diary, currentUser) {
  return diary?.author?.userCode || diary?.user?.userCode || currentUser?.userCode || 'unknown';
}

function sameId(left, right) {
  return Boolean(left && right && left.toString() === right.toString());
}
