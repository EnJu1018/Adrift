import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Eye, RefreshCcw, Search, Shield, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, getImageUrl } from '../api/client.js';
import ContentTransition from './ui/ContentTransition.jsx';
import Modal from './ui/Modal.jsx';
import { MOOD_FILTER_OPTIONS, MOOD_LABELS, ROLE_FILTER_OPTIONS, ROLE_OPTIONS, VISIBILITY_FILTER_OPTIONS } from '../constants/app.js';
import { normalizeTaiwanPlaceName } from '../utils/locationFormatter.js';
import ToastViewport from './ToastViewport.jsx';
import UserAvatar from './UserAvatar.jsx';
import Select from './ui/Select.jsx';
import AnimatedNumber from './ui/AnimatedNumber.jsx';
import './admin.css';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'diaries', label: 'Diaries' },
  { id: 'roles', label: 'Roles & Permissions' },
  { id: 'status', label: 'System Status' }
];

const defaultPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };

const roleFilterOptions = ROLE_FILTER_OPTIONS.map((value) => ({
  value,
  label: value === 'all' ? '全部角色' : formatRole(value)
}));

const visibilityFilterOptions = VISIBILITY_FILTER_OPTIONS.map((value) => ({
  value,
  label: ({ all: '全部範圍', private: '私人', friends: '好友', public: '公開' })[value]
}));

const moodFilterOptions = MOOD_FILTER_OPTIONS.map((value) => ({
  value,
  label: value === 'all' ? '全部心情' : MOOD_LABELS[value] || value
}));

export default function AdminDashboard({ user, theme = 'dark', onThemeChange, onBack, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState(defaultPagination);
  const [diaries, setDiaries] = useState([]);
  const [diariesPagination, setDiariesPagination] = useState(defaultPagination);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [diaryDeleteTarget, setDiaryDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [systemStatus, setSystemStatus] = useState(null);
  const [userSort, setUserSort] = useState('newest');
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
  const [userDeleteTarget, setUserDeleteTarget] = useState(null);
  const [userDeleteLoadingId, setUserDeleteLoadingId] = useState('');
  const [roleLoadingId, setRoleLoadingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestVersions = useRef({ overview: 0, users: 0, diaries: 0 });

  useEffect(() => () => {
    for (const key of Object.keys(requestVersions.current)) requestVersions.current[key]++;
  }, []);

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
  }, [activeTab, debouncedUserSearch, userRole, userPage, userSort]);

  useEffect(() => {
    if (activeTab !== 'status') return;
    const controller = new AbortController();
    api.getAdminStatus(controller.signal).then(payload => { if (!controller.signal.aborted) setSystemStatus(payload.data); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'diaries') {
      loadDiaries();
    }
  }, [activeTab, debouncedDiarySearch, diaryVisibility, diaryMood, diaryPage]);

  useEffect(() => {
    if (!notice && !error) return undefined;

    const timer = window.setTimeout(() => {
      setNotice('');
      setError('');
    }, error ? 3200 : 2200);

    return () => window.clearTimeout(timer);
  }, [error, notice]);

  const overviewStats = useMemo(() => {
    return [
      ['總使用者數', stats?.totalUsers],
      ['總日記數', stats?.totalDiaries],
      ['今日新增使用者', stats?.todayUsers],
      ['今日新增日記', stats?.todayDiaries]
    ];
  }, [stats]);

  const activeSection = useMemo(() => {
    const sections = {
      overview: { eyebrow: 'Overview', title: '系統總覽' },
      users: { eyebrow: 'Users', title: '使用者管理' },
      diaries: { eyebrow: 'Diaries', title: '日記管理' },
      roles: { eyebrow: 'Access', title: '角色與權限' },
      status: { eyebrow: 'Status', title: '系統狀態' }
    };

    return sections[activeTab] || sections.overview;
  }, [activeTab]);

  async function loadStats() {
    const version = ++requestVersions.current.overview;
    try {
      setLoading((current) => ({ ...current, overview: true }));
      setError('');
      const payload = await api.getAdminStats();
      if (version !== requestVersions.current.overview) return;
      setStats(payload.data && typeof payload.data === 'object' ? payload.data : null);
    } catch (err) {
      if (version === requestVersions.current.overview) setError(err.message || '管理資料載入失敗，請稍後再試');
    } finally {
      if (version === requestVersions.current.overview) setLoading((current) => ({ ...current, overview: false }));
    }
  }

  async function loadUsers() {
    const version = ++requestVersions.current.users;
    try {
      setLoading((current) => ({ ...current, users: true }));
      setError('');
      const payload = await api.getAdminUsers({
        page: userPage,
        limit: 10,
        search: debouncedUserSearch,
        role: userRole,
        sort: userSort
      });
      if (version !== requestVersions.current.users) return;
      setUsers(asArray(payload.data?.items));
      setUsersPagination(payload.data?.pagination || defaultPagination);
    } catch (err) {
      if (version === requestVersions.current.users) setError(err.message || '管理資料載入失敗，請稍後再試');
    } finally {
      if (version === requestVersions.current.users) setLoading((current) => ({ ...current, users: false }));
    }
  }

  async function loadDiaries() {
    const version = ++requestVersions.current.diaries;
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
      if (version !== requestVersions.current.diaries) return;
      setDiaries(asArray(payload.data?.items));
      setDiariesPagination(payload.data?.pagination || defaultPagination);
    } catch (err) {
      if (version === requestVersions.current.diaries) setError(err.message || '管理資料載入失敗，請稍後再試');
    } finally {
      if (version === requestVersions.current.diaries) setLoading((current) => ({ ...current, diaries: false }));
    }
  }

  function refreshActiveTab() {
    if (activeTab === 'overview') loadStats();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'diaries') loadDiaries();
    if (activeTab === 'status') { setSystemStatus(null); api.getAdminStatus().then(payload => setSystemStatus(payload.data)).catch(error => setError(error.message)); }
  }

  async function deleteDiary(id) {
    try {
      setDeleteLoadingId(id);
      setError('');
      const payload = await api.deleteAdminDiary(id, deleteReason.trim());
      setDiaryDeleteTarget(null); setDeleteReason('');
      window.dispatchEvent(new CustomEvent('adrift:feed-changed', { detail: { diaryId: id } }));
      setDiaries((current) => current.filter((item) => item._id !== id));
      setDiariesPagination((current) => ({
        ...current,
        total: Math.max(0, (current.total || 0) - 1)
      }));
      setNotice(payload.message || '日記已刪除');
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
      const nextUser = payload.data && typeof payload.data === 'object' ? payload.data : { role };
      setUsers((current) => current.map((item) => (item._id === id ? { ...item, ...nextUser } : item)));
      setNotice(payload.message || '使用者權限已更新');
      await loadStats();
    } catch (err) {
      setError(err.message || '更新使用者權限失敗');
    } finally {
      setRoleLoadingId('');
    }
  }

  async function deleteUser(id) {
    try {
      setUserDeleteLoadingId(id);
      setError('');
      const payload = await api.deleteAdminUser(id);
      setUsers((current) => current.filter((item) => item._id !== id));
      setUsersPagination((current) => ({
        ...current,
        total: Math.max(0, (current.total || 0) - 1)
      }));
      setNotice(payload.message || '使用者已刪除');
      setUserDeleteTarget(null);

      if (users.length <= 1 && userPage > 1) {
        setUserPage((current) => Math.max(1, current - 1));
      } else {
        await loadUsers();
      }

      await loadStats();
    } catch (err) {
      setError(err.message || '刪除使用者失敗');
    } finally {
      setUserDeleteLoadingId('');
    }
  }

  return (
    <section
      className="admin-page admin-dashboard-container admin-console"
    >
      <header className="admin-hero">
        <button className="icon-button" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={18} />
        </button>
        <div className="admin-title-block">
          <p className="eyebrow">Adrift · Administration</p>
          <h1>管理中心</h1>
        </div>
        <div className="admin-hero-actions">
          <div className="admin-theme-switcher" aria-label="主題模式">
            <span>主題模式</span>
            <div>
              <button
                className={theme === 'dark' ? 'active' : ''}
                type="button"
                onClick={() => onThemeChange?.('dark')}
                aria-pressed={theme === 'dark'}
              >
                深色
              </button>
              <button
                className={theme === 'bright' ? 'active' : ''}
                type="button"
                onClick={() => onThemeChange?.('bright')}
                aria-pressed={theme === 'bright'}
              >
                明亮
              </button>
            </div>
          </div>
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
        <nav className="admin-tabs" aria-label="Admin dashboard tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
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
      </div>

      <div className="admin-content-frame">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'overview' && (
            <ContentTransition as="section"
              key="overview"
              className="admin-card admin-overview-card"
            >
            {loading.overview && !stats ? (
              <p className="admin-empty">載入管理資料中...</p>
            ) : (
              <>
                <div className="admin-stats overview-stats">
                  {overviewStats.map(([label, value]) => (
                    <Stat key={label} label={label} value={value} />
                  ))}
                </div>
                <div className="admin-distribution"><h3>記憶分享範圍</h3>{[['公開', 'publicDiaries'], ['好友', 'friendsDiaries'], ['私人', 'privateDiaries']].map(([label, key]) => <div key={key}><span>{label}</span><meter aria-label={label} min="0" max={Math.max(1, stats?.totalDiaries || 0)} value={stats?.[key] || 0} /><AnimatedNumber value={stats?.[key] ?? '—'} digits={5} /></div>)}</div>
                <div className="admin-recent-grid"><section><h3>最近加入</h3>{stats?.recentUsers?.length ? stats.recentUsers.map(person => <div key={person._id} className="admin-recent-person"><UserAvatar user={person} size="sm" /><span><strong>{person.name}</strong><small>@{person.userCode}</small></span><time>{formatDate(person.createdAt)}</time></div>) : <p>目前沒有使用者資料</p>}</section><section><h3>最近的記憶</h3>{stats?.recentDiaries?.length ? stats.recentDiaries.map(diary => <button key={diary._id} onClick={() => setSelectedDiary(diary)}><strong>{diary.title}</strong><span>@{diary.author?.userCode || 'unknown'} · {formatDate(diary.createdAt)}</span></button>) : <p>目前沒有日記資料</p>}</section></div>
              </>
            )}
            </ContentTransition>
          )}

          {activeTab === 'users' && (
            <ContentTransition as="section"
              key="users"
              className="admin-card admin-data-card"
            >
            <div className="admin-controls">
              <label className="admin-search">
                <Search size={16} />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="搜尋名稱、使用者 ID 或 Email"
                />
              </label>
              <Select label="排序" value={userSort} options={[{ value: 'newest', label: '最新加入' }, { value: 'oldest', label: '最早加入' }]} onChange={value => { setUserSort(value); setUserPage(1); }} size="sm" fullWidth={false} />
              <Select
                label="權限"
                value={userRole}
                options={roleFilterOptions}
                onChange={(value) => {
                  setUserPage(1);
                  setUserRole(value);
                }}
                size="sm"
                fullWidth={false}
              />
            </div>
            <UsersTable
              users={users}
              currentUser={user}
              loading={loading.users}
              roleLoadingId={roleLoadingId}
              userDeleteLoadingId={userDeleteLoadingId}
              onUpdateRole={updateUserRole}
              onDeleteUser={user => { setError(''); setUserDeleteTarget(user); }}
            />
            <Pagination pagination={usersPagination} onPageChange={setUserPage} />
            </ContentTransition>
          )}

          {activeTab === 'diaries' && (
            <ContentTransition as="section"
              key="diaries"
              className="admin-card admin-data-card"
            >
            <div className="admin-controls diaries-controls">
              <label className="admin-search">
                <Search size={16} />
                <input
                  value={diarySearch}
                  onChange={(event) => setDiarySearch(event.target.value)}
                  placeholder="搜尋標題、內容或作者 ID"
                />
              </label>
              <Select
                label="可見範圍"
                value={diaryVisibility}
                options={visibilityFilterOptions}
                onChange={(value) => {
                  setDiaryPage(1);
                  setDiaryVisibility(value);
                }}
                size="sm"
                fullWidth={false}
              />
              <Select
                label="心情"
                value={diaryMood}
                options={moodFilterOptions}
                onChange={(value) => {
                  setDiaryPage(1);
                  setDiaryMood(value);
                }}
                size="sm"
                fullWidth={false}
              />
            </div>
            <DiariesTable
              diaries={diaries}
              loading={loading.diaries}
              deleteLoadingId={deleteLoadingId}
              onView={diary => { setError(''); setSelectedDiary(diary); }}
              onDelete={diary => { setError(''); setDeleteReason(''); setDiaryDeleteTarget(diary); }}
            />
            <Pagination pagination={diariesPagination} onPageChange={setDiaryPage} />
            </ContentTransition>
          )}
          {activeTab === 'roles' && <ContentTransition key="roles" className="admin-access"><p>目前登入角色：<strong>{formatRole(user.role)}</strong></p><table><thead><tr><th>權限</th><th>User</th><th>Admin</th><th>Owner</th></tr></thead><tbody>{[['個人日記與好友', '✓', '✓', '✓'], ['查看系統統計', '—', '✓', '✓'], ['管理日記', '—', '✓', '✓'], ['調整角色 / 刪除使用者', '—', '—', '✓']].map(row => <tr key={row[0]}>{row.map((cell, index) => index ? <td key={index}>{cell}</td> : <th key={index}>{cell}</th>)}</tr>)}</tbody></table><p>Owner 帳號不可降權或刪除。所有操作由伺服器重新驗證權限。</p></ContentTransition>}
          {activeTab === 'status' && <ContentTransition key="status" className="admin-system"><h3>服務連線</h3>{systemStatus ? <dl><div><dt>API</dt><dd>已回應</dd></div><div><dt>資料庫</dt><dd>{systemStatus.database?.connected ? '已連線' : systemStatus.database?.status || '尚未連線'}</dd></div><div><dt>檢查時間</dt><dd>{formatDate(systemStatus.checkedAt)}</dd></div></dl> : <p role="status">正在檢查服務…</p>}<p>顯示本次實際查詢結果，不代表歷史可用率。</p></ContentTransition>}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedDiary && (
          <DiaryDetailModal
            diary={selectedDiary}
            error={error}
            deleteLoading={deleteLoadingId === selectedDiary._id}
            onClose={() => setSelectedDiary(null)}
            onDelete={() => { setDeleteReason(''); setDiaryDeleteTarget(selectedDiary); setSelectedDiary(null); }}
          />
        )}
        {userDeleteTarget && (
          <DeleteUserModal
            user={userDeleteTarget}
            error={error}
            loading={userDeleteLoadingId === userDeleteTarget._id}
            onClose={() => setUserDeleteTarget(null)}
            onConfirm={() => deleteUser(userDeleteTarget._id)}
          />
        )}
        {diaryDeleteTarget && <Modal label="刪除日記確認" className="admin-detail-modal admin-danger-modal" busy={!!deleteLoadingId} error={error} onClose={() => setDiaryDeleteTarget(null)}><header><h2>刪除這篇記憶？</h2><button className="icon-button" aria-label="關閉" onClick={() => setDiaryDeleteTarget(null)} disabled={!!deleteLoadingId}><X size={18} /></button></header><p>「{diaryDeleteTarget.title}」將永久移除，作者無法復原。</p><label className="admin-confirm-field"><span>管理原因</span><textarea value={deleteReason} maxLength={300} onChange={event => setDeleteReason(event.target.value)} placeholder="請簡短說明原因（至少 4 字）" /></label><footer><button className="ghost-button" disabled={!!deleteLoadingId} onClick={() => setDiaryDeleteTarget(null)}>取消</button><button className="danger-button compact-danger" disabled={!!deleteLoadingId || deleteReason.trim().length < 4} onClick={() => deleteDiary(diaryDeleteTarget._id)}>{deleteLoadingId ? <span className="button-spinner" /> : <Trash2 size={16} />}永久刪除</button></footer></Modal>}
      </AnimatePresence>
      <ToastViewport
        toast={error ? { id: `admin-error-${error}`, message: error, type: 'error' } : notice ? { id: `admin-notice-${notice}`, message: notice, type: 'success' } : null}
        onDismiss={() => {
          setNotice('');
          setError('');
        }}
      />
    </section>
  );
}

export function AdminForbidden({ onBack }) {
  return (
    <section
      className="admin-page admin-forbidden"
    >
      <div className="admin-card glass">
        <p className="eyebrow">Admin Mode</p>
        <h1>沒有管理員權限</h1>
        <p>這個頁面只開放給 role 為 admin 或 owner 的使用者。</p>
        <button className="primary-button compact" type="button" onClick={onBack}>
          返回首頁
        </button>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="admin-stat">
      <span>{label}</span>
      <strong><AnimatedNumber value={value ?? '—'} digits={7} /></strong>
    </div>
  );
}

function UsersTable({ users, currentUser, loading, roleLoadingId, userDeleteLoadingId, onUpdateRole, onDeleteUser }) {
  const canManageRoles = currentUser?.role === 'owner';
  const canDeleteUsers = currentUser?.role === 'owner';

  return (
    <div className="admin-table users-table" role="table" aria-label="使用者資料" aria-colcount={6} aria-busy={loading} inert={loading || undefined}>
      <div className="admin-table-row header" role="row">
        <span role="columnheader">使用者名稱</span>
        <span role="columnheader">User ID</span>
        <span role="columnheader">Email</span>
        <span role="columnheader">Role</span>
        <span role="columnheader">Created</span>
        <span role="columnheader">操作</span>
      </div>
      {loading && users.length === 0 && <p className="admin-empty">載入管理資料中...</p>}
      {users.map((item) => {
        const isSelf = String(item._id || item.id) === String(currentUser?._id || currentUser?.id);

        return (
          <div className="admin-table-row" role="row" key={item._id}>
            <span role="cell" className="admin-user-cell" title={item.name}>
              <UserAvatar user={item} size="sm" />
              <span>{item.name}</span>
            </span>
            <span role="cell" title={item.userCode}>@{item.userCode}</span>
            <span role="cell" title={item.email}>{item.email}</span>
            <span role="cell"><RoleControl
              user={item}
              currentUser={currentUser}
              canManageRoles={canManageRoles}
              loading={roleLoadingId === item._id}
              onUpdateRole={onUpdateRole}
            /></span>
            <span role="cell">{formatDate(item.createdAt)}</span>
            <span role="cell" className="admin-row-actions user-actions">
              {isSelf ? (
                <span className="admin-row-note">目前帳號</span>
              ) : canDeleteUsers && item.role !== 'owner' ? (
                <button
                  className="icon-button danger compact-action"
                  type="button"
                  onClick={() => onDeleteUser(item)}
                  disabled={userDeleteLoadingId === item._id}
                  aria-label="刪除使用者"
                >
                  {userDeleteLoadingId === item._id ? <span className="button-spinner" /> : <Trash2 size={14} />}
                </button>
              ) : (
                <span className="admin-row-note">-</span>
              )}
            </span>
          </div>
        );
      })}
      {!loading && users.length === 0 && <p className="admin-empty">找不到符合條件的使用者</p>}
    </div>
  );
}

function RoleControl({ user, currentUser, canManageRoles, loading, onUpdateRole }) {
  const role = user.role || 'user';
  const isSelf = String(user._id || user.id) === String(currentUser?._id || currentUser?.id);
  if (isSelf) return <span className={`role-pill ${role} self`}>{formatRole(role)} · 目前帳號</span>;
  if (!canManageRoles || role === 'owner') return <span className={`role-pill ${role}`}>{formatRole(role)}</span>;
  return <div className="role-editor">
    <Select placeholder={`角色：${user.name || user.userCode}`} value={role}
      options={ROLE_OPTIONS.map(value => ({ value, label: formatRole(value) }))}
      busy={loading} size="sm" fullWidth={false}
      onChange={nextRole => { if (nextRole !== role && !loading) onUpdateRole(user._id, nextRole); }} />
    {loading && <span className="button-spinner" />}
  </div>;
}
function formatRole(role) {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'User';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function DiariesTable({ diaries, loading, deleteLoadingId, onView, onDelete }) {
  return (
    <div className="admin-table diaries-table" role="table" aria-label="日記資料" aria-colcount={6} aria-busy={loading} inert={loading || undefined}>
      <div className="admin-table-row header" role="row">
        <span role="columnheader">Title</span>
        <span role="columnheader">Author</span>
        <span role="columnheader">Mood</span>
        <span role="columnheader">Visibility</span>
        <span role="columnheader">Created</span>
        <span role="columnheader">操作</span>
      </div>
      {loading && diaries.length === 0 && <p className="admin-empty">載入管理資料中...</p>}
      {diaries.map((diary) => (
        <div className="admin-table-row admin-diary-row" role="row" key={diary._id}>
          <span role="cell" title={diary.title}>{diary.title}</span>
          <span role="cell" title={diary.author?.userCode || ''}>@{diary.author?.userCode || 'unknown'}</span>
          <span role="cell">{diary.mood?.type || '-'}</span>
          <span role="cell">{diary.visibility}</span>
          <span role="cell">{formatDate(diary.createdAt)}</span>
          <span role="cell" className="admin-row-actions">
            <button className="chip-button compact-action" type="button" onClick={() => onView(diary)}>
              <Eye size={14} />
              查看
            </button>
            <button
              className="icon-button danger compact-action"
              type="button"
              onClick={() => onDelete(diary)}
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
      <span>第 <AnimatedNumber value={page} digits={2} /> / {totalPages} 頁 · 共 <AnimatedNumber value={total} digits={5} /> 筆</span>
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

function DeleteUserModal({ user, loading, error, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState('');
  const canConfirm = confirmText === 'DELETE';

  return (
      <Modal as="article" backdropClassName="admin-modal-backdrop" label="刪除使用者" onClose={onClose} busy={loading}
        error={error}
        className="admin-detail-modal admin-danger-modal glass"
      >
        <header>
          <div>
            <p className="eyebrow">Delete User</p>
            <h2>確定要刪除此使用者嗎？</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="關閉" disabled={loading}>
            <X size={18} />
          </button>
        </header>

        <p className="admin-danger-copy">
          此操作會刪除該使用者、他的所有日記、好友關係與相關資料，且無法復原。
        </p>

        <div className="admin-user-delete-summary">
          <span>Name</span>
          <strong>{user.name}</strong>
          <span>User ID</span>
          <strong>@{user.userCode}</strong>
          <span>Email</span>
          <strong>{user.email}</strong>
          <span>Role</span>
          <strong>{formatRole(user.role)}</strong>
        </div>

        <label className="admin-confirm-field">
          <span>輸入 DELETE 以確認刪除</span>
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="DELETE"
        disabled={loading}
          />
        </label>

        <footer>
          <button className="ghost-button" type="button" onClick={onClose} disabled={loading}>
            取消
          </button>
          <button className="danger-button compact-danger" type="button" onClick={onConfirm} disabled={!canConfirm || loading}>
            {loading ? <span className="button-spinner" /> : <Trash2 size={15} />}
            確認刪除
          </button>
        </footer>
      </Modal>
  );
}

function DiaryDetailModal({ diary, deleteLoading, error, onClose, onDelete }) {
  const [lng, lat] = diary.location?.coordinates || [];
  const placeName = normalizeTaiwanPlaceName(diary.location?.placeName || (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '未記錄地點'));

  return (
      <Modal as="article" backdropClassName="admin-modal-backdrop" label="日記詳情" onClose={onClose} busy={deleteLoading}
        error={error}
        className="admin-detail-modal glass"
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
          <span>編輯 {diary.editCount || 0} 次</span>
          {diary.lastEditedAt && <span>最後編輯 {formatDate(diary.lastEditedAt)}</span>}
        </div>
        <p className="admin-detail-content">{diary.content || diary.text || '沒有內容'}</p>
        <footer>
          <button className="danger-button compact-danger" type="button" onClick={onDelete} disabled={deleteLoading}>
            {deleteLoading ? <span className="button-spinner" /> : <Trash2 size={15} />}
            刪除這篇日記
          </button>
        </footer>
      </Modal>
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
