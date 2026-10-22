import { readFile, writeFile } from "node:fs/promises";

const variants = [
  ["light", "profile/stats-light.svg", "profile/top-langs-light.svg"],
  ["dark", "profile/stats-dark.svg", "profile/top-langs-dark.svg"],
];
const themeColors = new Set([
  "FAFAF7",
  "0D1117",
  "111111",
  "F5F5F3",
  "C9D1D9",
]);

const grayscale = (hex) => {
  const value = hex.replace("#", "").toUpperCase();

  if (themeColors.has(value)) {
    return hex;
  }

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

  if (saturation < 0.1) {
    return hex;
  }

  const luminance = Math.max(
    48,
    Math.min(210, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)),
  );
  const channel = luminance.toString(16).padStart(2, "0");
  return `#${channel}${channel}${channel}`;
};

const rootSize = (svg) => {
  const match = svg.match(
    /<svg\s+width="([\d.]+)"\s+height="([\d.]+)"\s+viewBox="0 0 ([\d.]+) ([\d.]+)"/,
  );

  if (!match) throw new Error("Could not read SVG root dimensions");
  return { width: match[1], height: match[2], viewBoxWidth: match[3], viewBoxHeight: match[4] };
};

for (const [variant, statsFile, file] of variants) {
  const [svg, statsSvg] = await Promise.all([
    readFile(file, "utf8"),
    readFile(statsFile, "utf8"),
  ]);
  const targetHeight = rootSize(statsSvg).height;
  const normalized = svg.replace(
    /(<svg\s+width="[\d.]+"\s+height=")[\d.]+("\s+viewBox="0 0 [\d.]+ )[\d.]+(")/,
    (_, before, middle, after) => `${before}${targetHeight}${middle}${targetHeight}${after}`,
  );
  const monochrome = normalized.replace(
    /(fill|stroke)="(#[0-9a-fA-F]{6})"/g,
    (_, attribute, color) => `${attribute}="${grayscale(color)}"`,
  );

  if (monochrome !== svg) {
    await writeFile(file, monochrome);
    console.log(`Monochromed ${file} (${variant}, height ${targetHeight})`);
  }
}
