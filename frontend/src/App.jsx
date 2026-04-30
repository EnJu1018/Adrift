import { AnimatePresence, motion } from 'framer-motion';
import { Compass, MapPin, Plus, RefreshCcw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, clearStoredAuth, getStoredAuth, saveAuth } from './api/client.js';
import AccountSettings from './components/AccountSettings.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import DiaryModal from './components/DiaryModal.jsx';
import DiaryPopup from './components/DiaryPopup.jsx';
import MapView from './components/MapView.jsx';
import MemoryPanel from './components/MemoryPanel.jsx';
import Particles from './components/Particles.jsx';
import ProfileDock from './components/ProfileDock.jsx';

const requiredAccuracyMeters = 25;
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
  const [locating, setLocating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [diaryError, setDiaryError] = useState('');
  const [filterNearby, setFilterNearby] = useState(false);
  const [mapMode, setMapMode] = useState('mine');
  const [exploreRadius, setExploreRadius] = useState(5000);
  const [exploreCenter, setExploreCenter] = useState(null);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  const isAuthPage = currentPath === '/login' || currentPath === '/register';
  const authMode = currentPath === '/register' ? 'register' : 'login';
  const isProfilePage = currentPath === '/profile';
  const isSettingsPage = currentPath === '/settings/account';

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
    setExploreCenter(null);

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

  const stats = useMemo(() => {
    const mine = diaries.filter((diary) => diary.user?._id === user?.id || diary.user?.id === user?.id).length;
    return { total: diaries.length, mine };
  }, [diaries, user?.id]);

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
        setExploreCenter(null);
        navigate('/');
        await Promise.all([loadDiaries({}, { silent: true }), loadSocial()]);
      }

      return payload;
    } catch (error) {
      setAuthError(error.message);
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
      setLocating(true);
      setDiaryError('');
      const position = await getPrecisePosition();
      setDraftLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
    } catch (error) {
      setDraftLocation(null);
      setDiaryError(error.message);
    } finally {
      setLocating(false);
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

  async function toggleNearby() {
    if (mapMode === 'explore') return;

    const next = !filterNearby;
    setFilterNearby(next);

    if (!next) {
      await loadDiaries({}, { silent: true });
      return;
    }

    try {
      setLocating(true);
      const position = await getPrecisePosition();
      await loadDiaries(
        {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          radius: 50000
        },
        { silent: true }
      );
    } catch (error) {
      setFilterNearby(false);
      setDiaryError(error.message);
    } finally {
      setLocating(false);
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
    await loadDiaries({}, { silent: true });
  }

  async function activateExploreMode(radius = exploreRadius) {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setMapMode('explore');
      setFilterNearby(false);
      setSelectedDiary(null);
      setDiaryLoading(true);
      setDiaryError('');
      const position = await getPrecisePosition();
      const center = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      setExploreCenter(center);
      await loadExploreDiaries({ ...center, radius }, { silent: true });
    } catch (error) {
      setDiaryError(error.message || '需要開啟定位才能探索附近日記');
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
    <main className="app-frame">
      <div className="ambient-bg" />
      <Particles />

      <motion.div
        className={`app-layout ${user ? 'authenticated' : ''} ${!user && !isAuthPage ? 'guest' : ''}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
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
                  <button className="primary-button compact" onClick={openNewDiary} disabled={locating}>
                    {locating ? <span className="button-spinner dark" /> : <Plus size={18} />}
                    {locating ? '定位中...' : '新增'}
                  </button>
                </>
              )}

              {!user && (
                <button className="primary-button compact" onClick={() => navigate('/login')}>
                  登入
                </button>
              )}
            </div>
          </header>

          <MapView
            diaries={diaries}
            selectedDiary={selectedDiary}
            onSelect={setSelectedDiary}
            onViewportChange={handleMapViewportChange}
            focusLocation={exploreCenter}
            mode={mapMode}
            expanded={Boolean(user)}
            loading={diaryLoading}
            disabled={!user}
          />

          <div className="status-strip glass">
            <span>
              <MapPin size={15} />
              {stats.total} memories
            </span>
            <span>{stats.mine} mine</span>
            {mapMode === 'explore' && !diaryLoading && diaries.length === 0 && <strong>附近還沒有公開日記</strong>}
            {locating && <strong>正在取得精確位置，請允許瀏覽器定位...</strong>}
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
          ) : user ? (
            <MemoryPanel
              key="memory-panel"
              user={user}
              diaries={diaries}
              friends={friends}
              friendRequests={friendRequests}
              sentFriendRequests={sentFriendRequests}
              onNewDiary={openNewDiary}
              onSelectDiary={setSelectedDiary}
              onSearchUser={searchFriendUser}
              onSendFriendRequest={sendFriendRequest}
              onCancelFriendRequest={cancelFriendRequest}
              onAcceptFriendRequest={acceptFriendRequest}
              onRejectFriendRequest={rejectFriendRequest}
              locating={locating}
            />
          ) : isAuthPage ? (
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
          ) : null}
        </AnimatePresence>
      </motion.div>

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

      <AnimatePresence>
        {selectedDiary && (
          <DiaryPopup
            diary={selectedDiary}
            currentUser={user}
            onClose={() => setSelectedDiary(null)}
            onDelete={deleteDiary}
          />
        )}
      </AnimatePresence>

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

async function getPrecisePosition() {
  let bestPosition = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const position = await getCurrentPosition();

    if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
      bestPosition = position;
    }

    if (position.coords.accuracy <= requiredAccuracyMeters) {
      return position;
    }
  }

  throw new Error(
    `目前定位精度約 ±${Math.round(bestPosition.coords.accuracy)}m，請開啟瀏覽器/系統的精確位置權限後再試一次。`
  );
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('此瀏覽器不支援定位功能'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('定位權限被拒絕，請在瀏覽器網址列允許 Adrift 使用精確位置。'));
          return;
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error('目前無法取得位置，請確認系統定位服務已開啟。'));
          return;
        }

        if (error.code === error.TIMEOUT) {
          reject(new Error('取得精確位置逾時，請移到 GPS 或 Wi-Fi 訊號較好的地方再試一次。'));
          return;
        }

        reject(new Error('無法取得精確位置，請稍後再試。'));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}
