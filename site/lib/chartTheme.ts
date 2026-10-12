// Shared Chart.js setup and palette for the player-page charts, so the season
// and cumulative charts read as one system. Charts sit on bg-emerald-900 cards.
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
  type ChartType,
  type Plugin,
} from "chart.js";

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

export const CARD_BG_COLOR = "#064e3b"; // emerald-900, matches the card behind the canvas

export const PLAYER_LINE_COLOR = "#34d399"; // emerald-400
export const PLAYER_FILL_COLOR = "rgba(52, 211, 153, 0.25)";
export const COMPARISON_LINE_COLOR = "#fbbf24"; // amber-400
export const LEAGUE_AVG_COLOR = "#38bdf8"; // sky-400
export const LEAGUE_MAX_COLOR = "#fbbf24"; // amber-400
export const LEAGUE_BAND_COLOR = "rgba(251, 191, 36, 0.12)"; // amber-400 @ 12%
export const REFERENCE_LINE_COLOR = "rgba(228, 228, 231, 0.7)"; // zinc-200

export const AXIS_COLOR = "#e4e4e7"; // zinc-200
export const GRID_COLOR = "rgba(255, 255, 255, 0.08)";

export const TICK_FONT = { size: 11 };
export const LEGEND_FONT = { size: 12 };

// A labelled horizontal line at a fixed y value (e.g. a 162-game season).
// Enable per chart with `plugins: [refLinePlugin]` and set the line through
// `options.plugins.refLine`; `false` turns it off.
export type RefLineOptions = { value: number; label: string };

declare module "chart.js" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    refLine?: RefLineOptions | false;
  }
}

export const refLinePlugin: Plugin<"line", RefLineOptions> = {
  id: "refLine",
  // Drawn before the datasets so the data lines sit on top.
  beforeDatasetsDraw(chart, _args, opts) {
    if (opts?.value == null) return;
    const { ctx, chartArea, scales } = chart;
    const y = scales.y.getPixelForValue(opts.value);

    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = REFERENCE_LINE_COLOR;
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();

    ctx.fillStyle = REFERENCE_LINE_COLOR;
    ctx.font = `${TICK_FONT.size}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(opts.label, chartArea.right - 4, y - 3);
    ctx.restore();
  },
};
