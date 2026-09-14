import { getImageUrl } from '../api/client.js';
import { useState } from 'react';

export function getInitial(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return 'A';
  return trimmed.slice(0, 1).toUpperCase();
}

export default function UserAvatar({ user, src = '', name = '', size = 'md', className = '' }) {
  const displayName = name || user?.name || '';
  const avatarSrc = src || user?.avatar || user?.avatarUrl || '';
  const resolvedSrc = getImageUrl(avatarSrc);
  const [result, setResult] = useState({});
  const state = result.src === resolvedSrc ? result.state : 'loading';

  return (
    <span className={`user-avatar ${size ? `user-avatar-${size}` : ''} ${className}`.trim()} data-ready={Boolean(resolvedSrc && state === 'ready')} aria-hidden="true">
      <span>{getInitial(displayName)}</span>
      {resolvedSrc && state !== 'error' && <img key={resolvedSrc} src={resolvedSrc} alt="" loading="lazy" decoding="async"
        data-ready={state === 'ready'} onLoad={() => setResult({ src: resolvedSrc, state: 'ready' })}
        onError={() => setResult({ src: resolvedSrc, state: 'error' })} />}
    </span>
  );
}
