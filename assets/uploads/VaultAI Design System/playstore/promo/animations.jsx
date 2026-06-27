// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// animations.jsx
// Reusable animation starter: Stage, Timeline, Sprite, easing helpers.
// Exports (to window): Stage, Sprite, PlaybackBar, TextSprite, ImageSprite, RectSprite,
//   useTime, useTimeline, useSprite, Easing, interpolate, animate, clamp.
//
// Usage (in an HTML file that loads React + Babel):
//
//   <Stage width={1280} height={720} duration={10} background="#f6f4ef">
//     <MyScene />
//   </Stage>
//
// <Stage> auto-scales to the viewport and provides the scrubber, play/pause,
// ←/→ seek, space, and 0-to-reset controls, and persists the playhead.
// Inside <Stage>, any child can call useTime() to read the current
// playhead (seconds). Or wrap content in <Sprite start={1} end={4}>...</Sprite>
// to only render during that window -- children receive a `localTime` and
// `progress` via the useSprite() hook. Use Easing + interpolate()/animate()
// for tweens; TextSprite / ImageSprite / RectSprite have built-in entry/exit.
// Build YOUR scenes by composing Sprites inside a Stage.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

// ── Easing functions (hand-rolled, Popmotion-style) ─────────────────────────
// All easings take t ∈ [0,1] and return eased t ∈ [0,1] (may overshoot for back/elastic).
const Easing = {
  linear: (t) => t,

  // Quad
  easeInQuad:    (t) => t * t,
  easeOutQuad:   (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // Cubic
  easeInCubic:    (t) => t * t * t,
  easeOutCubic:   (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

  // Quart
  easeInQuart:    (t) => t * t * t * t,
  easeOutQuart:   (t) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t),

  // Expo
  easeInExpo:  (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return 0.5 * Math.pow(2, 20 * t - 10);
    return 1 - 0.5 * Math.pow(2, -20 * t + 10);
  },

  // Sine
  easeInSine:    (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine:   (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Back (overshoot)
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeInOutBack: (t) => {
    const c1 = 1.70158, c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // Elastic
  easeOutElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

// ── Core interpolation helpers ──────────────────────────────────────────────

// Clamp a value to [min, max]
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// interpolate([0, 0.5, 1], [0, 100, 50], ease?) -> fn(t)
// Popmotion-style: linearly maps t across input keyframes to output values,
// with optional easing per segment (single fn or array of fns).
function interpolate(input, output, ease = Easing.linear) {
  return (t) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const easeFn = Array.isArray(ease) ? (ease[i] || Easing.linear) : ease;
        const eased = easeFn(local);
        return output[i] + (output[i + 1] - output[i]) * eased;
      }
    }
    return output[output.length - 1];
  };
}

// animate({from, to, start, end, ease})(t) — simpler single-segment tween.
// Returns `from` before `start`, `to` after `end`.
function animate({ from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic }) {
  return (t) => {
    if (t <= start) return from;
    if (t >= end) return to;
    const local = (t - start) / (end - start);
    return from + (to - from) * ease(local);
  };
}

// ── Timeline context ────────────────────────────────────────────────────────

const TimelineContext = React.createContext({ time: 0, duration: 10, playing: false });

const useTime = () => React.useContext(TimelineContext).time;
const useTimeline = () => React.useContext(TimelineContext);

// ── Sprite ──────────────────────────────────────────────────────────────────
// Renders children only when the playhead is inside [start, end]. Provides
// a sub-context with `localTime` (seconds since start) and `progress` (0..1).
//
//   <Sprite start={2} end={5}>
//     {({ localTime, progress }) => <Thing x={progress * 100} />}
//   </Sprite>
//
// Or as a plain wrapper — children can call useSprite() themselves.

const SpriteContext = React.createContext({ localTime: 0, progress: 0, duration: 0 });
const useSprite = () => React.useContext(SpriteContext);

function Sprite({ start = 0, end = Infinity, children, keepMounted = false }) {
  const { time } = useTimeline();
  const visible = time >= start && time <= end;
  if (!visible && !keepMounted) return null;

  const duration = end - start;
  const localTime = Math.max(0, time - start);
  const progress = duration > 0 && isFinite(duration)
    ? clamp(localTime / duration, 0, 1)
    : 0;

  const value = { localTime, progress, duration, visible };

  return (
    <SpriteContext.Provider value={value}>
      {typeof children === 'function' ? children(value) : children}
    </SpriteContext.Provider>
  );
}

// ── Sample sprite components ────────────────────────────────────────────────

// TextSprite: fades/slides text in on entry, holds, then fades out on exit.
// Props: text, x, y, size, color, font, entryDur, exitDur, align
function TextSprite({
  text,
  x = 0, y = 0,
  size = 48,
  color = '#111',
  font = 'Inter, system-ui, sans-serif',
  weight = 600,
  entryDur = 0.45,
  exitDur = 0.35,
  entryEase = Easing.easeOutBack,
  exitEase = Easing.easeInCubic,
  align = 'left',
  letterSpacing = '-0.01em',
}) {
  const { localTime, duration } = useSprite();
  const exitStart = Math.max(0, duration - exitDur);

  let opacity = 1;
  let ty = 0;

  if (localTime < entryDur) {
    const t = entryEase(clamp(localTime / entryDur, 0, 1));
    opacity = t;
    ty = (1 - t) * 16;
  } else if (localTime > exitStart) {
    const t = exitEase(clamp((localTime - exitStart) / exitDur, 0, 1));
    opacity = 1 - t;
    ty = -t * 8;
  }

  const translateX = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      transform: `translate(${translateX}, ${ty}px)`,
      opacity,
      fontFamily: font,
      fontSize: size,
      fontWeight: weight,
      color,
      letterSpacing,
      whiteSpace: 'pre',
      lineHeight: 1.1,
      willChange: 'transform, opacity',
    }}>
      {text}
    </div>
  );
}

// ImageSprite: scales + fades in; optional Ken Burns drift during hold.
function ImageSprite({
  src,
  x = 0, y = 0,
  width = 400, height = 300,
  entryDur = 0.6,
  exitDur = 0.4,
  kenBurns = false,
  kenBurnsScale = 1.08,
  radius = 12,
  fit = 'cover',
  placeholder = null, // {label: string} for striped placeholder
}) {
  const { localTime, duration } = useSprite();
  const exitStart = Math.max(0, duration - exitDur);

  let opacity = 1;
  let scale = 1;

  if (localTime < entryDur) {
    const t = Easing.easeOutCubic(clamp(localTime / entryDur, 0, 1));
    opacity = t;
    scale = 0.96 + 0.04 * t;
  } else if (localTime > exitStart) {
    const t = Easing.easeInCubic(clamp((localTime - exitStart) / exitDur, 0, 1));
    opacity = 1 - t;
    scale = (kenBurns ? kenBurnsScale : 1) + 0.02 * t;
  } else if (kenBurns) {
    const holdSpan = exitStart - entryDur;
    const holdT = holdSpan > 0 ? (localTime - entryDur) / holdSpan : 0;
    scale = 1 + (kenBurnsScale - 1) * holdT;
  }

  const content = placeholder ? (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'repeating-linear-gradient(135deg, #e9e6df 0 10px, #dcd8cf 10px 20px)',
      color: '#6b6458',
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 13,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {placeholder.label || 'image'}
    </div>
  ) : (
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} />
  );

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width, height,
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      borderRadius: radius,
      overflow: 'hidden',
      willChange: 'transform, opacity',
    }}>
      {content}
    </div>
  );
}

// RectSprite: simple rectangle that animates position/size/color via props.
// Useful demo primitive — takes a `render` fn for per-frame customization.
function RectSprite({
  x = 0, y = 0,
  width = 100, height = 100,
  color = '#111',
  radius = 8,
  entryDur = 0.4,
  exitDur = 0.3,
  render, // optional: (ctx) => style overrides
}) {
  const spriteCtx = useSprite();
  const { localTime, duration } = spriteCtx;
  const exitStart = Math.max(0, duration - exitDur);

  let opacity = 1;
  let scale = 1;

  if (localTime < entryDur) {
    const t = Easing.easeOutBack(clamp(localTime / entryDur, 0, 1));
    opacity = clamp(localTime / entryDur, 0, 1);
    scale = 0.4 + 0.6 * t;
  } else if (localTime > exitStart) {
    const t = Easing.easeInQuad(clamp((localTime - exitStart) / exitDur, 0, 1));
    opacity = 1 - t;
    scale = 1 - 0.15 * t;
  }

  const overrides = render ? render(spriteCtx) : {};

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width, height,
      background: color,
      borderRadius: radius,
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      willChange: 'transform, opacity',
      ...overrides,
    }} />
  );
}


function Stage({
  width = 1280,
  height = 720,
  duration = 10,
  background = '#f6f4ef',
  fps = 60,
  loop = true,
  autoplay = true,
  controls = true,
  persistKey = 'animstage',
  children,
}) {
  const [time, setTime] = React.useState(() => {
    try {
      const v = parseFloat(localStorage.getItem(persistKey + ':t') || '0');
      return isFinite(v) ? clamp(v, 0, duration) : 0;
    } catch { return 0; }
  });
  const [playing, setPlaying] = React.useState(autoplay);
  const [hoverTime, setHoverTime] = React.useState(null);
  const [scale, setScale] = React.useState(1);

  const stageRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const lastTsRef = React.useRef(null);

  // Persist playhead
  React.useEffect(() => {
    try { localStorage.setItem(persistKey + ':t', String(time)); } catch {}
  }, [time, persistKey]);

  // Auto-scale to fit viewport
  React.useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const measure = () => {
      const barH = controls ? 44 : 0; // playback bar height
      const s = Math.min(
        el.clientWidth / width,
        (el.clientHeight - barH) / height
      );
      setScale(Math.max(0.05, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [width, height]);

  // Animation loop
  React.useEffect(() => {
    if (!playing) {
      lastTsRef.current = null;
      return;
    }
    const step = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTime((t) => {
        let next = t + dt;
        if (next >= duration) {
          if (loop) next = next % duration;
          else { next = duration; setPlaying(false); }
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [playing, duration, loop]);

  // Keyboard: space = play/pause, ← → = seek
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(p => !p);
      } else if (e.code === 'ArrowLeft') {
        setTime(t => clamp(t - (e.shiftKey ? 1 : 0.1), 0, duration));
      } else if (e.code === 'ArrowRight') {
        setTime(t => clamp(t + (e.shiftKey ? 1 : 0.1), 0, duration));
      } else if (e.key === '0' || e.code === 'Home') {
        setTime(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration]);

  const displayTime = hoverTime != null ? hoverTime : time;

  const ctxValue = React.useMemo(
    () => ({ time: displayTime, duration, playing, setTime, setPlaying }),
    [displayTime, duration, playing]
  );

  return (
    <div
      ref={stageRef}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        background: '#0a0a0a',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Canvas area — vertically centered in remaining space */}
      <div style={{
        flex: 1,
        width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <div
          ref={canvasRef}
          style={{
            width, height,
            background,
            position: 'relative',
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            flexShrink: 0,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          <TimelineContext.Provider value={ctxValue}>
            {children}
          </TimelineContext.Provider>
        </div>
      </div>

      {/* Playback bar — stacked below canvas, never overlapping */}
      {controls && <PlaybackBar
        time={displayTime}
        actualTime={time}
        duration={duration}
        playing={playing}
        onPlayPause={() => setPlaying(p => !p)}
        onReset={() => { setTime(0); }}
        onSeek={(t) => setTime(t)}
        onHover={(t) => setHoverTime(t)}
      />}
    </div>
  );
}

// ── Playback bar ────────────────────────────────────────────────────────────
// Play/pause, return-to-begin, scrub track, time display.
// Uses fixed-width time fields so layout doesn't thrash.

function PlaybackBar({ time, duration, playing, onPlayPause, onReset, onSeek, onHover }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);

  const timeFromEvent = React.useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    return x * duration;
  }, [duration]);

  const onTrackMove = (e) => {
    if (!trackRef.current) return;
    const t = timeFromEvent(e);
    if (dragging) {
      onSeek(t);
    } else {
      onHover(t);
    }
  };

  const onTrackLeave = () => {
    if (!dragging) onHover(null);
  };

  const onTrackDown = (e) => {
    setDragging(true);
    const t = timeFromEvent(e);
    onSeek(t);
    onHover(null);
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onUp = () => setDragging(false);
    const onMove = (e) => {
      if (!trackRef.current) return;
      const t = timeFromEvent(e);
      onSeek(t);
    };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
    };
  }, [dragging, timeFromEvent, onSeek]);

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const fmt = (t) => {
    const total = Math.max(0, t);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const cs = Math.floor((total * 100) % 100);
    return `${String(m).padStart(1, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const mono = 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 16px',
      background: 'rgba(20,20,20,0.92)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      width: '100%',
      maxWidth: 680,
      alignSelf: 'center',

      borderRadius: 8,
      color: '#f6f4ef',
      fontFamily: 'Inter, system-ui, sans-serif',
      userSelect: 'none',
      flexShrink: 0,
    }}>
      <IconButton onClick={onReset} title="Return to start (0)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 2v10M12 2L5 7l7 5V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      </IconButton>
      <IconButton onClick={onPlayPause} title="Play/pause (space)">
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="2" width="3" height="10" fill="currentColor"/>
            <rect x="8" y="2" width="3" height="10" fill="currentColor"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2l9 5-9 5V2z" fill="currentColor"/>
          </svg>
        )}
      </IconButton>

      {/* Current time: fixed width so it doesn't thrash */}
      <div style={{
        fontFamily: mono,
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        width: 64, textAlign: 'right',
        color: '#f6f4ef',
      }}>
        {fmt(time)}
      </div>

      {/* Scrub track */}
      <div
        ref={trackRef}
        onMouseMove={onTrackMove}
        onMouseLeave={onTrackLeave}
        onMouseDown={onTrackDown}
        style={{
          flex: 1,
          height: 22,
          position: 'relative',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}
      >
        <div style={{
          position: 'absolute',
          left: 0, right: 0, height: 4,
          background: 'rgba(255,255,255,0.12)',
          borderRadius: 2,
        }}/>
        <div style={{
          position: 'absolute',
          left: 0, width: `${pct}%`, height: 4,
          background: 'oklch(72% 0.12 250)',
          borderRadius: 2,
        }}/>
        <div style={{
          position: 'absolute',
          left: `${pct}%`, top: '50%',
          width: 12, height: 12,
          marginLeft: -6, marginTop: -6,
          background: '#fff',
          borderRadius: 6,
          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
        }}/>
      </div>

      {/* Duration: fixed width */}
      <div style={{
        fontFamily: mono,
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        width: 64, textAlign: 'left',
        color: 'rgba(246,244,239,0.55)',
      }}>
        {fmt(duration)}
      </div>
    </div>
  );
}

function IconButton({ children, onClick, title }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        color: '#f6f4ef',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}


Object.assign(window, {
  Easing, interpolate, animate, clamp,
  TimelineContext, useTime, useTimeline,
  Sprite, SpriteContext, useSprite,
  TextSprite, ImageSprite, RectSprite,
  Stage, PlaybackBar,
});

/* ════════════════════════════════════════════════════════════════════════
   VaultAI — Google Play promo video
   Composed on top of the engine above. Registers window.VaultPromo.
   ════════════════════════════════════════════════════════════════════════ */

const VA = {
  green:  '#36F0AB',
  greenMid:'#1ECF85',
  ink:    '#F4F7F4',
  mut:    'rgba(226,240,233,0.66)',
  font:   '"Sora","Helvetica Neue",Arial,sans-serif',
  mono:   'ui-monospace,Menlo,monospace',
};

const ICON = 'lockup-icon.png';

// per-element rise helper
function rise(localTime, delay, dur = 0.6, dist = 22) {
  const p = Easing.easeOutCubic(clamp((localTime - delay) / dur, 0, 1));
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
}

// ── Brand gradient field (always fully opaque so cuts never flash black) ──
function Field({ gx = 30, glow = [78, 30], glow2 = [12, 82] }) {
  const t = useSprite().localTime;
  const gly = glow[1] + Math.sin(t * 0.6) * 2.5;
  const glx = glow[0] + Math.cos(t * 0.5) * 2.0;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0,
        background: `radial-gradient(120% 130% at ${gx}% 16%, #0E2A20 0%, #08150F 55%, #040B08 100%)` }} />
      <div style={{ position: 'absolute', inset: 0,
        background: `radial-gradient(46% 60% at ${glx}% ${gly}%, rgba(54,240,171,0.22), transparent 62%)` }} />
      <div style={{ position: 'absolute', inset: 0,
        background: `radial-gradient(42% 55% at ${glow2[0]}% ${glow2[1]}%, rgba(99,102,241,0.12), transparent 60%)` }} />
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(75% 75% at 50% 50%, transparent 40%, rgba(0,0,0,0.42) 100%)' }} />
    </div>
  );
}

// ── Phone mock with slide-in + float + Ken-Burns drift on the screenshot ──
function Phone({ src, side, rot }) {
  const { localTime } = useSprite();
  const enter = Easing.easeOutCubic(clamp(localTime / 0.75, 0, 1));
  const op = clamp(localTime / 0.5, 0, 1);
  const dx = (side === 'right' ? 80 : -80) * (1 - enter);
  const sc = 0.94 + 0.06 * enter;
  const floatY = Math.sin(localTime * 1.05 + 0.4) * 9;
  const left = side === 'right' ? 1140 : 300;
  const kb = 1 + 0.05 * Easing.easeInOutSine(clamp(localTime / 2.7, 0, 1)); // slow zoom on screen
  return (
    <div style={{
      position: 'absolute', left, top: 57, width: 472, height: 966,
      opacity: op,
      transform: `translate(${dx}px, ${floatY}px) rotate(${rot}deg) scale(${sc})`,
      transformOrigin: 'center', willChange: 'transform, opacity',
      borderRadius: 64, padding: 14,
      background: 'linear-gradient(150deg,#3a3d46,#22242b 55%,#0f1014)',
      border: '2px solid rgba(255,255,255,0.14)',
      boxShadow: '0 60px 110px rgba(0,0,0,0.62), 0 0 120px rgba(54,240,171,0.18)',
    }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 50, overflow: 'hidden',
        background: '#1e1e26', position: 'relative' }}>
        <img src={src} alt="" style={{ width: '100%', display: 'block',
          transform: `scale(${kb})`, transformOrigin: '50% 22%' }} />
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          width: 104, height: 30, borderRadius: 16, background: '#000' }} />
      </div>
    </div>
  );
}

// ── Lockup (icon + wordmark) ──
function Lockup({ size = 62, type = 34, gap = 18, opacity = 1, transform }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, opacity, transform }}>
      <img src={ICON} alt="VaultAI" style={{ width: size, height: size, borderRadius: size * 0.24 }} />
      <span style={{ color: VA.ink, fontWeight: 700, fontSize: type, fontFamily: VA.font }}>VaultAI</span>
    </div>
  );
}

// ── A single feature scene ──
function Feature({ data }) {
  const { localTime } = useSprite();
  const colLeft = data.side === 'right' ? 120 : 1040;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Field gx={data.gx} glow={data.glow} glow2={data.glow2} />
      <Phone src={data.screen} side={data.side} rot={data.rot} />
      <div style={{ position: 'absolute', left: colLeft, top: 150, width: 760, fontFamily: VA.font }}>
        <div style={{ marginBottom: 70, ...rise(localTime, 0, 0.6, 14) }}>
          <Lockup />
        </div>
        <div style={{ display: 'inline-block', fontFamily: VA.mono, fontWeight: 600, fontSize: 23,
          letterSpacing: 2, color: VA.green, border: '2px solid rgba(54,240,171,0.45)',
          background: 'rgba(54,240,171,0.08)', padding: '13px 26px', borderRadius: 999,
          marginBottom: 34, ...rise(localTime, 0.18, 0.55, 18) }}>
          {data.tag}
        </div>
        <div style={{ fontWeight: 700, fontSize: 108, lineHeight: 1.04, letterSpacing: '-1px' }}>
          {data.lines.map((line, li) => (
            <div key={li} style={rise(localTime, 0.34 + li * 0.13, 0.6, 26)}>
              {line.map((tok, ti) => (
                <span key={ti} style={{ color: tok.g ? VA.green : VA.ink }}>{tok.t}</span>
              ))}
            </div>
          ))}
        </div>
        <div style={{ color: VA.mut, fontSize: 38, lineHeight: 1.5, marginTop: 40, maxWidth: 720,
          ...rise(localTime, 0.66, 0.7, 20) }}>
          {data.sub}
        </div>
      </div>
    </div>
  );
}

// ── Intro brand card ──
function Intro() {
  const { localTime, duration } = useSprite();
  const inP = Easing.easeOutBack(clamp(localTime / 0.8, 0, 1));
  const iconScale = 0.6 + 0.4 * inP;
  const exit = clamp((localTime - (duration - 0.45)) / 0.45, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - exit }}>
      <Field gx={50} glow={[50, 32]} glow2={[80, 84]} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', fontFamily: VA.font, textAlign: 'center' }}>
        <img src={ICON} alt="VaultAI" style={{ width: 168, height: 168, borderRadius: 40,
          opacity: clamp(localTime / 0.5, 0, 1), transform: `scale(${iconScale})`,
          boxShadow: '0 30px 80px rgba(54,240,171,0.25)' }} />
        <div style={{ marginTop: 40, fontWeight: 700, fontSize: 96, letterSpacing: '-2px',
          color: VA.ink, ...rise(localTime, 0.45, 0.6, 24) }}>VaultAI</div>
        <div style={{ marginTop: 14, fontSize: 44, fontWeight: 400, color: VA.mut,
          ...rise(localTime, 0.7, 0.6, 20) }}>
          Your money, <span style={{ color: VA.green, fontWeight: 600 }}>finally clear.</span>
        </div>
      </div>
    </div>
  );
}

// ── Outro CTA ──
function Outro() {
  const { localTime } = useSprite();
  const pulse = 1 + Math.sin(localTime * 2.2) * 0.02;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Field gx={50} glow={[50, 30]} glow2={[15, 85]} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', fontFamily: VA.font, textAlign: 'center' }}>
        <div style={rise(localTime, 0, 0.6, 18)}>
          <Lockup size={104} type={56} gap={26} />
        </div>
        <div style={{ marginTop: 56, fontWeight: 700, fontSize: 92, letterSpacing: '-1.5px',
          color: VA.ink, ...rise(localTime, 0.3, 0.6, 26) }}>
          Take control <span style={{ color: VA.green }}>today</span>
        </div>
        <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 16,
          padding: '22px 44px', borderRadius: 999, background: VA.green,
          color: '#05231a', fontWeight: 700, fontSize: 38,
          boxShadow: '0 20px 60px rgba(54,240,171,0.35)',
          transform: `scale(${pulse})`, ...rise(localTime, 0.6, 0.6, 22) }}>
          Download free on Google Play
        </div>
      </div>
    </div>
  );
}

const VP_FEATURES = [
  { side: 'right', gx: 30, glow: [78, 30], glow2: [12, 82], rot: -4, screen: 'screens/01.png',
    tag: 'AI FINANCE COACH', lines: [[{ t: 'Your money,' }], [{ t: 'crystal ' }, { t: 'clear', g: 1 }]],
    sub: 'See income, spending and savings in one calm, beautiful view — updated the moment you add a transaction.' },
  { side: 'left', gx: 70, glow: [22, 30], glow2: [88, 82], rot: 4, screen: 'screens/02.png',
    tag: 'POWERED BY AI', lines: [[{ t: 'Insights that' }], [{ t: 'pay ' }, { t: 'off', g: 1 }]],
    sub: 'VaultAI reads your numbers and surfaces specific, money-saving moves — like maxing your tax deductions.' },
  { side: 'right', gx: 30, glow: [78, 28], glow2: [12, 82], rot: -4, screen: 'screens/03.png',
    tag: 'ONE DASHBOARD', lines: [[{ t: 'Your whole' }], [{ t: 'financial ' }, { t: 'life', g: 1 }]],
    sub: 'Net worth, cash flow, retirement and your VaultScore — the health of your finances at a glance.' },
  { side: 'left', gx: 70, glow: [22, 30], glow2: [88, 82], rot: 4, screen: 'screens/04.png',
    tag: 'TRANSACTIONS', lines: [[{ t: 'Every dollar,' }], [{ t: 'tracked', g: 1 }]],
    sub: 'Log spending in seconds and watch budgets, categories and monthly net update instantly.' },
  { side: 'right', gx: 30, glow: [78, 30], glow2: [12, 82], rot: -4, screen: 'screens/05.png',
    tag: 'NET WORTH', lines: [[{ t: 'Watch your' }], [{ t: 'wealth ' }, { t: 'grow', g: 1 }]],
    sub: 'Track assets, liabilities and total wealth over time — from your car to your cash.' },
  { side: 'left', gx: 70, glow: [22, 30], glow2: [88, 82], rot: 4, screen: 'screens/06.png',
    tag: 'TAX BREAKDOWN', lines: [[{ t: 'Taxes, ' }, { t: 'finally', g: 1 }], [{ t: 'clear', g: 1 }]],
    sub: 'See exactly where your gross income goes — social security, health and income tax, down to net take-home.' },
  { side: 'right', gx: 30, glow: [78, 30], glow2: [12, 82], rot: -4, screen: 'screens/07.png',
    tag: 'VAULTAI PREMIUM', lines: [[{ t: 'Go further' }], [{ t: 'with ' }, { t: 'Premium', g: 1 }]],
    sub: 'Deep AI analysis, scenario planning and richer reports — all staying private on your device.' },
  { side: 'left', gx: 70, glow: [22, 30], glow2: [88, 82], rot: 4, screen: 'screens/08.png',
    tag: 'MADE YOURS', lines: [[{ t: 'Light or dark.' }], [{ t: 'Your ' }, { t: 'call', g: 1 }]],
    sub: 'A calm dark theme or a crisp light one — VaultAI looks right however you like it.' },
];

const PROMO = (() => {
  const INTRO = 3.0, SD = 2.7, START = 3.0, OUTRO = 4.2;
  const outroStart = START + VP_FEATURES.length * SD; // 24.6
  const duration = outroStart + OUTRO;                // 28.8
  return { INTRO, SD, START, OUTRO, outroStart, duration };
})();

function PromoScenes() {
  return (
    <React.Fragment>
      <Sprite start={0} end={PROMO.INTRO}><Intro /></Sprite>
      {VP_FEATURES.map((f, i) => {
        const s = PROMO.START + i * PROMO.SD;
        return <Sprite key={i} start={s} end={s + PROMO.SD}><Feature data={f} /></Sprite>;
      })}
      <Sprite start={PROMO.outroStart} end={PROMO.duration + 0.1}><Outro /></Sprite>
    </React.Fragment>
  );
}

function VaultPromo() {
  const record = (typeof window !== 'undefined' && window.__RECORD__) ||
    (typeof location !== 'undefined' &&
      new URLSearchParams(location.search).get('record') === '1');
  return (
    <Stage width={1920} height={1080} duration={PROMO.duration} background="#06120d"
      persistKey="vaultpromo" controls={!record} loop={!record}>
      <PromoScenes />
    </Stage>
  );
}

// Controlled single-frame renderer (no Stage / no rAF) — used by the frame exporter.
function PromoFrame({ time }) {
  const ctx = { time, duration: PROMO.duration, playing: false, setTime: () => {}, setPlaying: () => {} };
  return (
    <div style={{ width: 1920, height: 1080, position: 'relative', background: '#06120d', overflow: 'hidden' }}>
      <TimelineContext.Provider value={ctx}><PromoScenes /></TimelineContext.Provider>
    </div>
  );
}

window.VaultPromo = VaultPromo;
window.PromoFrame = PromoFrame;
window.PROMO_DURATION = PROMO.duration;
window.PROMO_IMAGES = [ICON, ...VP_FEATURES.map(f => f.screen)];

