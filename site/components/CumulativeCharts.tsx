"use client";

import { useEffect, useRef, useState } from "react";
import {
  Chart,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type Plugin,
} from "chart.js";
import type { PlayerSnapshot, ClubCumulative } from "@/lib/players";

Chart.register(
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

const CHART_HEIGHT = 288; // px
const PLAYER_LINE_COLOR = "#34d399"; // emerald-400
const PLAYER_FILL_COLOR = "rgba(52, 211, 153, 0.25)";
const COMPARISON_LINE_COLOR = "#fbbf24"; // amber-400
const AXIS_COLOR = "#e4e4e7"; // zinc-200
const GRID_COLOR = "rgba(255,255,255,0.12)";

const MILESTONE = 3000;
const MILESTONE_LINE_COLOR = "rgba(228, 228, 231, 0.7)"; // zinc-200

type Entry = { season: string; value: number };

function toEntries(dict: Record<string, number> | undefined): Entry[] {
  if (!dict) return [];
  return Object.entries(dict)
    .map(([season, value]) => ({ season, value }))
    .sort((a, b) => Number(a.season) - Number(b.season));
}

// Fractional x-index where the line first reaches `target`, linearly
// interpolated between the two seasons that straddle it, plus the season
// (year) in which it was reached. Undefined if the line never gets there.
function findCrossing(
  entries: Entry[],
  target: number,
): { index: number; season: string } | undefined {
  const i = entries.findIndex((e) => e.value >= target);
  if (i === -1) return undefined;
  if (i === 0) return { index: 0, season: entries[0].season };
  const prev = entries[i - 1].value;
  const curr = entries[i].value;
  return {
    index: i - 1 + (target - prev) / (curr - prev),
    season: entries[i].season,
  };
}

// Draws the 3,000-hit reference line across the plot, and a vertical line
// where the club player's line crosses it. Drawn before the datasets so the
// data lines sit on top.
function milestonePlugin(
  crossing: { index: number; season: string } | undefined,
): Plugin<"line"> {
  return {
    id: "milestoneLines",
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const y = scales.y.getPixelForValue(MILESTONE);

      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.font = "10px sans-serif";

      ctx.strokeStyle = MILESTONE_LINE_COLOR;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.fillStyle = MILESTONE_LINE_COLOR;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(MILESTONE.toLocaleString(), chartArea.left + 4, y - 3);

      if (crossing) {
        const x = scales.x.getPixelForValue(crossing.index);
        ctx.strokeStyle = COMPARISON_LINE_COLOR;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.fillStyle = COMPARISON_LINE_COLOR;
        // keep the label inside the plot when the crossing is near the right edge
        const nearRight = x > chartArea.right - 60;
        ctx.textAlign = nearRight ? "right" : "left";
        ctx.textBaseline = "top";
        ctx.fillText(
          `${crossing.season}`,
          nearRight ? x - 4 : x + 4,
          chartArea.top + 4,
        );
      }

      ctx.restore();
    },
  };
}

// Cumulative career hits, player vs. a 3,000-hit club member. Careers span
// different eras, so both lines are indexed by career season (1st, 2nd, ...)
// rather than calendar year. Styled after
// https://www.chartjs.org/docs/latest/samples/line/styling.html — the player
// line is "filled", the club comparison line is "unfilled".
export function CumulativeCharts({
  snapshot,
  clubPlayers,
  defaultClubKey,
}: {
  snapshot: PlayerSnapshot;
  clubPlayers: ClubCumulative[];
  defaultClubKey?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedKey, setSelectedKey] = useState(
    clubPlayers.some((c) => c.key === defaultClubKey)
      ? defaultClubKey
      : clubPlayers[0]?.key,
  );
  const comparison = clubPlayers.find((c) => c.key === selectedKey);

  const hasPlayerData =
    Object.keys(snapshot.hits_season_cumulative ?? {}).length > 0;

  useEffect(() => {
    const player = toEntries(snapshot.hits_season_cumulative);
    const club = toEntries(comparison?.hits_season_cumulative);
    const seasonCount = Math.max(player.length, club.length);
    if (!canvasRef.current || player.length === 0) return;

    const labels = Array.from({ length: seasonCount }, (_, i) => `${i + 1}`);

    const datasets = [
      {
        label: snapshot.player_fullName,
        data: player.map((e) => e.value),
        years: player.map((e) => e.season),
        borderColor: PLAYER_LINE_COLOR,
        backgroundColor: PLAYER_FILL_COLOR,
        fill: true,
        tension: 0.2,
        pointRadius: 2,
      },
      ...(comparison && club.length > 0
        ? [
            {
              label: comparison.player_fullName,
              data: club.map((e) => e.value),
              years: club.map((e) => e.season),
              borderColor: COMPARISON_LINE_COLOR,
              backgroundColor: COMPARISON_LINE_COLOR,
              fill: false,
              tension: 0.2,
              pointRadius: 2,
            },
          ]
        : []),
    ];

    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: { labels, datasets },
      plugins: [milestonePlugin(findCrossing(club, MILESTONE))],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "start",
            labels: { color: AXIS_COLOR, boxWidth: 16, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              title: (items) => `Career season ${items[0]?.label ?? ""}`,
              label: (item) => {
                const years = (item.dataset as { years?: string[] }).years;
                const year = years?.[item.dataIndex];
                const hits = (item.parsed.y ?? 0).toLocaleString();
                return `${item.dataset.label}: ${hits}${year ? ` (${year})` : ""}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Career season",
              color: AXIS_COLOR,
              font: { size: 10, weight: "bold" },
            },
            ticks: { color: AXIS_COLOR, font: { size: 10 } },
            grid: { color: GRID_COLOR },
          },
          y: {
            beginAtZero: true,
            // headroom above the 3,000 line so it and its label stay visible
            suggestedMax: MILESTONE * 1.1,
            ticks: {
              color: AXIS_COLOR,
              font: { size: 10 },
              callback: (v) => Number(v).toLocaleString(),
            },
            grid: { color: GRID_COLOR },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [snapshot, comparison]);

  if (!hasPlayerData) return null;

  return (
    <section className="w-full max-w-5xl">
      <h2 className="mb-3 text-lg font-semibold text-zinc-200">
        Comparison Charts
      </h2>
      {clubPlayers.length > 0 && (
        <label className="mb-3 flex items-center gap-3 text-sm text-zinc-200">
          <span>Compare with 3,000 hit club member</span>
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="rounded-md bg-emerald-900 px-3 py-1.5 text-sm text-zinc-200 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {clubPlayers.map((c) => (
              <option key={c.key} value={c.key}>
                {c.player_fullName}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="rounded-xl bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-200">
          Career hits by season
        </p>
        <div className="relative" style={{ height: CHART_HEIGHT }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Cumulative career hits by season for ${snapshot.player_fullName}${
              comparison ? ` compared with ${comparison.player_fullName}` : ""
            }`}
          />
        </div>
      </div>
    </section>
  );
}
