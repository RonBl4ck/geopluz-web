'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function sedSortKey(value) {
  const text = String(value || '');
  const match = text.match(/\d+/);
  return { number: match ? Number(match[0]) : Number.MAX_SAFE_INTEGER, text };
}

export function sortSedIds(ids) {
  return [...ids].sort((a, b) => {
    const left = sedSortKey(a);
    const right = sedSortKey(b);
    return left.number - right.number || left.text.localeCompare(right.text, 'es', { numeric: true });
  });
}

export default function SearchableSedSelect({ seds = {}, value = '', onChange, disabled = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const orderedIds = useMemo(() => sortSedIds(Object.keys(seds)), [seds]);
  const selectedLabel = value ? (seds[value]?.name || `SED ${value}`) : '';
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const filteredIds = orderedIds.filter(id => `${id} ${seds[id]?.name || ''}`.toLocaleLowerCase('es').includes(normalizedQuery));

  useEffect(() => {
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return <div className="sed-search" ref={rootRef}>
    <div className="sed-search-input-wrap">
      <i className="fa-solid fa-magnifying-glass"></i>
      <input
        className="input-control"
        value={open ? query : selectedLabel}
        disabled={disabled}
        placeholder={disabled ? 'Carga registros primero' : 'Buscar por código o nombre...'}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        aria-label="Buscar SED"
      />
      {value && <button className="sed-search-clear" onClick={() => { onChange?.(''); setQuery(''); setOpen(false); }} title="Limpiar selección"><i className="fa-solid fa-xmark"></i></button>}
    </div>
    {open && !disabled && <div className="sed-search-options">
      {filteredIds.length ? filteredIds.map(id => <button key={id} className={id === value ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange?.(id); setQuery(''); setOpen(false); }}>
        <strong>{id}</strong><span>{seds[id]?.name || `SED ${id}`}</span>
      </button>) : <div className="sed-search-empty">No se encontraron SED</div>}
    </div>}
  </div>;
}
