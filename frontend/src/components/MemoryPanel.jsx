import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  BookOpen,
  CalendarDays,
  Clock3,
  Eye,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  UserPlus,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fadeUpMotion, listItemMotion, panelSlideRight, toastMotion } from '../constants/animations.js';
import { USER_CODE_PATTERN } from '../constants/app.js';
import { formatDiaryTime } from '../utils/diaryTime.js';

const VISIBILITY_FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'private', label: '私人' },
  { value: 'friends', label: '朋友' },
  { value: 'public', label: '公開' }
];

export default function MemoryPanel({
  user,
  diaries,
  friends,
  friendRequests,
  sentFriendRequests,
  mapMode = 'mine',
  visibilityFilter = 'all',
  onVisibilityFilterChange,
  selectedDiaryId,
  onNewDiary,
  onSelectDiary,
  onSearchUser,
  onSendFriendRequest,
  onCancelFriendRequest,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onGetFriendProfile,
  onDeleteFriend,
  locating,
  lowPerformance = false
}) {
  const [activeTab, setActiveTab] = useState('memories');
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [busyAction, setBusyAction] = useState('');
  const [timeNow, setTimeNow] = useState(() => Date.now());
  const [friendQuery, setFriendQuery] = useState('');
  const [friendProfile, setFriendProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [friendToDelete, setFriendToDelete] = useState(null);

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
  const receivedRequestForSearchResult = searchResult
    ? requests.find((request) => sameId(request.from?._id, searchResult._id))
    : null;
  const searchResultIsFriend = searchResult
    ? friendList.some((friend) => sameId(friend._id, searchResult._id))
    : false;
  const searchFriendshipStatus = searchResult?.friendshipStatus
    || (searchResultIsFriend ? 'friend' : sentRequestForSearchResult ? 'sent_request' : receivedRequestForSearchResult ? 'received_request' : 'none');
  const normalizedFriendQuery = friendQuery.trim().toLowerCase();
  const filteredFriends = normalizedFriendQuery
    ? friendList.filter((friend) => {
        const name = friend.name?.toLowerCase() || '';
        const userCode = friend.userCode?.toLowerCase() || '';
        return name.includes(normalizedFriendQuery) || userCode.includes(normalizedFriendQuery);
      })
    : friendList;

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

    if (!USER_CODE_PATTERN.test(normalized)) {
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
      setSearchResult((current) => current ? { ...current, friendshipStatus: 'sent_request' } : current);
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
      setSearchResult((current) => current ? { ...current, friendshipStatus: 'none' } : current);
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
      setSearchResult((current) => current ? { ...current, friendshipStatus: 'friend' } : current);
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

  async function openFriendProfile(friend) {
    if (!friend?._id || !onGetFriendProfile) return;

    try {
      setBusyAction(`profile-${friend._id}`);
      setProfileError('');
      const profile = await onGetFriendProfile(friend._id);
      setFriendProfile(profile);
    } catch (error) {
      const nextMessage = error.message || '無法取得好友資料';
      setProfileError(nextMessage);
      showMessage(nextMessage, 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function confirmDeleteFriend() {
    if (!friendToDelete?._id || !onDeleteFriend) return;

    try {
      setBusyAction(`delete-friend-${friendToDelete._id}`);
      const payload = await onDeleteFriend(friendToDelete._id);
      setSearchResult((current) => sameId(current?._id, friendToDelete._id) ? { ...current, friendshipStatus: 'none' } : current);
      if (sameId(friendProfile?._id, friendToDelete._id)) {
        setFriendProfile(null);
      }
      setFriendToDelete(null);
      showMessage(payload.message || '已刪除好友');
    } catch (error) {
      showMessage(error.message || '刪除好友失敗', 'error');
    } finally {
      setBusyAction('');
    }
  }

  function viewFriendDiaries(profile) {
    const diary = visibleDiaries.find((item) => {
      const authorId = item.author?._id || item.user?._id || item.user?.id;
      return sameId(authorId, profile?._id);
    });

    setFriendProfile(null);

    if (diary) {
      setActiveTab('memories');
      onSelectDiary(diary);
      return;
    }

    showMessage('目前沒有可查看的好友日記', 'error');
  }

  const toast = (
    <div className="panel-toast-layer" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.p
            className={`form-message ${messageType} panel-toast`}
            {...toastMotion}
          >
            {messageType === 'error' ? <X size={16} /> : <Check size={16} />}
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  const friendProfileModal = friendProfile ? createPortal(
    <motion.div className="modal-backdrop" {...toastMotion}>
      <motion.article className="friend-profile-modal glass" {...fadeUpMotion}>
        <header className="friend-profile-header">
          <div className="avatar-orb">{friendProfile.name?.slice(0, 1).toUpperCase()}</div>
          <div>
            <p className="eyebrow">Friend Profile</p>
            <h3>{friendProfile.name}</h3>
            <span>@{friendProfile.userCode}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => setFriendProfile(null)} aria-label="關閉好友資料">
            <X size={16} />
          </button>
        </header>

        {profileError && <p className="form-message error">{profileError}</p>}

        <div className="friend-profile-grid">
          <article>
            <CalendarDays size={16} />
            <span>加入日期</span>
            <strong>{friendProfile.createdAt ? new Date(friendProfile.createdAt).toLocaleDateString() : '未知'}</strong>
          </article>
          <article>
            <Eye size={16} />
            <span>公開日記</span>
            <strong>{friendProfile.diaryStats?.publicCount ?? 0}</strong>
          </article>
          <article>
            <Users size={16} />
            <span>好友限定</span>
            <strong>{friendProfile.diaryStats?.friendsCount ?? 0}</strong>
          </article>
        </div>

        <footer className="friend-profile-actions">
          <button className="chip-button" type="button" onClick={() => viewFriendDiaries(friendProfile)}>
            <BookOpen size={15} />
            查看地圖日記
          </button>
          <button className="ghost-button danger" type="button" onClick={() => setFriendToDelete(friendProfile)}>
            <Trash2 size={15} />
            刪除好友
          </button>
        </footer>
      </motion.article>
    </motion.div>,
    document.body
  ) : null;

  const deleteFriendModal = friendToDelete ? createPortal(
    <motion.div className="modal-backdrop" {...toastMotion}>
      <motion.article className="friend-profile-modal danger glass" {...fadeUpMotion}>
        <header className="friend-profile-header">
          <div className="avatar-orb small">{friendToDelete.name?.slice(0, 1).toUpperCase()}</div>
          <div>
            <p className="eyebrow">Remove Friend</p>
            <h3>確定要刪除此好友嗎？</h3>
            <span>@{friendToDelete.userCode}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => setFriendToDelete(null)} aria-label="取消刪除好友">
            <X size={16} />
          </button>
        </header>
        <p className="quiet-note">刪除後，你們將無法再查看彼此的好友限定日記。這不會刪除任何日記或帳號。</p>
        <footer className="friend-profile-actions">
          <button className="ghost-button" type="button" onClick={() => setFriendToDelete(null)}>取消</button>
          <button
            className="ghost-button danger"
            type="button"
            onClick={confirmDeleteFriend}
            disabled={busyAction === `delete-friend-${friendToDelete._id}`}
          >
            {busyAction === `delete-friend-${friendToDelete._id}` ? <span className="button-spinner" /> : <Trash2 size={15} />}
            確認刪除
          </button>
        </footer>
      </motion.article>
    </motion.div>,
    document.body
  ) : null;

  return (
    <>
      {createPortal(toast, document.body)}
      {friendProfileModal}
      {deleteFriendModal}
      <motion.aside
        className="memory-panel glass"
        {...panelSlideRight}
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
              {...fadeUpMotion}
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

              {mapMode === 'explore' ? (
                <p className="visibility-filter-note">Explore 只顯示公開日記</p>
              ) : (
                <div className="visibility-filter" aria-label="日記可見性篩選">
                  {VISIBILITY_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={visibilityFilter === option.value ? 'active' : ''}
                      onClick={() => onVisibilityFilterChange?.(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              <section className="memory-section">
                <div className="section-title">
                  <Clock3 size={16} />
                  <span>最近日記</span>
                </div>

                {recent.length > 0 ? (
                  <div className="memory-list">
                    {recent.map((diary, index) => {
                      const title = getDiaryTitle(diary);
                      const authorCode = getDiaryAuthorCode(diary, user);

                      return (
                        <motion.button
                          key={diary._id}
                          className={`memory-item compact ${sameId(selectedDiaryId, diary._id) ? 'selected' : ''}`}
                          onClick={() => onSelectDiary(diary)}
                          title={title}
                          {...listItemMotion(index, lowPerformance)}
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
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-memory">
                    <Sparkles size={18} />
                    <p>{getVisibilityEmptyMessage(mapMode === 'explore' ? 'public' : visibilityFilter)}</p>
                  </div>
                )}
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="social"
              className="panel-scroll social-panel"
              {...fadeUpMotion}
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
                    <span>@{searchResult.userCode} · {getFriendshipLabel(searchFriendshipStatus)}</span>
                  </div>
                  {searchFriendshipStatus === 'self' ? (
                    <button className="chip-button" disabled>自己</button>
                  ) : searchFriendshipStatus === 'friend' ? (
                    <button className="chip-button" onClick={() => openFriendProfile(searchResult)}>
                      <UserRound size={15} />
                      資料卡
                    </button>
                  ) : searchFriendshipStatus === 'sent_request' ? (
                    <div className="person-actions">
                      <button className="chip-button" disabled>已送出邀請</button>
                      <button
                        className="icon-button"
                        onClick={() => cancelRequest(sentRequestForSearchResult?.requestId)}
                        disabled={Boolean(busyAction) || !sentRequestForSearchResult?.requestId}
                        aria-label="收回好友邀請"
                      >
                        {busyAction === `cancel-${sentRequestForSearchResult?.requestId}` ? <span className="button-spinner" /> : <Undo2 size={15} />}
                      </button>
                    </div>
                  ) : searchFriendshipStatus === 'received_request' ? (
                    <button
                      className="chip-button"
                      onClick={() => acceptRequest(receivedRequestForSearchResult?.requestId)}
                      disabled={Boolean(busyAction) || !receivedRequestForSearchResult?.requestId}
                    >
                      {busyAction === `accept-${receivedRequestForSearchResult?.requestId}` ? <span className="button-spinner" /> : <Check size={15} />}
                      接受邀請
                    </button>
                  ) : (
                    <button className="chip-button" onClick={sendRequest} disabled={Boolean(busyAction)}>
                      {busyAction === 'request' ? <span className="button-spinner" /> : <UserPlus size={15} />}
                      加入好友
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
                  <p className="quiet-note">尚未送出好友邀請</p>
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
                  <p className="quiet-note">尚未收到好友邀請</p>
                )}
              </section>

              <section className="social-section">
                <div className="section-title">
                  <Users size={16} />
                  <span>我的好友</span>
                </div>
                <label className="friend-list-search">
                  <Search size={15} />
                  <input
                    value={friendQuery}
                    onChange={(event) => setFriendQuery(event.target.value)}
                    placeholder="搜尋好友名稱或 ID"
                  />
                </label>
                {friendList.length > 0 ? (
                  filteredFriends.length > 0 ? (
                    filteredFriends.map((friend) => (
                      <article
                        className="person-card clickable"
                        key={friend._id}
                        onClick={() => openFriendProfile(friend)}
                      >
                        <div className="avatar-orb small">{friend.name.slice(0, 1).toUpperCase()}</div>
                        <div>
                          <strong>{friend.name}</strong>
                          <span>@{friend.userCode} · 已是好友</span>
                        </div>
                        <div className="person-actions">
                          <button
                            className="icon-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openFriendProfile(friend);
                            }}
                            disabled={busyAction === `profile-${friend._id}`}
                            aria-label="查看好友資料"
                          >
                            {busyAction === `profile-${friend._id}` ? <span className="button-spinner" /> : <UserRound size={15} />}
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFriendToDelete(friend);
                            }}
                            aria-label="刪除好友"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="quiet-note">找不到符合條件的好友</p>
                  )
                ) : (
                  <p className="quiet-note">還沒有好友。搜尋使用者 ID，開始建立你的 Adrift 連結。</p>
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

function getFriendshipLabel(status) {
  const labels = {
    self: '自己',
    friend: '已是好友',
    sent_request: '已送出邀請',
    received_request: '收到邀請',
    none: '可加好友'
  };

  return labels[status] || labels.none;
}

function getVisibilityEmptyMessage(filter) {
  const messages = {
    private: '沒有私人日記',
    friends: '沒有朋友可見日記',
    public: '沒有公開日記',
    all: '還沒有日記'
  };

  return messages[filter] || messages.all;
}

function sameId(left, right) {
  return Boolean(left && right && left.toString() === right.toString());
}


