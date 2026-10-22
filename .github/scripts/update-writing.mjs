import { readFile, writeFile } from "node:fs/promises";

const FEED_URL = "https://www.cnblogs.com/guangzan/rss";
const README_PATH = new URL("../../README.md", import.meta.url);
const MAX_POSTS = 5;
const START_MARKER = "<!-- WRITING:START -->";
const END_MARKER = "<!-- WRITING:END -->";

const decodeXml = (value) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const pick = (source, pattern) => source.match(pattern)?.[1]?.trim() ?? "";

const response = await fetch(FEED_URL, {
  headers: { "user-agent": "guangzan/profile-readme writing sync" },
});

if (!response.ok) {
  throw new Error(`Failed to fetch RSS feed: ${response.status}`);
}

const xml = await response.text();
const authorName = decodeXml(pick(xml, /<author>\s*<name>([\s\S]*?)<\/name>/));

const posts = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
  .map((match) => {
    const entry = match[1];
    const title = decodeXml(pick(entry, /<title[^>]*>([\s\S]*?)<\/title>/));
    const url = decodeXml(
      pick(entry, /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/),
    );
    const published = pick(entry, /<published>([\s\S]*?)<\/published>/);
    const date = published.slice(0, 10);
    const cleanTitle = authorName
      ? title.replace(new RegExp(`\\s+-\\s+${authorName}\\s*$`), "")
      : title;

    return { title: cleanTitle.trim(), url, date };
  })
  .filter(
    (post) =>
      post.title &&
      post.url.startsWith("https://www.cnblogs.com/guangzan/p/") &&
      /^\d{4}-\d{2}-\d{2}$/.test(post.date),
  )
  .slice(0, MAX_POSTS);

if (posts.length === 0) {
  throw new Error("RSS feed returned no usable posts; README left untouched.");
}

const block = [
  START_MARKER,
  ...posts.map(
    ({ date, title, url }) => `- **${date}** · [${title}](${url})`,
  ),
  END_MARKER,
].join("\n");

const readme = await readFile(README_PATH, "utf8");
const start = readme.indexOf(START_MARKER);
const end = readme.indexOf(END_MARKER);

if (start === -1 || end === -1 || end < start) {
  throw new Error("Writing markers are missing from README.md");
}

const updated = `${readme.slice(0, start)}${block}${readme.slice(
  end + END_MARKER.length,
)}`;

if (updated === readme) {
  console.log("Writing section is already up to date.");
} else {
  await writeFile(README_PATH, updated);
  console.log(`Updated writing section with ${posts.length} posts.`);
}
