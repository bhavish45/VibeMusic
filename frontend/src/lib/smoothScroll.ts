/**
 * High-FPS (60fps/120fps/144fps) Hardware-Accelerated Smooth Scroll Engine.
 * Uses quintic ease-out interpolation synchronized to requestAnimationFrame.
 * Eliminates native browser scrollTo({ behavior: 'smooth' }) micro-stutter,
 * frame drops, and layout thrashing when synchronizing lyrics line-by-line.
 */
export function smoothScrollTo(
  container: HTMLElement | null,
  targetTop: number,
  durationMs = 420
): void {
  if (!container) return;

  const startTop = container.scrollTop;
  const distance = targetTop - startTop;

  // Snap directly if already at target
  if (Math.abs(distance) <= 1) {
    container.scrollTop = targetTop;
    return;
  }

  // Cancel any running animation on this container for instantaneous redirection
  if ((container as any)._scrollRafId) {
    cancelAnimationFrame((container as any)._scrollRafId);
    (container as any)._scrollRafId = null;
  }

  const startTime = performance.now();

  function step(currentTime: number) {
    if (!container) return;
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / durationMs);

    // Quintic ease-out: 1 - Math.pow(1 - progress, 4)
    // Instantaneous responsive start with silky-smooth deceleration curve
    const ease = 1 - Math.pow(1 - progress, 4);
    container.scrollTop = startTop + distance * ease;

    if (progress < 1) {
      (container as any)._scrollRafId = requestAnimationFrame(step);
    } else {
      container.scrollTop = targetTop;
      (container as any)._scrollRafId = null;
    }
  }

  (container as any)._scrollRafId = requestAnimationFrame(step);
}

/**
 * Immediately cancel any active programmatic scroll animation on this container
 * (e.g. when the user manually touches or scrolls with a wheel/mouse).
 */
export function cancelSmoothScroll(container: HTMLElement | null): void {
  if (container && (container as any)._scrollRafId) {
    cancelAnimationFrame((container as any)._scrollRafId);
    (container as any)._scrollRafId = null;
  }
}

/**
 * Attaches a silky, butter-smooth kinetic momentum wheel listener to any scrollable container.
 * Eliminates Windows discrete 100px wheel notches for fluid 60fps/120fps/144fps gliding.
 * Uses hardware-synchronized requestAnimationFrame and lerp damping.
 */
export function attachSmoothWheel(container: HTMLElement | null): () => void {
  if (!container) return () => {};

  let targetScrollTop = container.scrollTop;
  let isAnimating = false;
  let rafId: number | null = null;

  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaY) < 0.5) return;

    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return;

    // Resynchronize if idle or user moved scrollbar thumb
    if (!isAnimating) {
      targetScrollTop = container.scrollTop;
    }

    e.preventDefault();

    // Standardize delta across wheel mice, trackpads, and line/page modes
    let delta = e.deltaY;
    if (e.deltaMode === 1) {
      // DOM_DELTA_LINE (~32px per line)
      delta *= 32;
    } else if (e.deltaMode === 2) {
      // DOM_DELTA_PAGE
      delta *= container.clientHeight;
    }

    targetScrollTop = Math.max(0, Math.min(maxScroll, targetScrollTop + delta));

    if (!isAnimating) {
      isAnimating = true;
      const step = () => {
        if (!container) {
          isAnimating = false;
          rafId = null;
          return;
        }

        const current = container.scrollTop;
        const diff = targetScrollTop - current;

        if (Math.abs(diff) < 0.5) {
          container.scrollTop = targetScrollTop;
          isAnimating = false;
          rafId = null;
          return;
        }

        // Snappy lerp factor 0.22 for responsive, fluid 60-144fps gliding without floatiness
        container.scrollTop = current + diff * 0.22;
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    }
  };

  const onScroll = () => {
    if (!isAnimating && container) {
      targetScrollTop = container.scrollTop;
    }
  };

  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    container.removeEventListener('wheel', onWheel);
    container.removeEventListener('scroll', onScroll);
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
