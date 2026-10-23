import { AnimatePresence } from 'framer-motion';
import { Bell, Check, ChevronRight, Copy, MapPin, RefreshCw, Search, Undo2, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { createPeopleReveal } from '../lib/motion/animeMotion.js';
import FriendCard from './social/FriendCard.jsx';
import FriendProfile from './social/FriendProfile.jsx';
import AnimatedNumber from './ui/AnimatedNumber.jsx';
import ButtonFeedback from './ui/ButtonFeedback.jsx';
import ContentTransition from './ui/ContentTransition.jsx';
import Modal from './ui/Modal.jsx';
import ToastViewport from './ToastViewport.jsx';
import UserAvatar from './UserAvatar.jsx';
import './social/socialHub.css';

const tabs = [['friends', '我的好友', Users], ['invites', '好友邀請', Bell], ['discover', '探索使用者', Search]];
const same = (a, b) => a != null && b != null && String(a) === String(b);
const statusLabels = { friend: '好友', sent_request: '等待回覆', received_request: '邀請你成為好友', none: '尚未成為好友', self: '你自己' };

export default function FriendsPage(props) {
  const { user, friends = [], friendRequests = [], sentFriendRequests = [], socialRefreshToken = 0, socialState = { status: 'ready' }, onRefresh, onOpenMap, onOpenDiary } = props;
  const [tab, setTab] = useState('friends'), [inviteTab, setInviteTab] = useState('received');
  const [filter, setFilter] = useState(''), [sort, setSort] = useState('name'), [limit, setLimit] = useState(24);
  const [query, setQuery] = useState(''), [results, setResults] = useState([]), [searchStatus, setSearchStatus] = useState('idle'), [searchError, setSearchError] = useState('');
  const [recommendations, setRecommendations] = useState([]), [recommendationStatus, setRecommendationStatus] = useState('idle');
  const [attempt, setAttempt] = useState(0), [selected, setSelected] = useState(null), [removing, setRemoving] = useState(null);
  const [pending, setPending] = useState({}), [overrides, setOverrides] = useState({}), [toast, setToast] = useState(null);
  const locks = useRef(new Set()), callbacks = useRef(props), mounted = useRef(false), searchInput = useRef(null);
  const discovery = useRef(null);
  useEffect(() => { if (props.notificationEntry) { setTab('invites'); setInviteTab('received'); } }, [props.notificationEntry]);
  callbacks.current = props;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { setLimit(24); }, [filter, sort]);
  useEffect(() => { setOverrides({}); }, [socialRefreshToken]);
  useLayoutEffect(() => {
    if (tab === 'discover' && searchStatus === 'ready') return createPeopleReveal(discovery.current);
  }, [tab, searchStatus, results]);
  useEffect(() => {
    if (tab !== 'discover') return;
    const controller = new AbortController();
    setRecommendationStatus('loading');
    api.getFriendRecommendations(8, controller.signal).then(payload => {
      if (!controller.signal.aborted) { setRecommendations(Array.isArray(payload.data) ? payload.data : []); setRecommendationStatus('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setRecommendationStatus('error'); });
    return () => controller.abort();
  }, [tab, socialRefreshToken, attempt]);
  useEffect(() => {
    const text = query.normalize('NFKC').trim().replace(/^@/, '');
    if (tab !== 'discover' || text.length < 2) { setResults([]); setSearchStatus('idle'); setSearchError(''); return; }
    const controller = new AbortController();
    setSearchStatus('loading'); setSearchError(''); setResults([]);
    const timer = setTimeout(() => api.searchPeople(text, controller.signal).then(payload => {
      if (!controller.signal.aborted) { setResults(Array.isArray(payload.data) ? payload.data : []); setSearchStatus('ready'); }
    }).catch(error => { if (!controller.signal.aborted) { setSearchError(error.message); setSearchStatus('error'); } }), 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, tab, socialRefreshToken, attempt]);

  const filtered = useMemo(() => {
    const text = filter.trim().toLocaleLowerCase();
    return friends.filter(person => `${person.name} ${person.userCode}`.toLocaleLowerCase().includes(text))
      .sort((a, b) => sort === 'joined' ? new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || String(a._id).localeCompare(String(b._id))
        : (a.name || '').localeCompare(b.name || '', 'zh-Hant') || String(a._id).localeCompare(String(b._id)));
  }, [friends, filter, sort]);
  function stateFor(person) {
    if (same(person._id, user?._id || user?.id)) return { friendshipStatus: 'self' };
    if (overrides[person._id]) return overrides[person._id];
    if (friends.some(friend => same(friend._id, person._id))) return { friendshipStatus: 'friend' };
    const received = friendRequests.find(item => same(item.from?._id, person._id));
    if (received) return { friendshipStatus: 'received_request', requestId: received.requestId };
    const sent = sentFriendRequests.find(item => same(item.to?._id, person._id));
    if (sent) return { friendshipStatus: 'sent_request', requestId: sent.requestId };
    return { friendshipStatus: person.friendshipStatus || 'none', requestId: person.requestId };
  }
  const notify = (message, type = 'success') => setToast({ id: crypto.randomUUID(), message, type });
  async function action(kind, person, requestId) {
    const id = person._id;
    if (locks.current.has(id)) return;
    locks.current.add(id); setPending(current => ({ ...current, [id]: kind }));
    try {
      const actions = { send: 'onSendFriendRequest', cancel: 'onCancelFriendRequest', accept: 'onAcceptFriendRequest', reject: 'onRejectFriendRequest', remove: 'onDeleteFriend' };
      const callback = callbacks.current[actions[kind]];
      if (!callback) throw new Error('操作暫時無法使用，請稍後再試。');
      const result = await callback(['send', 'remove'].includes(kind) ? id : requestId);
      if (!mounted.current) return;
      setOverrides(current => ({ ...current, [id]: result?.data || { friendshipStatus: kind === 'accept' ? 'friend' : kind === 'send' ? 'sent_request' : 'none' } }));
      if (kind === 'remove') { setRemoving(null); if (same(selected?._id, id)) setSelected(null); }
      notify(result?.message || ({ send: '好友邀請已送出', cancel: '好友邀請已撤回', accept: '已成為好友', reject: '已拒絕邀請', remove: '已移除好友' })[kind]);
    } catch (error) {
      if (!mounted.current) return;
      notify(error.message || '操作未完成，請再試一次。', 'error');
      if ([404, 409].includes(error.status)) { await callbacks.current.onRefresh?.(); setAttempt(value => value + 1); }
    } finally {
      locks.current.delete(id);
      if (mounted.current) setPending(current => { const next = { ...current }; delete next[id]; return next; });
    }
  }
  async function copy(code) {
    try { await navigator.clipboard.writeText(code); notify('已複製使用者 ID'); }
    catch { notify('無法複製，請選取使用者 ID 後手動複製。', 'error'); }
  }
  function controls(person) {
    const state = stateFor(person), busy = Boolean(pending[person._id]);
    const button = (kind, label, Icon, primary = false) => <button className={`hub-button ${primary ? 'primary' : ''} motion-soft-press`} type="button" disabled={busy || kind !== 'send' && !state.requestId} onClick={() => action(kind, person, state.requestId)}><ButtonFeedback busy={pending[person._id] === kind} label={label} busyLabel={label} icon={<Icon size={16} />} /></button>;
    if (state.friendshipStatus === 'friend' || state.friendshipStatus === 'self') return <span className="hub-relation"><Check size={15} />{statusLabels[state.friendshipStatus]}</span>;
    if (state.friendshipStatus === 'sent_request') return button('cancel', '撤回邀請', Undo2);
    if (state.friendshipStatus === 'received_request') return <>{button('accept', '接受', Check, true)}{button('reject', '拒絕', X)}</>;
    return button('send', '加入好友', UserPlus, true);
  }
  function discover() { setTab('discover'); requestAnimationFrame(() => searchInput.current?.focus()); }
  function searchField(value, change, placeholder, label) {
    return <div className="hub-search"><Search size={18} aria-hidden="true" /><input ref={label === '搜尋使用者' ? searchInput : undefined} aria-label={label} placeholder={placeholder} value={value} maxLength={40} onChange={event => change(event.target.value)} autoComplete="off" />{value && <button type="button" aria-label={label === '搜尋使用者' ? '清除使用者搜尋' : '清除好友篩選'} onClick={() => change('')}><X size={17} /></button>}</div>;
  }

  return <main className="friends-hub hub-page">
    <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
    <header className="hub-header"><div><span className="hub-eyebrow">Adrift Social Hub</span><h1>好友</h1><p>與朋友一起，留下屬於你們的城市記憶。</p></div><div className="hub-header-actions"><button className="hub-button" onClick={discover}><Search size={17} />尋找好友</button><button className="hub-icon-button" onClick={() => setTab('invites')} aria-label="查看好友邀請"><Bell size={19} />{friendRequests.length > 0 && <span className="hub-notification-dot" />}</button><button className="hub-icon-button" onClick={() => onRefresh?.()} disabled={socialState.status === 'loading'} aria-label="重新整理好友"><RefreshCw size={18} /></button></div></header>
    <dl className="hub-stats" aria-label="好友狀態摘要">{[[friends.length, '位好友'], [friendRequests.length, '待處理邀請'], [sentFriendRequests.length, '已送出邀請']].map(([value, label]) => <div key={label}><dd><AnimatedNumber value={value} digits={4} /></dd><dt>{label}</dt></div>)}</dl>
    <button className="hub-mobile-code" aria-label="複製我的使用者 ID" onClick={() => copy(user?.userCode)}><Copy size={16} />複製我的 ID<span>@{user?.userCode}</span></button>
    <nav className="hub-tabs" role="tablist" aria-label="好友功能" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const index = tabs.findIndex(item => item[0] === tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
      setTab(tabs[next][0]); event.currentTarget.querySelectorAll('[role="tab"]')[next].focus();
    }}>
      <span className="hub-tab-indicator" style={{ transform: `translateX(${tabs.findIndex(item => item[0] === tab) * 100}%)` }} aria-hidden="true" />
      {tabs.map(([id, label, Icon]) => <button key={id} role="tab" id={`hub-tab-${id}`} aria-controls="hub-content" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}><Icon size={17} /><span>{label}</span></button>)}
    </nav>
    <div className="hub-layout">
      <section className="hub-main" id="hub-content" role="tabpanel" aria-labelledby={`hub-tab-${tab}`}>
        {socialState.error && <div className="hub-error" role="alert"><p>{socialState.error}</p><button onClick={() => onRefresh?.()}><RefreshCw size={15} />重試更新</button></div>}
        {tab === 'friends' && <div className="hub-tab-content motion-fade-in">
          <header className="hub-section-heading"><h2>你的好友</h2><span>{filtered.length} 位</span></header>
          <div className="hub-directory-tools">{searchField(filter, setFilter, '搜尋好友名稱或 ID', '篩選我的好友')}<label className="hub-sort">排序<select aria-label="好友排序" value={sort} onChange={event => setSort(event.target.value)}><option value="name">名稱</option><option value="joined">最近加入 Adrift</option></select></label></div>
          {socialState.status === 'loading' && !friends.length ? <Loading text="正在讀取好友…" /> : filtered.length ? <>
            <div className="hub-directory" aria-label="我的好友列表"><AnimatePresence initial={false}>{filtered.slice(0, limit).map(person => <ContentTransition collapse key={person._id}><FriendCard person={person} onPreview={setSelected} manage onCopy={copy} onRemove={setRemoving}><span className="hub-relation"><Check size={15} />好友</span></FriendCard></ContentTransition>)}</AnimatePresence></div>
            {limit < filtered.length && <button className="hub-load-more hub-button" onClick={() => setLimit(value => value + 24)}>載入更多好友<ChevronRight size={16} /></button>}
          </> : <Empty icon={Users} title={filter ? '找不到符合條件的好友' : '你的城市故事，還有更多人可以一起寫下。'} text={filter ? '試試其他名稱或使用者 ID。' : '找到認識的朋友，讓彼此的足跡在城市裡慢慢交會。'} action={filter ? () => setFilter('') : discover} label={filter ? '清除篩選' : '尋找好友'} />}
        </div>}
        {tab === 'invites' && <div className="hub-tab-content motion-fade-in">
          <header className="hub-section-heading"><h2>好友邀請</h2><span>由你決定建立哪些連結</span></header>
          <div className="hub-invite-switch">{[['received', '收到的邀請', friendRequests.length], ['sent', '已送出邀請', sentFriendRequests.length]].map(([id, label, count]) => <button key={id} aria-pressed={inviteTab === id} onClick={() => setInviteTab(id)}>{label}<span>{count}</span></button>)}</div>
          <AnimatePresence mode="wait" initial={false}><ContentTransition key={inviteTab} className="hub-invite-list">
            {(inviteTab === 'received' ? friendRequests : sentFriendRequests).length ? (inviteTab === 'received' ? friendRequests : sentFriendRequests).map(invite => {
              const person = invite.from || invite.to; if (!person) return null;
              return <FriendCard key={invite.requestId} person={person} onPreview={setSelected}>{controls({ ...person, friendshipStatus: inviteTab === 'received' ? 'received_request' : 'sent_request', requestId: invite.requestId })}</FriendCard>;
            }) : <Empty icon={Bell} title={inviteTab === 'received' ? '目前沒有新的好友邀請。' : '目前沒有等待回覆的邀請。'} text={inviteTab === 'received' ? '新的連結，會在這裡與你相遇。' : '找到認識的人，從一個邀請開始。'} action={discover} label="尋找好友" />}
          </ContentTransition></AnimatePresence>
        </div>}
        {tab === 'discover' && <div className="hub-tab-content motion-fade-in" ref={discovery}>
          <header className="hub-section-heading"><h2>找到城市故事裡的人</h2></header>
          {searchField(query, setQuery, '輸入名稱或 @使用者 ID', '搜尋使用者')}
          <p className="hub-helper">輸入至少 2 個字；使用者 ID 可精確比對，名稱支援部分搜尋。</p>
          {searchStatus === 'loading' && <Loading text="正在尋找使用者…" />}
          {searchStatus === 'error' && <div className="hub-error" role="alert"><p>{searchError}</p><button onClick={() => setAttempt(value => value + 1)}>重新搜尋</button></div>}
          {searchStatus === 'ready' && (results.length ? <div className="hub-results" aria-label="使用者搜尋結果">{results.map(person => <FriendCard key={person._id} person={person} onPreview={setSelected}>{controls(person)}</FriendCard>)}</div> : <Empty icon={Search} title="找不到符合條件的使用者。" text="檢查名稱或 ID，或試試其他關鍵字。" action={() => setQuery('')} label="清除搜尋" />)}
          <section className="hub-recommendations"><header className="hub-section-heading"><h2>可能認識的人</h2><span>根據共同好友</span></header>
            {recommendationStatus === 'loading' ? <Loading text="正在整理好友連結…" /> : recommendationStatus === 'error' ? <div className="hub-error"><p>推薦暫時無法載入，仍可使用上方搜尋。</p><button onClick={() => setAttempt(value => value + 1)}>重試推薦</button></div>
              : recommendations.length ? recommendations.map(person => <FriendCard key={person._id} person={person} onPreview={setSelected}>{controls(person)}</FriendCard>) : <p className="hub-helper">目前還沒有足夠的共同好友連結。你可以先搜尋認識的人。</p>}
          </section>
        </div>}
      </section>
      <aside className="hub-sidebar"><section><UserAvatar user={user} /><h2>從你的 ID 開始連結</h2><p>把這組 ID 分享給認識的朋友。</p><div className="hub-own-code"><span>@{user?.userCode}</span><button className="hub-icon-button" aria-label="複製我的使用者 ID" onClick={() => copy(user?.userCode)}><Copy size={17} /></button></div></section><section><MapPin size={22} /><h2>不只是一份好友名單</h2><p>查看好友分享的日記，再回到地圖，重新遇見彼此留下的城市記憶。</p><button className="hub-map-link" onClick={onOpenMap}>回到記憶地圖<ChevronRight size={16} /></button></section><p className="hub-privacy">私人日記不會出現在好友預覽或共同地點。移除好友後，好友限定內容會重新驗證權限。</p></aside>
    </div>
    <AnimatePresence>{selected && <FriendProfile key={selected._id} person={selected} refreshToken={socialRefreshToken} onClose={() => setSelected(null)} renderActions={controls} onRemove={person => { setSelected(null); setRemoving(person); }} onOpenDiary={onOpenDiary} />}</AnimatePresence>
    <AnimatePresence>{removing && <Modal label="移除好友" className="hub-confirm-dialog" busy={Boolean(pending[removing._id])} onClose={() => setRemoving(null)}>
      <h2>移除 {removing.name}？</h2><p>你們將無法再查看彼此的好友限定記憶。公開日記不受影響。</p><footer><button className="hub-button" disabled={Boolean(pending[removing._id])} onClick={() => setRemoving(null)}>取消</button><button className="hub-button danger" disabled={Boolean(pending[removing._id])} onClick={() => action('remove', removing)}><ButtonFeedback busy={pending[removing._id] === 'remove'} label="移除好友" busyLabel="正在移除" icon={<X size={16} />} /></button></footer>
    </Modal>}</AnimatePresence>
  </main>;
}
function Loading({ text }) { return <div className="hub-loading" role="status"><span className="button-spinner" />{text}</div>; }
function Empty({ icon: Icon, title, text, action, label }) { return <div className="hub-empty"><Icon size={28} aria-hidden="true" /><h3>{title}</h3><p>{text}</p>{action && <button className="hub-button" onClick={action}>{label}<ChevronRight size={16} /></button>}</div>; }
