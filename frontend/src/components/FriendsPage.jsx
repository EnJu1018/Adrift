import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BookOpen,
  CalendarDays,
  Check,
  Eye,
  MoreHorizontal,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  UserPlus,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fadeUpMotion, listItemMotion, modalBackdropMotion, modalPopMotion, pageFadeUp } from '../constants/animations.js';
import { USER_CODE_PATTERN } from '../constants/app.js';
import ToastViewport from './ToastViewport.jsx';

export default function FriendsPage({
  user,
  diaries,
  friends,
  friendRequests,
  sentFriendRequests,
  socialRefreshToken = 0,
  onOpenDiary,
  onSearchUser,
  onSendFriendRequest,
  onCancelFriendRequest,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onGetFriendRecommendations,
  onGetFriendProfile,
  onDeleteFriend
}) {
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [friendQuery, setFriendQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [friendToDelete, setFriendToDelete] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [recommendationStatus, setRecommendationStatus] = useState({});
  const [inviteTab, setInviteTab] = useState('received');
  const [friendSort, setFriendSort] = useState('name');
  const [friendActionMenuId, setFriendActionMenuId] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const friendList = friends || [];
  const requests = friendRequests || [];
  const sentRequests = sentFriendRequests || [];
  const visibleDiaries = diaries || [];

  const filteredFriends = useMemo(() => {
    const normalized = friendQuery.trim().toLowerCase();
    const nextFriends = normalized
      ? friendList.filter((friend) => {
          const name = friend.name?.toLowerCase() || '';
          const userCode = friend.userCode?.toLowerCase() || '';
          return name.includes(normalized) || userCode.includes(normalized);
        })
      : [...friendList];

    if (friendSort === 'joined') {
      return nextFriends.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    if (friendSort === 'name') {
      return nextFriends.sort((a, b) => (a.name || a.userCode || '').localeCompare(b.name || b.userCode || '', 'zh-Hant'));
    }

    return nextFriends;
  }, [friendList, friendQuery, friendSort]);

  const friendActivity = useMemo(() => {
    const friendIds = new Set(friendList.map((friend) => friend._id?.toString()).filter(Boolean));

    return visibleDiaries
      .filter((diary) => {
        if (diary.visibility === 'private') return false;
        const author = getDiaryAuthor(diary);
        return friendIds.has(author?._id?.toString());
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [friendList, visibleDiaries]);

  const searchFriendshipStatus = useMemo(() => {
    if (!searchResult) return 'none';

    const sentRequest = sentRequests.find((request) => sameId(request.to?._id, searchResult._id));
    const receivedRequest = requests.find((request) => sameId(request.from?._id, searchResult._id));
    const isFriend = friendList.some((friend) => sameId(friend._id, searchResult._id));

    return getSyncedFriendshipStatus({
      explicitStatus: searchResult.friendshipStatus,
      isFriend,
      sentRequest,
      receivedRequest
    });
  }, [friendList, requests, searchResult, sentRequests]);

  const sentRequestForSearchResult = searchResult
    ? sentRequests.find((request) => sameId(request.to?._id, searchResult._id))
    : null;
  const receivedRequestForSearchResult = searchResult
    ? requests.find((request) => sameId(request.from?._id, searchResult._id))
    : null;

  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(() => {
      setMessage('');
    }, messageType === 'success' ? 1800 : 2600);

    return () => window.clearTimeout(timer);
  }, [message, messageType]);

  useEffect(() => {
    if (!onGetFriendRecommendations) return undefined;

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
  }, [onGetFriendRecommendations, socialRefreshToken]);

  useEffect(() => {
    if (friendList.length === 0) {
      setSelectedFriend(null);
      setSelectedProfile(null);
      return;
    }

    if (!selectedFriend || !friendList.some((friend) => sameId(friend._id, selectedFriend._id))) {
      setSelectedFriend(friendList[0]);
    }
  }, [friendList, selectedFriend]);

  useEffect(() => {
    if (!selectedFriend?._id || !onGetFriendProfile) {
      setSelectedProfile(null);
      return undefined;
    }

    let active = true;
    const actionId = `profile-${selectedFriend._id}`;
    setProfileError('');
    setBusyAction((current) => (current ? current : actionId));

    onGetFriendProfile(selectedFriend._id)
      .then((profile) => {
        if (!active) return;
        setSelectedProfile(profile || selectedFriend);
      })
      .catch((error) => {
        if (!active) return;
        setSelectedProfile(selectedFriend);
        setProfileError(error.message || '無法取得好友資料');
      })
      .finally(() => {
        if (active) {
          setBusyAction((current) => (current === actionId ? '' : current));
        }
      });

    return () => {
      active = false;
    };
  }, [onGetFriendProfile, selectedFriend]);

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
      setSearchError('請確認 userCode 是否正確');
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
      setSearchError('找不到此使用者，請確認 userCode 是否正確。');
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

  async function confirmDeleteFriend() {
    if (!friendToDelete?._id || !onDeleteFriend) return;

    try {
      setBusyAction(`delete-friend-${friendToDelete._id}`);
      updateSearchResultStatus(friendToDelete._id, 'none');
      const payload = await onDeleteFriend(friendToDelete._id);
      if (sameId(selectedFriend?._id, friendToDelete._id)) {
        const nextFriend = friendList.find((friend) => !sameId(friend._id, friendToDelete._id)) || null;
        setSelectedFriend(nextFriend);
        setSelectedProfile(nextFriend);
      }
      setFriendToDelete(null);
      setFriendActionMenuId(null);
      showMessage(payload.message || '已刪除好友');
    } catch (error) {
      showMessage(error.message || '刪除好友失敗', 'error');
    } finally {
      setBusyAction('');
    }
  }

  function selectFriend(friend) {
    setSelectedFriend(friend);
    setFriendActionMenuId(null);
  }

  function viewFriendDiaries(profile) {
    const diary = visibleDiaries.find((item) => {
      const author = getDiaryAuthor(item);
      return sameId(author?._id, profile?._id);
    });

    if (diary) {
      onOpenDiary?.(diary);
      return;
    }

    showMessage('目前沒有可查看的好友日記', 'error');
  }

  function viewSearchFriend() {
    if (!searchResult) return;
    selectFriend(searchResult);
  }

  const deleteFriendModal = friendToDelete ? createPortal(
    <motion.div className="modal-backdrop" {...modalBackdropMotion}>
      <motion.article className="friend-profile-modal danger glass" {...modalPopMotion}>
        <header className="friend-profile-header">
          <div className="avatar-orb small">{getInitial(friendToDelete.name)}</div>
          <div>
            <p className="eyebrow">刪除好友</p>
            <h3>刪除好友？</h3>
            <span>@{friendToDelete.userCode}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => setFriendToDelete(null)} aria-label="取消刪除好友">
            <X size={16} />
          </button>
        </header>
        <p className="quiet-note">刪除後，你們將無法再查看彼此的好友限定日記。</p>
        <footer className="friend-profile-actions">
          <button className="friend-secondary-button" type="button" onClick={() => setFriendToDelete(null)}>取消</button>
          <button
            className="friend-danger-button"
            type="button"
            onClick={confirmDeleteFriend}
            disabled={busyAction === `delete-friend-${friendToDelete._id}`}
          >
            {busyAction === `delete-friend-${friendToDelete._id}` ? <span className="button-spinner" /> : <Trash2 size={15} />}
            刪除好友
          </button>
        </footer>
      </motion.article>
    </motion.div>,
    document.body
  ) : null;

  const selectedDisplayProfile = selectedProfile || selectedFriend;

  return (
    <>
      <ToastViewport
        toast={message ? { id: `${messageType}-${message}`, message, type: messageType } : null}
        onDismiss={() => setMessage('')}
      />
      {deleteFriendModal}
      <motion.main className="friends-hub glass" {...pageFadeUp}>
        <header className="friends-hub-header">
          <div>
            <h2>好友</h2>
            <span>透過使用者 ID 找到朋友，分享你的地圖日記。</span>
          </div>
          <div className="friends-hub-pills" aria-label="好友狀態摘要">
            <span><strong>{friendList.length}</strong> 位好友 · <strong>{requests.length}</strong> 則邀請</span>
          </div>
        </header>

        <motion.div className="friends-new-user-flow" {...fadeUpMotion}>
          <SearchCard
            searchCode={searchCode}
            searchResult={searchResult}
            searchError={searchError}
            searchFriendshipStatus={searchFriendshipStatus}
            sentRequest={sentRequestForSearchResult}
            receivedRequest={receivedRequestForSearchResult}
            busyAction={busyAction}
            onSearchCodeChange={setSearchCode}
            onSearch={searchUser}
            onViewFriend={viewSearchFriend}
            onSend={sendRequest}
            onCancel={cancelRequest}
            onAccept={acceptRequest}
            onReject={rejectRequest}
          />

          <InvitesPanel
            inviteTab={inviteTab}
            requests={requests}
            sentRequests={sentRequests}
            busyAction={busyAction}
            compact
            onInviteTabChange={setInviteTab}
            onAccept={acceptRequest}
            onReject={rejectRequest}
            onCancel={cancelRequest}
          />

          <FriendsDirectory
            friends={friendList}
            filteredFriends={filteredFriends}
            friendQuery={friendQuery}
            friendSort={friendSort}
            friendActionMenuId={friendActionMenuId}
            selectedFriend={selectedFriend}
            selectedProfile={selectedDisplayProfile}
            profileError={profileError}
            busyAction={busyAction}
            onFriendQueryChange={setFriendQuery}
            onFriendSortChange={setFriendSort}
            onSelectFriend={selectFriend}
            onFriendActionMenuChange={setFriendActionMenuId}
            onViewDiary={viewFriendDiaries}
            onDeleteFriend={setFriendToDelete}
          />

          <RecommendationsPanel
            recommendations={recommendations}
            recommendationsLoading={recommendationsLoading}
            recommendationsError={recommendationsError}
            recommendationStatus={recommendationStatus}
            sentRequests={sentRequests}
            busyAction={busyAction}
            limit={6}
            subdued
            onSendRecommendation={sendRecommendationRequest}
            onCancelRecommendation={cancelRecommendationRequest}
          />
        </motion.div>
      </motion.main>
    </>
  );
}

function SectionHeading({ icon, title, description, badge }) {
  return (
    <div className="friends-section-heading">
      <div className="section-title">
        {icon}
        <h3>{title}</h3>
        {badge ? <span className="section-title-badge">{badge}</span> : null}
      </div>
      {description && <p>{description}</p>}
    </div>
  );
}

function SearchCard({
  searchCode,
  searchResult,
  searchError,
  searchFriendshipStatus,
  sentRequest,
  receivedRequest,
  busyAction,
  onSearchCodeChange,
  onSearch,
  onViewFriend,
  onSend,
  onCancel,
  onAccept,
  onReject
}) {
  return (
    <section className="friends-hub-card search-social-card">
      <SectionHeading icon={<Search size={17} />} title="搜尋好友" description="輸入朋友的使用者 ID，送出好友邀請。" />

      <form className="friends-quick-search inline" onSubmit={onSearch}>
        <label>
          <Search size={17} />
          <input
            value={searchCode}
            onChange={(event) => onSearchCodeChange(event.target.value)}
            placeholder="輸入 userCode，例如 arren1088"
          />
        </label>
        <button className="friend-primary-button" type="submit" disabled={busyAction === 'search'}>
          {busyAction === 'search' ? <span className="button-spinner dark" /> : <Search size={15} />}
          {busyAction === 'search' ? '搜尋中' : '搜尋'}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {searchResult ? (
          <motion.article className="search-result-card social-person-row" key={searchResult._id} {...fadeUpMotion}>
            <FriendIdentity user={searchResult} meta={getFriendshipLabel(searchFriendshipStatus)} />
            <SearchResultActions
              status={searchFriendshipStatus}
              busyAction={busyAction}
              sentRequest={sentRequest}
              receivedRequest={receivedRequest}
              onSelect={onViewFriend}
              onSend={onSend}
              onCancel={onCancel}
              onAccept={onAccept}
              onReject={onReject}
            />
          </motion.article>
        ) : searchError ? (
          <motion.div className="friends-search-error" key="search-error" {...fadeUpMotion}>
            <strong>{searchError.startsWith('找不到') ? '找不到此使用者' : searchError}</strong>
            {searchError.startsWith('找不到') && <span>請確認 userCode 是否正確。</span>}
          </motion.div>
        ) : (
          null
        )}
      </AnimatePresence>
    </section>
  );
}

function RecommendationsPanel({
  recommendations,
  recommendationsLoading,
  recommendationsError,
  recommendationStatus,
  sentRequests,
  busyAction,
  limit,
  full = false,
  subdued = false,
  onSendRecommendation,
  onCancelRecommendation,
  onShowAll
}) {
  const visibleRecommendations = typeof limit === 'number' ? recommendations.slice(0, limit) : recommendations;

  return (
    <section className={`friends-hub-card recommendations-panel ${subdued ? 'subdued' : ''}`}>
      <SectionHeading
        icon={<Sparkles size={17} />}
        title={full ? '推薦好友' : '可能認識的人'}
        description="根據共同好友、公開日記與相似心情推薦。"
      />

      {recommendationsLoading ? (
        <div className="friends-empty-panel compact">
          <span className="button-spinner" />
          <p>正在尋找可能認識的人...</p>
        </div>
      ) : recommendationsError ? (
        <p className="friend-inline-note error-note">{recommendationsError}</p>
      ) : visibleRecommendations.length > 0 ? (
        <>
          <div className={full ? 'recommendation-list-grid' : 'recommendation-strip'}>
            {visibleRecommendations.map((recommendation, index) => {
              const sentRequest = sentRequests.find((request) => sameId(request.to?._id, recommendation._id));
              const status = recommendationStatus[recommendation._id] || (sentRequest ? 'sent_request' : 'none');
              const tags = getRecommendationTags(recommendation);

              return (
                <motion.article className="social-suggestion-card" key={recommendation._id} {...listItemMotion(index)}>
                  <FriendIdentity user={recommendation} compact />
                  <p>{recommendation.reasons?.[0] || '你們可能有相近的 Adrift 足跡。'}</p>
                  {tags.length > 0 && (
                    <div className="recommendation-tags">
                      {tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="recommendation-actions">
                    {status === 'sent_request' ? (
                      <>
                        <span className="friend-status-pill">已送出</span>
                        <button
                          className="friend-secondary-button compact"
                          type="button"
                          onClick={() => onCancelRecommendation(recommendation, sentRequest?.requestId)}
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
                        onClick={() => onSendRecommendation(recommendation)}
                        disabled={busyAction === `recommend-${recommendation._id}`}
                      >
                        {busyAction === `recommend-${recommendation._id}` ? <span className="button-spinner dark" /> : <UserPlus size={15} />}
                        加好友
                      </button>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
          {onShowAll && recommendations.length > visibleRecommendations.length && (
            <button className="friend-secondary-button section-link" type="button" onClick={onShowAll}>
              查看全部推薦
            </button>
          )}
        </>
      ) : (
        <div className="friends-empty-panel">
          <Sparkles size={19} />
          <strong>目前沒有推薦好友</strong>
          <p>多新增公開日記或好友後，推薦會更準確。</p>
        </div>
      )}
    </section>
  );
}

function InvitesPanel({ inviteTab, requests, sentRequests, busyAction, compact = false, onInviteTabChange, onAccept, onReject, onCancel }) {
  return (
    <section className={`friends-hub-card invites-panel ${compact ? '' : 'centered-panel'}`}>
      <SectionHeading
        icon={<UserPlus size={17} />}
        title="好友邀請"
        badge={requests.length > 0 ? requests.length : null}
        description="集中處理新的連結與等待回覆。"
      />
      <div className="friend-segmented compact-tabs" aria-label="好友邀請分類">
        <button className={inviteTab === 'received' ? 'active' : ''} type="button" onClick={() => onInviteTabChange('received')}>
          收到的
          {requests.length > 0 && <span>{requests.length}</span>}
        </button>
        <button className={inviteTab === 'sent' ? 'active' : ''} type="button" onClick={() => onInviteTabChange('sent')}>
          已送出
          {sentRequests.length > 0 && <span>{sentRequests.length}</span>}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {inviteTab === 'received' ? (
          <motion.div className="social-invite-list" key="received" {...fadeUpMotion}>
            {requests.length > 0 ? (
              requests.map((request, index) => (
                <motion.article className="social-person-row" key={request.requestId} {...listItemMotion(index)}>
                  <FriendIdentity user={request.from} meta={formatDateTime(request.createdAt) || '新的邀請'} />
                  <div className="friend-actions">
                    <button
                      className="friend-primary-button compact"
                      type="button"
                      onClick={() => onAccept(request)}
                      disabled={busyAction === `accept-${request.requestId}`}
                    >
                      {busyAction === `accept-${request.requestId}` ? <span className="button-spinner dark" /> : <Check size={15} />}
                      接受
                    </button>
                    <button
                      className="friend-secondary-button compact"
                      type="button"
                      onClick={() => onReject(request)}
                      disabled={busyAction === `reject-${request.requestId}`}
                    >
                      {busyAction === `reject-${request.requestId}` ? <span className="button-spinner" /> : <X size={15} />}
                      拒絕
                    </button>
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="friends-empty-panel compact">
                <UserPlus size={18} />
                <strong>目前沒有好友邀請</strong>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div className="social-invite-list" key="sent" {...fadeUpMotion}>
            {sentRequests.length > 0 ? (
              sentRequests.map((request, index) => (
                <motion.article className="social-person-row" key={request.requestId} {...listItemMotion(index)}>
                  <FriendIdentity user={request.to} meta={formatDateTime(request.createdAt) || '等待回覆'} />
                  <div className="friend-actions">
                    <span className="friend-status-pill">等待回覆</span>
                    <button
                      className="friend-secondary-button compact"
                      type="button"
                      onClick={() => onCancel(request.requestId)}
                      disabled={busyAction === `cancel-${request.requestId}`}
                    >
                      {busyAction === `cancel-${request.requestId}` ? <span className="button-spinner" /> : <Undo2 size={15} />}
                      收回
                    </button>
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="friends-empty-panel compact">
                <Undo2 size={18} />
                <strong>尚未送出好友邀請</strong>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function FriendsDirectory({
  friends,
  filteredFriends,
  friendQuery,
  friendSort,
  friendActionMenuId,
  selectedFriend,
  selectedProfile,
  profileError,
  busyAction,
  onFriendQueryChange,
  onFriendSortChange,
  onSelectFriend,
  onFriendActionMenuChange,
  onViewDiary,
  onDeleteFriend
}) {
  return (
    <div className="friends-directory-grid">
      <section className="friends-hub-card friend-roster-card">
        <SectionHeading
          icon={<Users size={17} />}
          title="我的好友"
          description={friends.length > 0 ? `${friends.length} 位可以分享記憶的人` : '從搜尋開始建立你的 Adrift 連結。'}
        />
        <div className="friend-directory-toolbar">
          <label className="friend-list-search">
            <Search size={15} />
            <input
              value={friendQuery}
              onChange={(event) => onFriendQueryChange(event.target.value)}
              placeholder="搜尋好友名稱或 ID"
            />
          </label>
          <label className="friend-sort-control">
            <span>排序</span>
            <select value={friendSort} onChange={(event) => onFriendSortChange(event.target.value)}>
              <option value="recent">最近互動</option>
              <option value="name">名稱</option>
              <option value="joined">加入時間</option>
            </select>
          </label>
        </div>
        <div className="social-friend-list">
          {friends.length > 0 ? (
            filteredFriends.length > 0 ? (
              filteredFriends.map((friend, index) => (
                <motion.article
                  className={`social-friend-item ${sameId(selectedFriend?._id, friend._id) ? 'selected' : ''}`}
                  key={friend._id}
                  {...listItemMotion(index)}
                >
                  <FriendIdentity user={friend} compact />
                  <div className="friend-row-actions">
                    <button className="friend-secondary-button compact" type="button" onClick={() => onSelectFriend(friend)}>
                      查看
                    </button>
                    <button
                      className="friend-secondary-button icon-only subtle-icon"
                      type="button"
                      onClick={() => onFriendActionMenuChange((current) => (sameId(current, friend._id) ? null : friend._id))}
                      aria-label="更多好友操作"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {sameId(friendActionMenuId, friend._id) && (
                      <div className="friend-row-menu">
                        <button type="button" onClick={() => onSelectFriend(friend)}>
                          查看資料
                        </button>
                        <button className="danger-menu-item" type="button" onClick={() => onDeleteFriend(friend)}>
                          刪除好友
                        </button>
                      </div>
                    )}
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="friends-empty-panel compact">
                <Search size={18} />
                <strong>找不到符合條件的好友</strong>
              </div>
            )
          ) : (
            <div className="friends-empty-panel">
              <Users size={20} />
              <strong>還沒有好友</strong>
              <p>搜尋使用者 ID，開始建立你的 Adrift 連結。</p>
            </div>
          )}
        </div>
      </section>

      <FriendProfileCard
        profile={selectedProfile}
        profileError={profileError}
        busyAction={busyAction}
        onViewDiary={onViewDiary}
        onDeleteFriend={onDeleteFriend}
      />
    </div>
  );
}

function FriendProfileCard({ profile, profileError, onViewDiary, onDeleteFriend }) {
  if (!profile) {
    return (
      <section className="friends-profile-card">
        <div className="friends-empty-panel compact">
          <UserRound size={19} />
          <strong>選取好友查看資料</strong>
          <p>好友資料會在這裡以個人卡片呈現。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="friends-profile-card">
      <div className="profile-orb">{getInitial(profile.name)}</div>
      <h3>{profile.name}</h3>
      <span>@{profile.userCode}</span>
      {profileError && <p className="friend-inline-note error-note">{profileError}</p>}
      <div className="friends-profile-stats">
        <article>
          <CalendarDays size={15} />
          <span>加入 Adrift</span>
          <strong>{formatDate(profile.createdAt)}</strong>
        </article>
        <article>
          <Eye size={15} />
          <span>公開日記</span>
          <strong>{profile.diaryStats?.publicCount ?? 0}</strong>
        </article>
        <article>
          <Users size={15} />
          <span>好友可見</span>
          <strong>{profile.diaryStats?.friendsCount ?? 0}</strong>
        </article>
        {'mutualFriendsCount' in profile && (
          <article>
            <UserRound size={15} />
            <span>共同好友</span>
            <strong>{profile.mutualFriendsCount ?? 0}</strong>
          </article>
        )}
      </div>
      <div className="friend-profile-actions">
        <button className="friend-primary-button" type="button" onClick={() => onViewDiary(profile)}>
          <BookOpen size={15} />
          查看好友日記
        </button>
        <button className="friend-danger-button subtle" type="button" onClick={() => onDeleteFriend(profile)}>
          <Trash2 size={15} />
          刪除好友
        </button>
      </div>
    </section>
  );
}

function FriendActivityPanel({ activity, onOpenDiary }) {
  return (
    <section className="friends-hub-card activity-panel">
      <SectionHeading icon={<Activity size={17} />} title="好友最近動態" description="只顯示你目前有權限查看的日記。" />
      <div className="friend-activity-list">
        {activity.length > 0 ? (
          activity.map((diary, index) => {
            const author = getDiaryAuthor(diary);
            return (
              <motion.button
                className="friend-activity-item"
                type="button"
                key={diary._id}
                onClick={() => onOpenDiary?.(diary)}
                {...listItemMotion(index)}
              >
                <span className="avatar-orb small">{getInitial(author?.name)}</span>
                <span>
                  <strong>@{author?.userCode || 'unknown'}</strong>
                  {getActivityText(diary)}
                </span>
                <small>{formatDateTime(diary.createdAt)}</small>
              </motion.button>
            );
          })
        ) : (
          <div className="friends-empty-panel compact">
            <Activity size={18} />
            <strong>目前還沒有好友動態</strong>
            <p>加入好友或新增日記後，好友動態會更豐富。</p>
          </div>
        )}
      </div>
    </section>
  );
}

function FriendsPreview({ friends, onSelectFriend, onShowAll }) {
  const preview = friends.slice(0, 6);

  return (
    <section className="friends-hub-card friends-preview-panel">
      <SectionHeading
        icon={<Users size={17} />}
        title="我的好友"
        description={friends.length > 0 ? '快速查看你最近的連結。' : '從搜尋開始建立連結。'}
      />

      {preview.length > 0 ? (
        <>
          <div className="friends-preview-list">
            {preview.map((friend, index) => (
              <motion.button
                className="social-friend-item"
                key={friend._id}
                type="button"
                onClick={() => onSelectFriend(friend)}
                {...listItemMotion(index)}
              >
                <FriendIdentity user={friend} compact />
                <UserRound size={15} />
              </motion.button>
            ))}
          </div>
          {friends.length > preview.length && (
            <button className="friend-secondary-button section-link" type="button" onClick={onShowAll}>
              查看全部好友
            </button>
          )}
        </>
      ) : (
        <div className="friends-empty-panel compact">
          <Users size={18} />
          <strong>還沒有好友</strong>
          <p>搜尋使用者 ID，開始建立你的 Adrift 連結。</p>
        </div>
      )}
    </section>
  );
}

function FriendIdentity({ user, meta, compact = false }) {
  return (
    <div className={`friend-identity ${compact ? 'compact' : ''}`}>
      <span className="avatar-orb small">{getInitial(user?.name)}</span>
      <div>
        <strong>{user?.name || '未知使用者'}</strong>
        <span>@{user?.userCode || 'unknown'}</span>
        {meta && <small>{meta}</small>}
      </div>
    </div>
  );
}

function SearchResultActions({ status, busyAction, sentRequest, receivedRequest, onSelect, onSend, onCancel, onAccept, onReject }) {
  if (status === 'self' || status === 'blocked') {
    return <span className="friend-status-pill">{getFriendshipLabel(status)}</span>;
  }

  if (status === 'friend') {
    return (
      <button className="friend-primary-button compact" type="button" onClick={onSelect}>
        <UserRound size={15} />
        查看資料
      </button>
    );
  }

  if (status === 'sent_request') {
    return (
      <div className="friend-actions">
        <span className="friend-status-pill">已送出邀請</span>
        <button
          className="friend-secondary-button compact"
          type="button"
          onClick={() => onCancel(sentRequest?.requestId)}
          disabled={busyAction === `cancel-${sentRequest?.requestId}` || !sentRequest?.requestId}
        >
          {busyAction === `cancel-${sentRequest?.requestId}` ? <span className="button-spinner" /> : <Undo2 size={15} />}
          收回
        </button>
      </div>
    );
  }

  if (status === 'received_request') {
    return (
      <div className="friend-actions">
        <span className="friend-status-pill">對方已邀請你</span>
        <button
          className="friend-primary-button compact"
          type="button"
          onClick={() => onAccept(receivedRequest)}
          disabled={busyAction === `accept-${receivedRequest?.requestId}` || !receivedRequest?.requestId}
        >
          {busyAction === `accept-${receivedRequest?.requestId}` ? <span className="button-spinner dark" /> : <Check size={15} />}
          接受
        </button>
        {onReject && (
          <button
            className="friend-secondary-button compact"
            type="button"
            onClick={() => onReject(receivedRequest)}
            disabled={busyAction === `reject-${receivedRequest?.requestId}` || !receivedRequest?.requestId}
          >
            {busyAction === `reject-${receivedRequest?.requestId}` ? <span className="button-spinner" /> : <X size={15} />}
            拒絕
          </button>
        )}
      </div>
    );
  }

  return (
    <button className="friend-primary-button compact" type="button" onClick={onSend} disabled={busyAction === 'request'}>
      {busyAction === 'request' ? <span className="button-spinner dark" /> : <UserPlus size={15} />}
      {busyAction === 'request' ? '送出中' : '加入好友'}
    </button>
  );
}

function getFriendshipLabel(status) {
  const labels = {
    self: '這是你自己',
    friend: '已是好友',
    sent_request: '已送出邀請',
    received_request: '對方已邀請你',
    blocked: '無法加入',
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

function getDiaryAuthor(diary) {
  return diary?.author || diary?.user || {};
}

function getActivityText(diary) {
  const visibilityText = diary.visibility === 'friends' ? '朋友可見日記' : '公開日記';
  return ` 留下了一篇${visibilityText}`;
}

function formatDate(value) {
  if (!value) return '未知';
  return new Date(value).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getInitial(name) {
  return (name || '?').slice(0, 1).toUpperCase();
}

function sameId(left, right) {
  return Boolean(left && right && left.toString() === right.toString());
}
