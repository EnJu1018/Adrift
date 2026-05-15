import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Compass, MapPin, Plus, RefreshCcw, Search, Shield } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, clearStoredAuth, getDiaryEventsUrl, getStoredAuth, saveAuth } from './api/client.js';
import AccountSettings from './components/AccountSettings.jsx';
import AdminDashboard, { AdminForbidden } from './components/AdminDashboard.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import DiaryModal from './components/DiaryModal.jsx';
import DiarySidePanel from './components/DiarySidePanel.jsx';
import LifeMapAI from './components/LifeMapAI.jsx';
import MapView from './components/MapView.jsx';
import MemoryPanel from './components/MemoryPanel.jsx';
import Particles from './components/Particles.jsx';
import ProfileDock from './components/ProfileDock.jsx';
import { pageFadeUp } from './constants/animations.js';
import { usePerformanceMode } from './hooks/usePerformanceMode.js';
import { useUserLocation } from './hooks/useUserLocation.js';

const exploreRadiusOptions = [
  { label: '1km', value: 1000 },
  { label: '5km', value: 5000 },
  { label: '10km', value: 10000 },
  { label: '50km', value: 50000 }
];

export default function App() {
  const [user, setUser] = useState(() => getStoredAuth().user);
  const [diaries, setDiaries] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentFriendRequests, setSentFriendRequests] = useState([]);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [draftLocation, setDraftLocation] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [diaryError, setDiaryError] = useState('');
  const [filterNearby, setFilterNearby] = useState(false);
  const [mapMode, setMapMode] = useState('mine');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [exploreRadius, setExploreRadius] = useState(5000);
  const [exploreCenter, setExploreCenter] = useState(null);
  const [mapFocusLocation, setMapFocusLocation] = useState(null);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const userLocation = useUserLocation();
  const performanceMode = usePerformanceMode(diaries.length);
  const locating = userLocation.loading;
  const autoLocateRequestedRef = useRef(false);

  const isAuthPage = currentPath === '/login' || currentPath === '/register';
  const authMode = currentPath === '/register' ? 'register' : 'login';
  const isProfilePage = currentPath === '/profile';
  const isSettingsPage = currentPath === '/settings/account';
  const isAiPage = currentPath === '/ai/life-map';
  const isAdminPage = currentPath === '/admin' || currentPath === '/admin/dashboard';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const navigate = useCallback((path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }

    setCurrentPath(path);
    setAuthError('');

    if (path !== '/login') {
      setAuthNotice('');
    }
  }, []);

  const logout = useCallback((message = '') => {
    autoLocateRequestedRef.current = false;
    clearStoredAuth();
    setUser(null);
    setFriends([]);
    setFriendRequests([]);
    setSentFriendRequests([]);
    setDiaries([]);
    setSelectedDiary(null);
    setDraftLocation(null);
    setFilterNearby(false);
    setMapMode('mine');
    setVisibilityFilter('all');
    setExploreCenter(null);
    setMapFocusLocation(null);

    if (message) {
      setAuthNotice(message);
    }

    navigate('/login');
  }, [navigate]);

  const syncUser = useCallback((nextUser) => {
    const { token } = getStoredAuth();
    if (!token || !nextUser) return;

    setUser(nextUser);
    saveAuth(token, nextUser);
  }, []);

  const loadDiaries = useCallback(async (params = {}, options = {}) => {
    if (!getStoredAuth().token) return;

    const silent = options.silent ?? true;

    try {
      if (!silent) setDiaryLoading(true);
      setDiaryError('');
      const payload = await api.getDiaries(params);
      setDiaries(payload.data?.diaries || payload.diaries || []);
    } catch (error) {
      if (error.status !== 401) setDiaryError(error.message);
    } finally {
      if (!silent) setDiaryLoading(false);
    }
  }, []);

  const loadExploreDiaries = useCallback(async (params, options = {}) => {
    if (!getStoredAuth().token) return;

    const silent = options.silent ?? true;

    try {
      if (!silent) setDiaryLoading(true);
      setDiaryError('');
      const payload = await api.getExploreDiaries(params);
      const exploreDiaries = Array.isArray(payload.data) ? payload.data : payload.data?.diaries || [];
      setDiaries(exploreDiaries.map((diary) => ({ ...diary, isExplore: true })));
    } catch (error) {
      if (error.status !== 401) setDiaryError(error.message || '無法取得附近日記，請稍後再試');
    } finally {
      if (!silent) setDiaryLoading(false);
    }
  }, []);

  const loadSocial = useCallback(async () => {
    if (!getStoredAuth().token) return;

    try {
      const [friendsPayload, requestsPayload, sentRequestsPayload] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
        api.getSentFriendRequests()
      ]);
      setFriends(friendsPayload.data || []);
      setFriendRequests(requestsPayload.data || []);
      setSentFriendRequests(sentRequestsPayload.data || []);
    } catch (error) {
      if (error.status !== 401) setDiaryError(error.message);
    }
  }, []);

  const applyRealtimeDiary = useCallback((diary) => {
    if (!diary?._id) return;

    if (mapMode === 'explore') {
      if (diary.visibility === 'public' && exploreCenter) {
        loadExploreDiaries({ ...exploreCenter, radius: exploreRadius }, { silent: true });
      }
      return;
    }

    setDiaries((current) => {
      return [diary, ...current.filter((item) => item._id !== diary._id)];
    });
  }, [exploreCenter, exploreRadius, loadExploreDiaries, mapMode]);

  const removeRealtimeDiary = useCallback((diaryId) => {
    if (!diaryId) return;

    setDiaries((current) => current.filter((diary) => diary._id !== diaryId));
    setSelectedDiary((current) => (current?._id === diaryId ? null : current));
  }, []);

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  useEffect(() => {
    const handleExpired = (event) => {
      logout(event.detail?.message || '登入狀態已失效，請重新登入');
    };

    window.addEventListener('adrift:auth-expired', handleExpired);
    return () => window.removeEventListener('adrift:auth-expired', handleExpired);
  }, [logout]);

  useEffect(() => {
    if (!user && !isAuthPage) {
      navigate('/login');
      return;
    }

    if (user && isAuthPage) {
      navigate('/');
    }
  }, [isAuthPage, navigate, user]);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setFriendRequests([]);
      setSentFriendRequests([]);
      setExploreCenter(null);
      setMapFocusLocation(null);
      return;
    }

    if (mapMode === 'explore') {
      if (exploreCenter) {
        loadExploreDiaries({ ...exploreCenter, radius: exploreRadius }, { silent: true });
      }
    } else {
      loadDiaries({}, { silent: true });
    }
    loadSocial();
  }, [exploreCenter, exploreRadius, loadDiaries, loadExploreDiaries, loadSocial, mapMode, user]);

  useEffect(() => {
    if (!user?.id) return;

    api
      .getMe()
      .then((payload) => {
        if (payload.data) syncUser(payload.data);
      })
      .catch((error) => {
        if (error.status !== 401) setDiaryError(error.message);
      });
  }, [syncUser, user?.id]);

  useEffect(() => {
    const { token } = getStoredAuth();

    if (!user?.id || !token || typeof EventSource === 'undefined') return undefined;

    const events = new EventSource(getDiaryEventsUrl());

    function handleCreated(event) {
      try {
        const payload = JSON.parse(event.data);
        applyRealtimeDiary(payload.diary);
      } catch {
        // Ignore malformed event payloads; the next normal refresh will recover.
      }
    }

    function handleDeleted(event) {
      try {
        const payload = JSON.parse(event.data);
        removeRealtimeDiary(payload.diaryId);
      } catch {
        // Ignore malformed event payloads; the next normal refresh will recover.
      }
    }

    events.addEventListener('diary:created', handleCreated);
    events.addEventListener('diary:deleted', handleDeleted);

    return () => {
      events.removeEventListener('diary:created', handleCreated);
      events.removeEventListener('diary:deleted', handleDeleted);
      events.close();
    };
  }, [applyRealtimeDiary, removeRealtimeDiary, user?.id]);

  const stats = useMemo(() => {
    const mine = diaries.filter((diary) => diary.user?._id === user?.id || diary.user?.id === user?.id).length;
    return { total: diaries.length, mine };
  }, [diaries, user?.id]);

  const displayedDiaries = useMemo(() => {
    if (mapMode === 'explore' || visibilityFilter === 'all') {
      return diaries;
    }

    return diaries.filter((diary) => diary.visibility === visibilityFilter);
  }, [diaries, mapMode, visibilityFilter]);

  const currentLocationMarker = useMemo(() => {
    const lat = Number(userLocation.lat);
    const lng = Number(userLocation.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat,
      lng,
      accuracy: Number.isFinite(userLocation.accuracy) ? userLocation.accuracy : null,
      accuracyType: userLocation.accuracyType || 'precise',
      source: userLocation.source || 'browser'
    };
  }, [userLocation.accuracy, userLocation.accuracyType, userLocation.lat, userLocation.lng, userLocation.source]);

  useEffect(() => {
    if (!user?.id) {
      autoLocateRequestedRef.current = false;
      return;
    }

    if (autoLocateRequestedRef.current) return;
    autoLocateRequestedRef.current = true;

    let active = true;

    userLocation
      .getLocation({ showMessage: true })
      .then((location) => {
        if (!active) return;
        setMapFocusLocation({ ...location, focusId: Date.now() });
      })
      .catch(() => {
        // useUserLocation already stores the visible error message.
      });

    return () => {
      active = false;
    };
  }, [user?.id, userLocation.getLocation]);

  useEffect(() => {
    if (!selectedDiary) return;

    const stillVisible = displayedDiaries.some((diary) => diary._id === selectedDiary._id);

    if (!stillVisible) {
      setSelectedDiary(null);
    }
  }, [displayedDiaries, selectedDiary]);

  async function handleAuth(mode, form) {
    try {
      setAuthLoading(true);
      setAuthError('');
      const payload = mode === 'login' ? await api.login(form) : await api.register(form);

      if (mode === 'login') {
        const token = payload.token || payload.data?.token;
        const nextUser = payload.user || payload.data?.user;
        saveAuth(token, nextUser);
        setUser(nextUser);
        setMapMode('mine');
        setVisibilityFilter('all');
        setExploreCenter(null);
        setMapFocusLocation(null);
        navigate('/');
        await Promise.all([loadDiaries({}, { silent: true }), loadSocial()]);
      }

      return payload;
    } catch (error) {
      setAuthError(mode === 'login' && (error.status === 401 || error.status === 404) ? 'Email 不存在或密碼錯誤' : error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  async function openNewDiary() {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setDiaryError('');
      const location = await userLocation.getLocation();
      setDraftLocation({
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        accuracyType: location.accuracyType,
        source: location.source,
        placeName: buildApproximatePlaceName(location)
      });
    } catch (error) {
      setDraftLocation(null);
      setDiaryError(error.message);
    }
  }

  async function centerOnUserLocation() {
    if (!user) return;

    try {
      setDiaryError('');
      const location = await userLocation.refreshLocation({
        preciseMessage: '已回到目前位置',
        approximateMessage: '已使用大略位置'
      });
      const focus = { ...location, focusId: Date.now() };

      setMapFocusLocation(focus);

      if (mapMode === 'explore') {
        setExploreCenter({ lat: location.lat, lng: location.lng });
        await loadExploreDiaries({ lat: location.lat, lng: location.lng, radius: exploreRadius }, { silent: true });
      }
    } catch (error) {
      setDiaryError(error.message || '無法取得目前位置');
    }
  }

  async function createDiary(formData) {
    try {
      setPublishing(true);
      setDiaryError('');
      const payload = await api.createDiary(formData);
      const diary = payload.data?.diary || payload.diary;
      if (mapMode === 'explore' && exploreCenter) {
        await loadExploreDiaries({ ...exploreCenter, radius: exploreRadius }, { silent: true });
      } else {
        setDiaries((current) => [diary, ...current.filter((item) => item._id !== diary._id)]);
      }
      setDraftLocation(null);
      setSelectedDiary(diary);
    } catch (error) {
      if (error.status !== 401) setDiaryError(error.message);
      throw error;
    } finally {
      setPublishing(false);
    }
  }

  async function deleteDiary(id) {
    try {
      await api.deleteDiary(id);
      setDiaries((current) => current.filter((diary) => diary._id !== id));
      setSelectedDiary(null);
    } catch (error) {
      if (error.status !== 401) setDiaryError(error.message);
    }
  }

  async function reactToDiary(id, type, optimisticDiary) {
    const previousSelected = selectedDiary?._id === id ? selectedDiary : null;
    const previousDiary = diaries.find((diary) => diary._id === id) || null;

    if (optimisticDiary) {
      setSelectedDiary((current) => (current?._id === id ? optimisticDiary : current));
      setDiaries((current) => current.map((diary) => (diary._id === id ? { ...diary, ...optimisticDiary } : diary)));
    }

    try {
      const payload = await api.reactToDiary(id, type);
      const nextData = {
        reactions: payload.data?.reactions || payload.reactions,
        userReaction: payload.data?.userReaction ?? payload.userReaction ?? null
      };

      setSelectedDiary((current) => (current?._id === id ? { ...current, ...nextData } : current));
      setDiaries((current) => current.map((diary) => (diary._id === id ? { ...diary, ...nextData } : diary)));
      return payload;
    } catch (error) {
      if (previousSelected) setSelectedDiary(previousSelected);
      if (previousDiary) {
        setDiaries((current) => current.map((diary) => (diary._id === id ? previousDiary : diary)));
      }
      if (error.status !== 401) setDiaryError(error.message);
      throw error;
    }
  }

  async function toggleNearby() {
    if (mapMode === 'explore') return;

    const next = !filterNearby;
    setFilterNearby(next);

    if (!next) {
      await loadDiaries({}, { silent: true });
      return;
    }

    try {
      const location = await userLocation.getLocation();
      await loadDiaries(
        {
          lat: location.lat,
          lng: location.lng,
          radius: 50000
        },
        { silent: true }
      );
    } catch (error) {
      setFilterNearby(false);
      setDiaryError(error.message);
    }
  }

  const handleMapViewportChange = useCallback((params) => {
    if (!user) return;

    if (mapMode === 'explore') {
      const nextCenter = { lat: params.lat, lng: params.lng };
      setExploreCenter(nextCenter);
      loadExploreDiaries({ ...nextCenter, radius: exploreRadius }, { silent: true });
      return;
    }

    if (filterNearby) return;
    loadDiaries(params, { silent: true });
  }, [exploreRadius, filterNearby, loadDiaries, loadExploreDiaries, mapMode, user]);

  async function activateMineMode() {
    setMapMode('mine');
    setExploreCenter(null);
    setFilterNearby(false);
    setSelectedDiary(null);
    setMapFocusLocation(null);
    await loadDiaries({}, { silent: true });
  }

  async function activateExploreMode(radius = exploreRadius) {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setMapMode('explore');
      setVisibilityFilter('all');
      setFilterNearby(false);
      setSelectedDiary(null);
      setDiaryLoading(true);
      setDiaryError('');
      const location = await userLocation.getLocation();
      const center = {
        lat: location.lat,
        lng: location.lng
      };

      setExploreCenter(center);
      await loadExploreDiaries({ ...center, radius }, { silent: true });
    } catch (error) {
      setDiaryError(error.message || '無法取得位置，請稍後再試');
    } finally {
      setDiaryLoading(false);
    }
  }

  async function changeExploreRadius(radius) {
    setExploreRadius(radius);

    if (mapMode !== 'explore') return;

    if (exploreCenter) {
      await loadExploreDiaries({ ...exploreCenter, radius }, { silent: false });
      return;
    }

    await activateExploreMode(radius);
  }

  async function searchFriendUser(userCode) {
    const payload = await api.searchUser(userCode);
    return payload.data;
  }

  async function sendFriendRequest(targetUserId) {
    const payload = await api.sendFriendRequest(targetUserId);
    await loadSocial();
    return payload;
  }

  async function cancelFriendRequest(requestId) {
    const payload = await api.cancelFriendRequest(requestId);
    await loadSocial();
    return payload;
  }

  async function acceptFriendRequest(requestId) {
    const payload = await api.acceptFriendRequest(requestId);
    await Promise.all([loadSocial(), loadDiaries({}, { silent: true })]);
    return payload;
  }

  async function rejectFriendRequest(requestId) {
    const payload = await api.rejectFriendRequest(requestId);
    await loadSocial();
    return payload;
  }

  async function getFriendProfile(friendId) {
    const payload = await api.getFriendProfile(friendId);
    return payload.data;
  }

  async function getFriendRecommendations(limit = 10) {
    const payload = await api.getFriendRecommendations(limit);
    return payload.data || [];
  }

  async function deleteFriend(friendId) {
    const payload = await api.deleteFriend(friendId);
    await Promise.all([loadSocial(), loadDiaries({}, { silent: true })]);
    return payload;
  }

  async function updateName(name) {
    const payload = await api.updateName(name);
    syncUser(payload.data?.user || { ...user, name: payload.data?.name || name });
    return payload;
  }

  async function updateEmail(form) {
    const payload = await api.updateEmail(form);
    syncUser(payload.data?.user || { ...user, email: payload.data?.email || form.email });
    return payload;
  }

  async function updatePassword(form) {
    return api.updatePassword(form);
  }

  async function deleteAccount(form) {
    const payload = await api.deleteAccount(form);
    logout(payload.message || '帳號已刪除');
    return payload;
  }

  return (
    <main
      className={`app-frame ${performanceMode.lowPerformance ? 'low-performance' : ''} ${performanceMode.reducedMotion ? 'reduced-motion' : ''}`}
    >
      <div className="ambient-bg" />
      <Particles lowPerformance={performanceMode.lowPerformance} reducedMotion={performanceMode.reducedMotion} />

      <motion.div
        className={`app-layout ${user ? 'authenticated' : ''} ${!user && isAuthPage ? 'auth-mode' : ''} ${!user && !isAuthPage ? 'guest' : ''} ${isAdminPage ? 'admin-mode' : ''}`}
        {...pageFadeUp}
      >
        {user && isAdminPage ? (
          isAdmin ? (
            <AdminDashboard user={user} onBack={() => navigate('/')} onLogout={() => logout()} />
          ) : (
            <AdminForbidden onBack={() => navigate('/')} />
          )
        ) : !user && isAuthPage ? (
          <AuthPanel
            key={authMode}
            mode={authMode}
            onAuth={handleAuth}
            onNavigate={navigate}
            onClearError={() => setAuthError('')}
            onClearNotice={() => setAuthNotice('')}
            onRegisterSuccess={(message) => setAuthNotice(message)}
            loading={authLoading}
            error={authError}
            notice={authNotice}
          />
        ) : (
        <>
        <section className="experience-panel">
          <header className="topbar glass">
            <div>
              <p className="eyebrow">Map Diary</p>
              <h2>地圖日記</h2>
            </div>

            <div className="topbar-actions">
              {user && (
                <>
                  <button
                    className="icon-button"
                    onClick={() =>
                      mapMode === 'explore' ? activateExploreMode(exploreRadius) : loadDiaries({}, { silent: true })
                    }
                    aria-label="Refresh diaries"
                  >
                    <RefreshCcw size={18} />
                  </button>
                  <button className={`chip-button ${isAiPage ? 'active' : ''}`} onClick={() => navigate('/ai/life-map')}>
                    <Brain size={15} />
                    Adrift AI
                  </button>
                  {isAdmin && (
                    <button className="chip-button" onClick={() => navigate('/admin/dashboard')}>
                      <Shield size={15} />
                      Admin
                    </button>
                  )}
                  <div className="map-mode-switch" aria-label="地圖模式">
                    <button className={mapMode === 'mine' ? 'active' : ''} onClick={activateMineMode}>
                      我的日記
                    </button>
                    <button className={mapMode === 'explore' ? 'active' : ''} onClick={() => activateExploreMode()}>
                      <Compass size={15} />
                      Explore
                    </button>
                  </div>
                  {mapMode === 'explore' && (
                    <div className="radius-switch" aria-label="Explore 半徑">
                      {exploreRadiusOptions.map((option) => (
                        <button
                          key={option.value}
                          className={exploreRadius === option.value ? 'active' : ''}
                          onClick={() => changeExploreRadius(option.value)}
                          disabled={diaryLoading}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {mapMode === 'mine' && (
                  <button className={`chip-button ${filterNearby ? 'active' : ''}`} onClick={toggleNearby} disabled={locating}>
                    {locating ? <span className="button-spinner" /> : <Search size={16} />}
                    附近
                  </button>
                  )}
                </>
              )}

              {!user && (
                <button className="primary-button compact" onClick={() => navigate('/login')}>
                  登入
                </button>
              )}
            </div>
          </header>

          <div className="map-stage">
            <DiarySidePanel
              diary={selectedDiary}
              currentUser={user}
              onClose={() => setSelectedDiary(null)}
              onDelete={deleteDiary}
              onReact={reactToDiary}
            />
            <MapView
              diaries={displayedDiaries}
              selectedDiary={selectedDiary}
              onSelect={setSelectedDiary}
              onViewportChange={handleMapViewportChange}
              focusLocation={mapFocusLocation}
              currentLocation={currentLocationMarker}
              mode={mapMode}
              expanded={Boolean(user)}
              loading={diaryLoading}
              locating={locating}
              onLocateUser={centerOnUserLocation}
              disabled={!user}
              lowPerformance={performanceMode.lowPerformance}
              reducedMotion={performanceMode.reducedMotion}
            />
          </div>

          <div className="status-strip glass">
            <span>
              <MapPin size={15} />
              {stats.total} memories
            </span>
            <span>{stats.mine} mine</span>
            {mapMode === 'explore' && !diaryLoading && diaries.length === 0 && <strong>附近還沒有公開日記</strong>}
            {locating && <strong>正在取得位置...</strong>}
            {userLocation.message && <strong className={userLocation.accuracyType === 'approximate' ? 'location-approximate' : 'location-success'}>{userLocation.message}</strong>}
            {userLocation.accuracyType === 'approximate' && !userLocation.message && <strong className="location-approximate">目前為大略位置</strong>}
            {userLocation.error && <strong>{userLocation.error}</strong>}
            {diaryError && <strong>{diaryError}</strong>}
          </div>
        </section>

        <AnimatePresence mode="wait">
          {user && isSettingsPage ? (
            <AccountSettings
              key="account-settings"
              user={user}
              friends={friends}
              diaries={diaries}
              onBack={() => navigate('/')}
              onUpdateName={updateName}
              onUpdateEmail={updateEmail}
              onUpdatePassword={updatePassword}
              onDeleteAccount={deleteAccount}
            />
          ) : user && isAiPage ? (
            <LifeMapAI key="life-map-ai" onBack={() => navigate('/')} />
          ) : user ? (
            <MemoryPanel
              key="memory-panel"
              user={user}
              diaries={displayedDiaries}
              friends={friends}
              friendRequests={friendRequests}
              sentFriendRequests={sentFriendRequests}
              mapMode={mapMode}
              visibilityFilter={visibilityFilter}
              onVisibilityFilterChange={setVisibilityFilter}
              selectedDiaryId={selectedDiary?._id}
              onNewDiary={openNewDiary}
              onSelectDiary={setSelectedDiary}
              onSearchUser={searchFriendUser}
              onSendFriendRequest={sendFriendRequest}
              onCancelFriendRequest={cancelFriendRequest}
              onAcceptFriendRequest={acceptFriendRequest}
              onRejectFriendRequest={rejectFriendRequest}
              onGetFriendRecommendations={getFriendRecommendations}
              onGetFriendProfile={getFriendProfile}
              onDeleteFriend={deleteFriend}
              locating={locating}
              lowPerformance={performanceMode.lowPerformance}
            />
          ) : null}
        </AnimatePresence>
        </>
        )}
      </motion.div>

      {!isAdminPage && (
        <ProfileDock
          user={user}
          diaries={diaries}
          friends={friends}
          forceOpen={isProfilePage}
          onOpen={() => navigate('/profile')}
          onClose={() => navigate('/')}
          onSettings={() => navigate('/settings/account')}
          onLogout={() => logout()}
        />
      )}

      <AnimatePresence>
        {draftLocation && (
          <DiaryModal
            location={draftLocation}
            onClose={() => setDraftLocation(null)}
            onSubmit={createDiary}
            loading={publishing}
            error={diaryError}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function buildApproximatePlaceName(location) {
  if (location?.source !== 'ip') return '';

  return [location.city, location.region, location.country].filter(Boolean).join(', ');
}
