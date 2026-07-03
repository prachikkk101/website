// src/components/SiteSelectorModal.jsx
// Replaces SiteFlyoutMenu — click-to-open centered modal with 3-step breadcrumb picker.
import { useState, useEffect, useRef } from 'react';

function SiteSelectorModal({ isOpen, onClose, gaLocations, onSelect, selectedLabel }) {
  const [step, setStep]           = useState('ga');   // 'ga' | 'city' | 'area'
  const [selectedGA,   setSelectedGA]   = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  // Focus search on open / step change
  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [isOpen, step]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) { setStep('ga'); setSelectedGA(null); setSelectedCity(null); setSearch(''); }
  }, [isOpen]);

  if (!isOpen) return null;

  const reset = () => {
    setStep('ga'); setSelectedGA(null); setSelectedCity(null); setSearch('');
  };

  const close = () => { reset(); onClose(); };

  // Build list for current step
  let listItems = [];
  let title = 'Select GA Location';
  if (step === 'ga') {
    listItems = (gaLocations || []).filter(g =>
      (g?.name || '').toLowerCase().includes((search || '').toLowerCase())
    );
    title = 'Select GA Location';
  } else if (step === 'city') {
    title = `${selectedGA?.name || ''} — Select City`;
    listItems = (selectedGA?.cities || []).filter(c =>
      (c?.name || '').toLowerCase().includes((search || '').toLowerCase())
    );
  } else if (step === 'area') {
    title = `${selectedCity?.name || ''} — Select Area`;
    listItems = (selectedCity?.areas || []).filter(a =>
      (a || '').toLowerCase().includes((search || '').toLowerCase())
    );
  }

  const handleBack = () => {
    setSearch('');
    if (step === 'area') setStep('city');
    else { setStep('ga'); setSelectedGA(null); }
  };

  const handleItem = (item) => {
    if (step === 'ga') {
      setSelectedGA(item);
      // If GA has no cities, select it directly and close
      if (!item.cities || item.cities.length === 0) {
        onSelect(item.name, null, null);
        close();
        return;
      }
      setStep('city');
      setSearch('');
    } else if (step === 'city') {
      setSelectedCity(item);
      // If city has no areas, select it directly and close
      if (!item.areas || item.areas.length === 0) {
        onSelect(selectedGA.name, item.name, null);
        close();
        return;
      }
      setStep('area');
      setSearch('');
    } else if (step === 'area') {
      onSelect(selectedGA.name, selectedCity.name, item);
      close();
    }
  };

  const label = (item) => (step === 'area' ? item : item.name);
  const hasChildren = (item) => {
    if (step === 'ga') return item.cities && item.cities.length > 0;
    if (step === 'city') return item.areas && item.areas.length > 0;
    return false;
  };

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 12,
          width: 380,
          maxHeight: '78vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          background: '#1f4e1a',
          color: 'white',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          <button
            onClick={close}
            style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Breadcrumb / Back */}
        {step !== 'ga' && (
          <div style={{ padding: '8px 18px 0', flexShrink: 0 }}>
            <button
              onClick={handleBack}
              style={{
                background: 'none', border: 'none', color: '#2d6a27',
                fontSize: 12, cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
              }}
            >
              ← Back
            </button>
          </div>
        )}

        {/* "All GA" reset option — only on GA step */}
        {step === 'ga' && (
          <div
            onClick={() => { onSelect(null, null, null); close(); }}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: '#1f4e1a',
              cursor: 'pointer',
              borderBottom: '1px solid #f1f5f9',
              flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0f7ee'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            All GA (Reset)
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '10px 18px', flexShrink: 0 }}>
          <input
            ref={searchRef}
            type="text"
            placeholder={`Search ${step === 'ga' ? 'locations' : step === 'city' ? 'cities' : 'areas'}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: 36,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              padding: '0 10px',
              fontSize: 13,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>
          {listItems.length === 0 && (
            <div style={{ padding: '20px 18px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
              No results found
            </div>
          )}
          {listItems.map((item, i) => (
            <div
              key={label(item) + i}
              onClick={() => handleItem(item)}
              style={{
                padding: '12px 18px',
                fontSize: 13,
                cursor: 'pointer',
                color: '#1e293b',
                borderBottom: '1px solid #f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f7ee'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <span>{label(item)}</span>
              {hasChildren(item) && (
                <span style={{ color: '#94a3b8', fontSize: 14 }}>›</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SiteSelectorModal;
