import { readFile, writeFile } from "node:fs/promises";

const files = ["profile/top-langs-light.svg", "profile/top-langs-dark.svg"];
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

for (const file of files) {
  const svg = await readFile(file, "utf8");
  const monochrome = svg.replace(
    /(fill|stroke)="(#[0-9a-fA-F]{6})"/g,
    (_, attribute, color) => `${attribute}="${grayscale(color)}"`,
  );

  if (monochrome !== svg) {
    await writeFile(file, monochrome);
    console.log(`Monochromed ${file}`);
  }
}
