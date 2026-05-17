import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  BookOpen,
  CalendarDays,
  Clock3,
  Compass,
  Eye,
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
import ToastViewport from './ToastViewport.jsx';

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
  socialRefreshToken = 0,
  variant = 'panel',
  mapMode = 'mine',
  exploreRadius = 5000,
  exploreRadiusOptions = [],
  visibilityFilter = 'all',
  diaryLoading = false,
  onActivateMineMode,
  onActivateExploreMode,
  onExploreRadiusChange,
  onVisibilityFilterChange,
  selectedDiaryId,
  onSelectDiary,
  onNewDiary,
  createDiaryDisabled = false,
  onSearchUser,
  onSendFriendRequest,
  onCancelFriendRequest,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onGetFriendRecommendations,
  onGetFriendProfile,
  onDeleteFriend,
  lowPerformance = false
}) {
  const isFriendsPage = variant === 'friendsPage';
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [busyAction, setBusyAction] = useState('');
  const [timeNow, setTimeNow] = useState(() => Date.now());
  const [friendQuery, setFriendQuery] = useState('');
  const [friendProfile, setFriendProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [friendToDelete, setFriendToDelete] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [recommendationStatus, setRecommendationStatus] = useState({});
  const [inviteTab, setInviteTab] = useState('received');

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

  useEffect(() => {
    if (!isFriendsPage || !onGetFriendRecommendations) return undefined;

    let active = true;
    setRecommendationsLoading(true);
    setRecommendationsError('');
    setRecommendationStatus({});

    onGetFriendRecommendations()
      .then((items) => {
        if (!active) return;
        setRecommendations(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!active) return;
        setRecommendations([]);
        setRecommendationsError('推薦好友載入失敗，請稍後再試');
      })
      .finally(() => {
        if (active) setRecommendationsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isFriendsPage, onGetFriendRecommendations, socialRefreshToken]);

  const visibleDiaries = diaries || [];
  const friendList = friends || [];
  const requests = friendRequests || [];
  const sentRequests = sentFriendRequests || [];
  const mine = visibleDiaries.filter((diary) => sameId(diary.user?._id || diary.user?.id, user?.id));
  const listedDiaries = [...visibleDiaries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const sentRequestForSearchResult = searchResult
    ? sentRequests.find((request) => sameId(request.to?._id, searchResult._id))
    : null;
  const receivedRequestForSearchResult = searchResult
    ? requests.find((request) => sameId(request.from?._id, searchResult._id))
    : null;
  const searchResultIsFriend = searchResult
    ? friendList.some((friend) => sameId(friend._id, searchResult._id))
    : false;
  const searchFriendshipStatus = getSyncedFriendshipStatus({
    explicitStatus: searchResult?.friendshipStatus,
    isFriend: searchResultIsFriend,
    sentRequest: sentRequestForSearchResult,
    receivedRequest: receivedRequestForSearchResult
  });
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

  function updateSearchResultStatus(userId, status) {
    setSearchResult((current) => {
      if (!current || (userId && !sameId(current._id, userId))) return current;
      return { ...current, friendshipStatus: status };
    });
  }

  async function searchUser(event) {
    event.preventDefault();
    const normalized = searchCode.trim();

    if (!normalized) {
      setSearchResult(null);
      setSearchError('請輸入使用者 ID');
      return;
    }

    if (!USER_CODE_PATTERN.test(normalized)) {
      setSearchResult(null);
      setSearchError('使用者 ID 只能包含英文、數字、底線、減號，長度需為 4 到 20 字元');
      return;
    }

    try {
      setBusyAction('search');
      setSearchResult(null);
      setSearchError('');
      const result = await onSearchUser(normalized);
      setSearchResult(result);
    } catch (error) {
      setSearchResult(null);
      setSearchError(error.message || '找不到此使用者');
    } finally {
      setBusyAction('');
    }
  }

  async function sendRequest() {
    if (!searchResult?._id) return;

    try {
      setBusyAction('request');
      updateSearchResultStatus(searchResult._id, 'sent_request');
      const payload = await onSendFriendRequest(searchResult._id);
      showMessage(payload.message || '好友邀請已送出');
    } catch (error) {
      updateSearchResultStatus(searchResult._id, 'none');
      showMessage(error.message || '好友邀請送出失敗', 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function sendRecommendationRequest(recommendation) {
    if (!recommendation?._id) return;

    try {
      setBusyAction(`recommend-${recommendation._id}`);
      setRecommendationStatus((current) => ({ ...current, [recommendation._id]: 'sent_request' }));
      updateSearchResultStatus(recommendation._id, 'sent_request');
      const payload = await onSendFriendRequest(recommendation._id);
      showMessage(payload.message || '好友邀請已送出');
    } catch (error) {
      setRecommendationStatus((current) => ({ ...current, [recommendation._id]: 'none' }));
      updateSearchResultStatus(recommendation._id, 'none');
      showMessage(error.message || '好友邀請送出失敗', 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function cancelRecommendationRequest(recommendation, requestId) {
    if (!recommendation?._id || !requestId) return;

    try {
      setBusyAction(`cancel-recommend-${recommendation._id}`);
      setRecommendationStatus((current) => ({ ...current, [recommendation._id]: 'none' }));
      updateSearchResultStatus(recommendation._id, 'none');
      const payload = await onCancelFriendRequest(requestId);
      showMessage(payload.message || '好友邀請已收回');
    } catch (error) {
      setRecommendationStatus((current) => ({ ...current, [recommendation._id]: 'sent_request' }));
      updateSearchResultStatus(recommendation._id, 'sent_request');
      showMessage(error.message || '收回好友邀請失敗', 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function cancelRequest(requestId) {
    if (!requestId) return;
    const request = sentRequests.find((item) => sameId(item.requestId, requestId));
    const targetUserId = request?.to?._id;

    try {
      setBusyAction(`cancel-${requestId}`);
      updateSearchResultStatus(targetUserId, 'none');
      if (targetUserId) {
        setRecommendationStatus((current) => ({ ...current, [targetUserId]: 'none' }));
      }
      const payload = await onCancelFriendRequest(requestId);
      showMessage(payload.message || '好友邀請已收回');
    } catch (error) {
      updateSearchResultStatus(targetUserId, 'sent_request');
      showMessage(error.message || '收回好友邀請失敗', 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function acceptRequest(request) {
    const requestId = request?.requestId;
    if (!requestId) return;

    try {
      setBusyAction(`accept-${requestId}`);
      updateSearchResultStatus(request.from?._id, 'friend');
      const payload = await onAcceptFriendRequest(requestId);
      setRecommendations((current) => current.filter((item) => !sameId(item._id, request.from?._id)));
      showMessage(payload.message || '已成為好友');
    } catch (error) {
      updateSearchResultStatus(request.from?._id, 'received_request');
      showMessage(error.message || '接受好友邀請失敗', 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function rejectRequest(request) {
    const requestId = request?.requestId;
    if (!requestId) return;

    try {
      setBusyAction(`reject-${requestId}`);
      updateSearchResultStatus(request.from?._id, 'none');
      const payload = await onRejectFriendRequest(requestId);
      showMessage(payload.message || '已拒絕好友邀請');
    } catch (error) {
      updateSearchResultStatus(request.from?._id, 'received_request');
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
      updateSearchResultStatus(friendToDelete._id, 'none');
      const payload = await onDeleteFriend(friendToDelete._id);
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
      onSelectDiary(diary);
      return;
    }

    showMessage('目前沒有可查看的好友日記', 'error');
  }

  const friendProfileModal = friendProfile ? createPortal(
    <motion.div className="modal-backdrop" {...toastMotion}>
      <motion.article className="friend-profile-modal glass" {...fadeUpMotion}>
        <header className="friend-profile-header">
          <div className="avatar-orb">{friendProfile.name?.slice(0, 1).toUpperCase()}</div>
          <div>
            <p className="eyebrow">好友資料</p>
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
          <button className="friend-primary-button" type="button" onClick={() => viewFriendDiaries(friendProfile)}>
            <BookOpen size={15} />
            查看地圖日記
          </button>
          <button className="friend-danger-button" type="button" onClick={() => setFriendToDelete(friendProfile)}>
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
            <p className="eyebrow">刪除好友</p>
            <h3>確定要刪除此好友嗎？</h3>
            <span>@{friendToDelete.userCode}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => setFriendToDelete(null)} aria-label="取消刪除好友">
            <X size={16} />
          </button>
        </header>
        <p className="quiet-note">刪除後，你們將無法再查看彼此的好友限定日記。這不會刪除任何日記或帳號。</p>
        <footer className="friend-profile-actions">
          <button className="friend-secondary-button" type="button" onClick={() => setFriendToDelete(null)}>取消</button>
          <button
            className="friend-danger-button"
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
      <ToastViewport
        toast={message ? { id: `${messageType}-${message}`, message, type: messageType } : null}
        className={isFriendsPage ? '' : 'avoid-sidebar'}
        onDismiss={() => setMessage('')}
      />
      {friendProfileModal}
      {deleteFriendModal}
      <motion.section
        className={isFriendsPage ? 'friends-page-shell glass' : 'memory-panel glass'}
        {...panelSlideRight}
      >
        {isFriendsPage ? (
          <>
            <header className="friends-page-hero">
              <div>
                <p className="eyebrow">Friends</p>
                <h2>好友</h2>
                <span>連結你想分享記憶的人</span>
              </div>
              <strong>{friendList.length} 位好友 · {requests.length} 則邀請</strong>
            </header>
            <div className="friends-stat-grid" aria-label="好友狀態摘要">
              <article>
                <strong>{friendList.length}</strong>
                <span>我的好友</span>
              </article>
              <article>
                <strong>{requests.length}</strong>
                <span>收到邀請</span>
              </article>
              <article>
                <strong>{sentRequests.length}</strong>
                <span>已送出</span>
              </article>
            </div>
          </>
        ) : (
          <header className="memory-header map-diary-header">
            <div className="map-diary-title-group">
              <h2>地圖日記</h2>
              <p>在真實地點留下你的記憶</p>
            </div>
            <button
              className="create-diary-button"
              type="button"
              onClick={onNewDiary}
              disabled={createDiaryDisabled}
            >
              {createDiaryDisabled ? <span className="button-spinner" /> : <Plus size={16} />}
              <span className="create-diary-label-full">新增日記</span>
              <span className="create-diary-label-short">日記</span>
            </button>
          </header>
        )}

        <AnimatePresence mode="wait">
          {!isFriendsPage ? (
            <motion.div
              key="memories"
              className="panel-scroll memory-panel-content"
              {...fadeUpMotion}
            >
              <div className="memory-controls">
                <div className="map-mode-switch sidebar-map-mode" aria-label="地圖模式">
                  <button className={mapMode === 'mine' ? 'active' : ''} type="button" onClick={onActivateMineMode}>
                    我的地圖
                  </button>
                  <button className={mapMode === 'explore' ? 'active' : ''} type="button" onClick={() => onActivateExploreMode?.()}>
                    <Compass size={15} />
                    附近動態
                  </button>
                </div>

                {mapMode === 'explore' && (
                  <div className="radius-switch sidebar-radius-switch" aria-label="附近動態半徑">
                    {exploreRadiusOptions.map((option) => (
                      <button
                        key={option.value}
                        className={exploreRadius === option.value ? 'active' : ''}
                        onClick={() => onExploreRadiusChange?.(option.value)}
                        disabled={diaryLoading}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="memory-stats">
                  <article>
                    <span>{mine.length}</span>
                    <p>我的足跡</p>
                  </article>
                  <article>
                    <span>{visibleDiaries.length}</span>
                    <p>可見記憶</p>
                  </article>
                </div>

                {mapMode === 'explore' ? (
                  <p className="visibility-filter-note">附近動態只顯示公開日記</p>
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
              </div>

              <section className="memory-section">
                <div className="section-title">
                  <Clock3 size={16} />
                  <span>目前地圖日記</span>
                </div>

                <div className="diary-list-scroll-area">
                  {listedDiaries.length > 0 ? (
                    <div className="memory-list">
                      {listedDiaries.map((diary, index) => {
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
                                {(diary.editCount > 0 || diary.lastEditedAt) && <span className="memory-edited-label">已編輯</span>}
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
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="social"
              className={isFriendsPage ? 'friends-page-content' : 'panel-scroll social-panel'}
              {...fadeUpMotion}
            >
              <div className="friends-main-column">
                <form className="friend-page-card friend-search-card" onSubmit={searchUser}>
                  <div className="friend-card-heading">
                    <div>
                      <p className="eyebrow">Search</p>
                      <h3>搜尋好友</h3>
                    </div>
                    <Search size={18} />
                  </div>
                  <p className="friend-card-copy">輸入使用者 ID，找到你想連結的人。</p>
                  <label className="friend-search-control">
                    <span>使用者 ID</span>
                    <div className="inline-control">
                      <input
                        value={searchCode}
                        onChange={(event) => {
                          setSearchCode(event.target.value);
                          if (searchError) setSearchError('');
                        }}
                        placeholder="輸入 userCode，例如 arren1088"
                      />
                      <button className="friend-primary-button" type="submit" disabled={busyAction === 'search'}>
                        {busyAction === 'search' ? <span className="button-spinner dark" /> : <Search size={15} />}
                        {busyAction === 'search' ? '搜尋中' : '搜尋'}
                      </button>
                    </div>
                  </label>

                  {searchError && (
                    <p className="friend-inline-note error-note">{searchError}</p>
                  )}

                  {searchResult && (
                    <article className="friend-user-card search-result-card">
                      <span className="avatar-orb">{searchResult.name.slice(0, 1).toUpperCase()}</span>
                      <div className="friend-user-main">
                        <strong>{searchResult.name}</strong>
                        <span>@{searchResult.userCode}</span>
                        <small>{getFriendshipLabel(searchFriendshipStatus)}</small>
                      </div>
                      <div className="friend-actions">
                        {searchFriendshipStatus === 'self' ? (
                          <span className="friend-status-pill">這是你自己</span>
                        ) : searchFriendshipStatus === 'friend' ? (
                          <button className="friend-primary-button compact" type="button" onClick={() => openFriendProfile(searchResult)}>
                            <UserRound size={15} />
                            查看
                          </button>
                        ) : searchFriendshipStatus === 'sent_request' ? (
                          <>
                            <span className="friend-status-pill">已送出邀請</span>
                            <button
                              className="friend-secondary-button compact"
                              type="button"
                              onClick={() => cancelRequest(sentRequestForSearchResult?.requestId)}
                              disabled={busyAction === `cancel-${sentRequestForSearchResult?.requestId}` || !sentRequestForSearchResult?.requestId}
                            >
                              {busyAction === `cancel-${sentRequestForSearchResult?.requestId}` ? <span className="button-spinner" /> : <Undo2 size={15} />}
                              收回
                            </button>
                          </>
                        ) : searchFriendshipStatus === 'received_request' ? (
                          <>
                            <span className="friend-status-pill">對方已邀請你</span>
                            <button
                              className="friend-primary-button compact"
                              type="button"
                              onClick={() => acceptRequest(receivedRequestForSearchResult)}
                              disabled={busyAction === `accept-${receivedRequestForSearchResult?.requestId}` || !receivedRequestForSearchResult?.requestId}
                            >
                              {busyAction === `accept-${receivedRequestForSearchResult?.requestId}` ? <span className="button-spinner dark" /> : <Check size={15} />}
                              接受
                            </button>
                          </>
                        ) : (
                          <button className="friend-primary-button compact" type="button" onClick={sendRequest} disabled={busyAction === 'request'}>
                            {busyAction === 'request' ? <span className="button-spinner dark" /> : <UserPlus size={15} />}
                            {busyAction === 'request' ? '送出中' : '加入好友'}
                          </button>
                        )}
                      </div>
                    </article>
                  )}
                </form>

                <section className="friend-page-card recommendations-section">
                  <div className="friend-card-heading">
                    <div>
                      <p className="eyebrow">Suggestions</p>
                      <h3>推薦好友</h3>
                    </div>
                    <Sparkles size={18} />
                  </div>

                  {recommendationsLoading ? (
                    <div className="friend-empty-state compact">
                      <span className="button-spinner" />
                      <p>載入推薦好友...</p>
                    </div>
                  ) : recommendationsError ? (
                    <p className="friend-inline-note error-note">{recommendationsError}</p>
                  ) : recommendations.length > 0 ? (
                    <div className="friend-recommendation-grid">
                      {recommendations.map((recommendation) => {
                        const sentRequest = sentRequests.find((request) => sameId(request.to?._id, recommendation._id));
                        const status = recommendationStatus[recommendation._id] || (sentRequest ? 'sent_request' : 'none');
                        const tags = getRecommendationTags(recommendation);

                        return (
                          <article className="recommendation-card friend-recommendation-card" key={recommendation._id}>
                            <span className="avatar-orb small">{recommendation.name.slice(0, 1).toUpperCase()}</span>
                            <div className="recommendation-body">
                              <div className="recommendation-heading">
                                <strong>{recommendation.name}</strong>
                                <span>@{recommendation.userCode}</span>
                              </div>
                              <p>{recommendation.reasons?.[0] || '你們可能有相近的 Adrift 足跡。'}</p>
                              {tags.length > 0 && (
                                <div className="recommendation-tags">
                                  {tags.map((tag) => (
                                    <span key={tag}>{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="recommendation-actions">
                              {status === 'sent_request' ? (
                                <>
                                  <span className="friend-status-pill">已送出</span>
                                  <button
                                    className="friend-secondary-button compact"
                                    type="button"
                                    onClick={() => cancelRecommendationRequest(recommendation, sentRequest?.requestId)}
                                    disabled={!sentRequest?.requestId || busyAction === `cancel-recommend-${recommendation._id}`}
                                  >
                                    {busyAction === `cancel-recommend-${recommendation._id}` ? <span className="button-spinner" /> : <Undo2 size={15} />}
                                    收回
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="friend-primary-button compact"
                                  type="button"
                                  onClick={() => sendRecommendationRequest(recommendation)}
                                  disabled={busyAction === `recommend-${recommendation._id}`}
                                >
                                  {busyAction === `recommend-${recommendation._id}` ? <span className="button-spinner dark" /> : <UserPlus size={15} />}
                                  加好友
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="friend-empty-state">
                      <Sparkles size={18} />
                      <strong>目前沒有適合的推薦好友</strong>
                      <p>多新增一些公開日記或好友後，推薦會更準確。</p>
                    </div>
                  )}
                </section>

                <section className="friend-page-card friend-invites-card">
                  <div className="friend-card-heading">
                    <div>
                      <p className="eyebrow">Invites</p>
                      <h3>好友邀請</h3>
                    </div>
                    <UserPlus size={18} />
                  </div>
                  <div className="friend-segmented" aria-label="好友邀請分類">
                    <button className={inviteTab === 'received' ? 'active' : ''} type="button" onClick={() => setInviteTab('received')}>
                      收到的邀請
                      {requests.length > 0 && <span>{requests.length}</span>}
                    </button>
                    <button className={inviteTab === 'sent' ? 'active' : ''} type="button" onClick={() => setInviteTab('sent')}>
                      已送出的邀請
                      {sentRequests.length > 0 && <span>{sentRequests.length}</span>}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {inviteTab === 'received' ? (
                      <motion.div key="received" className="friend-invite-list" {...fadeUpMotion}>
                        {requests.length > 0 ? (
                          requests.map((request) => (
                            <article className="friend-user-card invite-card" key={request.requestId}>
                              <span className="avatar-orb small">{request.from.name.slice(0, 1).toUpperCase()}</span>
                              <div className="friend-user-main">
                                <strong>{request.from.name}</strong>
                                <span>@{request.from.userCode}</span>
                                <small>{request.createdAt ? new Date(request.createdAt).toLocaleString() : '新的邀請'}</small>
                              </div>
                              <div className="friend-actions">
                                <button
                                  className="friend-primary-button compact"
                                  type="button"
                                  onClick={() => acceptRequest(request)}
                                  disabled={busyAction === `accept-${request.requestId}`}
                                >
                                  {busyAction === `accept-${request.requestId}` ? <span className="button-spinner dark" /> : <Check size={15} />}
                                  接受
                                </button>
                                <button
                                  className="friend-secondary-button compact"
                                  type="button"
                                  onClick={() => rejectRequest(request)}
                                  disabled={busyAction === `reject-${request.requestId}`}
                                >
                                  {busyAction === `reject-${request.requestId}` ? <span className="button-spinner" /> : <X size={15} />}
                                  拒絕
                                </button>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="friend-empty-state compact">
                            <UserPlus size={18} />
                            <strong>尚未收到好友邀請</strong>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div key="sent" className="friend-invite-list" {...fadeUpMotion}>
                        {sentRequests.length > 0 ? (
                          sentRequests.map((request) => (
                            <article className="friend-user-card invite-card" key={request.requestId}>
                              <span className="avatar-orb small">{request.to.name.slice(0, 1).toUpperCase()}</span>
                              <div className="friend-user-main">
                                <strong>{request.to.name}</strong>
                                <span>@{request.to.userCode}</span>
                                <small>{request.createdAt ? new Date(request.createdAt).toLocaleString() : '等待對方回覆'}</small>
                              </div>
                              <div className="friend-actions">
                                <span className="friend-status-pill">等待回覆</span>
                                <button
                                  className="friend-secondary-button compact"
                                  type="button"
                                  onClick={() => cancelRequest(request.requestId)}
                                  disabled={busyAction === `cancel-${request.requestId}`}
                                >
                                  {busyAction === `cancel-${request.requestId}` ? <span className="button-spinner" /> : <Undo2 size={15} />}
                                  收回邀請
                                </button>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="friend-empty-state compact">
                            <Undo2 size={18} />
                            <strong>尚未送出好友邀請</strong>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </div>

              <aside className="friends-side-column">
                <section className="friend-page-card friends-list-card">
                  <div className="friend-card-heading">
                    <div>
                      <p className="eyebrow">Friends</p>
                      <h3>我的好友</h3>
                    </div>
                    <Users size={18} />
                  </div>
                  <label className="friend-list-search">
                    <Search size={15} />
                    <input
                      value={friendQuery}
                      onChange={(event) => setFriendQuery(event.target.value)}
                      placeholder="搜尋好友名稱或 ID"
                    />
                  </label>
                  <div className="friends-list">
                    {friendList.length > 0 ? (
                      filteredFriends.length > 0 ? (
                        filteredFriends.map((friend) => (
                          <article
                            className="friend-user-card friend-list-item"
                            key={friend._id}
                            onClick={() => openFriendProfile(friend)}
                          >
                            <span className="avatar-orb small">{friend.name.slice(0, 1).toUpperCase()}</span>
                            <div className="friend-user-main">
                              <strong>{friend.name}</strong>
                              <span>@{friend.userCode}</span>
                            </div>
                            <div className="friend-actions">
                              <button
                                className="friend-secondary-button icon-only"
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
                                className="friend-danger-button icon-only"
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
                        <div className="friend-empty-state compact">
                          <Search size={18} />
                          <strong>找不到符合條件的好友</strong>
                        </div>
                      )
                    ) : (
                      <div className="friend-empty-state">
                        <Users size={20} />
                        <strong>還沒有好友</strong>
                        <p>搜尋使用者 ID，開始建立你的 Adrift 連結。</p>
                      </div>
                    )}
                  </div>
                </section>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
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

function getSyncedFriendshipStatus({ explicitStatus, isFriend, sentRequest, receivedRequest }) {
  if (explicitStatus === 'self' || explicitStatus === 'blocked') return explicitStatus;
  if (isFriend) return 'friend';
  if (sentRequest) return 'sent_request';
  if (receivedRequest) return 'received_request';
  return explicitStatus || 'none';
}

function getRecommendationTags(recommendation) {
  const tags = [];

  (recommendation.sharedMoods || []).slice(0, 2).forEach((mood) => tags.push(mood));
  (recommendation.nearbyPlaces || []).slice(0, 2).forEach((place) => tags.push(place));

  if (recommendation.mutualFriendsCount > 0) {
    tags.push(`${recommendation.mutualFriendsCount} 位共同好友`);
  }

  return tags;
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
