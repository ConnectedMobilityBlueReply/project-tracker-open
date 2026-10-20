/**
 * Motion tokens: single source of truth for JS-driven animation.
 *
 * These MUST stay in sync with the CSS custom properties defined in `app/globals.css`
 * (`--ease-*`, `--duration-*`). For CSS/Tailwind, prefer the utilities backed by those
 * variables (e.g. `ease-out`, `duration-base`). Use these constants only when animating
 * from JS (Web Animations API, Framer Motion, GSAP). Never inline raw cubic-bezier values.
 */

/** Easing curves. Keys match the `--ease-*` CSS variables. */
export const easing = {
  /** UI enter/exit (Emil Kowalski curve). `--ease-out` */
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  /** On-screen movement. `--ease-in-out` */
  inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
  /** Sheets / drawers. `--ease-drawer` */
  drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  /** Playful overshoot for confirmations / pops. `--ease-spring` */
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  /** Symmetric, zero velocity at both ends. For values that oscillate. `--ease-sine` */
  sine: "cubic-bezier(0.37, 0, 0.63, 1)",
} as const;

/** Easing curves as cubic-bezier point arrays, for libraries that want tuples (e.g. Framer Motion). */
export const easingPoints = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  drawer: [0.32, 0.72, 0, 1],
  spring: [0.34, 1.56, 0.64, 1],
  sine: [0.37, 0, 0.63, 1],
} as const;

/** Durations in milliseconds. Keys match the `--duration-*` CSS variables. */
export const duration = {
  fast: 160,
  base: 300,
  slow: 450,
} as const;

/**
 * Duration (ms) for the count-up figure. Much longer than the UI micro-interaction durations above so
 * the value visibly climbs from zero to its target and decelerates into place, reading as a real
 * count-up rather than a subtle tick. This is a JS-only (rAF-driven) value, so it has no
 * `--duration-*` counterpart in globals.css.
 */
export const countUpDuration = 1800;

/**
 * The signature's pen (components/ui/signature), one entry per `speed`. `duration` is how long the
 * whole signature takes to write, shared out between its strokes by length so the pen keeps one
 * speed whether the hand is long or short; `lift` is the pause between two strokes while the pen
 * travels to the next. `base` is a person signing without hurry; `fast` is a flourish for a small
 * mark that should not hold up the page; `slow` is for a hero moment where the writing IS the
 * show. Driven from JS (the Web Animations API), so like the count-up it has no `--duration-*`
 * counterpart in globals.css.
 */
export const signatureDraw = {
  fast: { duration: 900, lift: 80 },
  base: { duration: 1600, lift: 140 },
  slow: { duration: 2800, lift: 220 },
} as const;

export type SignatureSpeed = keyof typeof signatureDraw;

/**
 * Build a JS easing function from a cubic-bezier control-point tuple (see {@link easingPoints}), so
 * rAF-driven animation (count-ups, canvas work) can honor the exact same curves as the CSS
 * `--ease-*` tokens instead of inlining a bespoke easing. Given progress `x` in [0, 1] it solves for
 * the bezier parameter `t` with a few Newton-Raphson steps, then returns the eased `y`.
 */
export function cubicBezier([x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 5; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-4) break;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return sampleY(t);
  };
}

/**
 * Whether the viewer has asked the OS to reduce motion. CSS handles this with a media query, but
 * animation that is *driven* from JS (a burst spawned imperatively, a one-shot class re-armed on an
 * event) has to ask before it fires. SSR-safe: returns false when there is no window, so the server
 * render never differs from the first client paint.
 */
export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export type Easing = keyof typeof easing;
export type Duration = keyof typeof duration;
