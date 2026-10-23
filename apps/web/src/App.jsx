import { AnimatePresence } from 'framer-motion';
import { Activity, Bell, Brain, Check, Copy, Home, LogOut, MapPin, Settings, Shield, UserRound, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, clearStoredAuth, getDiaryEventsUrl, getStoredAuth, saveAuth } from './api/client.js';
import AccountSettings from './components/AccountSettings.jsx';
import AdminDashboard, { AdminForbidden } from './components/AdminDashboard.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import DiaryModal from './components/DiaryModal.jsx';
import DiarySidePanel from './components/DiarySidePanel.jsx';
import FeedPage from './components/FeedPage.jsx';
import FeaturePage from './components/FeaturePage.jsx';
import FriendsPage from './components/FriendsPage.jsx';
import LandingPage from './components/LandingPage.jsx';
import LifeMapAI from './components/LifeMapAI.jsx';
import MapView from './components/MapView.jsx';
import MemoryPanel from './components/MemoryPanel.jsx';
import { normalizeDiaryCoordinate } from './components/markers/markerGeometry.js';
import PresentationPage from './components/PresentationPage.jsx';
import PublicInfoPage from './components/PublicInfoPage.jsx';
import ToastViewport from './components/ToastViewport.jsx';
import UserAvatar from './components/UserAvatar.jsx';
import AnimatedNumber from './components/ui/AnimatedNumber.jsx';
import ContentTransition from './components/ui/ContentTransition.jsx';
import useNotifications from './components/notifications/useNotifications.js';
import NotificationList from './components/notifications/NotificationList.jsx';
import FriendProfile from './components/social/FriendProfile.jsx';
import { usePerformanceMode } from './hooks/usePerformanceMode.js';
import { useUserLocation } from './hooks/useUserLocation.js';
import { normalizeTaiwanPlaceName } from './utils/locationFormatter.js';
import { updatePublicSeo } from './lib/publicSeo.js';

const exploreRadiusOptions = [
  { label: '1km', value: 1000 },
  { label: '5km', value: 5000 },
  { label: '10km', value: 10000 },
  { label: '50km', value: 50000 }
];

const THEME_KEY = 'adrift-theme';
const PRESENTATION_PDF_PATH = '/Adrift-presentation.pdf';
const themes = ['dark', 'bright'];

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'lightened') return 'bright';
    return themes.includes(savedTheme) ? savedTheme : 'bright';
  } catch {
    return 'bright';
  }
}

function getDiaryFocusLocation(diary) {
  const center = normalizeDiaryCoordinate(diary);
  if (!center) return null;

  const isApproximate = diary?.locationAccuracy === 'approximate';

  return {
    ...center,
    diaryId: diary._id,
    accuracyType: isApproximate ? 'approximate' : 'precise',
    source: isApproximate ? 'diary-approximate' : 'diary',
    focusId: `${diary?._id || 'diary'}-${Date.now()}`
  };
}

function getEntityId(entity) {
  if (!entity) return '';
  if (typeof entity === 'string') return entity;
  return entity._id || entity.id || '';
}

function getDiaryAuthorId(diary) {
  return getEntityId(diary?.user) || getEntityId(diary?.author) || getEntityId(diary?.userId);
}

function sameId(left, right) {
  return Boolean(left && right && left.toString() === right.toString());
}

export default function App() {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [user, setUser] = useState(() => getStoredAuth().user);
  const [diaries, setDiaries] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentFriendRequests, setSentFriendRequests] = useState([]);
  const [socialRefreshToken, setSocialRefreshToken] = useState(0);
  const [socialState, setSocialState] = useState({ status: 'idle', error: '' });
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [draftLocation, setDraftLocation] = useState(null);
  const [editingDiary, setEditingDiary] = useState(null);
  const [editLocation, setEditLocation] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [diaryError, setDiaryError] = useState('');
  const [actionToast, setActionToast] = useState(null);
  const [mapMode, setMapMode] = useState('mine');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [exploreRadius, setExploreRadius] = useState(5000);
  const [exploreCenter, setExploreCenter] = useState(null);
  const [mapFocusLocation, setMapFocusLocation] = useState(null);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useNotifications(getEntityId(user), notificationsOpen);
  const [notificationEntry, setNotificationEntry] = useState(0);
  const [profilePerson, setProfilePerson] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userCodeCopied, setUserCodeCopied] = useState(false);
  const [userCodeCopyError, setUserCodeCopyError] = useState(false);
  const [lifeMapState, setLifeMapState] = useState({
    status: 'idle',
    insight: null,
    dataWarmup: null
  });
  const userLocation = useUserLocation();
  const performanceMode = usePerformanceMode(diaries.length);
  const locating = userLocation.loading;
  const autoLocateRequestedRef = useRef(false);
  const navbarActionsRef = useRef(null);
  const diaryRequestVersion = useRef(0);
  const exploreRequestVersion = useRef(0);
  const socialRequestVersion = useRef(0);
  const aiSessionToken = getStoredAuth().token;
  const updateLifeMapState = useCallback(update => {
    if (aiSessionToken && getStoredAuth().token === aiSessionToken) setLifeMapState(update);
  }, [aiSessionToken]);

  useEffect(() => () => {
    diaryRequestVersion.current++;
    exploreRequestVersion.current++;
    socialRequestVersion.current++;
  }, []);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(themes.includes(nextTheme) ? nextTheme : 'dark');
  }, []);

  const isAuthPage = currentPath === '/auth' || currentPath === '/login' || currentPath === '/register';
  const isFriendsPage = currentPath === '/friends';
  const isFeedPage = currentPath === '/feed';
  const isSettingsPage = currentPath === '/settings/account' || currentPath === '/settings';
  const isAiPage = currentPath === '/ai/life-map';
  const isAdminPage = currentPath === '/admin' || currentPath === '/admin/dashboard';
  const isPresentationPage = currentPath === '/p' || currentPath === '/p/';
  const isPresentationDownloadPage = currentPath === '/pd' || currentPath === '/pd/';
  const isLandingPage = !user && currentPath === '/';
  const isAboutPage = currentPath === '/about' || currentPath === '/about/';
  const isPrivacyPage = currentPath === '/privacy' || currentPath === '/privacy/';
  const featureSlug = currentPath.match(/^\/features\/([^/]+)\/?$/)?.[1] || '';
  const isFeaturePage = ['map-diary', 'emotion', 'memories'].includes(featureSlug);
  const isPublicInfoPage = isAboutPage || isPrivacyPage;
  const isPublicStandalonePage = isPresentationPage || isPresentationDownloadPage || isLandingPage || isPublicInfoPage || isFeaturePage;
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // localStorage can be unavailable in private browsing; the in-memory theme still applies.
    }
  }, [theme]);

  useEffect(() => {
    updatePublicSeo(currentPath);
  }, [currentPath]);

  const navigate = useCallback((path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }

    setCurrentPath(path);
    setAuthError('');
    setNotificationsOpen(false);
    setUserMenuOpen(false);

    if (path !== '/auth') {
      setAuthNotice('');
    }
  }, []);

  const logout = useCallback((message = '') => {
    diaryRequestVersion.current++;
    exploreRequestVersion.current++;
    socialRequestVersion.current++;
    setLifeMapState({ status: 'idle', insight: null, dataWarmup: null });
    autoLocateRequestedRef.current = false;
    clearStoredAuth();
    setUser(null);
    setProfilePerson(null);
    setNotificationEntry(0);
    setFriends([]);
    setFriendRequests([]);
    setSentFriendRequests([]);
    setSocialState({ status: 'idle', error: '' });
    setSocialRefreshToken(0);
    setDiaries([]);
    setDiaryLoading(false);
    setSelectedDiary(null);
    setDraftLocation(null);
    setEditingDiary(null);
    setEditLocation(null);
    setActionToast(null);
    setMapMode('mine');
    setVisibilityFilter('all');
    setExploreCenter(null);
    setMapFocusLocation(null);

    if (message) {
      setAuthNotice(message);
    }

    navigate('/auth');
  }, [navigate]);

  const syncUser = useCallback((nextUser) => {
    const { token } = getStoredAuth();
    if (!token || !nextUser) return;

    setUser(nextUser);
    saveAuth(token, nextUser);
  }, []);

  const loadDiaries = useCallback(async (params = {}, options = {}) => {
    const { token } = getStoredAuth();
    if (!token) return;
    const version = ++diaryRequestVersion.current;
    const isCurrent = () => version === diaryRequestVersion.current && token === getStoredAuth().token;

    const silent = options.silent ?? true;

    try {
      if (!silent) setDiaryLoading(true);
      setDiaryError('');
      const payload = await api.getDiaries(params);
      if (!isCurrent()) return;
      setDiaries(asArray(payload.data?.diaries || payload.diaries));
    } catch (error) {
      if (isCurrent() && error.status !== 401) setDiaryError(error.message);
    } finally {
      if (isCurrent()) setDiaryLoading(false);
    }
  }, []);

  const loadExploreDiaries = useCallback(async (params, options = {}) => {
    const { token } = getStoredAuth();
    if (!token) return;
    const version = ++diaryRequestVersion.current;
    const isCurrent = () => version === diaryRequestVersion.current && token === getStoredAuth().token;

    const silent = options.silent ?? true;

    try {
      if (!silent) setDiaryLoading(true);
      setDiaryError('');
      const payload = await api.getExploreDiaries(params);
      if (!isCurrent()) return;
      const exploreDiaries = Array.isArray(payload.data) ? payload.data : asArray(payload.data?.diaries);
      setDiaries(exploreDiaries.map((diary) => ({ ...diary, isExplore: true })));
    } catch (error) {
      if (isCurrent() && error.status !== 401) setDiaryError(error.message || '無法取得附近日記，請稍後再試');
    } finally {
      if (isCurrent()) setDiaryLoading(false);
    }
  }, []);

  const loadSocial = useCallback(async () => {
    const { token } = getStoredAuth();
    if (!token) return;
    const version = ++socialRequestVersion.current;
    setSocialState(current => ({ ...current, status: 'loading', error: '' }));

    try {
      const [friendsPayload, requestsPayload, sentRequestsPayload] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
        api.getSentFriendRequests()
      ]);
      const nextFriends = asArray(friendsPayload.data);
      const nextRequests = asArray(requestsPayload.data);
      const nextSentRequests = asArray(sentRequestsPayload.data);
      if (version !== socialRequestVersion.current || getStoredAuth().token !== token) return;

      setFriends(nextFriends);
      setFriendRequests(nextRequests);
      setSentFriendRequests(nextSentRequests);
      setSocialState({ status: 'ready', error: '' });
      setSocialRefreshToken((current) => current + 1);

      return {
        friends: nextFriends,
        friendRequests: nextRequests,
        sentFriendRequests: nextSentRequests
      };
    } catch (error) {
      if (version === socialRequestVersion.current && getStoredAuth().token === token && error.status !== 401) setSocialState({ status: 'error', error: error.message });
    }
  }, []);

  const clearSharedContent = useCallback(() => {
    const ownId = getEntityId(getStoredAuth().user);
    diaryRequestVersion.current++;
    setSocialRefreshToken(current => current + 1);
    setDiaries(current => current.filter(diary => diary.visibility !== 'friends' || sameId(getDiaryAuthorId(diary), ownId)));
    setSelectedDiary(current => current?.visibility === 'friends' && !sameId(getDiaryAuthorId(current), ownId) ? null : current);
  }, []);

  const refreshSocialContent = useCallback(async () => {
    clearSharedContent();
    const snapshot = await loadSocial();
    if (mapMode === 'explore' && exploreCenter) await loadExploreDiaries({ ...exploreCenter, radius: exploreRadius }, { silent: true });
    else await loadDiaries({}, { silent: true });
    return snapshot;
  }, [clearSharedContent, loadSocial, loadDiaries, loadExploreDiaries, mapMode, exploreCenter, exploreRadius]);

  useEffect(() => {
    if (!user || !isFriendsPage) return;
    const refresh = () => { if (document.visibilityState !== 'hidden') refreshSocialContent(); };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [isFriendsPage, Boolean(user), refreshSocialContent]);

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

  const updateRealtimeDiary = useCallback((diary) => {
    if (!diary?._id) return;

    setDiaries((current) => current.map((item) => (item._id === diary._id ? { ...item, ...diary } : item)));
    setSelectedDiary((current) => (current?._id === diary._id ? { ...current, ...diary } : current));
  }, []);

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  useEffect(() => {
    if (currentPath !== '/login' && currentPath !== '/register') return;
    window.history.replaceState({}, '', '/auth');
    setCurrentPath('/auth');
  }, [currentPath]);

  useEffect(() => {
    const handleExpired = (event) => {
      logout(event.detail?.message || '登入狀態已失效，請重新登入');
    };

    window.addEventListener('adrift:auth-expired', handleExpired);
    return () => window.removeEventListener('adrift:auth-expired', handleExpired);
  }, [logout]);

  useEffect(() => {
    if (!actionToast) return undefined;

    const timer = window.setTimeout(() => setActionToast(null), actionToast.type === 'error' ? 3000 : 2200);
    return () => window.clearTimeout(timer);
  }, [actionToast]);

  useEffect(() => {
    if (!userCodeCopied && !userCodeCopyError) return undefined;

    const timer = window.setTimeout(() => {
      setUserCodeCopied(false);
      setUserCodeCopyError(false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [userCodeCopied, userCodeCopyError]);

  useEffect(() => {
    if (!notificationsOpen && !userMenuOpen) return undefined;
    const trigger = navbarActionsRef.current?.querySelector('[aria-expanded="true"]');
    const dropdown = document.getElementById(trigger?.getAttribute('aria-controls'));
    (dropdown?.querySelector('button:not(:disabled)') || dropdown)?.focus({ preventScroll: true });

    function closePopoversOutside(event) {
      if (navbarActionsRef.current?.contains(event.target)) return;
      setNotificationsOpen(false);
      setUserMenuOpen(false);
    }

    function closePopoversOnEscape(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setNotificationsOpen(false);
      setUserMenuOpen(false);
      trigger?.focus({ preventScroll: true });
    }

    document.addEventListener('pointerdown', closePopoversOutside);
    document.addEventListener('focusin', closePopoversOutside);
    document.addEventListener('keydown', closePopoversOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closePopoversOutside);
      document.removeEventListener('focusin', closePopoversOutside);
      document.removeEventListener('keydown', closePopoversOnEscape);
    };
  }, [notificationsOpen, userMenuOpen]);

  function handlePopoverKeyDown(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus({ preventScroll: true });
  }

  function showActionToast(message, type = 'success') {
    setActionToast({
      id: `${Date.now()}-${message}`,
      message,
      type
    });
  }

  useEffect(() => {
    if (!user && !isAuthPage && !isPublicStandalonePage) {
      navigate('/auth');
      return;
    }

    if (user && isAuthPage) {
      navigate('/');
    }
  }, [isAuthPage, isPublicStandalonePage, navigate, user]);

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
    const { token } = getStoredAuth();

    api
      .getMe()
      .then((payload) => {
        if (payload.data && getStoredAuth().token === token) syncUser(payload.data);
      })
      .catch((error) => {
        if (getStoredAuth().token === token && error.status !== 401) setDiaryError(error.message);
      });
  }, [syncUser, user?.id]);

  useEffect(() => {
    const { token } = getStoredAuth();

    if (!user?.id || !token || typeof EventSource === 'undefined') return undefined;

    const events = new EventSource(getDiaryEventsUrl());

    function handleCreated(event) {
      if (getStoredAuth().token !== token) return;
      try {
        const payload = JSON.parse(event.data);
        applyRealtimeDiary(payload.diary);
        window.dispatchEvent(new CustomEvent('adrift:feed-changed'));
      } catch {
        // Ignore malformed event payloads; the next normal refresh will recover.
      }
    }

    function handleDeleted(event) {
      if (getStoredAuth().token !== token) return;
      try {
        const payload = JSON.parse(event.data);
        removeRealtimeDiary(payload.diaryId);
        window.dispatchEvent(new CustomEvent('adrift:feed-changed', { detail: { diaryId: payload.diaryId } }));
      } catch {
        // Ignore malformed event payloads; the next normal refresh will recover.
      }
    }

    function handleUpdated(event) {
      if (getStoredAuth().token !== token) return;
      try {
        const payload = JSON.parse(event.data);
        updateRealtimeDiary(payload.diary);
        window.dispatchEvent(new CustomEvent('adrift:feed-changed', { detail: { diary: payload.diary } }));
      } catch {
        // Ignore malformed event payloads; the next normal refresh will recover.
      }
    }

    events.addEventListener('diary:created', handleCreated);
    events.addEventListener('diary:deleted', handleDeleted);
    events.addEventListener('diary:updated', handleUpdated);
    const socialChanged = () => { if (getStoredAuth().token === token) { refreshSocialContent(); window.dispatchEvent(new Event('adrift:feed-changed')); } };
    events.addEventListener('social:changed', socialChanged);
    const notificationChanged = () => { if (getStoredAuth().token === token) window.dispatchEvent(new Event('adrift:notifications-changed')); };
    events.addEventListener('notifications:changed', notificationChanged);
    events.addEventListener('open', notificationChanged);
    const contentChanged = () => { if (getStoredAuth().token === token) { setSelectedDiary(null); socialChanged(); notificationChanged(); } };
    events.addEventListener('content:changed', contentChanged);

    return () => {
      events.removeEventListener('diary:created', handleCreated);
      events.removeEventListener('diary:deleted', handleDeleted);
      events.removeEventListener('diary:updated', handleUpdated);
      events.removeEventListener('social:changed', socialChanged);
      events.removeEventListener('notifications:changed', notificationChanged);
      events.removeEventListener('open', notificationChanged);
      events.removeEventListener('content:changed', contentChanged);
      events.close();
    };
  }, [applyRealtimeDiary, removeRealtimeDiary, updateRealtimeDiary, refreshSocialContent, user?.id]);

  const currentUserId = getEntityId(user);
  const stats = useMemo(() => {
    const mine = diaries.filter((diary) => sameId(getDiaryAuthorId(diary), currentUserId)).length;
    return { total: diaries.length, mine };
  }, [currentUserId, diaries]);

  const friendIdSet = useMemo(() => {
    return new Set((friends || []).map(getEntityId).filter(Boolean).map((id) => id.toString()));
  }, [friends]);

  const displayedDiaries = useMemo(() => {
    if (mapMode === 'explore' || visibilityFilter === 'all') {
      return diaries;
    }

    return diaries.filter((diary) => {
      const visibility = diary.visibility || 'private';
      const authorId = getDiaryAuthorId(diary);
      const isOwnDiary = sameId(authorId, currentUserId);
      const isFriendDiary = Boolean(authorId && friendIdSet.has(authorId.toString()));

      if (visibilityFilter === 'private') {
        return isOwnDiary && visibility === 'private';
      }

      if (visibilityFilter === 'friends') {
        return isFriendDiary && (visibility === 'friends' || visibility === 'public');
      }

      if (visibilityFilter === 'public') {
        return visibility === 'public';
      }

      return true;
    });
  }, [currentUserId, diaries, friendIdSet, mapMode, visibilityFilter]);

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
    setSelectedDiary((current) => current
      ? displayedDiaries.find((diary) => String(diary._id) === String(current._id)) || null
      : null);
  }, [displayedDiaries]);

  const selectDiaryAndFocus = useCallback((diary, options = {}) => {
    if (!diary?._id) return;

    setSelectedDiary(diary);
    const focus = getDiaryFocusLocation(diary);

    if (focus) {
      setMapFocusLocation({ ...focus, ...options });
    }
  }, []);

  async function handleAuth(mode, form) {
    try {
      setAuthLoading(true);
      setAuthError('');
      const payload = mode === 'login' ? await api.login(form) : await api.register(form);

      const token = payload.token || payload.data?.token;
      const nextUser = payload.user || payload.data?.user;
      if (!token || !nextUser) {
        throw new Error('驗證回應格式不正確，請稍後再試');
      }

      saveAuth(token, nextUser);
      setUser(nextUser);
      setMapMode('mine');
      setVisibilityFilter('all');
      setExploreCenter(null);
      setMapFocusLocation(null);
      navigate('/');
      if (mode === 'register') showActionToast('歡迎來到 Adrift');
      await Promise.all([loadDiaries({}, { silent: true }), loadSocial()]);

      return payload;
    } catch (error) {
      setAuthError(mode === 'login' && (error.status === 401 || error.status === 404) ? 'Email 或密碼不正確，請再試一次。' : error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  async function openNewDiary() {
    if (!user) {
      navigate('/auth');
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
      if (!diary?._id) {
        throw new Error('日記建立回應格式不正確，請稍後再試');
      }
      if (mapMode === 'explore' && exploreCenter) {
        await loadExploreDiaries({ ...exploreCenter, radius: exploreRadius }, { silent: true });
      } else {
        setDiaries((current) => [diary, ...current.filter((item) => item._id !== diary._id)]);
      }
      setDraftLocation(null);
      setSelectedDiary(diary);
      showActionToast('日記已新增');
    } catch (error) {
      if (error.status !== 401) setDiaryError(error.message);
      throw error;
    } finally {
      setPublishing(false);
    }
  }

  async function openEditDiary(diary) {
    if (!diary?._id) return;

    try {
      setDiaryError('');
      const cachedLocation = userLocation.location;
      const location = cachedLocation || (await userLocation.getLocation());
      setEditLocation(location);
      setEditingDiary(diary);
    } catch (error) {
      setDiaryError(error.message || '需要目前位置才能編輯日記');
    }
  }

  async function refreshEditLocation() {
    try {
      setDiaryError('');
      const location = await userLocation.refreshLocation({
        preciseMessage: '已更新目前位置',
        approximateMessage: '已使用大略位置'
      });
      setEditLocation(location);
      return location;
    } catch (error) {
      setDiaryError(error.message || '無法更新目前位置');
      throw error;
    }
  }

  async function updateDiary(diaryId, payload) {
    try {
      setPublishing(true);
      setDiaryError('');
      const response = await api.updateDiary(diaryId, payload);
      const diary = response.data?.diary || response.data || response.diary;

      if (!diary?._id) {
        throw new Error('日記更新回應格式不正確，請稍後再試');
      }

      setDiaries((current) => current.map((item) => (item._id === diary._id ? { ...item, ...diary } : item)));
      setSelectedDiary((current) => (current?._id === diary._id ? { ...current, ...diary } : current));

      setEditingDiary(null);
      setEditLocation(null);
      showActionToast('日記已更新');
      return response;
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
      showActionToast('日記已刪除');
    } catch (error) {
      if (error.status !== 401) setDiaryError(error.message);
    }
  }

  async function reactToDiary(id, type, optimisticDiary) {
    const token = getStoredAuth().token;
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
      showActionToast('已更新共鳴');
      return payload;
    } catch (error) {
      if (token !== getStoredAuth().token) throw error;
      if (previousSelected) setSelectedDiary(previousSelected);
      if (previousDiary) {
        setDiaries((current) => current.map((diary) => (diary._id === id ? previousDiary : diary)));
      }
      if (error.status !== 401) setDiaryError(error.message);
      throw error;
    }
  }

  const handleMapViewportChange = useCallback((params) => {
    if (!user || mapMode !== 'explore') return;

    const nextCenter = { lat: params.lat, lng: params.lng };
    setExploreCenter(nextCenter);
    loadExploreDiaries({ ...nextCenter, radius: exploreRadius }, { silent: true });
  }, [exploreRadius, loadExploreDiaries, mapMode, user]);

  async function activateMineMode() {
    exploreRequestVersion.current++;
    setMapMode('mine');
    setExploreCenter(null);
    setSelectedDiary(null);
    setMapFocusLocation(null);
    await loadDiaries({}, { silent: true });
  }

  async function activateExploreMode(radius = exploreRadius) {
    if (!user) {
      navigate('/auth');
      return;
    }

    const version = ++exploreRequestVersion.current;
    diaryRequestVersion.current++;

    try {
      setMapMode('explore');
      setVisibilityFilter('all');
      setSelectedDiary(null);
      setDiaryLoading(true);
      setDiaryError('');
      const location = await userLocation.getLocation();
      if (version !== exploreRequestVersion.current) return;
      const center = {
        lat: location.lat,
        lng: location.lng
      };

      setExploreCenter(center);
      await loadExploreDiaries({ ...center, radius }, { silent: true });
    } catch (error) {
      if (version === exploreRequestVersion.current) {
        setDiaryError(error.message || '無法取得位置，請稍後再試');
        setDiaryLoading(false);
      }
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
    if (!payload.data) {
      throw new Error('找不到此使用者');
    }
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
    await refreshSocialContent();
    return payload;
  }

  async function rejectFriendRequest(requestId) {
    const payload = await api.rejectFriendRequest(requestId);
    await loadSocial();
    return payload;
  }

  async function getFriendProfile(friendId) {
    const payload = await api.getFriendProfile(friendId);
    if (!payload.data) {
      throw new Error('無法取得好友資料');
    }
    return payload.data;
  }

  async function getFriendRecommendations(limit = 10) {
    const payload = await api.getFriendRecommendations(limit);
    return asArray(payload.data);
  }

  async function deleteFriend(friendId) {
    const payload = await api.deleteFriend(friendId);
    clearSharedContent();
    setFriends(current => current.filter(friend => !sameId(friend._id, friendId)));
    await refreshSocialContent();
    return payload;
  }

  async function copyUserCode() {
    const userCode = user?.userCode;
    if (!userCode) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(userCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = userCode;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setUserCodeCopied(true);
      setUserCodeCopyError(false);
    } catch {
      setUserCodeCopied(false);
      setUserCodeCopyError(true);
    }
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

  async function updateAvatar(formData) {
    const payload = await api.updateAvatar(formData);
    syncUser(payload.data?.user || { ...user, avatar: payload.data?.avatar || '' });
    return payload;
  }

  async function deleteAvatar() {
    const payload = await api.deleteAvatar();
    syncUser(payload.data?.user || { ...user, avatar: '' });
    return payload;
  }

  async function deleteAccount(form) {
    const payload = await api.deleteAccount(form);
    logout(payload.message || '帳號已刪除');
    return payload;
  }

  function openDiaryFromFeed(diary) {
    if (!diary?._id) return;
    selectDiaryAndFocus(diary);
    setVisibilityFilter('all');
    navigate('/');
  }

  async function openMemoryDiary(id, signal) {
    const { token } = getStoredAuth();
    const payload = await api.getDiary(id, signal);
    if (signal?.aborted || token !== getStoredAuth().token) return;
    const diary = payload.data?.diary;
    if (!diary?._id) throw new Error('這篇日記目前無法開啟。');
    setDiaries(current => current.some(item => item._id === diary._id) ? current : [...current, diary]);
    openDiaryFromFeed(diary);
  }

  return (
    <main
      className={`app-frame ${performanceMode.lowPerformance ? 'low-performance' : ''} ${performanceMode.reducedMotion ? 'reduced-motion' : ''}`}
    >
      <div className="ambient-bg" />

      <div
        className={`app-layout ${user ? 'authenticated' : ''} ${!user && isAuthPage ? 'auth-mode' : ''} ${!user && !isAuthPage && !isPublicStandalonePage ? 'guest' : ''} ${isLandingPage ? 'landing-mode' : ''} ${isPublicInfoPage ? 'public-info-mode' : ''} ${isFriendsPage ? 'friends-mode' : ''} ${isFeedPage ? 'feed-mode' : ''} ${isSettingsPage ? 'settings-mode' : ''} ${isAiPage ? 'ai-mode' : ''} ${isAdminPage ? 'admin-mode' : ''} ${isPresentationPage ? 'presentation-mode' : ''} ${isPresentationDownloadPage ? 'presentation-download-mode' : ''}`}
      >
        {isPresentationDownloadPage ? (
          <PresentationPdfDownload />
        ) : isPresentationPage ? (
          <PresentationPage />
        ) : isLandingPage ? (
          <LandingPage onNavigate={navigate} />
        ) : isFeaturePage ? (
          <FeaturePage slug={featureSlug} onNavigate={navigate} />
        ) : isPublicInfoPage ? (
          <PublicInfoPage type={isPrivacyPage ? 'privacy' : 'about'} onNavigate={navigate} />
        ) : user && isAdminPage ? (
          isAdmin ? (
            <AdminDashboard user={user} theme={theme} onThemeChange={setTheme} onBack={() => navigate('/')} onLogout={() => logout()} />
          ) : (
            <AdminForbidden onBack={() => navigate('/')} />
          )
        ) : !user && isAuthPage ? (
          <AuthPanel
            onAuth={handleAuth}
            onClearError={() => setAuthError('')}
            onClearNotice={() => setAuthNotice('')}
            loading={authLoading}
            error={authError}
            notice={authNotice}
          />
        ) : (
        <>
        <header className="product-navbar glass">
          <button className="brand-nav-button" type="button" onClick={() => navigate('/')} aria-label="回到地圖">
            <img className="brand-icon nav-brand-icon" src="/adrift-icon.png" alt="" aria-hidden="true" />
            <strong>Adrift</strong>
          </button>

          {user ? (
            <>
              <nav className="primary-nav" aria-label="主要導覽">
                <button className={isHomePath(currentPath) ? 'active' : ''} type="button" onClick={() => navigate('/')}>
                  <Home size={16} />
                  地圖
                </button>
                <button className={isFriendsPage ? 'active' : ''} type="button" onClick={() => navigate('/friends')}>
                  <Users size={16} />
                  好友
                </button>
                <button className={isFeedPage ? 'active' : ''} type="button" onClick={() => navigate('/feed')}>
                  <Activity size={16} />
                  動態
                </button>
                <button className={isAiPage ? 'active' : ''} type="button" onClick={() => navigate('/ai/life-map')}>
                  <Brain size={16} />
                  Adrift Intelligence
                </button>
              </nav>

              <div className="navbar-actions" ref={navbarActionsRef}>
                <div className="nav-popover-wrap">
                  <button
                    className={`nav-icon-button ${notificationsOpen ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      setNotificationsOpen((open) => !open);
                      setUserMenuOpen(false);
                    }}
                    aria-label={`通知${notifications.unreadCount ? `，${notifications.unreadCount} 則未讀` : ''}`}
                    aria-expanded={notificationsOpen}
                    aria-controls="nav-notifications"
                  >
                    <Bell size={18} />
                    {notifications.unreadCount > 0 && <span className="nav-badge"><AnimatedNumber value={notifications.unreadCount > 99 ? '99+' : notifications.unreadCount} digits={3} variant="badge" /></span>}
                  </button>
                  <AnimatePresence initial={false}>{notificationsOpen && (
                    <ContentTransition id="nav-notifications" tabIndex={-1} role="region" aria-label="通知清單" className="nav-dropdown notifications-dropdown glass" onKeyDown={handlePopoverKeyDown}>
                      <NotificationList notifications={notifications} onOpen={async target => {
                        if (target.type === 'diary_reaction') await openMemoryDiary(target.targetId);
                        else if (target.type === 'friend_request') { setNotificationEntry(value => value + 1); navigate('/friends'); }
                        else setProfilePerson({ _id: target.actorId, name: '好友' });
                        setNotificationsOpen(false);
                      }} />
                    </ContentTransition>
                  )}</AnimatePresence>
                </div>

                <div className="nav-popover-wrap">
                  <button
                    className={`nav-avatar-button ${userMenuOpen ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      setUserMenuOpen((open) => !open);
                      setNotificationsOpen(false);
                    }}
                    aria-label="使用者選單"
                    aria-expanded={userMenuOpen}
                    aria-controls="nav-user-menu"
                  >
                    <UserAvatar user={user} size="sm" />
                    <small>{user.name || '使用者'}</small>
                  </button>
                  <AnimatePresence initial={false}>{userMenuOpen && (
                    <ContentTransition id="nav-user-menu" className="nav-dropdown user-dropdown glass" onKeyDown={handlePopoverKeyDown}>
                      <div className="nav-dropdown-header">
                        <div className="nav-dropdown-avatar-row">
                          <UserAvatar user={user} size="md" />
                          <div>
                            <strong>{user.name || 'Account'}</strong>
                            {user.role && <span className={`nav-role-badge ${user.role}`}>{user.role}</span>}
                          </div>
                        </div>
                        <div className="nav-user-code-row">
                          <span>@{user.userCode || 'user'}</span>
                          <button
                            className="copy-mini-button nav-copy-button"
                            type="button"
                            onClick={copyUserCode}
                            aria-label={userCodeCopyError ? '複製使用者 ID 失敗' : userCodeCopied ? '已複製使用者 ID' : '複製使用者 ID'}
                            data-state={userCodeCopyError ? 'error' : userCodeCopied ? 'copied' : 'idle'}
                          >
                            <span className="copy-feedback-icon" aria-hidden="true">
                              <Copy size={13} />
                              <Check size={13} />
                            </span>
                            <span className="copy-feedback-label" aria-hidden="true">
                              <span>複製</span>
                              <span>{userCodeCopyError ? '失敗' : '已複製'}</span>
                            </span>
                          </button>
                        </div>
                      </div>
                      <button type="button" onClick={() => navigate('/settings/account')}>
                        <Settings size={15} />
                        我的帳號
                      </button>
                      {isAdmin && (
                        <button type="button" onClick={() => navigate('/admin/dashboard')}>
                          <Shield size={15} />
                          Admin Dashboard
                        </button>
                      )}
                      <button className="danger-menu-item" type="button" onClick={() => logout()}>
                        <LogOut size={15} />
                        登出
                      </button>
                    </ContentTransition>
                  )}</AnimatePresence>
                </div>
              </div>

            </>
          ) : (
            <button className="primary-button compact" onClick={() => navigate('/auth')}>
              登入
            </button>
          )}
        </header>

        {user && <nav className="mobile-bottom-nav glass" aria-label="手機導覽">
          <button className={isHomePath(currentPath) ? 'active' : ''} type="button" onClick={() => navigate('/')}><Home size={18} /><span>地圖</span></button>
          <button className={isFriendsPage ? 'active' : ''} type="button" onClick={() => navigate('/friends')}><Users size={18} /><span>好友</span></button>
          <button className={isFeedPage ? 'active' : ''} type="button" onClick={() => navigate('/feed')}><Activity size={18} /><span>動態</span></button>
          <button className={isAiPage ? 'active' : ''} type="button" onClick={() => navigate('/ai/life-map')}><Brain size={18} /><span>Intelligence</span></button>
        </nav>}

        {user && isSettingsPage ? (
          <AccountSettings
            key="account-settings"
            user={user}
            theme={theme}
            onThemeChange={setTheme}
            onBack={() => navigate('/')}
            onUpdateName={updateName}
            onUpdateEmail={updateEmail}
            onUpdatePassword={updatePassword}
            onUpdateAvatar={updateAvatar}
            onDeleteAvatar={deleteAvatar}
            onDeleteAccount={deleteAccount}
          />
        ) : user && isFriendsPage ? (
          <FriendsPage
            key="friends-page"
            notificationEntry={notificationEntry}
            user={user}
            diaries={displayedDiaries}
            friends={friends}
            friendRequests={friendRequests}
            sentFriendRequests={sentFriendRequests}
            socialRefreshToken={socialRefreshToken}
            socialState={socialState}
            onRefresh={refreshSocialContent}
            onOpenMap={() => navigate('/')}
            onOpenDiary={openMemoryDiary}
            onSearchUser={searchFriendUser}
            onSendFriendRequest={sendFriendRequest}
            onCancelFriendRequest={cancelFriendRequest}
            onAcceptFriendRequest={acceptFriendRequest}
            onRejectFriendRequest={rejectFriendRequest}
            onGetFriendRecommendations={getFriendRecommendations}
            onGetFriendProfile={getFriendProfile}
            onDeleteFriend={deleteFriend}
          />
        ) : user && isFeedPage ? (
          <FeedPage
            diaries={diaries}
            user={user}
            onOpenDiary={diary => openMemoryDiary(diary._id)}
            onOpenPerson={setProfilePerson}
            onReact={reactToDiary}
            onNewDiary={openNewDiary}
          />
        ) : user && isAiPage ? (
          <LifeMapAI
            state={lifeMapState}
            onStateChange={updateLifeMapState}
            onBack={() => navigate('/')}
            onOpenDiary={openMemoryDiary}
            onNewDiary={openNewDiary}
          />
        ) : (
        <>
        <section className="experience-panel">
          <div className="map-stage">
            <DiarySidePanel
              diary={selectedDiary}
              currentUser={user}
              currentLocation={userLocation.location}
              onClose={() => setSelectedDiary(null)}
              onDelete={deleteDiary}
              onReact={reactToDiary}
              onEdit={openEditDiary}
            />
            <MapView
              diaries={displayedDiaries}
              selectedDiary={selectedDiary}
              onSelect={selectDiaryAndFocus}
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
              theme={theme}
            />
          </div>

          <div className="status-strip glass">
            <span>
              <MapPin size={15} />
              {stats.total} 則記憶
            </span>
            <span>{stats.mine} 我的</span>
            {mapMode === 'explore' && !diaryLoading && diaries.length === 0 && <strong>附近還很安靜，先留下自己的記憶。</strong>}
            {locating && <strong>正在取得位置...</strong>}
            {userLocation.message && <strong className={userLocation.accuracyType === 'approximate' ? 'location-approximate' : 'location-success'}>{userLocation.message}</strong>}
            {userLocation.accuracyType === 'approximate' && !userLocation.message && <strong className="location-approximate">目前為大略位置</strong>}
            {userLocation.error && <strong>{userLocation.error}</strong>}
            {diaryError && <strong>{diaryError}</strong>}
          </div>
        </section>

        <AnimatePresence mode="wait">
          {user ? (
            <MemoryPanel
              key="memory-panel"
              user={user}
              diaries={displayedDiaries}
              friends={friends}
              friendRequests={friendRequests}
              sentFriendRequests={sentFriendRequests}
              socialRefreshToken={socialRefreshToken}
              mapMode={mapMode}
              exploreRadius={exploreRadius}
              exploreRadiusOptions={exploreRadiusOptions}
              diaryLoading={diaryLoading}
              onActivateMineMode={activateMineMode}
              onActivateExploreMode={activateExploreMode}
              onExploreRadiusChange={changeExploreRadius}
              visibilityFilter={visibilityFilter}
              onVisibilityFilterChange={setVisibilityFilter}
              selectedDiaryId={selectedDiary?._id}
              onSelectDiary={selectDiaryAndFocus}
              onNewDiary={openNewDiary}
              createDiaryDisabled={locating}
              onSearchUser={searchFriendUser}
              onSendFriendRequest={sendFriendRequest}
              onCancelFriendRequest={cancelFriendRequest}
              onAcceptFriendRequest={acceptFriendRequest}
              onRejectFriendRequest={rejectFriendRequest}
              onGetFriendRecommendations={getFriendRecommendations}
              onGetFriendProfile={getFriendProfile}
              onDeleteFriend={deleteFriend}
              lowPerformance={performanceMode.lowPerformance}
            />
          ) : null}
        </AnimatePresence>
        </>
        )}
        </>
        )}
      </div>
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
        {editingDiary && editLocation && (
          <DiaryModal
            mode="edit"
            diary={editingDiary}
            location={editLocation}
            onClose={() => {
              setEditingDiary(null);
              setEditLocation(null);
            }}
            onSubmit={(payload) => updateDiary(editingDiary._id, payload)}
            onRefreshLocation={refreshEditLocation}
            loading={publishing}
            error={diaryError}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{user && profilePerson && <FriendProfile key={profilePerson._id} person={profilePerson} refreshToken={socialRefreshToken} onClose={() => setProfilePerson(null)} onOpenDiary={async (id, signal) => { await openMemoryDiary(id, signal); setProfilePerson(null); }} />}</AnimatePresence>
      <ToastViewport toast={actionToast} className="avoid-sidebar" onDismiss={() => setActionToast(null)} />
    </main>
  );
}

function PresentationPdfDownload() {
  useEffect(() => {
    const link = document.createElement('a');
    link.href = PRESENTATION_PDF_PATH;
    link.download = 'Adrift-presentation.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  return (
    <section className="presentation-download-page">
      <div className="presentation-download-card">
        <img src="/adrift-icon.png" alt="" aria-hidden="true" />
        <p className="eyebrow">Presentation PDF</p>
        <h1>正在下載簡報 PDF</h1>
        <p>如果瀏覽器沒有自動開始下載，請點擊下方按鈕。</p>
        <a className="primary-button" href={PRESENTATION_PDF_PATH} download="Adrift-presentation.pdf">
          下載簡報 PDF
        </a>
      </div>
    </section>
  );
}

function buildApproximatePlaceName(location) {
  if (location?.source !== 'ip') return '';

  return normalizeTaiwanPlaceName([location.city, location.region, location.country].filter(Boolean).join(', '));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isHomePath(path) {
  return path === '/' || path === '/map' || path === '/profile';
}
