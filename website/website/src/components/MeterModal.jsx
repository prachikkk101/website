// src/components/MeterModal.jsx
import { useState, useRef } from 'react';

const meterMakes = ['Itron', 'Elster', 'Honeywell', 'Landis+Gyr'];

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function MeterModal({ house, onClose, onSave }) {
  const [cameraFile, setCameraFile] = useState(null);
  const [galleryFile, setGalleryFile] = useState(null);
  const [meterMake, setMeterMake] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [reading, setReading] = useState(0);
  const [position, setPosition] = useState('LHS');
  const [installDate, setInstallDate] = useState(today());

  const cameraRef = useRef();
  const galleryRef = useRef();

  function handleSave() {
    const data = { cameraFile, galleryFile, meterMake, serialNo, reading, position, installDate };
    onSave && onSave(data);
    onClose();
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-box w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'white' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: '#1f4e1a' }}
        >
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7ec56f" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
            <h2 className="text-white font-bold text-base">Meter Installation Details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-green-300 hover:text-white transition-colors text-xl font-light leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            ×
          </button>
        </div>

        {/* House info summary bar */}
        {house && (
          <div
            className="px-5 py-2.5 flex flex-wrap items-center gap-4 text-sm border-b"
            style={{ background: '#f0f7ee', borderColor: '#c6dfc2' }}
          >
            <div>
              <span className="text-gray-400 text-xs">Customer</span>
              <p className="font-semibold text-gray-800">{house.name}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">BP No.</span>
              <p className="font-semibold text-gray-800">{house.bpNo}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">House No.</span>
              <p className="font-semibold text-gray-800">{house.houseNo}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Area</span>
              <p className="font-semibold text-gray-800">{house.area}</p>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Meter Photo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Meter Photo
            </label>
            <div className="flex gap-2">
              {/* Camera */}
              <button
                onClick={() => cameraRef.current.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-sm font-medium transition-all hover:border-green-500 hover:bg-green-50"
                style={{ borderColor: '#2d6a27', color: '#2d6a27' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                {cameraFile ? cameraFile.name.slice(0, 15) + '…' : 'Take Photo'}
              </button>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => setCameraFile(e.target.files[0])}
              />

              {/* Gallery */}
              <button
                onClick={() => galleryRef.current.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-sm font-medium transition-all hover:border-green-500 hover:bg-green-50"
                style={{ borderColor: '#6b7280', color: '#6b7280' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                {galleryFile ? galleryFile.name.slice(0, 15) + '…' : 'From Gallery'}
              </button>
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => setGalleryFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* Meter Make */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Meter Make
            </label>
            <select
              value={meterMake}
              onChange={e => setMeterMake(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#2d6a27' }}
            >
              <option value="">— Select Make —</option>
              {meterMakes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Meter Serial No. */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Meter Serial No.
            </label>
            <input
              type="text"
              value={serialNo}
              onChange={e => setSerialNo(e.target.value)}
              placeholder="e.g. 20240321327"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {/* Meter Reading */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Meter Reading
            </label>
            <input
              type="number"
              value={reading}
              onChange={e => setReading(Number(e.target.value))}
              min={0}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {/* LHS / RHS */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Position
            </label>
            <div className="flex gap-4">
              {['LHS', 'RHS'].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setPosition(opt)}
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer"
                    style={{
                      borderColor: position === opt ? '#2d6a27' : '#d1d5db',
                      background: position === opt ? '#2d6a27' : 'white',
                    }}
                  >
                    {position === opt && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Installation Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Installation Date
            </label>
            <input
              type="date"
              value={installDate}
              onChange={e => setInstallDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: '#e5e7eb' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: '#c0440a', color: 'white' }}
          >
            Close
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: '#2d6a27', color: 'white' }}
          >
            Save Details
          </button>
        </div>
      </div>
    </div>
  );
}
