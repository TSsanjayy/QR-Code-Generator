function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");

  const value =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  const num = parseInt(value, 16);

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);

  const values = [r, g, b].map((value) => {
    const channel = value / 255;

    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow(
          (channel + 0.055) / 1.055,
          2.4
        );
  });

  return (
    0.2126 * values[0] +
    0.7152 * values[1] +
    0.0722 * values[2]
  );
}

export function contrastRatio(
  foreground: string,
  background: string
) {
  const fg = luminance(foreground);
  const bg = luminance(background);

  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);

  return (lighter + 0.05) / (darker + 0.05);
}

export function isForegroundLighter(
  foreground: string,
  background: string
) {
  return luminance(foreground) > luminance(background);
}