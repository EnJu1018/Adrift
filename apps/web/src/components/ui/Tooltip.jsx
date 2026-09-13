import { cloneElement, useId, useState } from 'react';

export default function Tooltip({ label, children }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <span className="ui-tooltip-wrap" data-visible={visible}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setVisible(true); }}
    onPointerLeave={() => setVisible(false)} onFocus={() => setVisible(true)} onBlur={() => setVisible(false)}
    onKeyDown={event => {
      if (visible && event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); setVisible(false);
      }
    }}>
    {cloneElement(children, { 'aria-describedby': [children.props['aria-describedby'], id].filter(Boolean).join(' ') })}
    <span id={id} className="ui-tooltip" role="tooltip">{label}</span>
  </span>;
}
