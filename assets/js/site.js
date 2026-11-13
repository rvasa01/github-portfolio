// Rahil Vasa — footage of the work, drawn live.
(() => {
  document.documentElement.classList.add("js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const C = {
    black: "#000000", panel: "#0e1013", bone: "#f2f0ea", dim: "#b3b0a8", faint: "#3a3f44",
    steel: "#2a3b4a", mid: "#4d6a82", grade: "#8fb2cc", deep: "#16212b", warn: "#e8b04a",
  };
  const FAMILY = '"Hanken Grotesk", system-ui, sans-serif';

  // ---------- drawing helpers ----------
  function fit(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  function text(ctx, s, x, y, o = {}) {
    ctx.font = `${o.weight || 600} ${o.size || 12}px ${FAMILY}`;
    ctx.fillStyle = o.color || C.bone;
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.base || "alphabetic";
    ctx.fillText(s, x, y);
  }
  function box(ctx, x, y, w, h, o = {}) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, o.r ?? 4); else ctx.rect(x, y, w, h);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 1.5; ctx.stroke(); }
  }
  function arrow(ctx, x1, y1, x2, y2, color, lw = 1.5, head = 7) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
    ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fill();
  }
  function pip(ctx, x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
  // Font size that scales with the frame but never drops below legible.
  const fs = (w, base) => Math.round(clamp(base * (w / 900), 11, base * 1.15));

  const films = {
    // ---------- Conway's Game of Life ----------
    life(canvas, opts = {}) {
      let grid, cols, rows, cell, gen = 0, rand = rng(7), lastW = 0;
      function seed(w, h) {
        cell = w < 500 ? 7 : 9;
        cols = Math.ceil(w / cell); rows = Math.ceil(h / cell);
        grid = new Uint8Array(cols * rows);
        for (let i = 0; i < grid.length; i++) grid[i] = rand() < 0.22 ? 1 : 0;
        gen = 0; lastW = w;
      }
      function step() {
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
      const bands = opts.bands || 0;
      return {
        tick: 110, still: 30,
        subtitle: () => bands
          ? "Four threads each update their own strip of the grid at the same time."
          : "Each cell lives or dies by counting its eight neighbors, one generation at a time.",
        draw() {
          const { ctx, w, h } = fit(canvas);
          if (!grid || Math.abs(w - lastW) > 40) seed(w, h);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            if (!grid[y * cols + x]) continue;
            if (bands) ctx.fillStyle = Math.floor((x / cols) * bands) % 2 ? C.grade : C.bone;
            else ctx.fillStyle = (x * 31 + y * 17) % 23 === 0 ? C.bone : C.mid;
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          }
          if (bands) {
            for (let b = 1; b < bands; b++) { ctx.fillStyle = C.dim; ctx.fillRect(Math.round((b / bands) * w), 0, 1, h); }
            for (let b = 0; b < bands; b++) {
              const lx = (b / bands) * w + 8, label = "thread " + (b + 1);
              ctx.font = `600 12px ${FAMILY}`;
              box(ctx, lx - 4, 8, ctx.measureText(label).width + 8, 20, { fill: C.black, r: 2 });
              text(ctx, label, lx, 23, { size: 12 });
            }
          }
          step();
        },
      };
    },
    threads(canvas) { return films.life(canvas, { bands: 4 }); },

    // ---------- Deterministic FSM with a clock ----------
    fsm(canvas) {
      const S = [
        { name: "Intent", q: "What do you need?", a: "Analyze a client's portfolio" },
        { name: "Account", q: "Which account?", a: "Taxable equity account" },
        { name: "Horizon", q: "Over what time horizon?", a: "5 years" },
        { name: "Risk", q: "What risk tolerance?", a: "Moderate" },
        { name: "Output", q: "Generate the report?", a: "Yes" },
      ];
      const STEP = 96, HOLD = 90, CYCLE = S.length * STEP + HOLD;
      let t = 0;
      const where = () => {
        const c = t % CYCLE;
        if (c >= S.length * STEP) return { i: S.length - 1, p: 1, done: true, hold: (c - S.length * STEP) / HOLD };
        return { i: Math.floor(c / STEP), p: (c % STEP) / STEP, done: false };
      };
      return {
        tick: 33, still: S.length * STEP + 10,
        subtitle() {
          const { i, p, done } = where();
          if (done) return "Same answers, same path, same output: one portfolio report, every time.";
          if (p < 0.38) return `Clock tick ${i + 1}: the machine enters the ${S[i].name} state and asks one question.`;
          if (p < 0.72) return "It cannot move on until the user answers.";
          return i < S.length - 1 ? `The answer is in, so the next tick moves it to ${S[i + 1].name}.` : "Every state is answered, so the machine lands on a single output.";
        },
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const { i, p, done, hold } = where();
          const n = S.length, pad = w * 0.08, ny = h * 0.7;
          text(ctx, "Use case: portfolio analysis", 16, 16 + fs(w, 14), { size: fs(w, 14), weight: 800 });
          text(ctx, "one question per state", 16, 22 + fs(w, 14) * 2, { size: Math.max(10, fs(w, 14) - 2), color: C.dim });
          const xs = S.map((_, k) => pad + (k * (w - 2 * pad)) / (n - 1));
          const r = clamp(w / 34, 13, 28), f = fs(w, 14);

          for (let k = 0; k < n - 1; k++) {
            const lit = k < i || (k === i && p > 0.72 && !done);
            const x1 = xs[k] + r + 4, x2 = xs[k + 1] - r - 6;
            arrow(ctx, x1, ny, x2, ny, lit ? C.grade : C.faint, lit ? 2 : 1.5, 8);
            if (k === i && p > 0.72 && !done) pip(ctx, lerp(x1, x2, ease((p - 0.72) / 0.28)), ny, 4, C.bone);
          }
          S.forEach((s, k) => {
            const active = k === i, visited = k < i || done;
            ctx.beginPath(); ctx.arc(xs[k], ny, r, 0, Math.PI * 2);
            ctx.fillStyle = active ? C.bone : visited ? C.steel : C.black; ctx.fill();
            ctx.strokeStyle = active || visited ? C.grade : C.faint; ctx.lineWidth = 2; ctx.stroke();
            if (k === n - 1) { ctx.beginPath(); ctx.arc(xs[k], ny, r - 5, 0, Math.PI * 2); ctx.strokeStyle = active ? C.black : C.faint; ctx.lineWidth = 1.5; ctx.stroke(); }
            text(ctx, String(k + 1), xs[k], ny + 1, { size: f, weight: 700, align: "center", base: "middle", color: active ? C.black : C.dim });
            text(ctx, s.name, xs[k], ny + r + f + 6, { size: f, weight: 600, align: "center", color: active ? C.bone : C.dim });
          });

          const cr = clamp(h * 0.07, 14, 26), cx = w - cr - 16, cy = cr + 16;
          ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.strokeStyle = C.dim; ctx.lineWidth = 2; ctx.stroke();
          for (let k = 0; k < n; k++) {
            const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
            ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (cr - 5), cy + Math.sin(a) * (cr - 5)); ctx.lineTo(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr);
            ctx.strokeStyle = k <= i ? C.grade : C.faint; ctx.stroke();
          }
          const ha = -Math.PI / 2 + ((i + (done ? 1 : p)) / n) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * (cr - 6), cy + Math.sin(ha) * (cr - 6)); ctx.strokeStyle = C.bone; ctx.lineWidth = 2; ctx.stroke();
          text(ctx, `tick ${done ? n : i + 1} / ${n}`, cx - cr - 10, cy + 4, { size: f - 1, align: "right", color: C.dim });

          const fq = f + 2, cw = Math.min(w - 24, Math.max(250, w * 0.4)), lh = fq * 1.6;
          const ch = lh * 2 + 22, cxl = clamp(xs[i] - cw / 2, 12, w - cw - 12), cyt = clamp(h * 0.3, cy + cr + 12, ny - r - ch - 30);
          box(ctx, cxl, cyt, cw, ch, { fill: C.panel, stroke: C.mid, r: 6 });
          ctx.beginPath(); ctx.moveTo(clamp(xs[i], cxl + 12, cxl + cw - 12), cyt + ch); ctx.lineTo(xs[i], ny - r - 4); ctx.strokeStyle = C.mid; ctx.lineWidth = 1.5; ctx.stroke();
          if (done) {
            text(ctx, "Output", cxl + 14, cyt + 10 + lh * 0.8, { size: fq, weight: 700, color: C.grade });
            text(ctx, "Portfolio report, generated", cxl + 14, cyt + 10 + lh * 1.8, { size: fq, weight: 600 });
          } else {
            const qn = Math.floor(S[i].q.length * clamp(p / 0.3, 0, 1));
            const an = Math.floor(S[i].a.length * clamp((p - 0.38) / 0.3, 0, 1));
            text(ctx, "Asks", cxl + 14, cyt + 10 + lh * 0.8, { size: fq, weight: 700, color: C.grade });
            text(ctx, S[i].q.slice(0, qn), cxl + 14 + fq * 3.3, cyt + 10 + lh * 0.8, { size: fq });
            text(ctx, "User", cxl + 14, cyt + 10 + lh * 1.8, { size: fq, weight: 700, color: C.dim });
            text(ctx, S[i].a.slice(0, an), cxl + 14 + fq * 3.3, cyt + 10 + lh * 1.8, { size: fq });
          }
          t++;
        },
      };
    },

    // ---------- AWS: S3 + ECR → Fargate tasks in a private VPC → prioritization ----------
    aws(canvas) {
      const P = 96, PHASES = 4, CYCLE = P * PHASES;
      const rand = rng(42);
      const speed = Array.from({ length: 100 }, () => 0.75 + rand() * 0.5);
      let t = 0;
      const subs = [
        "Firmware images for BMC, BIOS, and GPU are stored in an S3 bucket.",
        "CloudFormation stands up 100 ECS Fargate tasks in a private VPC; each pulls the EMBA scanner image from ECR.",
        "Each task runs EMBA on one image: static analysis first (Binwalk, YARA), then dynamic (QEMU, fuzzing).",
        "Findings flow out and are ranked by platform risk, so BMC, BIOS, and GPU fixes get the right priority.",
      ];
      return {
        tick: 33, still: CYCLE - 2,
        subtitle: () => subs[Math.floor((t % CYCLE) / P)],
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const c = t % CYCLE, ph = Math.floor(c / P), pp = (c % P) / P;
          const f = fs(w, 14), narrow = w < 560, m = 14, small = Math.max(10, f - 2);
          let s3, ecr, vpc, out;
          if (!narrow) {
            s3 = { x: m, y: h * 0.08, w: w * 0.19, h: h * 0.5 };
            ecr = { x: m, y: h * 0.64, w: w * 0.19, h: h * 0.28 };
            vpc = { x: w * 0.25, y: h * 0.05, w: w * 0.5, h: h * 0.9 };
            out = { x: w * 0.79, y: h * 0.2, w: w * 0.21 - m, h: h * 0.6 };
          } else {
            s3 = { x: m, y: m, w: w * 0.3, h: h * 0.3 };
            ecr = { x: m, y: m + h * 0.33, w: w * 0.3, h: h * 0.2 };
            vpc = { x: w * 0.36, y: m, w: w * 0.64 - m, h: h * 0.6 };
            out = { x: m, y: h * 0.68, w: w - 2 * m, h: h * 0.3 - m };
          }
          // S3 bucket with a pile that never empties (200+ images)
          box(ctx, s3.x, s3.y, s3.w, s3.h, { fill: C.panel, stroke: ph === 0 ? C.bone : C.mid, r: 6 });
          text(ctx, "S3", s3.x + 10, s3.y + f + 6, { size: f + 2, weight: 800 });
          text(ctx, "200+ firmware images", s3.x + 10, s3.y + f * 2 + 10, { size: small, color: C.dim });
          const ccols = narrow ? 2 : 3, chipW = (s3.w - 20 - (ccols - 1) * 4) / ccols, chipH = clamp(f + 4, 14, 20);
          const chipTop = s3.y + f * 2 + 20, fitRows = Math.max(1, Math.floor((s3.y + s3.h - 8 - chipTop) / (chipH + 4)));
          const shown = ph === 2 ? Math.max(ccols, Math.round(fitRows * ccols * (1 - pp * 0.6))) : ph === 3 ? Math.ceil(fitRows * ccols * 0.4) : fitRows * ccols;
          for (let k = 0; k < shown; k++) {
            const cx = s3.x + 10 + (k % ccols) * (chipW + 4), cy = chipTop + Math.floor(k / ccols) * (chipH + 4);
            if (cy + chipH > s3.y + s3.h - 6) break;
            box(ctx, cx, cy, chipW, chipH, { fill: C.steel, r: 2 });
            text(ctx, ["BMC", "BIOS", "GPU"][k % 3], cx + chipW / 2, cy + chipH / 2 + 1, { size: Math.max(10, f - 3), align: "center", base: "middle" });
          }
          // ECR outside the VPC
          box(ctx, ecr.x, ecr.y, ecr.w, ecr.h, { fill: C.panel, stroke: ph === 1 ? C.bone : C.mid, r: 6 });
          text(ctx, "ECR", ecr.x + 10, ecr.y + f + 6, { size: f + 1, weight: 800 });
          text(ctx, "EMBA scanner image", ecr.x + 10, ecr.y + f * 2 + 10, { size: small, color: C.dim });
          // VPC
          box(ctx, vpc.x, vpc.y, vpc.w, vpc.h, { stroke: ph >= 1 ? C.grade : C.faint, lw: 1.5, r: 8 });
          text(ctx, "Private VPC", vpc.x + 12, vpc.y + f + 6, { size: f, weight: 800 });
          text(ctx, narrow ? "CloudFormation" : "provisioned by CloudFormation", vpc.x + vpc.w - 12, vpc.y + f + 6, { size: small, align: "right", color: C.dim });
          // legend
          const ly = vpc.y + vpc.h - 10;
          box(ctx, vpc.x + 12, ly - 9, 10, 10, { fill: C.grade, r: 1 });
          text(ctx, narrow ? "static" : "static: Binwalk, YARA", vpc.x + 28, ly, { size: small, color: C.dim });
          const lx2 = vpc.x + 12 + (narrow ? 70 : 170);
          box(ctx, lx2, ly - 9, 10, 10, { fill: C.bone, r: 1 });
          text(ctx, narrow ? "dynamic" : "dynamic: QEMU, fuzzing", lx2 + 16, ly, { size: small, color: C.dim });
          // task tiles: 10 x 10, each an EMBA run with a static and a dynamic half
          const gx = vpc.x + 12, gy = vpc.y + f + 18, gw = vpc.w - 24, gh = ly - 22 - gy;
          const cols = 10, rows = 10, tw = gw / cols, th = gh / rows;
          for (let k = 0; k < 100; k++) {
            const x = gx + (k % cols) * tw, y = gy + Math.floor(k / cols) * th;
            const up = ph === 1 ? k / 100 < ease(pp * 1.4) : ph >= 2;
            box(ctx, x + 2, y + 2, tw - 4, th - 4, { fill: up ? C.deep : "#07090b", stroke: up ? C.steel : C.faint, lw: 1, r: 2 });
            if (!up) continue;
            const prog = ph === 2 ? clamp(pp * 1.3 * speed[k], 0, 1) : ph === 3 ? 1 : 0;
            const half = (tw - 8) / 2, bh = Math.max(3, th * 0.22), by = y + th - bh - 5;
            box(ctx, x + 4, by, half * clamp(prog * 2, 0, 1), bh, { fill: C.grade, r: 1 });
            box(ctx, x + 4 + half, by, half * clamp(prog * 2 - 1, 0, 1), bh, { fill: C.bone, r: 1 });
            if (tw > 44 && th > 30) text(ctx, "EMBA", x + tw / 2, y + th * 0.42, { size: Math.max(10, f - 4), align: "center", base: "middle", color: C.dim });
          }
          // flows
          const s3o = [s3.x + s3.w + 4, s3.y + s3.h / 2], s3i = [vpc.x - 4, s3.y + s3.h / 2];
          arrow(ctx, s3o[0], s3o[1], s3i[0], s3i[1], ph === 2 ? C.grade : C.faint, 2, 8);
          if (ph === 2) for (let k = 0; k < 3; k++) pip(ctx, lerp(s3o[0], s3i[0], (pp * 3 + k / 3) % 1), s3o[1], 3.5, C.bone);
          const eo = [ecr.x + ecr.w + 4, ecr.y + ecr.h / 2], ei = [vpc.x - 4, ecr.y + ecr.h / 2];
          arrow(ctx, eo[0], eo[1], ei[0], ei[1], ph === 1 ? C.bone : C.faint, 2, 8);
          if (ph === 1) pip(ctx, lerp(eo[0], ei[0], (pp * 3) % 1), eo[1], 3.5, C.bone);
          const v1 = narrow ? [vpc.x + vpc.w / 2, vpc.y + vpc.h + 4] : [vpc.x + vpc.w + 4, out.y + out.h / 2];
          const v2 = narrow ? [vpc.x + vpc.w / 2, out.y - 4] : [out.x - 4, out.y + out.h / 2];
          arrow(ctx, v1[0], v1[1], v2[0], v2[1], ph === 3 ? C.grade : C.faint, 2, 8);
          if (ph === 3) for (let k = 0; k < 3; k++) { const q = (pp * 3 + k / 3) % 1; pip(ctx, lerp(v1[0], v2[0], q), lerp(v1[1], v2[1], q), 3.5, C.bone); }
          // prioritization
          box(ctx, out.x, out.y, out.w, out.h, { fill: C.panel, stroke: ph === 3 ? C.bone : C.mid, r: 6 });
          text(ctx, "Prioritize", out.x + 10, out.y + f + 6, { size: f + 1, weight: 800 });
          text(ctx, "by platform risk", out.x + 10, out.y + f * 2 + 10, { size: small, color: C.dim });
          const bars = [["BMC", 0.92], ["BIOS", 0.64], ["GPU", 0.4]];
          const bx = out.x + 10, by0 = out.y + f * 2 + 22, bh = clamp((out.y + out.h - by0 - 8) / 3 - 6, 6, 22), lab = f * 3;
          bars.forEach(([name, v], k) => {
            const y = by0 + k * (bh + 6), grow = ph === 3 ? ease(pp * 1.6) : 0;
            text(ctx, name, bx, y + bh / 2 + 1, { size: small, base: "middle", color: C.dim });
            box(ctx, bx + lab, y, out.w - lab - 22, bh, { stroke: C.faint, lw: 1, r: 2 });
            if (grow > 0) box(ctx, bx + lab, y, (out.w - lab - 22) * v * grow, bh, { fill: k === 0 ? C.bone : C.grade, r: 2 });
          });
          t++;
        },
      };
    },

    // ---------- Honeypot network map ----------
    honeypot(canvas) {
      const P = 96, PHASES = 4, CYCLE = P * PHASES;
      let t = 0;
      const subs = [
        "Attackers scan the internet for open ports; the firewall drops most probes.",
        "The few probes that get through land on decoy services posing as SSH and RDP, not on the real servers.",
        "Each decoy logs the attacker's IP and the port it targeted, and reports it to the central monitoring server.",
        "The real web and database servers stay untouched while the attack is recorded.",
      ];
      function laptop(ctx, x, y, s, color) {
        box(ctx, x - s * 0.6, y - s * 0.45, s * 1.2, s * 0.75, { fill: C.panel, stroke: color, lw: 1.5, r: 2 });
        ctx.fillStyle = color; ctx.fillRect(x - s * 0.8, y + s * 0.34, s * 1.6, 3);
      }
      function server(ctx, x, y, w, h, color, fill) {
        box(ctx, x, y, w, h, { fill: fill || C.panel, stroke: color, lw: 1.5, r: 4 });
        if (w < 130) return;
        const units = 3, uh = (h - 10) / units;
        for (let u = 0; u < units; u++) {
          ctx.fillStyle = C.faint; ctx.fillRect(x + 6, y + 5 + u * uh + uh - 2, Math.min(28, w * 0.25), 1);
          pip(ctx, x + Math.min(40, w * 0.33), y + 5 + u * uh + uh / 2, 2, color);
        }
      }
      return {
        tick: 33, still: P * 2 + 60,
        subtitle: () => subs[Math.floor((t % CYCLE) / P)],
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const c = t % CYCLE, ph = Math.floor(c / P), pp = (c % P) / P;
          const f = fs(w, 14), narrow = w < 560, small = Math.max(10, f - 2), m = 12;
          const inet = { x: m, y: m, w: w * 0.2, h: h - 2 * m };
          const fw = { x: w * 0.26, y: m, w: clamp(w * 0.025, 10, 20), h: h - 2 * m };
          const lan = { x: w * 0.33, y: m, w: w * 0.67 - m, h: h - 2 * m };
          box(ctx, inet.x, inet.y, inet.w, inet.h, { stroke: C.faint, r: 8 });
          text(ctx, "Internet", inet.x + 10, inet.y + f + 6, { size: f, weight: 800 });
          box(ctx, lan.x, lan.y, lan.w, lan.h, { stroke: C.faint, r: 8 });
          text(ctx, narrow ? "Network" : "Company network", lan.x + 10, lan.y + f + 6, { size: f, weight: 800 });
          // firewall: one wall, two open ports
          const gapH = clamp(h * 0.05, 10, 22), g1 = fw.y + fw.h * 0.38, g2 = fw.y + fw.h * 0.62;
          const segs = [[fw.y + f + 14, g1 - gapH / 2], [g1 + gapH / 2, g2 - gapH / 2], [g2 + gapH / 2, fw.y + fw.h]];
          segs.forEach(([a, b]) => box(ctx, fw.x, a, fw.w, b - a, { fill: "#2b2416", stroke: C.warn, lw: 1.5, r: 2 }));
          text(ctx, "Firewall", fw.x + fw.w / 2, fw.y + f + 4, { size: small, weight: 700, align: "center", color: C.warn });
          // attackers as laptops
          const ls = clamp(w * 0.028, 16, 28);
          const atk = [0.3, 0.5, 0.7].map((v) => ({ x: inet.x + inet.w / 2, y: inet.y + inet.h * v }));
          atk.forEach((a, k) => {
            laptop(ctx, a.x, a.y, ls, C.warn);
            if (!narrow) text(ctx, "attacker " + (k + 1), a.x, a.y + ls * 0.75 + f, { size: small, align: "center", color: C.dim });
          });
          // network: real servers (left column), decoys (right column), monitoring (under decoys)
          const colW = clamp(lan.w * 0.4, 90, 260), hh = clamp(h * 0.16, 40, 76);
          const top = lan.y + f + 24, gapY = clamp(h * 0.05, 10, 24);
          const realX = lan.x + 14, decX = lan.x + lan.w - colW - 14;
          const hosts = [
            { label: "Web server", x: realX, y: top, real: true },
            { label: "Database", x: realX, y: top + hh + gapY, real: true },
            { label: narrow ? "SSH :22" : "Decoy SSH :22", x: decX, y: top, real: false },
            { label: narrow ? "RDP :3389" : "Decoy RDP :3389", x: decX, y: top + hh + gapY, real: false },
          ];
          const mon = { x: decX, y: lan.y + lan.h - hh - 14 };
          hosts.forEach((ho) => {
            const flash = !ho.real && ph === 2 && Math.floor(pp * 10) % 2 === 0;
            const col = ho.real ? C.mid : ph >= 1 ? (flash ? C.bone : C.warn) : C.mid;
            server(ctx, ho.x, ho.y, colW, hh, col);
            const tx = ho.x + (colW < 130 ? 8 : Math.min(52, colW * 0.42));
            text(ctx, ho.label, tx, ho.y + hh / 2 - 2, { size: narrow ? 11 : Math.max(11, f - 1), weight: 700 });
            const sub = ho.real ? (ph === 3 ? (narrow ? "untouched" : "real, untouched") : "real") : (narrow ? "decoy" : "OpenCanary");
            text(ctx, sub, tx, ho.y + hh / 2 + f, { size: small, color: ho.real ? (ph === 3 ? C.grade : C.dim) : C.warn });
          });
          server(ctx, mon.x, mon.y, colW, hh, ph >= 2 ? C.grade : C.mid);
          text(ctx, narrow ? "Monitoring" : "Central monitoring", mon.x + (colW < 130 ? 8 : Math.min(52, colW * 0.42)), mon.y + hh / 2 + 4, { size: Math.max(11, f - 1), weight: 700 });
          // probes: bounce off the wall, or pass through an open port to a decoy
          for (let k = 0; k < 6; k++) {
            const a = atk[k % 3], q = (pp * 2 + k / 6) % 1;
            if (ph === 0) {
              const x = q < 0.6 ? lerp(a.x + ls, fw.x, q / 0.6) : lerp(fw.x, a.x + ls * 1.5, (q - 0.6) / 0.4);
              pip(ctx, x, a.y + (k - 3) * 2, 4, C.warn);
            } else if (ph === 1 || ph === 2) {
              const gy = k % 2 ? g2 : g1, target = hosts[2 + (k % 2)];
              const ty = target.y + hh / 2, tx = target.x;
              const pt = q < 0.4 ? [lerp(a.x + ls, fw.x + fw.w / 2, q / 0.4), lerp(a.y, gy, q / 0.4)] : [lerp(fw.x + fw.w / 2, tx, (q - 0.4) / 0.6), lerp(gy, ty, (q - 0.4) / 0.6)];
              pip(ctx, pt[0], pt[1], 4, C.warn);
            }
          }
          // telemetry stays in the decoy column: SSH decoy along the right edge, RDP decoy straight down
          if (ph >= 2) {
            const rd = hosts[3], sd = hosts[2];
            const midX = rd.x + colW / 2;
            if (mon.y - (rd.y + hh) > 14) {
              arrow(ctx, midX, rd.y + hh + 4, midX, mon.y - 4, C.grade, 1.5, 7);
              if (ph === 2) pip(ctx, midX, lerp(rd.y + hh, mon.y, (pp * 3) % 1), 3.5, C.bone);
            }
            const ex = Math.min(lan.x + lan.w - 5, sd.x + colW + 8), sy = sd.y + hh / 2, my = mon.y + hh / 2;
            ctx.strokeStyle = C.grade; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(sd.x + colW + 2, sy); ctx.lineTo(ex, sy); ctx.lineTo(ex, my); ctx.stroke();
            arrow(ctx, ex, my, sd.x + colW + 4, my, C.grade, 1.5, 6);
            if (ph === 2) pip(ctx, ex, lerp(sy, my, (pp * 2.5) % 1), 3.5, C.bone);
            if (!narrow) {
              text(ctx, "log 203.0.113.24 → port 22", mon.x - 14, mon.y + hh / 2 - 2, { size: Math.max(10, f - 3), align: "right", color: C.grade });
              text(ctx, "log 203.0.113.71 → port 3389", mon.x - 14, mon.y + hh / 2 + f, { size: Math.max(10, f - 3), align: "right", color: C.grade });
            }
          }
          t++;
        },
      };
    },

    // ---------- Grid robot: grid simulation ⇄ HELICS ⇄ ROS ----------
    gridbot(canvas) {
      const P = 90, PHASES = 4, CYCLE = P * PHASES;
      let t = 0, pos = 0.1;
      const subs = [
        "A grid simulation produces energy data for the power lines.",
        "HELICS co-simulation exchanges that energy data with ROS.",
        "ROS turns the energy data into motion commands for the line robot.",
        "The energy data drives how the robot moves along the power line.",
      ];
      function crawler(ctx, x, y, s) {
        // two wheels riding on top of the wire, body hanging below, sensor arm
        ctx.strokeStyle = C.bone; ctx.lineWidth = 2;
        [-0.35, 0.35].forEach((o) => {
          ctx.beginPath(); ctx.arc(x + o * s, y - s * 0.12, s * 0.16, 0, Math.PI * 2); ctx.fillStyle = C.panel; ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + o * s, y); ctx.lineTo(x + o * s, y + s * 0.28); ctx.stroke();
        });
        box(ctx, x - s * 0.55, y + s * 0.28, s * 1.1, s * 0.5, { fill: C.bone, r: 4 });
        pip(ctx, x + s * 0.4, y + s * 0.53, s * 0.07, C.black);
        ctx.strokeStyle = C.grade; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - s * 0.2, y + s * 0.78); ctx.lineTo(x - s * 0.2, y + s * 1.0); ctx.lineTo(x + s * 0.15, y + s * 1.12); ctx.stroke();
        pip(ctx, x + s * 0.18, y + s * 1.12, s * 0.08, C.grade);
      }
      return {
        tick: 33, still: CYCLE - 2,
        subtitle: () => subs[Math.floor((t % CYCLE) / P)],
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const c = t % CYCLE, ph = Math.floor(c / P), pp = (c % P) / P;
          const f = fs(w, 14), narrow = w < 560, small = Math.max(10, f - 2);
          const sh = clamp(h * 0.2, 44, 84), sy = h - sh - 12, gap = narrow ? 10 : 22;
          const base = sy - 36, top = 18, towers = narrow ? 3 : 4;
          const tx = Array.from({ length: towers }, (_, k) => w * 0.1 + (k * (w * 0.8)) / (towers - 1));
          const wireY = top + (base - top) * 0.25;
          tx.forEach((x) => {
            ctx.strokeStyle = C.mid; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x - 14, base); ctx.lineTo(x, wireY - 14); ctx.lineTo(x + 14, base); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - 20, wireY - 6); ctx.lineTo(x + 20, wireY - 6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - 9, (wireY + base) / 2); ctx.lineTo(x + 9, (wireY + base) / 2); ctx.stroke();
          });
          const sag = (x) => {
            for (let k = 0; k < towers - 1; k++) if (x >= tx[k] && x <= tx[k + 1]) {
              const u = (x - tx[k]) / (tx[k + 1] - tx[k]); return wireY + Math.sin(u * Math.PI) * (base - wireY) * 0.14;
            }
            return wireY;
          };
          const seg = Math.floor(t / CYCLE) % (towers - 1);
          ctx.lineWidth = 2;
          for (let k = 0; k < towers - 1; k++) {
            ctx.strokeStyle = k === seg ? C.warn : C.dim;
            ctx.beginPath();
            for (let x = tx[k]; x <= tx[k + 1]; x += 4) { const y = sag(x); x === tx[k] ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
            ctx.stroke();
          }
          const segMid = (tx[seg] + tx[seg + 1]) / 2;
          text(ctx, "grid energy data", segMid, top + f - 2, { size: small, align: "center", color: C.warn });
          const goal = (segMid - tx[0]) / (tx[towers - 1] - tx[0]);
          if (ph === 3) pos = lerp(pos, goal, 0.05);
          const rx = lerp(tx[0], tx[towers - 1], pos), ry = sag(rx);
          crawler(ctx, rx, ry, clamp(w * 0.05, 26, 56));

          // architecture strip
          const labels = narrow
            ? [["Grid sim", "PNNL"], ["HELICS", "co-sim"], ["ROS", "control"], ["Robot", "on line"]]
            : [["Grid energy sim", "with PNNL"], ["HELICS", "co-simulation"], ["ROS", "robot control"], ["Line robot", "moves on the wire"]];
          const bwid = (w - 24 - gap * 3) / 4;
          const bx = labels.map((_, k) => 12 + k * (bwid + gap));
          labels.forEach(([a, b], k) => {
            box(ctx, bx[k], sy, bwid, sh, { fill: C.panel, stroke: k === ph ? C.bone : C.mid, r: 5 });
            text(ctx, a, bx[k] + 10, sy + sh / 2 - 2, { size: narrow ? Math.max(11, f - 2) : f + 2, weight: 800 });
            text(ctx, b, bx[k] + 10, sy + sh / 2 + f + 2, { size: Math.max(10, f - 2), color: C.dim });
          });
          // grid sim ↔ HELICS ↔ ROS (two-way), ROS → robot
          for (let k = 0; k < 3; k++) {
            const x1 = bx[k] + bwid + 2, x2 = bx[k + 1] - 2, y = sy + sh / 2;
            const lit = k < ph || (k === ph && ph < 3);
            if (k < 2) {
              arrow(ctx, x1, y - 5, x2, y - 5, lit ? C.grade : C.faint, 1.5, 5);
              arrow(ctx, x2, y + 5, x1, y + 5, lit ? C.grade : C.faint, 1.5, 5);
            } else arrow(ctx, x1, y, x2, y, lit ? C.grade : C.faint, 1.5, 5);
            if (k === ph && ph < 3) pip(ctx, lerp(x1, x2, ease(pp)), y - 5, 3, C.bone);
          }
          // tie the diagram to the scene: wire → grid sim, robot box → robot
          ctx.lineWidth = 1.5;
          const gsx = bx[0] + bwid / 2;
          if (ph === 0) { ctx.strokeStyle = C.warn; ctx.beginPath(); ctx.moveTo(segMid, sag(segMid) + 6); ctx.lineTo(segMid, base + 14); ctx.lineTo(gsx, base + 14); ctx.lineTo(gsx, sy - 2); ctx.stroke();
          pip(ctx, gsx, lerp(base + 14, sy - 2, (pp * 2) % 1), 3, C.warn); }
          const rbx = bx[3] + bwid / 2;
          if (ph === 3) {
            ctx.strokeStyle = C.grade;
            ctx.beginPath(); ctx.moveTo(rbx, sy - 2); ctx.lineTo(rbx, base + 22); ctx.lineTo(rx, base + 22); ctx.lineTo(rx, ry + clamp(w * 0.05, 26, 56) * 1.25); ctx.stroke();
          }
          t++;
        },
      };
    },

    // ---------- UDP robot on a grid ----------
    robot(canvas) {
      const path = "RRRDDLLURRRRDDDLLLLUURRR".split("");
      const NAMES = { R: "RIGHT", L: "LEFT", U: "UP", D: "DOWN" };
      let i = 0, pos = { x: 2, y: 2 }, trail = [];
      return {
        tick: 420, still: 6,
        subtitle: () => `The client sends "MOVE ${NAMES[path[(i - 1 + path.length) % path.length]]}" over UDP; the server moves the robot one cell.`,
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const s = Math.max(16, Math.min(w, h) / 8);
          const cols = Math.floor(w / s), rows = Math.floor(h / s);
          const ox = (w - cols * s) / 2, oy = (h - rows * s) / 2;
          ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
          for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(ox + c * s, oy); ctx.lineTo(ox + c * s, oy + rows * s); ctx.stroke(); }
          for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(ox, oy + r * s); ctx.lineTo(ox + cols * s, oy + r * s); ctx.stroke(); }
          trail.forEach((p, k) => { ctx.globalAlpha = (k + 1) / trail.length; box(ctx, ox + p.x * s + s * 0.3, oy + p.y * s + s * 0.3, s * 0.4, s * 0.4, { fill: C.steel, r: 1 }); });
          ctx.globalAlpha = 1;
          box(ctx, ox + pos.x * s + s * 0.15, oy + pos.y * s + s * 0.15, s * 0.7, s * 0.7, { fill: C.bone, r: 3 });
          const cmd = path[i % path.length];
          trail.push({ ...pos }); if (trail.length > 10) trail.shift();
          pos.x = clamp(pos.x + (cmd === "R" ? 1 : cmd === "L" ? -1 : 0), 0, cols - 1);
          pos.y = clamp(pos.y + (cmd === "D" ? 1 : cmd === "U" ? -1 : 0), 0, rows - 1);
          i++;
        },
      };
    },

    // ---------- Distribution fit ----------
    fit(canvas) {
      const rand = rng(11);
      const bins = new Array(28).fill(0);
      let t = 0;
      return {
        tick: 40, still: 290,
        subtitle: () => ((t % 300) < 120
          ? "Each mouse decision trial lands in the histogram as the data comes in."
          : "A normal distribution is fitted over the data to see how well it explains it."),
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          if (t % 300 === 0) bins.fill(0);
          for (let k = 0; k < 6; k++) {
            const v = (rand() + rand() + rand() + rand()) / 4;
            bins[Math.min(bins.length - 1, Math.floor(v * bins.length))]++;
          }
          const max = Math.max(1, ...bins), base = h * 0.76, top = h * 0.1, bw = (w * 0.8) / bins.length, x0 = w * 0.1;
          bins.forEach((b, k) => { const bh = ((base - top) * b) / max; box(ctx, x0 + k * bw + 1, base - bh, bw - 2, bh, { fill: C.steel, r: 0 }); });
          const prog = Math.min(1, ((t % 300) - 120) / 120);
          if (prog > 0) {
            ctx.strokeStyle = C.bone; ctx.lineWidth = 2.5; ctx.beginPath();
            const steps = Math.floor(80 * prog);
            for (let s = 0; s <= steps; s++) {
              const u = s / 80, z = (u - 0.5) / 0.144;
              const y = base - (base - top) * Math.exp(-0.5 * z * z);
              s ? ctx.lineTo(x0 + u * w * 0.8, y) : ctx.moveTo(x0 + u * w * 0.8, y);
            }
            ctx.stroke();
          }
          ctx.fillStyle = C.faint; ctx.fillRect(x0, base, w * 0.8, 1);
          t++;
        },
      };
    },
  };

  // ---------- players: run each film only while on screen ----------
  const players = [];
  function writeSub(p) {
    if (!p.sub || !p.film.subtitle) return;
    const s = p.film.subtitle();
    if (s !== p.lastSub) { p.sub.textContent = s; p.lastSub = s; }
  }
  document.querySelectorAll("canvas[data-film]").forEach((canvas) => {
    const make = films[canvas.dataset.film];
    if (!make) return;
    const film = make(canvas);
    const figure = canvas.closest("figure");
    const sub = figure && figure.querySelector(".subtitle");
    const p = { canvas, film, sub, figure, visible: false, last: 0, lastSub: "" };
    players.push(p);
    if (reduce) {
      for (let k = 0; k < (film.still || 1); k++) film.draw();
      if (sub && figure.dataset.summary) sub.textContent = figure.dataset.summary;
    } else {
      film.draw();
      writeSub(p);
    }
  });

  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => players.forEach((p) => { if (p.box === e.target) p.visible = e.isIntersecting; }));
    }, { rootMargin: "100px" });
    players.forEach((p) => { p.box = p.canvas.closest(".scene, .reel, .title") || p.canvas; io.observe(p.box); });
    const loop = (now) => {
      if (!document.hidden) players.forEach((p) => {
        if (p.visible && now - p.last >= p.film.tick) { p.last = now; p.film.draw(); writeSub(p); }
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

  // ---------- bottom bar label ----------
  const label = document.querySelector(".counter-name");
  const labeled = [...document.querySelectorAll("[data-label]")];
  if (label) {
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = innerHeight * 0.5;
      let pick = null;
      for (const el of labeled) { const r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom >= mid) pick = el; }
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
