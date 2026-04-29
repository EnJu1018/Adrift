import { AnimatePresence, motion } from 'framer-motion';
import { LocateFixed, MapPin, Plus, RefreshCcw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, clearStoredAuth, getStoredAuth, saveAuth } from './api/client.js';
import AuthPanel from './components/AuthPanel.jsx';
import DiaryModal from './components/DiaryModal.jsx';
import DiaryPopup from './components/DiaryPopup.jsx';
import MapView from './components/MapView.jsx';
import MemoryPanel from './components/MemoryPanel.jsx';
import Particles from './components/Particles.jsx';
import ProfileDock from './components/ProfileDock.jsx';

const requiredAccuracyMeters = 25;

export default function App() {
  const [user, setUser] = useState(() => getStoredAuth().user);
  const [diaries, setDiaries] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
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
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  const isAuthPage = currentPath === '/login' || currentPath === '/register';
  const authMode = currentPath === '/register' ? 'register' : 'login';
  const isProfilePage = currentPath === '/profile';

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
    setDiaries([]);
    setSelectedDiary(null);
    setDraftLocation(null);
    setFilterNearby(false);

    if (message) {
      setAuthNotice(message);
    }

    navigate('/login');
  }, [navigate]);

  const loadDiaries = useCallback(async (params = {}, options = {}) => {
    if (!getStoredAuth().token) return;

    const silent = options.silent ?? true;

    try {
      if (!silent) {
        setDiaryLoading(true);
      }

      setDiaryError('');
      const payload = await api.getDiaries(params);
      setDiaries(payload.data?.diaries || payload.diaries || []);
    } catch (error) {
      if (error.status !== 401) {
        setDiaryError(error.message);
      }
    } finally {
      if (!silent) {
        setDiaryLoading(false);
      }
    }
  }, []);

  const loadSocial = useCallback(async () => {
    if (!getStoredAuth().token) return;

    try {
      const [friendsPayload, requestsPayload] = await Promise.all([api.getFriends(), api.getFriendRequests()]);
      setFriends(friendsPayload.data || []);
      setFriendRequests(requestsPayload.data || []);
    } catch (error) {
      if (error.status !== 401) {
        setDiaryError(error.message);
      }
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
      return;
    }

    loadDiaries({}, { silent: true });
    loadSocial();
  }, [loadDiaries, loadSocial, user]);

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
      setDiaries((current) => [diary, ...current.filter((item) => item._id !== diary._id)]);
      setDraftLocation(null);
      setSelectedDiary(diary);
    } catch (error) {
      if (error.status !== 401) {
        setDiaryError(error.message);
      }
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
      if (error.status !== 401) {
        setDiaryError(error.message);
      }
    }
  }

  async function toggleNearby() {
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
    if (!user || filterNearby) return;
    loadDiaries(params, { silent: true });
  }, [filterNearby, loadDiaries, user]);

  async function searchFriendUser(userCode) {
    const payload = await api.searchUser(userCode);
    return payload.data;
  }

  async function sendFriendRequest(targetUserId) {
    const payload = await api.sendFriendRequest(targetUserId);
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
                    onClick={() => loadDiaries({}, { silent: true })}
                    aria-label="Refresh diaries"
                  >
                    <RefreshCcw size={18} />
                  </button>
                  <button className={`chip-button ${filterNearby ? 'active' : ''}`} onClick={toggleNearby} disabled={locating}>
                    {locating ? <span className="button-spinner" /> : <Search size={16} />}
                    附近
                  </button>
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
            expanded={Boolean(user)}
            loading={false}
            disabled={!user}
          />

          <div className="status-strip glass">
            <span>
              <MapPin size={15} />
              {stats.total} memories
            </span>
            <span>{stats.mine} mine</span>
            {locating && <strong>正在取得精確位置，請允許瀏覽器定位...</strong>}
            {diaryError && <strong>{diaryError}</strong>}
          </div>
        </section>

        <AnimatePresence mode="wait">
          {user ? (
            <MemoryPanel
              key="memory-panel"
              user={user}
              diaries={diaries}
              friends={friends}
              friendRequests={friendRequests}
              onNewDiary={openNewDiary}
              onSelectDiary={setSelectedDiary}
              onSearchUser={searchFriendUser}
              onSendFriendRequest={sendFriendRequest}
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
        friendRequests={friendRequests}
        forceOpen={isProfilePage}
        onOpen={() => navigate('/profile')}
        onClose={() => navigate('/')}
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
