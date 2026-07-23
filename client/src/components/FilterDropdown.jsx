import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// A boxed "All Categories ⌄" style dropdown with a floating checklist menu —
// used on the Lessons page filters.
export default function FilterDropdown({ icon, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="filter-box" ref={ref}>
      <button type="button" className="filter-box-btn" onClick={() => setOpen(o => !o)}>
        <span className="filter-box-icon">{icon}</span>
        <span>{current.label}</span>
        <span className={'filter-box-chevron' + (open ? ' open' : '')}><ChevronDown size={14} strokeWidth={2} /></span>
      </button>
      {open && (
        <div className="filter-box-menu">
          {options.map(o => (
            <div
              key={o.value}
              className={'filter-box-item' + (o.value === value ? ' selected' : '')}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.value === value && <span className="filter-box-check"><Check size={13} strokeWidth={2.5} /></span>}
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
