import { BookOpen, ChevronRight, MapPin, RefreshCw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { MOOD_LABELS } from '../../constants/app.js';
import Modal from '../ui/Modal.jsx';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import UserAvatar from '../UserAvatar.jsx';
import DiaryImage from '../DiaryImage.jsx';

const date = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeZone: 'Asia/Taipei' }).format(new Date(value)) : '';
export default function FriendProfile({ person, refreshToken, renderActions, onClose, onRemove, onOpenDiary }) {
  const [profile, setProfile] = useState(null), [memories, setMemories] = useState([]), [cursor, setCursor] = useState(null);
  const [tab, setTab] = useState('memories'), [places, setPlaces] = useState(null);
  const [status, setStatus] = useState('loading'), [error, setError] = useState(''), [retry, setRetry] = useState(0), [opening, setOpening] = useState(false);
  const request = useRef(null), busy = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); request.current = controller; busy.current = false;
    setStatus('loading'); setError(''); setOpening(false); setProfile(null); setMemories([]); setPlaces(null); setCursor(null); setTab('memories');
    Promise.all([api.getFriendProfile(person._id, controller.signal), api.getFriendMemories(person._id, null, controller.signal)])
      .then(([info, page]) => { if (!controller.signal.aborted) { setProfile(info.data); setMemories(page.data?.diaries || []); setCursor(page.data?.nextCursor || null); setStatus('ready'); } })
      .catch(error => { if (!controller.signal.aborted) { setError(error.message); setStatus('error'); } });
    return () => controller.abort();
  }, [person._id, refreshToken, retry]);
  useEffect(() => {
    if (tab !== 'places' || places || !profile?.canViewSharedPlaces) return;
    const controller = new AbortController(); setError('');
    api.getSharedPlaces(person._id, controller.signal).then(payload => { if (!controller.signal.aborted) setPlaces(payload.data); })
      .catch(error => { if (!controller.signal.aborted) { setError(error.message); setPlaces({ places: [] }); } });
    return () => controller.abort();
  }, [tab, profile?.canViewSharedPlaces, person._id, places]);
  async function loadMore() {
    if (busy.current || !cursor) return;
    busy.current = true; setOpening(true); setError('');
    const controller = request.current;
    try {
      const page = await api.getFriendMemories(person._id, cursor, controller.signal);
      if (!controller.signal.aborted) { setMemories(current => [...current, ...(page.data?.diaries || []).filter(diary => !current.some(item => item._id === diary._id))]); setCursor(page.data?.nextCursor || null); }
    } catch (error) { if (!controller.signal.aborted) setError(error.message); }
    finally { if (request.current === controller) { busy.current = false; if (!controller.signal.aborted) setOpening(false); } }
  }
  async function open(id) {
    if (busy.current) return;
    busy.current = true; setOpening(true); setError('');
    const controller = request.current;
    try { await onOpenDiary?.(id, controller.signal); }
    catch (error) { if (!controller.signal.aborted) setError(error.message); }
    finally { if (request.current === controller) { busy.current = false; if (!controller.signal.aborted) setOpening(false); } }
  }
  const display = profile || person;
  return <Modal className="hub-profile-sheet" backdropClassName="hub-profile-backdrop" label={`${person.name} 的個人資料`} onClose={onClose}>
    <header className="hub-profile-top"><span>個人資料</span><button className="hub-icon-button" aria-label="關閉個人資料" onClick={onClose}><X size={20} /></button></header>
    <div className="hub-profile-scroll">
      <div className="hub-profile-identity"><UserAvatar user={display} size="lg" /><h2>{display.name}</h2><p>@{display.userCode}</p></div>
      {status === 'ready' && <>
        <div className="hub-profile-actions">{renderActions(display)}{display.friendshipStatus === 'friend' && <button className="hub-icon-button" onClick={() => onRemove(display)} aria-label={`移除好友 ${display.name}`}><Trash2 size={17} /></button>}</div>
        <dl className="hub-profile-stats"><div><dt>公開記憶</dt><dd><AnimatedNumber value={profile.diaryStats?.publicCount || 0} digits={4} /></dd></div><div><dt>向你分享的好友記憶</dt><dd><AnimatedNumber value={profile.diaryStats?.friendsCount || 0} digits={4} /></dd></div></dl>
        <nav className="hub-profile-tabs" aria-label="個人記憶分類">
          <button aria-pressed={tab === 'memories'} onClick={() => setTab('memories')}><BookOpen size={16} />可見記憶</button>
          {profile.canViewSharedPlaces && <button aria-pressed={tab === 'places'} onClick={() => setTab('places')}><MapPin size={16} />共同地點</button>}
        </nav>
      </>}
      {status === 'loading' && <div className="hub-loading" role="status"><span className="button-spinner" />正在讀取可見記憶…</div>}
      {error && <div className="hub-error" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}><RefreshCw size={15} />重新載入</button></div>}
      {status === 'ready' && tab === 'memories' && <section className="hub-profile-memories" aria-label="可見的日記">
        {memories.length ? memories.map(diary => <button key={diary._id} className="hub-memory" disabled={opening} onClick={() => open(diary._id)}>
          {diary.imageUrl && <DiaryImage src={diary.imageUrl} alt={diary.title} />}
          <span><small>{date(diary.createdAt)} · {MOOD_LABELS[diary.mood?.type] || '生活記錄'}</small><strong>{diary.title}</strong><span>{diary.text}</span><small><MapPin size={13} />{diary.location?.placeName || '未命名地點'}</small></span><ChevronRight size={16} />
        </button>) : <div className="hub-empty"><BookOpen size={24} /><h3>還沒有可見的記憶</h3><p>這裡只顯示對你公開或向好友分享的日記。</p></div>}
        {cursor && <button className="hub-button" onClick={loadMore} disabled={opening}>{opening ? <span className="button-spinner" /> : null}載入更多記憶</button>}
      </section>}
      {status === 'ready' && tab === 'places' && <section className="hub-shared-places" aria-label="你們都留下過記憶的地方">
        <h3>你們都留下過記憶的地方</h3>
        <p>{places?.description || '只比對彼此可見的已分享日記，不推測共同活動。'}</p>
        {!places ? <div className="hub-loading" role="status"><span className="button-spinner" />正在比對已分享地點…</div>
          : places.places?.length ? places.places.map(place => <article key={place.mine._id}><h4><MapPin size={17} />{place.place}</h4><button disabled={opening} onClick={() => open(place.mine._id)}><span>你的記憶</span>{place.mine.title}<ChevronRight size={15} /></button>{place.theirs.map(diary => <button disabled={opening} key={diary._id} onClick={() => open(diary._id)}><span>{person.name} 的記憶</span>{diary.title}<ChevronRight size={15} /></button>)}</article>)
          : <div className="hub-empty"><MapPin size={24} /><h3>還沒有找到重疊的地點</h3><p>各自的城市故事，也值得慢慢探索。</p></div>}
      </section>}
    </div>
  </Modal>;
}
