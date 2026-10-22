import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GH_USERNAME;
const token = process.env.STATS_TOKEN || process.env.GITHUB_TOKEN;

if (!username) {
  throw new Error("GH_USERNAME is required");
}

if (!token) {
  throw new Error("STATS_TOKEN or GITHUB_TOKEN is required");
}

const query = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "profile-readme-activity",
  },
  body: JSON.stringify({ query, variables: { login: username } }),
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL request failed: ${response.status}`);
}

const payload = await response.json();

if (payload.errors?.length) {
  throw new Error(payload.errors.map((error) => error.message).join("; "));
}

const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;

if (!calendar?.weeks?.length) {
  throw new Error("Contribution calendar is empty");
}

const CELL = 11;
const GAP = 3;
const LEFT = 30;
const TOP = 26;
const FOOTER = 30;
const weeks = calendar.weeks;
const width = LEFT + weeks.length * (CELL + GAP) - GAP + 1;
const height = TOP + 7 * (CELL + GAP) - GAP + FOOTER;
const maxCount = Math.max(
  1,
  ...weeks.flatMap((week) =>
    week.contributionDays.map((day) => day.contributionCount),
  ),
);

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const level = (count) => {
  if (count <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
};

const render = ({ palette, text, textMuted }) => {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Contribution activity for ${escapeXml(username)}">`,
    `  <g font-family="ui-monospace, Menlo, Consolas, monospace">`,
  ];

  let previousMonth = "";

  weeks.forEach((week, index) => {
    const firstDay = week.contributionDays[0];

    if (firstDay) {
      const month = new Date(`${firstDay.date}T00:00:00Z`).toLocaleString(
        "en-US",
        { month: "short", timeZone: "UTC" },
      );

      if (month !== previousMonth) {
        const x = LEFT + index * (CELL + GAP);
        parts.push(
          `    <text x="${x}" y="16" fill="${textMuted}" font-size="10">${month}</text>`,
        );
        previousMonth = month;
      }
    }

    week.contributionDays.forEach((day, dayIndex) => {
      const x = LEFT + index * (CELL + GAP);
      const y = TOP + dayIndex * (CELL + GAP);
      const color = palette[level(day.contributionCount)];

      parts.push(
        `    <rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${color}"><title>${escapeXml(`${day.date}: ${day.contributionCount} contributions`)}</title></rect>`,
      );
    });
  });

  ["Mon", "Wed", "Fri"].forEach((label, index) => {
    const y = TOP + (index * 2 + 1) * (CELL + GAP) + CELL - 1;
    parts.push(
      `    <text x="0" y="${y}" fill="${textMuted}" font-size="10">${label}</text>`,
    );
  });

  parts.push(
    `    <text x="${LEFT}" y="${height - 8}" fill="${text}" font-size="12">${calendar.totalContributions.toLocaleString("en-US")} contributions in the last year</text>`,
    `  </g>`,
    `</svg>`,
    ``,
  );

  return parts.join("\n");
};

const variants = {
  light: {
    palette: ["#EBEBE8", "#C9C9C4", "#8F8F89", "#4A4A45", "#111111"],
    text: "#111111",
    textMuted: "#6B6B66",
  },
  dark: {
    palette: ["#21262D", "#39414A", "#6E7781", "#AAB4BF", "#F5F5F3"],
    text: "#F5F5F3",
    textMuted: "#8B949E",
  },
};

await mkdir("profile", { recursive: true });

for (const [name, options] of Object.entries(variants)) {
  await writeFile(`profile/activity-${name}.svg`, render(options));
}

console.log(`Generated activity cards for ${username}.`);
