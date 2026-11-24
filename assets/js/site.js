// Rahil Vasa — footage of the work, drawn live.
(() => {
  document.documentElement.classList.add("js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // One accent. Navy marks only the thing that is happening right now.
  const C = {
    bg: "#f3eee4", ink: "#1b1a18", dim: "#5a554d", faint: "#7b756b", line: "#a49d90",
    hair: "#d6cebf", fill: "#e9e2d4", red: "#1f3a5f", hot: "#dbe2ea", block: "#c9c1b2",
  };
  // Colours live in CSS custom properties; the films read them so a theme change reaches the canvas.
  {
    const cs = getComputedStyle(document.documentElement);
    const map = { bg: "--frame", ink: "--bone", dim: "--dim", faint: "--faint", line: "--line", hair: "--hair", fill: "--panel", red: "--accent", hot: "--hot", block: "--block" };
    for (const k in map) { const v = cs.getPropertyValue(map[k]).trim(); if (v) C[k] = v; }
  }
  const SANS = '"Schibsted Grotesk", system-ui, sans-serif';
  const MONO = '"Fragment Mono", ui-monospace, Menlo, monospace';

  // ---------- drawing helpers ----------
  function fit(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  // Font size that scales with the frame but never drops below legible.
  const fs = (w, base) => Math.round(clamp(base * (w / 900), 11, base * 1.15));

  function font(ctx, o) {
    ctx.font = `${o.weight || (o.mono ? 400 : 500)} ${o.size || 12}px ${o.mono ? MONO : SANS}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = o.mono ? "0.08em" : "0px";
  }
  function text(ctx, s, x, y, o = {}) {
    font(ctx, o);
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.base || "alphabetic";
    ctx.fillText(o.mono && o.upper !== false ? s.toUpperCase() : s, x, y);
  }
  function measure(ctx, s, o = {}) { font(ctx, o); return ctx.measureText(o.mono && o.upper !== false ? s.toUpperCase() : s).width; }

  // Registration marks around a box: the "this one" signal.
  function marks(ctx, x, y, w, h, color = C.red, off = 4, len = 9, lw = 1.5) {
    const L = Math.min(len, w * 0.3, h * 0.3);
    const x0 = x - off, y0 = y - off, x1 = x + w + off, y1 = y + h + off;
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
    ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
    ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
    ctx.moveTo(x1, y1 - L); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L, y1);
    ctx.moveTo(x0 + L, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - L);
    ctx.stroke();
  }
  // Square-cornered hairline frame. kind: solid | dashed | ticks (corner marks only).
  function frame(ctx, x, y, w, h, o = {}) {
    const X = Math.round(x) + 0.5, Y = Math.round(y) + 0.5, W = Math.round(w), H = Math.round(h);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(X - 0.5, Y - 0.5, W + 1, H + 1); }
    const kind = o.kind || "solid";
    if (kind === "ticks") marks(ctx, X, Y, W, H, o.color || C.line, 0, 14, 1);
    else {
      ctx.strokeStyle = o.color || C.line; ctx.lineWidth = 1;
      if (kind === "dashed") ctx.setLineDash([3, 4]);
      ctx.strokeRect(X, Y, W, H);
      ctx.setLineDash([]);
    }
    if (o.active) marks(ctx, X, Y, W, H);
  }
  function line(ctx, pts, color, lw = 1, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Hairline arrow with an open chevron head.
  function arrow(ctx, x1, y1, x2, y2, color, lw = 1, head = 6) {
    line(ctx, [[x1, y1], [x2, y2]], color, lw);
    const a = Math.atan2(y2 - y1, x2 - x1);
    line(ctx, [[x2 - head * Math.cos(a - 0.5), y2 - head * Math.sin(a - 0.5)], [x2, y2], [x2 - head * Math.cos(a + 0.5), y2 - head * Math.sin(a + 0.5)]], color, lw);
  }
  // A packet in flight: a small square.
  function pkt(ctx, x, y, s, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); }
  // A mono tag on a solid ground, for labels over busy art.
  function tag(ctx, s, x, y, o = {}) {
    const size = o.size || 11, tw = measure(ctx, s, { mono: true, size });
    const bx = o.align === "right" ? x - tw - 12 : x;
    ctx.fillStyle = C.bg; ctx.fillRect(bx, y, tw + 12, size + 10);
    text(ctx, s, bx + 6, y + size + 4, { mono: true, size, color: o.color || C.ink });
  }

  // Point at fraction q along a polyline.
  function along(pts, q) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
    let d = clamp(q, 0, 1) * total;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) { const u = seg[i] ? d / seg[i] : 0; return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]; }
      d -= seg[i];
    }
    return pts[pts.length - 1];
  }

  // Shared clock for films that play in fixed-length steps.
  function phases(P, n) {
    const c = { t: 0, P, n };
    c.ph = () => Math.floor((c.t % (P * n)) / P);
    c.pp = () => (c.t % P) / P;
    c.seek = (k) => { c.t = k * P; };
    return c;
  }

  const films = {
    // ---------- Conway's Game of Life (title, CUDA reel, threads reel) ----------
    life(canvas, opts = {}) {
      let grid, cols, rows, cell, gen = 0, rand = rng(7), lastW = 0;
      const mode = opts.mode || "";
      const G = 45, N = mode ? 3 : 0;
      let t = 0;
      function seed(w, h) {
        cell = w < 500 ? 7 : 9;
        cols = Math.ceil(w / cell); rows = Math.ceil(h / cell);
        grid = new Uint8Array(cols * rows);
        for (let i = 0; i < grid.length; i++) grid[i] = rand() < 0.22 ? 1 : 0;
        gen = 0; lastW = w;
      }
      function evolve() {
        const next = new Uint8Array(grid.length);
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (dx || dy) n += grid[((y + dy + rows) % rows) * cols + ((x + dx + cols) % cols)];
          }
          const i = y * cols + x;
          next[i] = n === 3 || (n === 2 && grid[i]) ? 1 : 0;
        }
        grid = next; gen++;
        if (gen > 420) seed(lastW, rows * cell);
      }
      const step = () => (N ? Math.floor((t % (G * N)) / G) : -1);
      const BANDS = 4, MEM = ["normal", "pinned", "managed"];
      return {
        tick: 110, still: N ? G + 20 : 30, steps: N,
        step, seek(k) { t = k * G; },
        subtitle: () => "Each cell lives or dies by counting its eight neighbors, one generation at a time.",
        draw() {
          const { ctx, w, h } = fit(canvas);
          if (!grid || Math.abs(w - lastW) > 40) seed(w, h);
          const k = step(), u = N ? (t % G) / G : 0;
          const reveal = mode === "cuda" && k === 0 ? cols * ease(u * 1.6) : cols;
          for (let y = 0; y < rows; y++) for (let x = 0; x < reveal; x++) {
            if (!grid[y * cols + x]) continue;
            if (mode === "threads" && k >= 1) ctx.fillStyle = Math.floor((x / cols) * BANDS) % 2 ? C.dim : C.ink;
            else ctx.fillStyle = (x * 31 + y * 17) % 7 === 0 ? C.ink : C.line;
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          }
          const f = 11;
          if (mode === "threads") {
            for (let b = 1; b < BANDS; b++) {
              const x = Math.round((b / BANDS) * w) + 0.5;
              const len = k === 0 ? h * ease(u * 2) : h;
              line(ctx, [[x, 0], [x, len]], k === 0 ? C.red : C.ink, k === 0 ? 1.5 : 1);
            }
            if (k >= 0) for (let b = 0; b < BANDS; b++) tag(ctx, "thread " + (b + 1), (b / BANDS) * w + 6, 6, { size: f, color: k === 1 ? C.ink : C.dim });
            if (k === 2) tag(ctx, `gen ${Math.min(100, Math.round(u * 110))} / 100 · seq / thrd / omp`, 6, h - f - 16, { size: f, color: C.red });
          } else if (mode === "cuda") {
            const mem = MEM[Math.floor(t / (G * N)) % 3];
            if (k === 0) {
              const x = Math.round(reveal * cell) + 0.5;
              line(ctx, [[x, 0], [x, h]], C.red, 1.5);
              tag(ctx, `host → gpu · ${mem} memory`, 6, 6, { size: f, color: C.red });
            } else if (k === 1) {
              const bs = cell * 16;
              for (let x = bs; x < w; x += bs) line(ctx, [[Math.round(x) + 0.5, 0], [Math.round(x) + 0.5, h]], C.hair);
              for (let y = bs; y < h; y += bs) line(ctx, [[0, Math.round(y) + 0.5], [w, Math.round(y) + 0.5]], C.hair);
              tag(ctx, "kernel · 32 threads per block", 6, 6, { size: f, color: C.red });
            } else {
              tag(ctx, `${mem} · gen ${Math.min(100, Math.round(u * 110))} / 100 timed`, 6, 6, { size: f, color: C.red });
            }
          }
          evolve(); t++;
        },
      };
    },
    cuda(canvas) { return films.life(canvas, { mode: "cuda" }); },
    threads(canvas) { return films.life(canvas, { mode: "threads" }); },

    // ---------- FSM: each circle is a state; answers pick the branch ----------
    fsm(canvas) {
      const STAGES = [
        { name: "Intent", q: "What do you need?", opts: ["Portfolio analysis"] },
        { name: "Account", q: "Which account?", opts: ["Taxable", "Retirement", "Trust"] },
        { name: "Horizon", q: "Over what time horizon?", opts: ["Under 3 yrs", "3–7 yrs", "7+ yrs"] },
        { name: "Risk", q: "What risk tolerance?", opts: ["Conservative", "Moderate", "Aggressive"] },
        { name: "Output", q: "", opts: ["Report"] },
      ];
      // Each loop answers differently, so a different route lights up.
      const RUNS = [[0, 0, 1, 1, 0], [0, 1, 2, 2, 0], [0, 2, 0, 0, 0]];
      const STEP = 150, HOLD = 110, N = STAGES.length, CYCLE = N * STEP + HOLD;
      let t = 0;
      const where = () => {
        const c = t % CYCLE, run = RUNS[Math.floor(t / CYCLE) % RUNS.length];
        if (c >= N * STEP) return { i: N - 1, p: 1, done: true, run };
        return { i: Math.floor(c / STEP), p: (c % STEP) / STEP, done: false, run };
      };
      return {
        tick: 33, still: 3 * STEP + 120, steps: N,
        step: () => where().i,
        seek(k) { t = Math.floor(t / CYCLE) * CYCLE + k * STEP + 1; },
        draw() {
          const { ctx, w, h } = fit(canvas);
          const { i, p, done, run } = where();
          const f = fs(w, 15), m = clamp(w * 0.03, 12, 32), narrow = w < 560;

          // Wide: clock and the question sit in a left column so the graph gets the full height.
          const side = !narrow, sw = side ? clamp(w * 0.24, 180, 270) : 0;
          // clock
          const cr = side ? clamp(h * 0.07, 16, 26) : clamp(h * 0.065, 14, 28);
          const cx = side ? m + cr : w - m - cr, cy = m + cr;
          ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
          for (let k = 0; k < N; k++) {
            const a = -Math.PI / 2 + (k / N) * Math.PI * 2;
            line(ctx, [[cx + Math.cos(a) * (cr - 6), cy + Math.sin(a) * (cr - 6)], [cx + Math.cos(a) * cr, cy + Math.sin(a) * cr]], k <= i ? C.ink : C.line, 1.5);
          }
          const ha = -Math.PI / 2 + ((i + (done ? 1 : p)) / N) * Math.PI * 2;
          line(ctx, [[cx, cy], [cx + Math.cos(ha) * (cr - 8), cy + Math.sin(ha) * (cr - 8)]], C.red, 1.5);
          if (side) text(ctx, `clock tick ${done ? N : i + 1} / ${N}`, cx + cr + 12, cy + 4, { mono: true, size: 11, color: C.dim });

          // question card: top left (narrow) or under the clock (wide), labels above values
          const cw = side ? sw : w - 3 * m - 2 * cr, ch = side ? 104 : 50;
          const cardY = side ? cy + cr + 22 : m;
          frame(ctx, m, cardY, cw, ch, { kind: "ticks", fill: C.fill });
          const lx = m + 12, fq = side ? clamp(f, 13, 16) : 12;
          const L1 = side ? cardY + 22 : m + 20, V1 = side ? [lx, cardY + 42] : [lx + 40, m + 20];
          const L2 = side ? cardY + 68 : m + 39, V2 = side ? [lx, cardY + 88] : [lx + 40, m + 39];
          // Timeline of one step: ask from the current state, take the answer,
          // show the possible branches, then the transition fires along the chosen one.
          const last = i === N - 1;
          const candAt = last ? 0.2 : 0.5, fireAt = last ? 0.3 : 0.62;
          const arrived = done || p >= 0.96;
          const cur = arrived ? i : i - 1; // column of the state the machine is in
          if (done) {
            text(ctx, "output", lx, L1, { mono: true, size: 10, color: C.red });
            text(ctx, "One report for this route", V1[0], V1[1], { size: fq });
            text(ctx, "same answers, same route", lx, L2, { mono: true, size: 10, color: C.dim });
          } else if (last) {
            text(ctx, "state", lx, L1, { mono: true, size: 10, color: C.dim });
            text(ctx, "Every question answered", V1[0], V1[1], { size: fq });
            text(ctx, "next", lx, L2, { mono: true, size: 10, color: C.red });
            text(ctx, p >= fireAt ? "Generating the report" : "", V2[0], V2[1], { size: fq, color: C.dim });
          } else {
            const S = STAGES[i], ans = S.opts[run[i]];
            const qn = Math.floor(S.q.length * clamp(p / 0.22, 0, 1));
            const an = Math.floor(ans.length * clamp((p - 0.28) / 0.2, 0, 1));
            text(ctx, "asks", lx, L1, { mono: true, size: 10, color: C.red });
            text(ctx, S.q.slice(0, qn), V1[0], V1[1], { size: fq });
            text(ctx, "user", lx, L2, { mono: true, size: 10, color: C.dim });
            text(ctx, ans.slice(0, an), V2[0], V2[1], { size: fq, color: C.dim });
          }

          // graph
          const gTop = side ? m + 14 : m + ch + 26, gBot = h - m - (side ? 10 : 6);
          const gx0 = side ? m + sw + 72 : m + 30, gx1 = w - m - 30;
          const colX = STAGES.map((_, k) => gx0 + (k * (gx1 - gx0)) / (N - 1));
          const rowGap = (gBot - gTop - 18) / 3;
          const r = clamp(Math.min(rowGap * 0.28, (colX[1] - colX[0]) * 0.16), 9, 26);
          const midY = gTop + 18 + rowGap * 1.5;
          const nodeY = (k, o) => (STAGES[k].opts.length === 1 ? midY : gTop + 18 + rowGap * (o + 0.5));
          STAGES.forEach((S, k) => text(ctx, S.name, colX[k], gTop, { mono: true, size: 10, align: "center", color: k === i && !done ? C.red : C.faint }));

          const chosen = (k, o) => run[k] === o;
          const deciding = !arrived && p >= candAt; // branches of column i are on show
          const seg = (k, a, b) => {
            const x1 = colX[k], y1 = nodeY(k, a), x2 = colX[k + 1], y2 = nodeY(k + 1, b);
            const ang = Math.atan2(y2 - y1, x2 - x1);
            return [x1 + Math.cos(ang) * (r + 3), y1 + Math.sin(ang) * (r + 3), x2 - Math.cos(ang) * (r + 4), y2 - Math.sin(ang) * (r + 4)];
          };
          // route already travelled, with the branches not taken left faint
          for (let k = 0; k < cur; k++) {
            const a = run[k];
            STAGES[k + 1].opts.forEach((_, b) => {
              const [sx, sy, ex, ey] = seg(k, a, b);
              if (chosen(k + 1, b)) arrow(ctx, sx, sy, ex, ey, C.ink, 1.5, 6);
              else line(ctx, [[sx, sy], [ex, ey]], C.hair, 1, [2, 4]);
            });
          }
          // the transition being decided right now
          if (deciding && i > 0) {
            const a = run[i - 1];
            STAGES[i].opts.forEach((_, b) => {
              const [sx, sy, ex, ey] = seg(i - 1, a, b);
              if (chosen(i, b)) {
                arrow(ctx, sx, sy, ex, ey, C.dim, 1, 6);
                if (p >= fireAt) { const q = ease((p - fireAt) / (0.96 - fireAt)); pkt(ctx, lerp(sx, ex, q), lerp(sy, ey, q), 6, C.red); }
              } else line(ctx, [[sx, sy], [ex, ey]], C.line, 1, [2, 4]);
            });
          }
          // start arrow into the initial state
          const s0 = colX[0] - r - 30, s1 = colX[0] - r - 4;
          arrow(ctx, s0, midY, s1, midY, i === 0 && deciding ? C.ink : C.dim, 1, 5);
          if (i === 0 && deciding && p >= fireAt) pkt(ctx, lerp(s0, s1, ease((p - fireAt) / (0.96 - fireAt))), midY, 6, C.red);

          // states
          STAGES.forEach((S, k) => S.opts.forEach((label, o) => {
            const x = colX[k], y = nodeY(k, o);
            const onRoute = chosen(k, o);
            const active = onRoute && k === cur;
            const visited = onRoute && k < cur;
            const candidate = deciding && k === i;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = active || visited ? C.fill : C.bg; ctx.fill();
            ctx.strokeStyle = active || visited || (candidate && onRoute) ? C.ink : candidate ? C.dim : C.line;
            ctx.lineWidth = active ? 1.5 : 1; ctx.stroke();
            if (k === N - 1) { ctx.beginPath(); ctx.arc(x, y, r - 4, 0, Math.PI * 2); ctx.stroke(); }
            if (active) { ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2); ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.stroke(); }
            if (visited || active) pkt(ctx, x, y, 4, active ? C.red : C.ink);
            const show = !narrow || (onRoute && k <= cur) || (candidate && onRoute);
            const col = active || visited ? C.ink : candidate && onRoute ? C.dim : C.faint;
            if (show) text(ctx, label, x, y + r + (narrow ? 13 : 17) + (active ? 7 : 0), { size: narrow ? 10 : Math.max(11, f - 3), align: "center", color: col });
          }));
          if (!narrow) text(ctx, "each circle is a state", m, h - m, { mono: true, size: 10, color: C.faint });
          t++;
        },
      };
    },

    // ---------- AWS: S3 + ECR → Fargate tasks in a private VPC → prioritization ----------
    aws(canvas) {
      const ck = phases(150, 4);
      const rand = rng(42);
      const speed = Array.from({ length: 100 }, () => 0.75 + rand() * 0.5);
      return {
        tick: 33, still: 150 * 4 - 2, steps: 4,
        step: ck.ph, seek: ck.seek,
        draw() {
          const { ctx, w, h } = fit(canvas);
          const ph = ck.ph(), pp = ck.pp();
          const f = fs(w, 15), narrow = w < 560, m = 14, lbl = 11;
          let s3, ecr, vpc, out;
          // labels pick the longest wording that fits their box
          const pick = (opts, max, o) => opts.find((t) => measure(ctx, t, o) <= max) ?? opts[opts.length - 1];
          const lo = { mono: true, size: lbl };
          if (!narrow) {
            s3 = { x: m, y: h * 0.08, w: w * 0.19, h: h * 0.5 };
            ecr = { x: m, y: h * 0.66, w: w * 0.19, h: Math.min(h * 0.26, f + 52) };
            vpc = { x: w * 0.25, y: h * 0.05, w: w * 0.46, h: h * 0.9 };
            out = { x: w * 0.75, y: 0, w: w * 0.25 - m, h: Math.min(h * 0.7, f + 46 + 3 * 34) };
            out.y = (h - out.h) / 2;
          } else {
            s3 = { x: m, y: m, w: w * 0.3, h: h * 0.27 };
            ecr = { x: m, y: m + h * 0.31, w: w * 0.3, h: h * 0.19 };
            vpc = { x: w * 0.37, y: m, w: w * 0.63 - m, h: h * 0.5 };
            out = { x: m, y: h * 0.58, w: w - 2 * m, h: h * 0.42 - m };
          }
          // S3 with a pile of images
          frame(ctx, s3.x, s3.y, s3.w, s3.h, { active: ph === 0 });
          text(ctx, "S3", s3.x + 10, s3.y + f + 8, { size: f + 2 });
          text(ctx, "200+ images", s3.x + 10, s3.y + f + 26, { mono: true, size: lbl, color: C.dim });
          const ccols = narrow ? 2 : 3, chipW = (s3.w - 20 - (ccols - 1) * 4) / ccols, chipH = clamp(f + 4, 15, 20);
          const chipTop = s3.y + f + 38, fitRows = Math.max(1, Math.floor((s3.y + s3.h - 8 - chipTop) / (chipH + 4)));
          const shown = ph === 2 ? Math.max(ccols, Math.round(fitRows * ccols * (1 - pp * 0.6))) : ph === 3 ? Math.ceil(fitRows * ccols * 0.4) : fitRows * ccols;
          for (let k = 0; k < shown; k++) {
            const cx = s3.x + 10 + (k % ccols) * (chipW + 4), cy = chipTop + Math.floor(k / ccols) * (chipH + 4);
            if (cy + chipH > s3.y + s3.h - 6) break;
            frame(ctx, cx, cy, chipW, chipH, { color: C.hair, fill: C.fill });
            text(ctx, ["bmc", "bios", "gpu"][k % 3], cx + chipW / 2, cy + chipH / 2 + 1, { mono: true, size: 10, align: "center", base: "middle", color: C.dim });
          }
          // ECR
          frame(ctx, ecr.x, ecr.y, ecr.w, ecr.h, { active: ph === 1 });
          text(ctx, "ECR", ecr.x + 10, ecr.y + f + 8, { size: f + 1 });
          text(ctx, pick(["emba scanner image", "emba image", "emba"], ecr.w - 20, lo), ecr.x + 10, ecr.y + f + 26, { mono: true, size: lbl, color: C.dim });
          // VPC
          frame(ctx, vpc.x, vpc.y, vpc.w, vpc.h, { kind: "dashed", color: ph >= 1 ? C.dim : C.line });
          text(ctx, "Private VPC", vpc.x + 12, vpc.y + f + 8, { size: f });
          text(ctx, pick(["cloudformation", "cfn"], vpc.w - 40 - measure(ctx, "Private VPC", { size: f }), lo), vpc.x + vpc.w - 12, vpc.y + f + 6, { mono: true, size: lbl, align: "right", color: C.dim });
          text(ctx, pick(["ecs fargate · 100 tasks", "fargate · 100 tasks", "100 tasks"], vpc.w - 24, lo), vpc.x + 12, vpc.y + f * 2 + 18, { mono: true, size: lbl, color: C.dim });
          // legend
          const ly = vpc.y + vpc.h - 12;
          ctx.fillStyle = C.faint; ctx.fillRect(vpc.x + 12, ly - 8, 14, 3);
          const lg = { mono: true, size: lbl - 1 };
          const legends = [["static · binwalk, yara", "dynamic · qemu, fuzzing"], ["static · yara", "dynamic · qemu"], ["static", "dynamic"]];
          const [ls, ld] = legends.find(([a, b]) => 20 + measure(ctx, a, lg) + 28 + 20 + measure(ctx, b, lg) <= vpc.w - 24) ?? legends[2];
          text(ctx, ls, vpc.x + 32, ly, { ...lg, color: C.dim });
          const lx2 = vpc.x + 32 + measure(ctx, ls, lg) + 28;
          ctx.fillStyle = C.ink; ctx.fillRect(lx2, ly - 8, 14, 3);
          text(ctx, ld, lx2 + 20, ly, { ...lg, color: C.dim });
          // 10 x 10 tasks, each an EMBA run with a static and a dynamic half
          const gx = vpc.x + 12, gy = vpc.y + f * 2 + 30, gw = vpc.w - 24, gh = ly - 22 - gy;
          const tw = gw / 10, th = gh / 10;
          for (let k = 0; k < 100; k++) {
            const x = gx + (k % 10) * tw, y = gy + Math.floor(k / 10) * th;
            const up = ph === 1 ? k / 100 < ease(pp * 1.4) : ph >= 2;
            frame(ctx, x + 2, y + 2, tw - 4, th - 4, { color: up ? C.line : C.hair });
            if (!up) continue;
            const prog = ph === 2 ? clamp(pp * 1.3 * speed[k], 0, 1) : ph === 3 ? 1 : 0;
            const half = (tw - 10) / 2, by = y + th - 7;
            ctx.fillStyle = C.faint; ctx.fillRect(x + 5, by, half * clamp(prog * 2, 0, 1), 2);
            ctx.fillStyle = C.ink; ctx.fillRect(x + 5 + half, by, half * clamp(prog * 2 - 1, 0, 1), 2);
          }
          if (ph === 2) marks(ctx, vpc.x, vpc.y, vpc.w, vpc.h);
          // flows
          const s3o = [s3.x + s3.w + 6, s3.y + s3.h / 2], s3i = [vpc.x - 6, s3.y + s3.h / 2];
          arrow(ctx, s3o[0], s3o[1], s3i[0], s3i[1], ph === 2 ? C.ink : C.line);
          if (ph === 2) for (let k = 0; k < 3; k++) pkt(ctx, lerp(s3o[0], s3i[0], (pp * 3 + k / 3) % 1), s3o[1], 5, C.red);
          const eo = [ecr.x + ecr.w + 6, ecr.y + ecr.h / 2], ei = [vpc.x - 6, ecr.y + ecr.h / 2];
          arrow(ctx, eo[0], eo[1], ei[0], ei[1], ph === 1 ? C.ink : C.line);
          if (ph === 1) pkt(ctx, lerp(eo[0], ei[0], (pp * 3) % 1), eo[1], 5, C.red);
          const v1 = narrow ? [vpc.x + vpc.w / 2, vpc.y + vpc.h + 6] : [vpc.x + vpc.w + 6, out.y + out.h / 2];
          const v2 = narrow ? [vpc.x + vpc.w / 2, out.y - 6] : [out.x - 6, out.y + out.h / 2];
          arrow(ctx, v1[0], v1[1], v2[0], v2[1], ph === 3 ? C.ink : C.line);
          if (ph === 3) for (let k = 0; k < 3; k++) { const q = (pp * 3 + k / 3) % 1; pkt(ctx, lerp(v1[0], v2[0], q), lerp(v1[1], v2[1], q), 5, C.red); }
          // prioritization
          frame(ctx, out.x, out.y, out.w, out.h, { active: ph === 3 });
          text(ctx, "Prioritize", out.x + 10, out.y + f + 8, { size: f + 1 });
          text(ctx, pick(["by vulnerability type", "by vuln type", "by type"], out.w - 20, lo), out.x + 10, out.y + f + 26, { mono: true, size: lbl, color: C.dim });
          // ranked by type of finding, most urgent first
          const nameSize = narrow ? 11 : 12, room = out.w - 20 - 24;
          const sets = [["CWEs above severity threshold", "Weak hashes (MD5)", "Overly permissive files"], ["CWEs over threshold", "Weak hashes", "Permissive files"], ["CWEs", "Weak hashes", "Permissive"]];
          const names = sets.find((st) => st.every((t) => measure(ctx, t, { size: nameSize }) <= room)) ?? sets[2];
          const bars = [[names[0], 0.92, C.red], [names[1], 0.64, C.ink], [names[2], 0.42, C.dim]];
          const bx = out.x + 10, bw = out.w - 20, by0 = out.y + f + 46, rowH = narrow ? 30 : 34;
          bars.forEach(([name, v, col], k) => {
            const y = by0 + k * rowH, grow = ph === 3 ? ease(pp * 1.6 - k * 0.15) : 0;
            text(ctx, String(k + 1).padStart(2, "0"), bx, y, { mono: true, size: 10, color: ph === 3 && k === 0 ? C.red : C.faint });
            text(ctx, name, bx + 24, y, { size: narrow ? 11 : 12, color: ph === 3 ? C.ink : C.dim });
            frame(ctx, bx, y + 7, bw, 5, { color: C.hair });
            if (grow > 0) { ctx.fillStyle = col; ctx.fillRect(bx + 1, y + 8, (bw - 2) * v * grow, 4); }
          });
          ck.t++;
        },
      };
    },

    // ---------- Honeypot network: every host is a honeypot ----------
    honeypot(canvas) {
      const ck = phases(150, 4);
      const LOG = [
        ["203.0.113.24", ":22", "ssh"], ["203.0.113.71", ":3389", "rdp"],
        ["203.0.113.9", ":80", "http"], ["203.0.113.52", ":3306", "db"],
      ];
      function laptop(ctx, x, y, s, color) {
        frame(ctx, x - s * 0.6, y - s * 0.45, s * 1.2, s * 0.75, { color });
        line(ctx, [[x - s * 0.85, y + s * 0.38], [x + s * 0.85, y + s * 0.38]], color, 1.5);
      }
      return {
        tick: 33, still: 150 * 3 + 100, steps: 4,
        step: ck.ph, seek: ck.seek,
        draw() {
          const { ctx, w, h } = fit(canvas);
          const ph = ck.ph(), pp = ck.pp();
          const f = fs(w, 15), narrow = w < 560, lbl = 11, m = 12;
          const inet = { x: m, y: m, w: w * 0.2, h: h - 2 * m };
          const fw = { x: w * 0.255, y: m, w: clamp(w * 0.022, 10, 18), h: h - 2 * m };
          const lan = { x: w * 0.32, y: m, w: w * 0.68 - m, h: h - 2 * m };
          frame(ctx, inet.x, inet.y, inet.w, inet.h, { kind: "ticks" });
          text(ctx, "Internet", inet.x + 10, inet.y + f + 8, { size: f });
          frame(ctx, lan.x, lan.y, lan.w, lan.h, { kind: "dashed" });
          text(ctx, "Network", lan.x + 12, lan.y + f + 8, { size: f });
          if (!narrow) text(ctx, "every host is a honeypot", lan.x + lan.w - 12, lan.y + f + 6, { mono: true, size: lbl, align: "right", color: C.dim });

          // honeypots: one row of four when there is room, else two by two
          const pad = 14, row = lan.w - 2 * pad > 4 * 150;
          const cols = row ? 4 : 2, gapX = 12, gapY = 12;
          const hw = (lan.w - 2 * pad - gapX * (cols - 1)) / cols;
          const hh = row ? clamp(h * 0.16, 54, 84) : clamp(h * 0.15, 44, 72);
          const lh = narrow ? 14 : 20, monH = narrow ? f + 18 + 2 * lh : f + 26 + 4 * lh;
          const gapM = clamp(h * 0.09, 22, 64), block = (row ? hh : hh * 2 + gapY) + gapM + monH;
          const top = Math.max(lan.y + f + 46, lan.y + (lan.h - block) / 2 + 10), busY = top - 18;
          const names = narrow ? ["SSH :22", "RDP :3389", "HTTP :80", "DB :3306"] : ["SSH :22", "RDP :3389", "Web :80", "Database :3306"];
          const hosts = names.map((label, k) => ({ label, x: lan.x + pad + (k % cols) * (hw + gapX), y: top + Math.floor(k / cols) * (hh + gapY) }));
          const hostsBottom = hosts[hosts.length - 1].y + hh;
          const mon = { x: lan.x + pad, y: hostsBottom + gapM, w: lan.w - 2 * pad };
          mon.h = Math.min(monH, lan.y + lan.h - pad - mon.y);

          // firewall: hatched wall with two open ports
          const gapH = clamp(h * 0.05, 12, 22);
          const g = row ? [busY, top + hh * 0.5] : [top + hh * 0.5, top + hh + gapY + hh * 0.5];
          const segs = [[fw.y + f + 16, g[0] - gapH / 2], [g[0] + gapH / 2, g[1] - gapH / 2], [g[1] + gapH / 2, fw.y + fw.h]];
          segs.forEach(([a, b]) => {
            frame(ctx, fw.x, a, fw.w, b - a, { color: C.line });
            ctx.save(); ctx.beginPath(); ctx.rect(fw.x, a, fw.w, b - a); ctx.clip();
            for (let y = a - fw.w; y < b; y += 7) line(ctx, [[fw.x, y + fw.w], [fw.x + fw.w, y]], C.hair);
            ctx.restore();
          });
          if (!narrow) text(ctx, "firewall", fw.x + fw.w / 2, fw.y + f + 2, { mono: true, size: 10, align: "center", color: C.dim });

          // attackers
          const ls = clamp(w * 0.026, 15, 26);
          const mid = (g[0] + g[1]) / 2, spread = clamp(h * 0.17, 60, 130);
          const atk = [-1, 0, 1].map((v) => ({ x: inet.x + inet.w / 2, y: mid + v * spread }));
          atk.forEach((a) => {
            laptop(ctx, a.x, a.y, ls, ph === 0 ? C.red : C.dim);
            if (!narrow) text(ctx, "attacker", a.x, a.y + ls * 0.75 + 14, { mono: true, size: 10, align: "center", color: C.faint });
          });

          // hosts
          hosts.forEach((ho, k) => {
            frame(ctx, ho.x, ho.y, hw, hh, { fill: C.fill, color: ph >= 1 ? C.ink : C.line, active: ph === 1 || (ph === 2 && Math.floor(pp * 8 + k) % 4 === 0) });
            text(ctx, ho.label, ho.x + 10, ho.y + hh / 2 - 1, { size: narrow ? 11 : Math.max(11, f - 1) });
            text(ctx, ph === 2 ? "logged" : "honeypot", ho.x + 10, ho.y + hh / 2 + 16, { mono: true, size: 10, color: ph === 2 ? C.red : C.dim });
          });

          // probes: bounce off the wall, or pass through a port to a honeypot
          // (row layout: the upper port feeds a lane above the row, so probes never cross a box)
          const route = (k) => {
            if (row) {
              if (k % 4 === 0) return [g[1], [[hosts[0].x - 2, g[1]]]];
              const cx = hosts[k % 4].x + hw / 2;
              return [g[0], [[cx, g[0]], [cx, top - 3]]];
            }
            const i = (k % 2) * 2;
            return [g[k % 2], [[hosts[i].x - 2, g[k % 2]]]];
          };
          if (row) line(ctx, [[fw.x + fw.w + 2, busY], [hosts[3].x + hw / 2, busY]], ph === 1 ? C.line : C.hair, 1, [2, 3]);
          for (let k = 0; k < 8; k++) {
            const a = atk[k % 3], q = (pp * 2 + k / 8) % 1;
            if (ph === 0) {
              const x = q < 0.6 ? lerp(a.x + ls, fw.x, q / 0.6) : lerp(fw.x, a.x + ls * 1.4, (q - 0.6) / 0.4);
              pkt(ctx, x, a.y + (k - 4) * 2, 5, C.red);
            } else if (ph === 1) {
              const [gy, rest] = route(k);
              const pt = along([[a.x + ls, a.y], [fw.x + fw.w / 2, gy], ...rest], q);
              pkt(ctx, pt[0], pt[1], 5, C.red);
            }
          }

          // telemetry: every honeypot reports to the central server
          const monTop = mon.y;
          hosts.forEach((ho, k) => {
            const lit = ph >= 2;
            let pts;
            const bottomRow = row || k >= 2;
            if (bottomRow) pts = [[ho.x + hw / 2, ho.y + hh + 4], [ho.x + hw / 2, monTop - 4]];
            else {
              const ex = k % 2 === 0 ? ho.x - 7 : ho.x + hw + 7;
              pts = [[k % 2 === 0 ? ho.x - 2 : ho.x + hw + 2, ho.y + hh / 2], [ex, ho.y + hh / 2], [ex, monTop - 4]];
            }
            line(ctx, pts.slice(0, -1).concat([pts[pts.length - 1]]), lit ? C.dim : C.hair, 1, lit ? null : [2, 3]);
            const [lx, ly] = pts[pts.length - 1];
            line(ctx, [[lx - 4, ly - 5], [lx, ly], [lx + 4, ly - 5]], lit ? C.dim : C.hair);
            if (ph === 2) {
              const q = (pp * 2 + k / 4) % 1;
              const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1];
              pkt(ctx, lerp(ax, bx, q), lerp(ay, by, q), 5, C.ink);
            }
          });

          // central monitoring with a live log
          frame(ctx, mon.x, mon.y, mon.w, mon.h, { fill: C.fill, color: ph >= 2 ? C.ink : C.line, active: ph === 3 });
          text(ctx, narrow ? "Monitoring" : "Central monitoring server", mon.x + 10, mon.y + f + 6, { size: Math.max(11, f - 1) });
          if (ph === 3 && Math.floor(pp * 6) % 2 === 0) {
            const lx = mon.x + mon.w - 12;
            ctx.fillStyle = C.red; ctx.fillRect(lx - measure(ctx, "live", { mono: true, size: 10 }) - 12, mon.y + 11, 6, 6);
            text(ctx, "live", lx, mon.y + 18, { mono: true, size: 10, align: "right", color: C.red });
          }
          const lines = ph === 2 ? Math.floor(pp * 5) : ph === 3 ? 4 : 0;
          const maxLines = Math.max(0, Math.floor((mon.h - f - (narrow ? 10 : 18)) / lh)), ls2 = narrow ? 10 : 12;
          if (!lines) text(ctx, "listening…", mon.x + 10, mon.y + f + 26, { mono: true, size: ls2, color: C.faint });
          const cx = narrow ? [0, 92, 0] : [0, 150, 230];
          for (let k = 0; k < Math.min(lines, maxLines); k++) {
            const [ip, port, svc] = LOG[k], y = mon.y + f + (narrow ? 18 : 26) + k * lh;
            const col = k === lines - 1 && ph === 2 ? C.ink : C.dim;
            text(ctx, ip, mon.x + 10 + cx[0], y, { mono: true, size: ls2, color: col });
            text(ctx, port, mon.x + 10 + cx[1], y, { mono: true, size: ls2, color: col });
            if (!narrow) text(ctx, svc, mon.x + 10 + cx[2], y, { mono: true, size: ls2, color: col });
          }
          ck.t++;
        },
      };
    },

    // ---------- Grid robot: grid simulation ⇄ HELICS ⇄ ROS → line robot ----------
    gridbot(canvas) {
      const ck = phases(150, 4);
      let pos = 0.1;
      function crawler(ctx, x, y, s) {
        ctx.lineWidth = 1.5; ctx.strokeStyle = C.ink;
        [-0.35, 0.35].forEach((o) => {
          ctx.beginPath(); ctx.arc(x + o * s, y - s * 0.12, s * 0.15, 0, Math.PI * 2); ctx.fillStyle = C.bg; ctx.fill(); ctx.stroke();
          line(ctx, [[x + o * s, y], [x + o * s, y + s * 0.28]], C.ink, 1.5);
        });
        frame(ctx, x - s * 0.55, y + s * 0.28, s * 1.1, s * 0.48, { fill: C.fill, color: C.ink });
        ctx.fillStyle = C.red; ctx.fillRect(x + s * 0.3, y + s * 0.46, s * 0.12, s * 0.12);
        line(ctx, [[x - s * 0.2, y + s * 0.76], [x - s * 0.2, y + s * 0.98], [x + s * 0.12, y + s * 1.1]], C.dim, 1.5);
      }
      return {
        tick: 33, still: 150 * 4 - 2, steps: 4,
        step: ck.ph, seek: ck.seek,
        draw() {
          const { ctx, w, h } = fit(canvas);
          const ph = ck.ph(), pp = ck.pp();
          const f = fs(w, 15), narrow = w < 560;
          const sh = clamp(h * 0.2, 48, 88), sy = h - sh - 14, gap = narrow ? 10 : 24;
          const base = sy - 40, top = 22, towers = narrow ? 3 : 4;
          const tx = Array.from({ length: towers }, (_, k) => w * 0.1 + (k * (w * 0.8)) / (towers - 1));
          const wireY = top + (base - top) * 0.25;
          tx.forEach((x) => {
            line(ctx, [[x - 15, base], [x, wireY - 14], [x + 15, base]], C.line, 1.5);
            line(ctx, [[x - 22, wireY - 6], [x + 22, wireY - 6]], C.line, 1.5);
            line(ctx, [[x - 9, (wireY + base) / 2], [x + 9, (wireY + base) / 2]], C.line, 1);
            line(ctx, [[x - 30, base + 0.5], [x + 30, base + 0.5]], C.hair, 1);
          });
          const sag = (x) => {
            for (let k = 0; k < towers - 1; k++) if (x >= tx[k] && x <= tx[k + 1]) {
              const u = (x - tx[k]) / (tx[k + 1] - tx[k]); return wireY + Math.sin(u * Math.PI) * (base - wireY) * 0.14;
            }
            return wireY;
          };
          const seg = Math.floor(ck.t / (ck.P * 4)) % (towers - 1);
          for (let k = 0; k < towers - 1; k++) {
            const pts = [];
            for (let x = tx[k]; x <= tx[k + 1]; x += 4) pts.push([x, sag(x)]);
            line(ctx, pts, k === seg ? C.red : C.dim, 1.5);
          }
          const segMid = (tx[seg] + tx[seg + 1]) / 2;
          text(ctx, "energy data", segMid, wireY - 24, { mono: true, size: 11, align: "center", color: C.red });
          const goal = (segMid - tx[0]) / (tx[towers - 1] - tx[0]);
          if (ph === 3) pos = lerp(pos, goal, 0.04);
          const rx = lerp(tx[0], tx[towers - 1], pos), ry = sag(rx), rs = clamp(w * 0.05, 26, 54);
          crawler(ctx, rx, ry, rs);

          // architecture strip
          const labels = narrow
            ? [["Grid sim", "pnnl"], ["HELICS", "co-sim"], ["ROS", "control"], ["Robot", "on line"]]
            : [["Grid simulation", "with pnnl"], ["HELICS", "co-simulation"], ["ROS", "robot control"], ["Line robot", "moves on the wire"]];
          const bwid = (w - 28 - gap * 3) / 4;
          const bx = labels.map((_, k) => 14 + k * (bwid + gap));
          labels.forEach(([a, b], k) => {
            frame(ctx, bx[k], sy, bwid, sh, { fill: C.fill, color: k <= ph ? C.ink : C.line, active: k === ph });
            text(ctx, a, bx[k] + 10, sy + sh / 2 - 2, { size: narrow ? 11 : f + 1 });
            text(ctx, b, bx[k] + 10, sy + sh / 2 + 16, { mono: true, size: 10, color: C.dim });
          });
          for (let k = 0; k < 3; k++) {
            const x1 = bx[k] + bwid + 4, x2 = bx[k + 1] - 4, y = sy + sh / 2;
            const lit = k < ph;
            if (k < 2) {
              arrow(ctx, x1, y - 5, x2, y - 5, lit || k === ph ? C.ink : C.line, 1, 4);
              arrow(ctx, x2, y + 5, x1, y + 5, lit || k === ph ? C.ink : C.line, 1, 4);
            } else arrow(ctx, x1, y, x2, y, lit || k === ph ? C.ink : C.line, 1, 4);
            if (k === ph && ph < 3) pkt(ctx, lerp(x1, x2, ease(pp)), y - 5, 4, C.red);
          }
          // tie the strip to the scene
          const gsx = bx[0] + bwid / 2;
          if (ph === 0) {
            line(ctx, [[segMid, sag(segMid) + 6], [segMid, base + 16], [gsx, base + 16], [gsx, sy - 4]], C.red, 1, [3, 3]);
            pkt(ctx, gsx, lerp(base + 16, sy - 4, (pp * 2) % 1), 4, C.red);
          }
          if (ph === 3) line(ctx, [[bx[3] + bwid / 2, sy - 4], [bx[3] + bwid / 2, base + 24], [rx, base + 24], [rx, ry + rs * 1.2]], C.red, 1, [3, 3]);
          ck.t++;
        },
      };
    },

    // ---------- Robot over UDP: client key → datagram → server → SFML frame ----------
    robot(canvas) {
      const K = 150; // frames per key press
      const KEYS = ["d", "s", "a", "g", "w", "h", "d", "q"];
      const MEAN = { w: "up", a: "left", s: "down", d: "right", g: "faster", h: "slower", q: "quit" };
      const GC = 9, GR = 6;
      let t = 0, state;
      function reset() { state = { x: 2, y: 2, dx: 0, dy: 0, v: 0.011, on: true, trail: [], applied: -1, hist: [] }; }
      reset();
      const step = () => Math.min(3, Math.floor(((t % K) / K) * 4));
      return {
        tick: 33, still: K * 2 + 140, steps: 4,
        step, seek(k) { t = Math.floor(t / K) * K + Math.round((k / 4) * K); },
        draw() {
          const { ctx, w, h } = fit(canvas);
          const ki = Math.floor(t / K) % KEYS.length, key = KEYS[ki], u = (t % K) / K, st = step();
          if (ki === 0 && t % K === 0) reset();
          // apply the key when the packet lands
          if (u >= 0.5 && state.applied !== ki) {
            state.applied = ki;
            state.hist.push(key); if (state.hist.length > 4) state.hist.shift();
            if (key === "w") { state.dx = 0; state.dy = -1; }
            if (key === "s") { state.dx = 0; state.dy = 1; }
            if (key === "a") { state.dx = -1; state.dy = 0; }
            if (key === "d") { state.dx = 1; state.dy = 0; }
            if (key === "g") state.v = 0.017;
            if (key === "h") state.v = 0.011;
            if (key === "q") state.on = false;
          }
          if (state.on) {
            state.x = clamp(state.x + state.dx * state.v, 0.5, GC - 0.5);
            state.y = clamp(state.y + state.dy * state.v, 0.5, GR - 0.5);
            if (t % 3 === 0) { state.trail.push([state.x, state.y]); if (state.trail.length > 90) state.trail.shift(); }
          }

          const stack = w < 460, m = 10, f = stack ? 12 : fs(w, 14);
          let cl, sv;
          if (!stack) {
            sv = { x: w * 0.42, y: m + 18, w: w * 0.58 - m, h: h - 2 * m - 18 };
            const cw = w * 0.3, cs0 = Math.min(30, (cw - 20 - 16) / 5), ch = Math.min(sv.h, 20 + cs0 * 2 + 4 + 22 + 4 * 17);
            cl = { x: m, y: sv.y + (sv.h - ch) / 2, w: cw, h: ch };
          } else {
            cl = { x: m, y: m + 18, w: w - 2 * m, h: clamp(h * 0.2, 62, 80) };
            sv = { x: m, y: cl.y + cl.h + h * 0.15, w: w - 2 * m, h: h - (cl.y + cl.h + h * 0.15) - m };
          }
          text(ctx, "client", cl.x, cl.y - 8, { mono: true, size: 10, color: C.dim });
          text(ctx, stack ? "server · sfml" : "server · sfml 800×600", sv.x, sv.y - 8, { mono: true, size: 10, color: C.dim });

          // client: keycaps and a command log
          frame(ctx, cl.x, cl.y, cl.w, cl.h, { fill: C.fill, color: C.line, active: st === 0 });
          // keyboard: w over a s d, speed keys g h, quit q
          const caps = [["w", 1, 0], ["a", 0, 1], ["s", 1, 1], ["d", 2, 1], ["g", 3, 0], ["h", 4, 0], ["q", 4, 1]];
          const cs = stack ? clamp((cl.h - 24) / 2 - 2, 14, 24) : Math.min(30, (cl.w - 20 - 16) / 5);
          caps.forEach(([c, cx, cy]) => {
            const x = cl.x + 10 + cx * (cs + 4), y = cl.y + 10 + cy * (cs + 4), hot = c === key && st === 0;
            frame(ctx, x, y, cs, cs, { color: hot ? C.red : C.line, fill: hot ? C.hot : null });
            text(ctx, c, x + cs / 2, y + cs / 2 + 1, { mono: true, upper: false, size: 11, align: "center", base: "middle", color: hot ? C.red : C.dim });
          });
          const lh = 17, logX = stack ? cl.x + 10 + 5 * (cs + 4) + 8 : cl.x + 10;
          const logTop = stack ? cl.y + 22 : cl.y + 10 + cs * 2 + 4 + 22;
          const rowsFit = Math.max(0, Math.floor((cl.y + cl.h - logTop + 8) / lh));
          const sent = KEYS.slice(0, ki + (st >= 1 ? 1 : 0)).slice(-rowsFit);
          sent.forEach((c, k) => {
            const last = k === sent.length - 1;
            text(ctx, `> send '${c}'  ${MEAN[c]}`, logX, logTop + k * lh, { mono: true, upper: false, size: 11, color: last ? C.ink : C.faint });
          });

          // the wire: one datagram per key, no handshake
          const a0 = stack ? [w / 2, cl.y + cl.h + 6] : [cl.x + cl.w + 8, cl.y + cl.h / 2];
          const a1 = stack ? [w / 2, sv.y - 6] : [sv.x - 8, cl.y + cl.h / 2];
          arrow(ctx, a0[0], a0[1], a1[0], a1[1], st === 1 ? C.ink : C.line);
          const lblX = stack ? w / 2 + 12 : (a0[0] + a1[0]) / 2, lblY = stack ? (a0[1] + a1[1]) / 2 + 4 : a0[1] - 14;
          text(ctx, "udp", lblX, lblY, { mono: true, size: 10, align: stack ? "left" : "center", color: st === 1 ? C.ink : C.dim });
          if (st === 1) {
            const q = ease((u - 0.25) / 0.25);
            const px = lerp(a0[0], a1[0], q), py = lerp(a0[1], a1[1], q);
            frame(ctx, px - 13, py - 9, 26, 18, { fill: C.bg, color: C.red });
            text(ctx, `'${key}'`, px, py + 1, { mono: true, upper: false, size: 10, align: "center", base: "middle", color: C.red });
          }

          // server window
          frame(ctx, sv.x, sv.y, sv.w, sv.h, { color: st >= 2 ? C.ink : C.line, active: st >= 2 });
          const cell = Math.min((sv.w - 20) / GC, (sv.h - 34) / GR);
          const gx = sv.x + (sv.w - cell * GC) / 2, gy = sv.y + 26 + (sv.h - 30 - cell * GR) / 2;
          for (let c = 0; c <= GC; c++) line(ctx, [[Math.round(gx + c * cell) + 0.5, gy], [Math.round(gx + c * cell) + 0.5, gy + GR * cell]], C.hair);
          for (let r = 0; r <= GR; r++) line(ctx, [[gx, Math.round(gy + r * cell) + 0.5], [gx + GC * cell, Math.round(gy + r * cell) + 0.5]], C.hair);
          const status = st === 2 ? `recv '${key}' → ${MEAN[key]}` : state.on ? `speed ${state.v > 0.012 ? "fast" : "normal"}` : "client disconnected";
          text(ctx, status, sv.x + 10, sv.y + 17, { mono: true, upper: false, size: 10, color: st === 2 ? C.red : C.dim });
          if (state.on) {
            const pts = state.trail.map(([x, y]) => [gx + x * cell, gy + y * cell]);
            if (pts.length > 1) line(ctx, pts, C.line, 1, [2, 3]);
            const rx = gx + state.x * cell, ry = gy + state.y * cell, rs = clamp(cell * 0.62, 12, 34);
            // top-down robot: treads on the sides, red sensor facing the heading
            const hx = state.dx, hy = state.dy || (state.dx ? 0 : -1);
            const tr = rs * 0.18;
            ctx.fillStyle = C.line;
            if (hx) { ctx.fillRect(rx - rs / 2, ry - rs / 2 - tr, rs, tr - 1); ctx.fillRect(rx - rs / 2, ry + rs / 2 + 1, rs, tr - 1); }
            else { ctx.fillRect(rx - rs / 2 - tr, ry - rs / 2, tr - 1, rs); ctx.fillRect(rx + rs / 2 + 1, ry - rs / 2, tr - 1, rs); }
            frame(ctx, rx - rs / 2, ry - rs / 2, rs, rs, { fill: C.ink, color: C.ink });
            ctx.fillStyle = C.red; ctx.fillRect(rx + hx * rs * 0.3 - 3, ry + hy * rs * 0.3 - 3, 6, 6);
          }
          t++;
        },
      };
    },

    // ---------- Centipede project: a schematic of the game's systems ----------
    centipede(canvas) {
      const ck = phases(150, 4), COLS = 24, ROWS = 14;
      let seedN = 1, mush, cent, spider, shots, score, lives, flashes;
      function reset() {
        const rand = rng(seedN++ * 97);
        mush = [];
        for (let k = 0; k < 34; k++) mush.push({ x: 1 + Math.floor(rand() * (COLS - 2)), y: 2 + Math.floor(rand() * (ROWS - 6)), hp: 3 });
        cent = { x: 0, y: 1, dir: 1, body: [] };
        spider = { x: 4, y: ROWS - 3, vx: 1, vy: -1, rand };
        shots = []; score = 0; lives = 3; flashes = [];
      }
      reset();
      const mushAt = (x, y) => mush.find((m) => m.x === x && m.y === y && m.hp > 0);
      let segs = 12;
      return {
        tick: 33, still: 150 * 2 + 60, steps: 4,
        step: ck.ph,
        seek(k) { ck.seek(k); if (k === 0) { reset(); segs = 12; } },
        draw() {
          const { ctx, w, h } = fit(canvas);
          const ph = ck.ph(), pp = ck.pp();
          if (ck.t % (150 * 4) === 0) { reset(); segs = 12; }
          const hud = 22, cell = Math.min((w - 20) / COLS, (h - hud - 16) / ROWS);
          const ox = (w - cell * COLS) / 2, oy = hud + 8 + (h - hud - 16 - cell * ROWS) / 2;
          const X = (x) => ox + x * cell, Y = (y) => oy + y * cell;
          frame(ctx, ox, oy, cell * COLS, cell * ROWS, { color: C.hair });
          // HUD
          text(ctx, `score ${String(score).padStart(4, "0")}`, ox, hud, { mono: true, size: 10, color: ph === 3 ? C.red : C.dim });
          text(ctx, `lives ${lives}`, ox + cell * COLS, hud, { mono: true, size: 10, align: "right", color: ph === 3 ? C.red : C.dim });
          // mushrooms, placed at random (appear during step 1)
          const shown = ph === 0 ? Math.floor(mush.length * ease(pp * 1.3)) : mush.length;
          mush.slice(0, shown).forEach((m) => {
            if (m.hp <= 0) return;
            const s = cell * (0.3 + m.hp * 0.12);
            frame(ctx, X(m.x) + (cell - s) / 2, Y(m.y) + (cell - s) / 2, s, s, { color: ph === 0 ? C.dim : C.line });
          });
          const moving = ph >= 1, tickMove = ck.t % 4 === 0;
          // centipede: walks a row, drops down and turns at a wall or mushroom
          if (moving && tickMove && segs > 0) {
            cent.body.unshift({ x: cent.x, y: cent.y });
            cent.body.length = Math.min(cent.body.length, segs - 1);
            const nx = cent.x + cent.dir;
            if (nx < 0 || nx >= COLS || mushAt(nx, cent.y)) { cent.y = cent.y + 1 >= ROWS - 1 ? 1 : cent.y + 1; cent.dir *= -1; }
            else cent.x = nx;
          }
          if (moving && segs > 0) {
            cent.body.forEach((b) => { ctx.fillStyle = C.ink; ctx.fillRect(X(b.x) + cell * 0.18, Y(b.y) + cell * 0.18, cell * 0.64, cell * 0.64); });
            ctx.fillStyle = C.red; ctx.fillRect(X(cent.x) + cell * 0.12, Y(cent.y) + cell * 0.12, cell * 0.76, cell * 0.76);
          }
          // spider: random walk near the bottom, eats mushrooms
          if (moving) {
            if (tickMove) {
              if (spider.rand() < 0.3) spider.vy *= -1;
              if (spider.rand() < 0.15) spider.vx *= -1;
              spider.x = clamp(spider.x + spider.vx, 0, COLS - 1); spider.y = clamp(spider.y + spider.vy, ROWS - 6, ROWS - 2);
              if (spider.x === 0 || spider.x === COLS - 1) spider.vx *= -1;
              const m = mushAt(spider.x, spider.y); if (m) m.hp = 0;
            }
            const sx = X(spider.x) + cell / 2, sy = Y(spider.y) + cell / 2, a = cell * 0.32;
            line(ctx, [[sx - a, sy - a], [sx + a, sy + a]], C.dim, 1.5); line(ctx, [[sx - a, sy + a], [sx + a, sy - a]], C.dim, 1.5);
          }
          // ship and laser blasts
          const shipX = COLS / 2 + Math.sin(ck.t / 40) * (COLS / 2 - 2);
          const px = ox + shipX * cell, py = Y(ROWS - 1) + cell * 0.85;
          line(ctx, [[px - cell * 0.45, py], [px, py - cell * 0.75], [px + cell * 0.45, py], [px - cell * 0.45, py]], C.ink, 1.5);
          if (ph >= 2) {
            if (ck.t % 10 === 0) shots.push({ x: Math.floor(shipX), y: ROWS - 1.5 });
            shots.forEach((s) => {
              s.y -= 0.6;
              const cx = s.x, cy = Math.round(s.y);
              const m = mushAt(cx, cy);
              if (m) { m.hp--; s.dead = true; score += 1; flashes.push({ x: cx, y: cy, t: 8 }); }
              else if (segs > 0 && (cent.x === cx && cent.y === cy || cent.body.some((b) => b.x === cx && b.y === cy))) {
                s.dead = true; score += 10; segs = Math.max(0, segs - 1); flashes.push({ x: cx, y: cy, t: 10 });
                if (segs === 0) { segs = 12; cent = { x: 0, y: 1, dir: 1, body: [] }; }
              }
              if (s.y < 0) s.dead = true;
              if (!s.dead) line(ctx, [[X(s.x) + cell / 2, Y(s.y)], [X(s.x) + cell / 2, Y(s.y) + cell * 0.6]], C.ink, 1.5);
            });
            shots = shots.filter((s) => !s.dead);
          }
          flashes.forEach((fl) => { marks(ctx, X(fl.x), Y(fl.y), cell, cell, C.red, 2, 5, 1.5); fl.t--; });
          flashes = flashes.filter((fl) => fl.t > 0);
          const label = ["random placement · std::uniform_int_distribution", "11 segments + head · spider", "collision handling", "score · lives · game state"][ph];
          if (w > 420) text(ctx, label, w / 2, hud, { mono: true, size: 10, align: "center", color: C.faint });
          ck.t++;
        },
      };
    },

    // ---------- Netpbm converter: parse → malloc → convert → write ----------
    netpbm(canvas) {
      const ck = phases(150, 4), G = 12;
      const px = [];
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        const dx = x - 5.5, dy = y - 5.5, d = Math.hypot(dx, dy);
        px.push(clamp(1 - d / 7 + (x + y) * 0.015 + ((x * 7 + y * 3) % 5) * 0.02, 0, 1));
      }
      return {
        tick: 33, still: 150 * 3 - 4, steps: 4,
        step: ck.ph, seek: ck.seek,
        draw() {
          const { ctx, w, h } = fit(canvas);
          const ph = ck.ph(), pp = ck.pp(), toPbm = Math.floor(ck.t / (150 * 4)) % 2 === 1;
          const narrow = w < 460, top = 30, bot = narrow ? 44 : 56;
          const size = Math.min((w - (narrow ? 64 : 120)) / 2, h - top - bot);
          const cell = size / G, gx1 = (w - size * 2 - (narrow ? 44 : 90)) / 2, gx2 = w - gx1 - size, gy = top + 4;
          text(ctx, "$ ppmcvt <options> in.ppm", gx1, 16, { mono: true, upper: false, size: 11, color: ph === 0 ? C.ink : C.faint });
          // input pixels (PPM, shown by luminance)
          for (let k = 0; k < G * G; k++) {
            const v = px[k], c = Math.round(20 + v * 215);
            ctx.fillStyle = `rgb(${c},${c - 4},${c - 10})`;
            ctx.fillRect(gx1 + (k % G) * cell, gy + Math.floor(k / G) * cell, cell - 1, cell - 1);
          }
          frame(ctx, gx1 - 4, gy - 4, size + 8, size + 8, { color: C.line, active: ph === 0 });
          // output: rows allocated (step 2), filled pixel by pixel (step 3)
          const rowsAlloc = ph === 0 ? 0 : ph === 1 ? Math.ceil(G * ease(pp * 1.2)) : G;
          const filled = ph < 2 ? 0 : ph === 2 ? Math.floor(G * G * clamp(pp * 1.15, 0, 1)) : G * G;
          for (let y = 0; y < rowsAlloc; y++) frame(ctx, gx2, gy + y * cell, size - 1, cell - 1, { color: ph === 1 && y === rowsAlloc - 1 ? C.red : C.hair });
          for (let k = 0; k < filled; k++) {
            const v = px[k], c = toPbm ? (v > 0.45 ? 236 : 10) : Math.round(20 + v * 215);
            ctx.fillStyle = `rgb(${c},${c},${c})`;
            ctx.fillRect(gx2 + (k % G) * cell, gy + Math.floor(k / G) * cell, cell - 1, cell - 1);
          }
          frame(ctx, gx2 - 4, gy - 4, size + 8, size + 8, { color: C.line, active: ph >= 2 });
          if (ph === 2 && filled < G * G) {
            const k = filled, x = k % G, y = Math.floor(k / G);
            frame(ctx, gx1 + x * cell - 1, gy + y * cell - 1, cell + 1, cell + 1, { color: C.red });
            frame(ctx, gx2 + x * cell - 1, gy + y * cell - 1, cell + 1, cell + 1, { color: C.red });
          }
          // arrow between
          const ay = gy + size / 2;
          arrow(ctx, gx1 + size + 12, ay, gx2 - 12, ay, ph === 2 ? C.ink : C.line);
          if (!narrow) text(ctx, ph === 1 ? "malloc" : "pixels", (gx1 + size + gx2) / 2, ay - 10, { mono: true, size: 10, align: "center", color: ph === 1 ? C.red : C.dim });
          // headers
          const hy = gy + size + 22, hs = narrow ? 10 : 11;
          const inHead = ["P3", `${G} ${G}`, "255"], outHead = toPbm ? ["P1", `${G} ${G}`] : ["P2", `${G} ${G}`, "255"];
          const inN = ph === 0 ? Math.ceil(inHead.length * clamp(pp * 1.5, 0, 1)) : inHead.length;
          text(ctx, "in.ppm  " + inHead.slice(0, inN).join("  "), gx1, hy, { mono: true, upper: false, size: hs, color: ph === 0 ? C.ink : C.dim });
          const outName = toPbm ? "out.pbm" : "out.pgm";
          if (ph === 3) {
            const n = Math.ceil(outHead.length * clamp(pp * 1.6, 0, 1));
            text(ctx, `${outName}  ${outHead.slice(0, n).join("  ")}`, gx2, hy, { mono: true, upper: false, size: hs, color: C.red });
          } else text(ctx, ph >= 1 ? `${outName}` : "", gx2, hy, { mono: true, upper: false, size: hs, color: C.faint });
          ck.t++;
        },
      };
    },

    // ---------- Distribution fit ----------
    fit(canvas) {
      const rand = rng(11);
      const bins = new Array(28).fill(0);
      const P = 120;
      let t = 0;
      const step = () => Math.floor((t % (P * 3)) / P);
      return {
        tick: 40, still: P * 2 + 60, steps: 3,
        step, seek(k) { const b = Math.floor(t / (P * 3)) * P * 3; bins.fill(0); if (k > 0) for (let i = 0; i < P; i++) sample(); t = b + k * P; },
        draw() {
          const { ctx, w, h } = fit(canvas);
          const k = step();
          if (t % (P * 3) === 0) bins.fill(0);
          if (k === 0) sample();
          const max = Math.max(1, ...bins), base = h * 0.8, top = h * 0.14, bw = (w * 0.8) / bins.length, x0 = w * 0.1;
          bins.forEach((b, i) => {
            const bh = ((base - top) * b) / max, tail = i < 4 || i > 23;
            const x = x0 + i * bw + 1, y = base - bh;
            if (k === 2 && tail) frame(ctx, x, y, bw - 2, bh, { kind: "dashed", color: C.hair });
            else { ctx.fillStyle = C.block; ctx.fillRect(x, y, bw - 2, bh); ctx.fillStyle = C.dim; ctx.fillRect(x, y, bw - 2, 1); }
          });
          const prog = k === 0 ? 0 : k === 1 ? ease(((t % P) / P) * 1.4) : 1;
          if (prog > 0) {
            const pts = [], steps = Math.floor(80 * prog);
            for (let s = 0; s <= steps; s++) {
              const u = s / 80, z = (u - 0.5) / 0.144;
              pts.push([x0 + u * w * 0.8, base - (base - top) * Math.exp(-0.5 * z * z)]);
            }
            line(ctx, pts, k === 1 ? C.red : C.ink, 1.5);
          }
          line(ctx, [[x0, base + 0.5], [x0 + w * 0.8, base + 0.5]], C.line);
          const lab = ["trials", "best fit", "cleaned → neural network input"][k];
          text(ctx, lab, x0, top - 10, { mono: true, size: 11, color: k === 0 ? C.dim : C.red });
          t++;
        },
      };
      function sample() {
        for (let k = 0; k < 6; k++) {
          const v = (rand() + rand() + rand() + rand()) / 4;
          bins[Math.min(bins.length - 1, Math.floor(v * bins.length))]++;
        }
      }
    },
  };

  // ---------- players: run each film only while on screen ----------
  const players = [];
  function sync(p) {
    if (p.items && p.film.step) {
      const k = reduce ? -1 : p.film.step();
      if (k !== p.lastStep) {
        p.items.forEach((li, i) => (i === k ? li.setAttribute("aria-current", "step") : li.removeAttribute("aria-current")));
        p.lastStep = k;
      }
    } else if (p.sub && p.film.subtitle) {
      const s = p.film.subtitle();
      if (s !== p.lastSub) { p.sub.textContent = s; p.lastSub = s; }
    }
  }
  document.querySelectorAll("canvas[data-film]").forEach((canvas) => {
    const make = films[canvas.dataset.film];
    if (!make) return;
    const film = make(canvas);
    const figure = canvas.closest("figure");
    const sub = figure && figure.querySelector(".subtitle");
    const list = figure && figure.querySelector(".steps");
    const items = list ? [...list.children] : null;
    const p = { canvas, film, sub, items, figure, visible: false, last: 0, lastSub: "", lastStep: null };
    players.push(p);
    if (reduce) {
      for (let k = 0; k < (film.still || 1); k++) film.draw();
      if (sub && figure.dataset.summary) sub.textContent = figure.dataset.summary;
    } else {
      film.draw();
    }
    sync(p);
    if (items && film.seek) items.forEach((li, i) => li.querySelector("button").addEventListener("click", () => {
      film.seek(i); film.draw(); p.last = performance.now(); sync(p);
      if (reduce) li.setAttribute("aria-current", "step"), items.forEach((o) => o !== li && o.removeAttribute("aria-current"));
    }));
  });

  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => players.forEach((p) => { if (p.box === e.target) p.visible = e.isIntersecting; }));
    }, { rootMargin: "100px" });
    players.forEach((p) => { p.box = p.canvas.closest(".scene, .reel, .title") || p.canvas; io.observe(p.box); });
    const loop = (now) => {
      if (!document.hidden) players.forEach((p) => {
        if (p.visible && now - p.last >= p.film.tick) { p.last = now; p.film.draw(); sync(p); }
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => players.forEach((p) => p.film.draw()), 150);
  });

  // ---------- slide-in for education and skills ----------
  const reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) reveals.forEach((el) => el.classList.add("is-in"));
  else {
    const ro = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); ro.unobserve(e.target); }
    }), { rootMargin: "0px 0px -12% 0px" });
    reveals.forEach((el) => ro.observe(el));
  }

  // ---------- shutter reveal ----------
  const shutters = document.querySelectorAll(".footage");
  if (reduce || !("IntersectionObserver" in window)) {
    shutters.forEach((f) => f.classList.add("is-open"));
  } else {
    // Observe each entry, not the clipped footage: a fully clipped box never intersects.
    const so = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const f = e.target.querySelector(".footage");
        if (f) f.classList.add("is-open");
        so.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -25% 0px" });
    shutters.forEach((f) => so.observe(f.closest(".scene") || f.parentElement));
  }

  // ---------- one entry at a time, one screen at a time ----------
  // Work, Research and Projects show a single entry. Each entry is cut into full-screen
  // pages (the write-up, then its diagram) and the page snaps so a scroll always lands
  // on exactly one of them. A sticky bar names every entry and carries Next.
  const carousels = [];
  const peeks = [];
  // copy each live diagram into its preview window while the card shows its front
  const drawPeeks = () => {
    for (const { tc, src, card } of peeks) {
      if (!card.offsetParent || card.classList.contains("is-flipped") || src.width < 2) continue;
      const r = tc.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.width < 2) continue;
      const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(r.width * dpr), H = Math.round(W * src.height / src.width);
      if (tc.width !== W || tc.height !== H) { tc.width = W; tc.height = H; tc.style.height = H / dpr + "px"; }
      const c2 = tc.getContext("2d");
      c2.fillStyle = C.bg; c2.fillRect(0, 0, W, H);
      c2.drawImage(src, 0, 0, W, H);
    }
    requestAnimationFrame(drawPeeks);
  };
  requestAnimationFrame(drawPeeks);
  const barH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar")) || 56;
  const minZoom = () => (innerWidth < 700 ? 0.86 : 0.74);
  // Shrink a page's text until it fits the screen (down to a readable floor).
  const fitPage = (pg) => {
    const face = pg.querySelector(".front");
    const inner = face?.querySelector(".page-inner"), box = inner?.querySelector(".fit-box");
    if (!box) return;
    inner.style.zoom = ""; inner.classList.remove("scrolls");
    const cs = getComputedStyle(face), flip = face.querySelector(".flip-btn");
    const avail = face.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      - (flip && flip.offsetParent ? flip.getBoundingClientRect().height + parseFloat(getComputedStyle(flip).marginTop) : 0);
    // project previews are sized from the card's height so the 16:9 frame always fits
    const rp = pg.classList.contains("reel") && box.querySelector(".peek");
    if (rp) {
      const call = rp.querySelector(".peek-call").getBoundingClientRect().height;
      rp.style.width = Math.max(240, Math.floor((avail - call - 10 - 22) * 16 / 9 + 22)) + "px";
    }
    const fits = (z) => { inner.style.zoom = String(z); return box.getBoundingClientRect().height <= avail + 1; };
    if (fits(1)) { inner.style.zoom = ""; return; }
    // largest size that still fits (text reflows as it shrinks, so search rather than scale)
    let lo = minZoom(), hi = 1;
    if (!fits(lo)) { inner.classList.add("scrolls"); inner.scrollTop = 0; return; }
    for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    inner.style.zoom = String(Math.round(lo * 1000) / 1000);
  };

  // Diagrams keep the shape they were drawn for; the card grows rather than squeezing them.
  const narrowScreen = () => matchMedia("(max-width: 899px)").matches;
  const ratioOf = (cv) => {
    const film = cv.dataset.film, phone = matchMedia("(max-width: 640px)").matches;
    if (cv.closest(".reel")) return phone && film === "robot" ? 1 : 16 / 9;
    if (phone) return film === "aws" ? 1 : 4 / 3;
    return 2;
  };
  const sizeFig = (pg) => {
    const stage = pg.querySelector(".back .fig-stage"), cv = stage?.querySelector("canvas");
    if (!cv) return;
    pg.style.height = "";
    const r = ratioOf(cv);
    cv.style.width = cv.style.height = "0px";
    if (narrowScreen()) { const w = stage.clientWidth; cv.style.width = w + "px"; cv.style.height = Math.round(w / r) + "px"; return; }
    const sw = stage.clientWidth, sh = stage.clientHeight;
    let w = Math.min(sw, sh * r);
    const min = Math.min(sw, 560);
    if (w < min) { pg.style.height = pg.offsetHeight + Math.ceil(min / r - sh) + "px"; w = min; }
    cv.style.width = Math.floor(w) + "px"; cv.style.height = Math.floor(w / r) + "px";
    // the step list scrolls in its own column if it is taller than the diagram area
    const ol = pg.querySelector(".back .steps");
    if (ol) ol.style.maxHeight = stage.clientHeight + "px";
  };

  document.querySelectorAll("[data-carousel]").forEach((track) => {
    const slides = [...track.children];
    if (slides.length < 2) return;
    const section = track.closest("section");
    const noun = track.dataset.noun || "entry";
    const Noun = noun[0].toUpperCase() + noun.slice(1);
    const behavior = reduce ? "auto" : "smooth";
    const name = (el) => el.dataset.tab || el.querySelector("h3")?.textContent.trim() || "";
    const full = (el) => el.dataset.label || name(el);
    track.classList.add("is-stepper");
    section.classList.add("has-stepper");

    let after = section.nextElementSibling;
    while (after && !(after.tagName === "SECTION" && after.id)) after = after.nextElementSibling;
    const afterName = after ? (after.dataset.label || after.querySelector("h2")?.textContent.trim()) : "";

    // each entry becomes one card: the write-up on the front, its diagram on the back
    const isProj = noun === "project";
    const flipText = isProj ? "Flip to see it run" : "Flip to see how it works";
    const pagesOf = slides.map((sl) => {
      const fig = sl.querySelector(":scope > figure, :scope > .footage");
      const page = sl.classList.contains("reel") ? sl : document.createElement("div");
      page.classList.add("page", "page-card");
      const card = document.createElement("div"); card.className = "card";
      const turn = document.createElement("div"); turn.className = "card-inner";
      const front = document.createElement("div"); front.className = "face front";
      const inner = document.createElement("div"); inner.className = "page-inner";
      const box = document.createElement("div"); box.className = "fit-box"; inner.append(box);
      [...sl.childNodes].forEach((n) => { if (n !== fig) box.append(n); });
      front.append(inner); turn.append(front); card.append(turn);
      if (page === sl) sl.append(card); else { page.append(card); sl.append(page); }
      if (!fig) { card.classList.add("single"); return [page]; }
      fig.classList.add("footage", "is-open");
      const back = document.createElement("div"); back.className = "face back";
      const stage = document.createElement("div"); stage.className = "fig-stage";
      const cv = fig.querySelector("canvas"); cv.before(stage); stage.append(cv);
      let head = fig.querySelector(".fig-head");
      if (!head) { head = document.createElement("div"); head.className = "fig-head"; head.innerHTML = `<span class="fig-kicker">${isProj ? "Demo" : "Diagram"}</span><span class="fig-title">${sl.querySelector("h3")?.textContent.trim() || name(sl)}</span>`; fig.prepend(head); }
      const unflip = document.createElement("button");
      unflip.type = "button"; unflip.className = "flip-back";
      unflip.innerHTML = `<i aria-hidden="true">&#8634;</i> Back to the details`;
      head.append(unflip);
      back.append(fig); turn.append(back);
      const flip = document.createElement("button");
      flip.type = "button"; flip.className = "flip-btn";
      flip.innerHTML = `<span>${flipText}</span><i aria-hidden="true">&#8635;</i>`;
      front.append(flip);
      // live preview of the diagram, top right of the front: the motion is the cue
      const peek = document.createElement("button");
      peek.type = "button"; peek.className = "peek"; peek.setAttribute("aria-label", flipText);
      peek.innerHTML = `<span class="peek-call" aria-hidden="true">
          <span class="peek-title">${isProj ? "See it run" : "See it in action"}</span>
          <span class="peek-sub">Click to flip the card</span>
          <svg class="peek-arrow peek-r" viewBox="0 0 64 36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 26 C 18 6, 40 4, 58 16"/><path d="M48 9 L58 16 L47 21"/></svg>
          <svg class="peek-arrow peek-d" viewBox="0 0 40 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4 C 30 10, 32 26, 24 42"/><path d="M17 34 L24 43 L31 35"/></svg>
        </span><span class="peek-frame"><canvas aria-hidden="true"></canvas></span>`;
      const tc = peek.querySelector("canvas");
      const headRow = document.createElement("div"); headRow.className = "front-head";
      const left = document.createElement("div"); left.className = "front-head-text";
      const sceneCard = box.querySelector(".scene-card");
      if (sceneCard) { const dates = box.querySelector(":scope > .dates"); if (dates) left.append(dates); left.append(sceneCard); }
      else { const txt = box.querySelector(":scope > div"); if (txt) left.append(txt); }
      headRow.append(left, peek); box.prepend(headRow);
      peeks.push({ tc, src: cv, card });
      const set = (on, kb) => {
        card.classList.toggle("is-flipped", on);
        front.inert = on; back.inert = !on;
        front.setAttribute("aria-hidden", String(on)); back.setAttribute("aria-hidden", String(!on));
        dispatchEvent(new Event("resize"));
        if (kb) setTimeout(() => (on ? unflip : flip).focus({ preventScroll: true }), reduce ? 0 : 400);
      };
      card.unflip = () => { card.classList.remove("is-flipped"); front.inert = false; back.inert = true; back.setAttribute("aria-hidden", "true"); front.setAttribute("aria-hidden", "false"); };
      card.unflip();
      flip.addEventListener("click", (e) => set(true, e.detail === 0));
      peek.addEventListener("click", (e) => set(true, e.detail === 0));
      unflip.addEventListener("click", (e) => set(false, e.detail === 0));
      return [page];
    });

    // sticky bar: chapter name, every entry, and Next
    const h2 = section.querySelector(".chapter-title");
    const nav = document.createElement("div");
    nav.className = "slide-nav";
    nav.innerHTML = `<div class="slide-tabs" role="tablist" aria-label="${track.getAttribute("aria-label") || "Entries"}"></div>
      <div class="slide-ctrl"><span class="slide-count"></span>
      <button type="button" class="slide-prev" aria-label="Previous ${noun}">&larr;</button>
      <button type="button" class="slide-next"><span></span><i aria-hidden="true">&rarr;</i></button></div>`;
    if (h2) { h2.classList.remove("chapter-title"); h2.classList.add("slide-title"); nav.prepend(h2); }
    const tabs = slides.map((sl, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab");
      b.innerHTML = `<small>${String(i + 1).padStart(2, "0")}</small>${name(sl)}`;
      b.addEventListener("click", () => go(i));
      nav.querySelector(".slide-tabs").append(b);
      return b;
    });
    track.before(nav);

    // end of every entry: Next on top, Previous under it
    const foot = document.createElement("div");
    foot.className = "slide-foot";
    foot.innerHTML = `<button type="button" class="foot-prev"></button>
      <button type="button" class="foot-next"><small></small><span></span><i aria-hidden="true">&rarr;</i></button>`;
    const more = section.querySelector(".more");
    // wide screens: slim tabs in the side margins instead of a row under the card
    const sPrev = document.createElement("button"), sNext = document.createElement("button");
    sPrev.type = sNext.type = "button";
    sPrev.className = "side-tab side-prev"; sNext.className = "side-tab side-next";
    sPrev.addEventListener("click", () => step(-1));
    sNext.addEventListener("click", () => step(1));

    const count = nav.querySelector(".slide-count");
    const prev = nav.querySelector(".slide-prev"), next = nav.querySelector(".slide-next");
    const fPrev = foot.querySelector(".foot-prev"), fNext = foot.querySelector(".foot-next");
    let cur = -1;
    const measure = () => section.style.setProperty("--subnav", nav.offsetHeight + "px");
    const refit = () => { measure(); if (cur >= 0) pagesOf[cur].forEach((pg) => { sizeFig(pg); fitPage(pg); }); };
    const leave = () => after && after.scrollIntoView({ behavior, block: "start" });
    function show(i) {
      i = clamp(i, 0, slides.length - 1);
      const dir = i >= cur ? 1 : -1;
      if (i !== cur) {
        slides.forEach((sl, k) => { sl.hidden = k !== i; sl.classList.remove("enter-l", "enter-r"); });
        if (cur >= 0 && !reduce) { void slides[i].offsetWidth; slides[i].classList.add(dir > 0 ? "enter-r" : "enter-l"); }
        cur = i;
      }
      const last = i === slides.length - 1;
      tabs.forEach((b, k) => { b.setAttribute("aria-selected", String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      const tl = tabs[i].parentElement;
      tl.scrollTo({ left: tabs[i].offsetLeft - tl.offsetLeft - 24, behavior });
      count.textContent = `${Noun} ${i + 1} of ${slides.length}`;
      prev.disabled = i === 0;
      next.querySelector("span").textContent = last ? (after ? `On to ${afterName}` : "Done") : `Next: ${name(slides[i + 1])}`;
      next.querySelector("i").innerHTML = last ? "&darr;" : "&rarr;";
      next.disabled = last && !after;
      fNext.hidden = last && !after;
      fNext.querySelector("small").textContent = last ? `That's every ${noun}` : `Next ${noun}`;
      fNext.querySelector("span").textContent = last ? `Continue to ${afterName}` : full(slides[i + 1]);
      fNext.querySelector("i").innerHTML = last ? "&darr;" : "&rarr;";
      fPrev.hidden = i === 0;
      if (i > 0) fPrev.innerHTML = `<i aria-hidden="true">&larr;</i> Previous: ${full(slides[i - 1])}`;
      const lastPage = pagesOf[i][pagesOf[i].length - 1];
      lastPage.querySelector(".card")?.unflip?.();
      lastPage.append(foot);
      sPrev.hidden = i === 0;
      // thin drawn arrows, no box: the labelled Next lives in the top bar
      const svg = (d) => `<svg viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">${d}</svg>`;
      const R = svg('<path d="M4 15h22M18 7l8 8-8 8"/>'), L = svg('<path d="M26 15H4M12 7l-8 8 8 8"/>'), D = svg('<path d="M15 4v22M7 18l8 8 8-8"/>');
      if (i > 0) { sPrev.innerHTML = L; sPrev.setAttribute("aria-label", `Previous ${noun}: ${full(slides[i - 1])}`); sPrev.title = full(slides[i - 1]); }
      sNext.hidden = last && !after;
      sNext.innerHTML = last ? D : R;
      sNext.title = last ? afterName : full(slides[i + 1]);
      sNext.setAttribute("aria-label", last ? `Continue to ${afterName}` : `Next ${noun}: ${full(slides[i + 1])}`);
      lastPage.append(sPrev, sNext);
      if (more) fPrev.after(more);
      refit();
      dispatchEvent(new Event("resize"));
      dispatchEvent(new Event("scroll"));
    }
    // switch entry and land on its first page
    function go(i) {
      show(i);
      requestAnimationFrame(() => pagesOf[cur][0].scrollIntoView({ behavior, block: "start" }));
    }
    const step = (d) => (cur + d >= slides.length ? leave() : cur + d >= 0 && go(cur + d));
    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    fPrev.addEventListener("click", () => step(-1));
    fNext.addEventListener("click", () => step(1));
    nav.querySelector(".slide-tabs").addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault(); show(cur + d); tabs[cur].focus();
    });
    let sx = 0, sy = 0, st = 0;
    track.addEventListener("touchstart", (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
    track.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        const k = cur + (dx < 0 ? 1 : -1);
        if (k >= 0 && k < slides.length) go(k);
      }
    }, { passive: true });
    show(0);
    let rt; addEventListener("resize", (e) => { if (!e.isTrusted) return; clearTimeout(rt); rt = setTimeout(refit, 120); });
    document.fonts?.ready.then(refit);
    carousels.push({ slides, go });
  });
  // Links into an entry (index panel, #hash) open that entry first.
  const openEntry = (hash) => {
    if (!hash || hash.length < 2) return;
    let el; try { el = document.querySelector(hash); } catch { return; }
    for (const c of carousels) {
      const i = c.slides.findIndex((sl) => sl === el || sl.contains(el));
      if (i >= 0) { c.go(i); return; }
    }
  };
  document.addEventListener("click", (e) => { const a = e.target.closest('a[href^="#"]'); if (a) openEntry(a.getAttribute("href")); }, true);
  addEventListener("hashchange", () => openEntry(location.hash));
  openEntry(location.hash);

  // ---------- up / down: step through the snap points one at a time ----------
  const secUp = document.querySelector(".sec-up"), secDown = document.querySelector(".sec-down");
  if (secUp && secDown) {
    const stops = () => [...document.querySelectorAll(".title, .about, .page, .chapter:not(.has-stepper), .closing")]
      .filter((el) => el.offsetParent && !el.closest("[hidden]"));
    // where each stop sits once snapped (its scroll-margin and the top bar included)
    const restY = (el) => {
      const r = el.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar")) || 0;
      return r.top - top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    };
    const move = (d) => {
      const list = stops();
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar")) || 0;
      const view = innerHeight - 2 * bar, b = reduce ? "auto" : "smooth";
      // inside a stop taller than the screen, page through it before moving on
      const here = [...list].reverse().find((el) => restY(el) <= 4);
      if (here) {
        const r = here.getBoundingClientRect();
        if (d > 0 && r.bottom > innerHeight - bar + 24) { scrollBy({ top: Math.min(view - 40, r.bottom - (innerHeight - bar)), behavior: b }); return; }
        if (d < 0 && restY(here) < -4) { scrollBy({ top: Math.max(-(view - 40), restY(here)), behavior: b }); return; }
      }
      const target = d > 0 ? list.find((el) => restY(el) > 4) : [...list].reverse().find((el) => restY(el) < -4);
      if (target) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      else if (d < 0) scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    };
    secUp.addEventListener("click", () => move(-1));
    secDown.addEventListener("click", () => move(1));
    const syncArrows = () => {
      secUp.disabled = scrollY < 4;
      secDown.disabled = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    };
    addEventListener("scroll", syncArrows, { passive: true });
    syncArrows();
  }

  // ---------- bottom bar label ----------
  const label = document.querySelector(".counter-name");
  const labeled = [...document.querySelectorAll("[data-label]")];
  if (label) {
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = innerHeight * 0.5;
      let pick = null;
      for (const el of labeled) { const r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom >= mid && r.right > 0 && r.left < innerWidth) pick = el; }
      if (pick && label.textContent !== pick.dataset.label) label.textContent = pick.dataset.label;
    };
    addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  // ---------- index panel ----------
  const btn = document.querySelector(".index-btn");
  const panel = document.getElementById("index-panel");
  if (btn && panel) {
    const scrim = document.createElement("div");
    scrim.className = "index-scrim";
    document.body.appendChild(scrim);
    const open = () => {
      panel.hidden = false; btn.setAttribute("aria-expanded", "true");
      document.documentElement.classList.add("index-open");
      requestAnimationFrame(() => panel.querySelector("a").focus({ preventScroll: true }));
    };
    const close = (focusBtn = true) => {
      panel.hidden = true; btn.setAttribute("aria-expanded", "false");
      document.documentElement.classList.remove("index-open");
      if (focusBtn) btn.focus({ preventScroll: true });
    };
    btn.addEventListener("click", () => (panel.hidden ? open() : close()));
    scrim.addEventListener("click", () => close());
    panel.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      close(false);
      const target = document.querySelector(a.getAttribute("href"));
      if (target) {
        const heading = target.querySelector("h2, h3") || target;
        heading.setAttribute("tabindex", "-1");
        setTimeout(() => heading.focus({ preventScroll: true }), 50);
      }
    });
    panel.addEventListener("focusout", (e) => {
      if (!panel.hidden && e.relatedTarget && !panel.contains(e.relatedTarget) && e.relatedTarget !== btn) close(false);
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });
  }
})();
