import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Eye, RefreshCcw, Search, Shield, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, getImageUrl } from '../api/client.js';
import { MOOD_FILTER_OPTIONS, ROLE_FILTER_OPTIONS, ROLE_OPTIONS, VISIBILITY_FILTER_OPTIONS } from '../constants/app.js';
import Select from './ui/Select.jsx';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'diaries', label: 'Diaries' }
];

const defaultPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };

const roleFilterOptions = ROLE_FILTER_OPTIONS.map((value) => ({
  value,
  label: value === 'all' ? 'All roles' : formatRole(value)
}));

const visibilityFilterOptions = VISIBILITY_FILTER_OPTIONS.map((value) => ({
  value,
  label: value === 'all' ? 'All visibility' : value
}));

const moodFilterOptions = MOOD_FILTER_OPTIONS.map((value) => ({
  value,
  label: value === 'all' ? 'All moods' : value
}));

export default function AdminDashboard({ user, onBack, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState(defaultPagination);
  const [diaries, setDiaries] = useState([]);
  const [diariesPagination, setDiariesPagination] = useState(defaultPagination);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [userRole, setUserRole] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [diarySearch, setDiarySearch] = useState('');
  const [debouncedDiarySearch, setDebouncedDiarySearch] = useState('');
  const [diaryVisibility, setDiaryVisibility] = useState('all');
  const [diaryMood, setDiaryMood] = useState('all');
  const [diaryPage, setDiaryPage] = useState(1);
  const [loading, setLoading] = useState({ overview: true, users: false, diaries: false });
  const [deleteLoadingId, setDeleteLoadingId] = useState('');
  const [roleLoadingId, setRoleLoadingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUserPage(1);
      setDebouncedUserSearch(userSearch.trim());
    }, 400);

    return () => window.clearTimeout(timer);
  }, [userSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDiaryPage(1);
      setDebouncedDiarySearch(diarySearch.trim());
    }, 400);

    return () => window.clearTimeout(timer);
  }, [diarySearch]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab, debouncedUserSearch, userRole, userPage]);

  useEffect(() => {
    if (activeTab === 'diaries') {
      loadDiaries();
    }
  }, [activeTab, debouncedDiarySearch, diaryVisibility, diaryMood, diaryPage]);

  const overviewStats = useMemo(() => {
    return [
      ['總使用者數', stats?.totalUsers],
      ['總日記數', stats?.totalDiaries],
      ['今日新增使用者', stats?.todayUsers],
      ['今日新增日記', stats?.todayDiaries],
      ['Public 日記', stats?.publicDiaries],
      ['Friends 日記', stats?.friendsDiaries],
      ['Private 日記', stats?.privateDiaries]
    ];
  }, [stats]);

  const activeSection = useMemo(() => {
    const sections = {
      overview: { eyebrow: 'Overview', title: '系統總覽' },
      users: { eyebrow: 'Users', title: '使用者管理' },
      diaries: { eyebrow: 'Diaries', title: '日記管理' }
    };

    return sections[activeTab] || sections.overview;
  }, [activeTab]);

  async function loadStats() {
    try {
      setLoading((current) => ({ ...current, overview: true }));
      setError('');
      const payload = await api.getAdminStats();
      setStats(payload.data);
    } catch (err) {
      setError(err.message || '管理資料載入失敗，請稍後再試');
    } finally {
      setLoading((current) => ({ ...current, overview: false }));
    }
  }

  async function loadUsers() {
    try {
      setLoading((current) => ({ ...current, users: true }));
      setError('');
      const payload = await api.getAdminUsers({
        page: userPage,
        limit: 10,
        search: debouncedUserSearch,
        role: userRole
      });
      setUsers(payload.data?.items || []);
      setUsersPagination(payload.data?.pagination || defaultPagination);
    } catch (err) {
      setError(err.message || '管理資料載入失敗，請稍後再試');
    } finally {
      setLoading((current) => ({ ...current, users: false }));
    }
  }

  async function loadDiaries() {
    try {
      setLoading((current) => ({ ...current, diaries: true }));
      setError('');
      const payload = await api.getAdminDiaries({
        page: diaryPage,
        limit: 10,
        search: debouncedDiarySearch,
        visibility: diaryVisibility,
        mood: diaryMood
      });
      setDiaries(payload.data?.items || []);
      setDiariesPagination(payload.data?.pagination || defaultPagination);
    } catch (err) {
      setError(err.message || '管理資料載入失敗，請稍後再試');
    } finally {
      setLoading((current) => ({ ...current, diaries: false }));
    }
  }

  function refreshActiveTab() {
    if (activeTab === 'overview') loadStats();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'diaries') loadDiaries();
  }

  async function deleteDiary(id) {
    try {
      setDeleteLoadingId(id);
      setError('');
      const payload = await api.deleteAdminDiary(id);
      setNotice(payload.message || '日記已刪除');
      window.setTimeout(() => setNotice(''), 2200);
      setSelectedDiary((current) => (current?._id === id ? null : current));
      await Promise.all([loadStats(), loadDiaries()]);
    } catch (err) {
      setError(err.message || '刪除日記失敗');
    } finally {
      setDeleteLoadingId('');
    }
  }

  async function updateUserRole(id, role) {
    try {
      setRoleLoadingId(id);
      setError('');
      const payload = await api.updateAdminUserRole(id, role);
      setUsers((current) => current.map((item) => (item._id === id ? { ...item, ...payload.data } : item)));
      setNotice(payload.message || '使用者權限已更新');
      window.setTimeout(() => setNotice(''), 2200);
    } catch (err) {
      setError(err.message || '更新使用者權限失敗');
    } finally {
      setRoleLoadingId('');
    }
  }

  return (
    <motion.section
      className="admin-page admin-dashboard-container"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <header className="admin-hero glass">
        <button className="icon-button" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={18} />
        </button>
        <div className="admin-title-block">
          <p className="eyebrow">Admin Mode</p>
          <h1>管理員模式</h1>
          <p>以低密度工作台管理系統、使用者與日記內容。</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-badge">
            <Shield size={15} />
            {user?.userCode ? `@${user.userCode}` : 'admin'}
          </span>
          <button className="ghost-button" type="button" onClick={refreshActiveTab} disabled={loading[activeTab]}>
            {loading[activeTab] ? <span className="button-spinner" /> : <RefreshCcw size={16} />}
            重新整理
          </button>
          <button className="ghost-button danger" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="admin-tab-strip">
        <nav className="admin-tabs glass" aria-label="Admin dashboard tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="admin-current-section">
          <p className="eyebrow">{activeSection.eyebrow}</p>
          <h2>
            {activeSection.title}
            {loading[activeTab] && <span className="button-spinner" />}
          </h2>
        </div>
        <div className="admin-feedback-slot" aria-live="polite">
          <AnimatePresence>
            {notice && (
              <motion.p className="admin-notice" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                {notice}
              </motion.p>
            )}
            {error && (
              <motion.p className="admin-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="admin-content-frame">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'overview' && (
            <motion.section
              key="overview"
              className="admin-card admin-overview-card glass"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
            {loading.overview ? (
              <p className="admin-empty">載入管理資料中...</p>
            ) : (
              <>
                <div className="admin-stats overview-stats">
                  {overviewStats.map(([label, value]) => (
                    <Stat key={label} label={label} value={value} />
                  ))}
                </div>
                <div className="admin-activity">
                  <div>
                    <p className="eyebrow">Recent Activity</p>
                    <h3>今日系統狀態</h3>
                  </div>
                  <p>今天新增 {stats?.todayUsers ?? 0} 位使用者、{stats?.todayDiaries ?? 0} 篇日記。</p>
                  <p>公開 / 好友 / 私密日記分布為 {stats?.publicDiaries ?? 0} / {stats?.friendsDiaries ?? 0} / {stats?.privateDiaries ?? 0}。</p>
                </div>
              </>
            )}
            </motion.section>
          )}

          {activeTab === 'users' && (
            <motion.section
              key="users"
              className="admin-card admin-data-card glass"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
            <div className="admin-controls">
              <label className="admin-search">
                <Search size={16} />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="搜尋 name / userCode / email"
                />
              </label>
              <Select
                label="Role"
                value={userRole}
                options={roleFilterOptions}
                onChange={(value) => {
                  setUserPage(1);
                  setUserRole(value);
                }}
                size="sm"
              />
            </div>
            <UsersTable
              users={users}
              currentUser={user}
              loading={loading.users}
              roleLoadingId={roleLoadingId}
              onUpdateRole={updateUserRole}
            />
            <Pagination pagination={usersPagination} onPageChange={setUserPage} />
            </motion.section>
          )}

          {activeTab === 'diaries' && (
            <motion.section
              key="diaries"
              className="admin-card admin-data-card glass"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
            <div className="admin-controls diaries-controls">
              <label className="admin-search">
                <Search size={16} />
                <input
                  value={diarySearch}
                  onChange={(event) => setDiarySearch(event.target.value)}
                  placeholder="搜尋 title / content / author userCode"
                />
              </label>
              <Select
                label="Visibility"
                value={diaryVisibility}
                options={visibilityFilterOptions}
                onChange={(value) => {
                  setDiaryPage(1);
                  setDiaryVisibility(value);
                }}
                size="sm"
              />
              <Select
                label="Mood"
                value={diaryMood}
                options={moodFilterOptions}
                onChange={(value) => {
                  setDiaryPage(1);
                  setDiaryMood(value);
                }}
                size="sm"
              />
            </div>
            <DiariesTable
              diaries={diaries}
              loading={loading.diaries}
              deleteLoadingId={deleteLoadingId}
              onView={setSelectedDiary}
              onDelete={deleteDiary}
            />
            <Pagination pagination={diariesPagination} onPageChange={setDiaryPage} />
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedDiary && (
          <DiaryDetailModal
            diary={selectedDiary}
            deleteLoading={deleteLoadingId === selectedDiary._id}
            onClose={() => setSelectedDiary(null)}
            onDelete={() => deleteDiary(selectedDiary._id)}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export function AdminForbidden({ onBack }) {
  return (
    <motion.section
      className="admin-page admin-forbidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <div className="admin-card glass">
        <p className="eyebrow">Admin Mode</p>
        <h1>沒有管理員權限</h1>
        <p>這個頁面只開放給 role 為 admin 或 owner 的使用者。</p>
        <button className="primary-button compact" type="button" onClick={onBack}>
          返回首頁
        </button>
      </div>
    </motion.section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="admin-stat">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </div>
  );
}

function UsersTable({ users, currentUser, loading, roleLoadingId, onUpdateRole }) {
  const canManageRoles = currentUser?.role === 'owner';

  return (
    <div className="admin-table users-table">
      <div className="admin-table-row header">
        <span>使用者名稱</span>
        <span>User ID</span>
        <span>Email</span>
        <span>Role</span>
        <span>Created</span>
      </div>
      {loading && <p className="admin-empty">載入管理資料中...</p>}
      {!loading && users.map((item) => (
        <div className="admin-table-row" key={item._id}>
          <span title={item.name}>{item.name}</span>
          <span title={item.userCode}>@{item.userCode}</span>
          <span title={item.email}>{item.email}</span>
          <RoleControl
            user={item}
            currentUser={currentUser}
            canManageRoles={canManageRoles}
            loading={roleLoadingId === item._id}
            onUpdateRole={onUpdateRole}
          />
          <span>{formatDate(item.createdAt)}</span>
        </div>
      ))}
      {!loading && users.length === 0 && <p className="admin-empty">找不到符合條件的使用者</p>}
    </div>
  );
}

function RoleControl({ user, currentUser, canManageRoles, loading, onUpdateRole }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const role = user.role || 'user';
  const isSelf = user._id === currentUser?._id || user.id === currentUser?.id;
  const roleChoices = ROLE_OPTIONS;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (isSelf) {
    return <span className={`role-pill ${role} self`}>{formatRole(role)} · 目前帳號</span>;
  }

  if (!canManageRoles) {
    return <span className={`role-pill ${role}`}>{formatRole(role)}</span>;
  }

  async function selectRole(nextRole) {
    setOpen(false);
    if (nextRole === role || loading) return;
    await onUpdateRole(user._id, nextRole);
  }

  return (
    <span className="role-editor">
      <span className="role-selector" ref={menuRef}>
        <button
          className={`role-pill role-trigger ${role}`}
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={loading}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {formatRole(role)}
          <ChevronDown size={13} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              className="role-menu"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              role="menu"
            >
              {roleChoices.map((item) => (
                <button
                  key={item}
                  className={item === role ? 'active' : ''}
                  type="button"
                  onClick={() => selectRole(item)}
                  disabled={loading}
                  role="menuitem"
                >
                  <span className={`role-dot ${item}`} />
                  {formatRole(item)}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </span>
      {loading && <span className="button-spinner" />}
    </span>
  );
}

function formatRole(role) {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'User';
}

function DiariesTable({ diaries, loading, deleteLoadingId, onView, onDelete }) {
  return (
    <div className="admin-table diaries-table">
      <div className="admin-table-row header">
        <span>Title</span>
        <span>Author</span>
        <span>Mood</span>
        <span>Visibility</span>
        <span>Created</span>
        <span>操作</span>
      </div>
      {loading && <p className="admin-empty">載入管理資料中...</p>}
      {!loading && diaries.map((diary) => (
        <div className="admin-table-row admin-diary-row" key={diary._id}>
          <span title={diary.title}>{diary.title}</span>
          <span title={diary.author?.userCode || ''}>@{diary.author?.userCode || 'unknown'}</span>
          <span>{diary.mood?.type || '-'}</span>
          <span>{diary.visibility}</span>
          <span>{formatDate(diary.createdAt)}</span>
          <span className="admin-row-actions">
            <button className="chip-button compact-action" type="button" onClick={() => onView(diary)}>
              <Eye size={14} />
              查看
            </button>
            <button
              className="icon-button danger compact-action"
              type="button"
              onClick={() => onDelete(diary._id)}
              disabled={deleteLoadingId === diary._id}
              aria-label="刪除日記"
            >
              {deleteLoadingId === diary._id ? <span className="button-spinner" /> : <Trash2 size={14} />}
            </button>
          </span>
        </div>
      ))}
      {!loading && diaries.length === 0 && <p className="admin-empty">找不到符合條件的日記</p>}
    </div>
  );
}

function Pagination({ pagination, onPageChange }) {
  const page = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || 0;

  return (
    <div className="admin-pagination">
      <span>第 {page} / {totalPages} 頁 · 共 {total} 筆</span>
      <div>
        <button className="ghost-button" type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          上一頁
        </button>
        <button className="ghost-button" type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          下一頁
        </button>
      </div>
    </div>
  );
}

function DiaryDetailModal({ diary, deleteLoading, onClose, onDelete }) {
  const [lng, lat] = diary.location?.coordinates || [];
  const placeName = diary.location?.placeName || (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '未記錄地點');

  return (
    <motion.div className="admin-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.article
        className="admin-detail-modal glass"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <header>
          <div>
            <p className="eyebrow">Diary Detail</p>
            <h2>{diary.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="關閉">
            <X size={18} />
          </button>
        </header>
        {diary.imageUrl && <img className="admin-detail-image" src={getImageUrl(diary.imageUrl)} alt="" />}
        <div className="admin-detail-meta">
          <span>@{diary.author?.userCode || 'unknown'}</span>
          <span>{diary.visibility}</span>
          <span>{diary.mood?.type || '-'} · {diary.mood?.intensity || '-'}</span>
          <span>{formatDate(diary.createdAt)}</span>
          <span>{placeName}</span>
          <span>{diary.locationAccuracy || 'precise'}</span>
        </div>
        <p className="admin-detail-content">{diary.content || diary.text || '沒有內容'}</p>
        <footer>
          <button className="danger-button compact-danger" type="button" onClick={onDelete} disabled={deleteLoading}>
            {deleteLoading ? <span className="button-spinner" /> : <Trash2 size={15} />}
            刪除這篇日記
          </button>
        </footer>
      </motion.article>
    </motion.div>
  );
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}
