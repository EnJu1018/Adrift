import { ArrowUpRight, MapPin, Plus, RefreshCw } from 'lucide-react';
import { Fragment } from 'react';
import { moodLabel } from './insightData.js';

const memoryDate = new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeZone: 'Asia/Taipei' });

function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part.startsWith('`') && part.endsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part);
}
function MemoryAnswer({ text }) {
  const blocks = [];
  for (const line of String(text || '').split('\n')) {
    const list = line.match(/^\s*(?:([-*])|\d+[.)])\s+(.+)/), heading = line.match(/^#{1,3}\s+(.+)/);
    const kind = list ? list[1] ? 'ul' : 'ol' : heading ? 'heading' : line.trim() ? 'paragraph' : 'space';
    const last = blocks.at(-1);
    if (kind === 'space') { blocks.push({ kind, lines: [] }); continue; }
    const value = list?.[2] || heading?.[1] || line;
    if (last?.kind === kind && kind !== 'heading') last.lines.push(value);
    else blocks.push({ kind, lines: [value] });
  }
  return <div className="memory-chat-answer">{blocks.map((block, index) => block.kind === 'space' ? null
    : ['ul', 'ol'].includes(block.kind) ? <block.kind key={index}>{block.lines.map((line, index) => <li key={index}>{inline(line)}</li>)}</block.kind>
      : block.kind === 'heading' ? <h3 key={index}>{inline(block.lines[0])}</h3>
        : <p key={index}>{block.lines.map((line, index) => <Fragment key={index}>{index > 0 && <br />}{inline(line)}</Fragment>)}</p>)}</div>;
}

export default function ChatMessage({ item, busy, opening, unavailable, onRetry, onOpenDiary, onNewDiary }) {
  return <article className={`memory-chat-message ${item.role} motion-fade-in`}>
    <span className="sr-only">{item.role === 'user' ? '你' : 'Adrift'}</span>
    {item.status === 'pending' ? <p className="memory-chat-thinking"><span className="button-spinner" aria-hidden="true" />正在尋找你的記憶…</p>
      : item.status === 'error' ? <div className="memory-chat-error"><p role="alert">{item.error}</p><button type="button" className="intel-text-button motion-soft-press" onClick={() => onRetry(item.question, item.id)} disabled={busy}><RefreshCw size={15} />重試</button></div>
        : item.role === 'user' ? <p className="memory-chat-user-text">{item.content}</p> : <MemoryAnswer text={item.content} />}
    {item.relatedDiaries?.length > 0 && <section className="memory-chat-citations" aria-label="相關記憶">
      <h3>相關記憶</h3>
      {item.relatedDiaries.map(diary => unavailable.has(diary.id) ? <p className="memory-chat-unavailable" key={diary.id}>這則記憶已移除或目前無法查看。</p> : <button type="button" key={diary.id} onClick={() => onOpenDiary(diary.id)} disabled={Boolean(opening)} className="memory-chat-citation">
        <span><strong>{diary.title || '未命名日記'}</strong><small>{memoryDate.format(new Date(diary.createdAt))} · {moodLabel(diary.mood?.type)}</small><small><MapPin size={12} />{diary.place || '未命名地點'}</small></span>
        {opening === diary.id ? <span className="button-spinner" /> : <ArrowUpRight size={16} />}
      </button>)}
    </section>}
    {item.resultStatus === 'empty' && <button type="button" className="intel-text-button" onClick={onNewDiary}><Plus size={15} />新增第一篇日記</button>}
  </article>;
}
