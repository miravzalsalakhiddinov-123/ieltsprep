import { useEffect, useRef, useState } from 'react';

function fmt(t) {
  if (!isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

export default function AudioPlayer({ src, label = 'Recording' }) {
  const audioRef = useRef(null);
  const barRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onEnd = () => setPlaying(false);
    const onPause = () => setPlaying(false);
    const onProgress = () => {
      if (a.buffered && a.buffered.length) {
        setBuffered(a.buffered.end(a.buffered.length - 1));
      }
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('ended', onEnd);
    a.addEventListener('pause', onPause);
    a.addEventListener('progress', onProgress);

    // Autoplay as soon as this player mounts — it's only rendered once the
    // student has already confirmed "I'm ready to start" (see TestRunner's
    // ReadyGate), so this counts as a direct result of that click and isn't
    // blocked by browser autoplay restrictions. No play/pause button, no
    // skip buttons, and no seeking on the bar below — the recording just
    // runs once, exactly like the real exam.
    a.play().catch(() => {});

    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('progress', onProgress);
    };
  }, []);

  function changeVolume(v) {
    const a = audioRef.current;
    setVolume(v);
    setMuted(v === 0);
    if (a) a.volume = v;
  }

  function toggleMute() {
    const a = audioRef.current;
    if (!a) return;
    if (muted) { a.volume = volume || 1; setMuted(false); if (!volume) setVolume(1); }
    else { a.volume = 0; setMuted(true); }
  }

  function changeSpeed(sp) {
    const a = audioRef.current;
    setSpeed(sp);
    setShowSpeed(false);
    if (a) a.playbackRate = sp;
  }

  const pct = duration ? (current / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div className="ap">
      <audio ref={audioRef} src={src} preload="auto" />

      <span className="ap-live-dot" aria-hidden="true" />
      <span className="ap-time">{fmt(current)}</span>

      <div className="ap-bar ap-bar-static" ref={barRef}>
        <div className="ap-bar-track">
          <div className="ap-bar-buffered" style={{ width: `${bufPct}%` }} />
          <div className="ap-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="ap-bar-thumb" style={{ left: `${pct}%` }} />
      </div>

      <span className="ap-time ap-time-total">{fmt(duration)}</span>

      <div className="ap-speed-wrap">
        <button className="ap-speed-btn" onClick={() => setShowSpeed(s => !s)}>{speed}×</button>
        {showSpeed && (
          <div className="ap-speed-menu" onMouseLeave={() => setShowSpeed(false)}>
            {SPEEDS.map(sp => (
              <button key={sp} className={`ap-speed-opt${sp === speed ? ' active' : ''}`} onClick={() => changeSpeed(sp)}>{sp}×</button>
            ))}
          </div>
        )}
      </div>

      <div className="ap-vol-wrap" onMouseEnter={() => setShowVolume(true)} onMouseLeave={() => setShowVolume(false)}>
        <button className="ap-vol-btn" onClick={toggleMute} aria-label="Mute">
          {muted || volume === 0 ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M17 8l4 8M21 8l-4 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M18.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6"/></svg>
          )}
        </button>
        {showVolume && (
          <div className="ap-vol-pop">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              className="ap-vol-slider"
            />
          </div>
        )}
      </div>
    </div>
  );
}
