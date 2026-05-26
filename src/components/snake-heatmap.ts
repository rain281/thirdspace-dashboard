import { cellsToGrid } from "../snk/cellsToGrid";
import { getBestRoute } from "../snk/solver-getBestRoute";
import { createSvg } from "../snk/svg-index";
import { snake4 } from "../snk/fixtures-snake";
import type { SnakeCell } from "../data/worklog-parser";

const MOONLIT_DRAW_OPTIONS = {
  colorDots: { 1: "#C4A882", 2: "#A8845A", 3: "#B5392A", 4: "#8B1A0A" } as Record<1|2|3|4, string>,
  colorEmpty: "#E4D8C8",
  colorDotBorder: "transparent",
  colorSnake: "#B5392A",
  sizeCell: 14,
  sizeDot: 10,
  sizeDotBorderRadius: 2,
};

const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LBLS = ["Mon","","Wed","","Fri","","Sun"];

function getStartDate(): Date {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(today); d.setDate(today.getDate() - 364);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 1 ? 0 : dow === 0 ? 6 : dow - 1));
  return d;
}

function addDateLabels(svgEl: SVGElement): void {
  const sz = MOONLIT_DRAW_OPTIONS.sizeCell;
  const ns = "http://www.w3.org/2000/svg";
  const fill = "#8A7968", font = '"JetBrains Mono","Fira Code",monospace';

  const vbStr = svgEl.getAttribute("viewBox") || "-14 -28 770 168";
  const vb = vbStr.split(/\s+/).map(Number) as [number,number,number,number];
  const EL = 30, EB = 18;
  svgEl.setAttribute("viewBox", `${vb[0]-EL} ${vb[1]} ${vb[2]+EL} ${vb[3]+EB}`);
  svgEl.setAttribute("height", String(parseInt(svgEl.getAttribute("height")||"168") + EB));

  // Day labels
  for (let d = 0; d < 7; d++) {
    if (!DAY_LBLS[d]) continue;
    const t = document.createElementNS(ns, "text") as SVGTextElement;
    t.setAttribute("x", String(vb[0] - 4));
    t.setAttribute("y", String(d * sz + sz/2 + 3));
    t.setAttribute("text-anchor","end"); t.setAttribute("dominant-baseline","middle");
    t.setAttribute("font-size","9"); t.setAttribute("fill",fill); t.setAttribute("font-family",font);
    t.textContent = DAY_LBLS[d]; svgEl.appendChild(t);
  }

  // Month labels
  const startDate = getStartDate();
  let lastMonth = -1;
  for (let w = 0; w < 53; w++) {
    const date = new Date(startDate); date.setDate(startDate.getDate() + w * 7);
    const month = date.getMonth();
    if (month !== lastMonth) {
      const t = document.createElementNS(ns, "text") as SVGTextElement;
      t.setAttribute("x", String(w * sz + 1));
      t.setAttribute("y", String(7 * sz + 12));
      t.setAttribute("text-anchor","start"); t.setAttribute("font-size","9");
      t.setAttribute("fill",fill); t.setAttribute("font-family",font);
      t.textContent = MONTHS[month]; svgEl.appendChild(t);
      lastMonth = month;
    }
  }
}

/**
 * Render the snake heatmap and return the resulting HTML string for caching.
 * On subsequent renders the caller can re-inject the cached string directly,
 * skipping the expensive getBestRoute() computation.
 */
export async function renderSnakeHeatmap(
  container: HTMLElement,
  cells: SnakeCell[],
  cachedHtml?: string,   // pass cached HTML to skip recompute
): Promise<string | null> {
  container.empty();

  if (cells.length === 0) {
    container.createDiv({ cls: "ts-snake-empty", text: "No activity data found" });
    return null;
  }

  // If we have cached HTML, inject it directly (animation will restart via CSS)
  if (cachedHtml) {
    const wrapper = container.createDiv({ cls: "ts-snake-wrapper" });
    wrapper.innerHTML = cachedHtml;
    const svgEl = wrapper.querySelector("svg") as SVGElement | null;
    if (svgEl) { svgEl.setAttribute("width","100%"); svgEl.style.maxWidth = "100%"; }
    return cachedHtml;
  }

  const loading = container.createDiv({ cls: "ts-snake-loading", text: "Computing snake path…" });
  try {
    const grid  = cellsToGrid(cells);
    const chain = getBestRoute(grid, snake4);
    const svg   = createSvg(grid, null, chain, MOONLIT_DRAW_OPTIONS, { stepDurationMs: 80 });

    loading.remove();
    const wrapper = container.createDiv({ cls: "ts-snake-wrapper" });
    wrapper.innerHTML = svg;
    const svgEl = wrapper.querySelector("svg") as SVGElement | null;
    if (svgEl) {
      addDateLabels(svgEl);
      svgEl.setAttribute("width","100%"); svgEl.style.maxWidth = "100%";
    }
    return wrapper.innerHTML;
  } catch (err) {
    loading.remove();
    container.createDiv({ cls: "ts-snake-error", text: `Snake failed: ${err}` });
    return null;
  }
}
