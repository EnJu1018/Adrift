import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { BookOpen, Copy, MoreHorizontal, Trash2, UserRound } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dropdownMotion } from '../../constants/animations.js';
import UserAvatar from '../UserAvatar.jsx';

function FriendMenu({ menuRef, ...props }) {
  const present = useIsPresent();
  return <motion.div {...props} ref={menuRef} inert={!present ? true : undefined} />;
}

export default function FriendCard({ person, onPreview, children, manage, onCopy, onRemove }) {
  const [open, setOpen] = useState(false), [above, setAbove] = useState(false);
  const root = useRef(null), trigger = useRef(null), menu = useRef(null);
  useLayoutEffect(() => {
    if (!open) return;
    setAbove(menu.current.getBoundingClientRect().bottom > innerHeight - 16);
    menu.current.querySelector('button')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    const scroll = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', escape);
    document.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', escape); document.removeEventListener('scroll', scroll, true);
    };
  }, [open]);
  const choose = action => { trigger.current?.focus(); setOpen(false); action(); };
  return <article className="hub-person-row" data-person-reveal ref={root}>
    <button type="button" className="hub-person-identity" onClick={() => onPreview(person)} aria-label={`查看 ${person.name} 的個人資料`}>
      <UserAvatar user={person} />
      <span><strong>{person.name}</strong><small>@{person.userCode}</small>{person.reasons?.[0] && <span className="hub-person-reason">{person.reasons[0]}</span>}</span>
    </button>
    <div className="hub-person-actions">{children}
      {manage && <div className="hub-more">
        <button type="button" className="hub-icon-button motion-soft-press" ref={trigger} aria-label={`管理好友 ${person.name}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}><MoreHorizontal size={20} /></button>
        <AnimatePresence>{open && <FriendMenu menuRef={menu} role="menu" aria-label={`${person.name} 的好友選單`} className={`hub-more-menu ${above ? 'above' : ''}`} {...dropdownMotion(above)}
          onKeyDown={event => {
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const items = [...event.currentTarget.querySelectorAll('button')], index = items.indexOf(document.activeElement);
            items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
          }}>
          <button role="menuitem" onClick={() => choose(() => onPreview(person))}><UserRound size={16} />個人資料</button>
          <button role="menuitem" onClick={() => choose(() => onPreview(person))}><BookOpen size={16} />查看可見記憶</button>
          <button role="menuitem" onClick={() => choose(() => onCopy(person.userCode))}><Copy size={16} />複製使用者 ID</button>
          <button role="menuitem" className="hub-danger" onClick={() => choose(() => onRemove(person))}><Trash2 size={16} />移除好友</button>
        </FriendMenu>}</AnimatePresence>
      </div>}
    </div>
  </article>;
}
