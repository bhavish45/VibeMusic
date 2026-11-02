/**
 * Fast client-side image dominant color extractor with fallback.
 * Samples canvas pixels to find the most vibrant / dominant aesthetic color.
 */

export interface DominantColor {
  r: number;
  g: number;
  b: number;
  hex: string;
  topGradient: string;
  midGradient: string;
  cardBg: string;
  cardBorder: string;
  accent: string;
}

// Default sleek dark slate fallback
const DEFAULT_COLOR: DominantColor = {
  r: 30,
  g: 41,
  b: 59,
  hex: "#1e293b",
  topGradient: "rgb(30, 41, 59)",
  midGradient: "rgb(15, 23, 42)",
  cardBg: "rgba(30, 41, 59, 0.65)",
  cardBorder: "rgba(255, 255, 255, 0.15)",
  accent: "#38bdf8",
};

// Generate deterministic vibrant HSL from string if canvas is tainted by CORS
export function hashToColor(str: string): DominantColor {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const sat = 55 + (Math.abs(hash >> 3) % 25); // 55-80%
  const light = 25 + (Math.abs(hash >> 5) % 15); // 25-40%

  // HSL to RGB conversion
  const c = (1 - Math.abs(2 * (light / 100) - 1)) * (sat / 100);
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light / 100 - c / 2;

  let r1 = 0, g1 = 0, b1 = 0;
  if (hue < 60) { r1 = c; g1 = x; }
  else if (hue < 120) { r1 = x; g1 = c; }
  else if (hue < 180) { g1 = c; b1 = x; }
  else if (hue < 240) { g1 = x; b1 = c; }
  else if (hue < 300) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  return buildColorResult(r, g, b);
}

function buildColorResult(r: number, g: number, b: number): DominantColor {
  // Clamp values
  r = Math.max(15, Math.min(235, r));
  g = Math.max(15, Math.min(235, g));
  b = Math.max(15, Math.min(235, b));

  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  
  // Create richer, deep dark 100% solid non-transparent gradient steps
  const topGradient = `rgb(${r}, ${g}, ${b})`;
  const midR = Math.round(r * 0.28);
  const midG = Math.round(g * 0.28);
  const midB = Math.round(b * 0.28);
  const midGradient = `rgb(${midR}, ${midG}, ${midB})`;

  return {
    r,
    g,
    b,
    hex,
    topGradient,
    midGradient,
    cardBg: `rgba(${r}, ${g}, ${b}, 0.35)`,
    cardBorder: `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.3)`,
    accent: `rgb(${Math.min(255, r + 70)}, ${Math.min(255, g + 70)}, ${Math.min(255, b + 70)})`,
  };
}

const colorCache = new Map<string, DominantColor>();

export function getCachedDominantColor(
  imageUrl: string, 
  fallbackKey: string = "",
  trackKey: string = ""
): DominantColor {
  // 1. Check trackKey cache
  if (trackKey && colorCache.has(trackKey)) {
    return colorCache.get(trackKey)!;
  }
  // 2. Check imageUrl cache (ignore generic logo url to avoid theme collisions)
  if (imageUrl && !imageUrl.includes('logo.png') && colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl)!;
  }
  return fallbackKey ? hashToColor(fallbackKey) : DEFAULT_COLOR;
}

export function extractDominantColor(
  imageUrl: string,
  fallbackKey: string = "",
  trackKey: string = ""
): Promise<DominantColor> {
  return new Promise((resolve) => {
    // If generic fallback or empty image, resolve deterministic vibe immediately
    if (!imageUrl || imageUrl.includes('logo.png')) {
      const fallback = fallbackKey ? hashToColor(fallbackKey) : DEFAULT_COLOR;
      if (trackKey) colorCache.set(trackKey, fallback);
      resolve(fallback);
      return;
    }

    if (trackKey && colorCache.has(trackKey)) {
      resolve(colorCache.get(trackKey)!);
      return;
    }

    if (colorCache.has(imageUrl)) {
      resolve(colorCache.get(imageUrl)!);
      return;
    }

    if (typeof window === "undefined") {
      resolve(fallbackKey ? hashToColor(fallbackKey) : DEFAULT_COLOR);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";

    // Fast 600ms timeout for snappy responsiveness
    const timeout = setTimeout(() => {
      const fallback = fallbackKey ? hashToColor(fallbackKey) : DEFAULT_COLOR;
      if (trackKey) colorCache.set(trackKey, fallback);
      colorCache.set(imageUrl, fallback);
      resolve(fallback);
    }, 600);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          const fallback = fallbackKey ? hashToColor(fallbackKey) : DEFAULT_COLOR;
          resolve(fallback);
          return;
        }

        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);

        const imgData = ctx.getImageData(0, 0, 32, 32).data;
        let totalR = 0, totalG = 0, totalB = 0, count = 0;
        let maxSaturation = -1;
        let bestR = 40, bestG = 60, bestB = 90;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const brightness = (r + g + b) / 3;

          // Skip pure black and pure white
          if (brightness < 35 || brightness > 230) continue;

          totalR += r;
          totalG += g;
          totalB += b;
          count++;

          // Calculate approximate saturation
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const sat = max === 0 ? 0 : delta / max;

          if (sat > maxSaturation) {
            maxSaturation = sat;
            bestR = r;
            bestG = g;
            bestB = b;
          }
        }

        let chosenR = bestR;
        let chosenG = bestG;
        let chosenB = bestB;

        if (count > 0 && maxSaturation < 0.25) {
          // If low saturation, use average with slight tone boost
          chosenR = Math.round(totalR / count);
          chosenG = Math.round(totalG / count);
          chosenB = Math.round(totalB / count);
        }

        const result = buildColorResult(chosenR, chosenG, chosenB);
        if (trackKey) colorCache.set(trackKey, result);
        colorCache.set(imageUrl, result);
        resolve(result);
      } catch {
        // Tainted canvas security error (CORS) -> fallback to deterministic color
        const fallback = fallbackKey ? hashToColor(fallbackKey) : DEFAULT_COLOR;
        if (trackKey) colorCache.set(trackKey, fallback);
        colorCache.set(imageUrl, fallback);
        resolve(fallback);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      const fallback = fallbackKey ? hashToColor(fallbackKey) : DEFAULT_COLOR;
      if (trackKey) colorCache.set(trackKey, fallback);
      colorCache.set(imageUrl, fallback);
      resolve(fallback);
    };

    img.src = imageUrl;
  });
}
