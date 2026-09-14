import { ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { getImageUrl } from '../api/client.js';

export default function DiaryImage({ src, alt, className = '' }) {
  const url = getImageUrl(src);
  const [result, setResult] = useState({});
  const state = result.url === url ? result.state : 'loading';
  return <div className={`${className} diary-image-frame`} data-state={state} aria-busy={state === 'loading'}>
    {state === 'error' ? (
      <div className="diary-image-fallback" role="img" aria-label="圖片無法載入">
        <ImageIcon size={20} />
        <span>圖片無法載入</span>
      </div>
    ) : <img key={url} src={url} alt={alt} loading="lazy" decoding="async"
      onLoad={() => setResult({ url, state: 'ready' })}
      onError={() => setResult({ url, state: 'error' })} />}
  </div>;
}
