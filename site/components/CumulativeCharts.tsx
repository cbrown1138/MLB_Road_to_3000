"use client";

import { useEffect, useRef, useState } from "react";
import { Chart, type Plugin } from "chart.js";
import type { PlayerSnapshot, ClubCumulative } from "@/lib/players";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  AXIS_COLOR,
  COMPARISON_LINE_COLOR,
  GRID_COLOR,
  LEGEND_FONT,
  PLAYER_FILL_COLOR,
  PLAYER_LINE_COLOR,
  REFERENCE_LINE_COLOR,
  TICK_FONT,
} from "@/lib/chartTheme";

const CHART_HEIGHT = 288; // px

const MILESTONE = 3000;

// Careers span different eras, so lines are lined up either by career season
// (1st, 2nd, ...) or by the player's age that season, never by calendar year.
type XAxis = "season" | "age";

const X_AXIS_OPTIONS: { value: XAxis; label: string }[] = [
  { value: "season", label: "By career season" },
  { value: "age", label: "By age" },
];

const X_AXIS_TITLES: Record<XAxis, string> = {
  season: "Career season",
  age: "Age",
};

// One point per season; x is the career-season number or the age.
type Point = { x: number; season: string; value: number };

function toPoints(
  cumulative: Record<string, number> | undefined,
  ages: Record<string, number> | undefined,
  xAxis: XAxis,
): Point[] {
  if (!cumulative) return [];
  const sorted = Object.entries(cumulative).sort(
    ([a], [b]) => Number(a) - Number(b),
  );
  return sorted.flatMap(([season, value], i) => {
    const x = xAxis === "age" ? ages?.[season] : i + 1;
    return x === undefined ? [] : [{ x, season, value }];
  });
}

// Spread points over one label per x from `minX`, with nulls in seasons a
// player didn't play (or before/after their career).
function alignToLabels<T>(
  points: Point[],
  minX: number,
  labelCount: number,
  pick: (p: Point) => T,
): (T | null)[] {
  const out: (T | null)[] = Array(labelCount).fill(null);
  for (const p of points) out[p.x - minX] = pick(p);
  return out;
}

// Fractional x where the line first reaches `target`, linearly interpolated
// between the two seasons that straddle it, plus the season it was reached in.
// Undefined if the line never gets there.
function findCrossing(
  points: Point[],
  target: number,
): { x: number; point: Point } | undefined {
  const i = points.findIndex((p) => p.value >= target);
  if (i === -1) return undefined;
  if (i === 0) return { x: points[0].x, point: points[0] };
  const prev = points[i - 1];
  const curr = points[i];
  return {
    x: prev.x + ((target - prev.value) / (curr.value - prev.value)) * (curr.x - prev.x),
    point: curr,
  };
}

// Draws the 3,000-hit reference line across the plot, and a vertical line
// where the club player's line crosses it. Drawn before the datasets so the
// data lines sit on top.
function milestonePlugin(
  crossing: { index: number; label: string } | undefined,
): Plugin<"line"> {
  return {
    id: "milestoneLines",
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const y = scales.y.getPixelForValue(MILESTONE);

      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.font = `${TICK_FONT.size}px sans-serif`;

      ctx.strokeStyle = REFERENCE_LINE_COLOR;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.fillStyle = REFERENCE_LINE_COLOR;
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
          crossing.label,
          nearRight ? x - 4 : x + 4,
          chartArea.top + 4,
        );
      }

      ctx.restore();
    },
  };
}

// Cumulative career hits, player vs. a 3,000-hit club member, by career
// season or by age (see XAxis). Styled after
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
  const hasAges = Object.keys(snapshot.age_per_season ?? {}).length > 0;
  const [xAxis, setXAxis] = useState<XAxis>("season");

  const hasPlayerData =
    Object.keys(snapshot.hits_season_cumulative ?? {}).length > 0;

  useEffect(() => {
    const player = toPoints(snapshot.hits_season_cumulative, snapshot.age_per_season, xAxis);
    const club = toPoints(comparison?.hits_season_cumulative, comparison?.age_per_season, xAxis);
    if (!canvasRef.current || player.length === 0) return;

    const xs = [...player, ...club].map((p) => p.x);
    const minX = Math.min(...xs);
    const labelCount = Math.max(...xs) - minX + 1;
    const labels = Array.from({ length: labelCount }, (_, i) => `${minX + i}`);
    const align = <T,>(points: Point[], pick: (p: Point) => T) =>
      alignToLabels(points, minX, labelCount, pick);

    const crossing = findCrossing(club, MILESTONE);

    const datasets = [
      {
        label: snapshot.full_name,
        data: align(player, (p) => p.value),
        years: align(player, (p) => p.season),
        borderColor: PLAYER_LINE_COLOR,
        backgroundColor: PLAYER_FILL_COLOR,
        fill: true,
        tension: 0.2,
        pointRadius: 2,
      },
      ...(comparison && club.length > 0
        ? [
            {
              label: comparison.full_name,
              data: align(club, (p) => p.value),
              years: align(club, (p) => p.season),
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
      plugins: [
        milestonePlugin(
          crossing && {
            index: crossing.x - minX,
            label:
              xAxis === "age"
                ? `Age ${crossing.point.x} (${crossing.point.season})`
                : crossing.point.season,
          },
        ),
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        // bridge seasons a player missed rather than breaking the line
        spanGaps: true,
        plugins: {
          legend: {
            position: "top",
            align: "start",
            labels: { color: AXIS_COLOR, boxWidth: 16, font: LEGEND_FONT },
          },
          tooltip: {
            callbacks: {
              title: (items) => `${X_AXIS_TITLES[xAxis]} ${items[0]?.label ?? ""}`,
              label: (item) => {
                const years = (item.dataset as { years?: (string | null)[] }).years;
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
              text: X_AXIS_TITLES[xAxis],
              color: AXIS_COLOR,
              font: { ...TICK_FONT, weight: "bold" },
            },
            ticks: { color: AXIS_COLOR, font: TICK_FONT },
            grid: { color: GRID_COLOR },
          },
          y: {
            beginAtZero: true,
            // headroom above the 3,000 line so it and its label stay visible
            suggestedMax: MILESTONE * 1.1,
            ticks: {
              color: AXIS_COLOR,
              font: TICK_FONT,
              callback: (v) => Number(v).toLocaleString(),
            },
            grid: { color: GRID_COLOR },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [snapshot, comparison, xAxis]);

  if (!hasPlayerData) return null;

  return (
    <section className="w-full max-w-5xl">
      <h2 className="mb-3 text-lg font-semibold text-zinc-200">
        Comparison Charts
      </h2>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {clubPlayers.length > 0 && (
          <label className="flex items-center gap-3 text-sm text-zinc-200">
            <span>Compare with 3,000 hit club member</span>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="rounded-md bg-emerald-900 px-3 py-1.5 text-sm text-zinc-200 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {clubPlayers.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasAges && (
          <SegmentedControl
            label="Line up careers"
            options={X_AXIS_OPTIONS}
            value={xAxis}
            onChange={setXAxis}
          />
        )}
      </div>
      <div className="rounded-xl bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-200">
          Cumulative hits by {xAxis === "age" ? "age" : "career season"}
        </p>
        <div className="relative" style={{ height: CHART_HEIGHT }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Cumulative career hits by ${X_AXIS_TITLES[xAxis].toLowerCase()} for ${snapshot.full_name}${
              comparison ? ` compared with ${comparison.full_name}` : ""
            }`}
          />
        </div>
      </div>
    </section>
  );
}
