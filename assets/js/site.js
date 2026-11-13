// Rahil Vasa — scene footage, recreated in code.
(() => {
  document.documentElement.classList.add("js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const C = {
    black: "#000000", bone: "#f2f0ea", dim: "#a9a69e", faint: "#3a3f44",
    steel: "#2a3b4a", grade: "#8fb2cc", mid: "#4d6a82", deep: "#16212b",
  };
  const FONT = '500 12px Manrope, system-ui, sans-serif';

  function fit(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  // Seeded random so every visit plays the same cut.
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  const films = {
    // Conway's Game of Life, graded steel blue.
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
      return {
        tick: 110,
        draw() {
          const { ctx, w, h } = fit(canvas);
          if (!grid || Math.abs(w - lastW) > 40) seed(w, h);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const bands = opts.bands || 0;
          for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            if (!grid[y * cols + x]) continue;
            if (bands) {
              const b = Math.floor((x / cols) * bands);
              ctx.fillStyle = b % 2 ? C.grade : C.bone;
            } else {
              ctx.fillStyle = (x * 31 + y * 17) % 23 === 0 ? C.bone : C.mid;
            }
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          }
          if (bands) {
            ctx.fillStyle = C.dim; ctx.font = FONT;
            for (let b = 1; b < bands; b++) {
              const x = Math.round((b / bands) * w);
              ctx.fillRect(x, 0, 1, h);
            }
            for (let b = 0; b < bands; b++) {
              const lx = (b / bands) * w + 8, label = "thread " + (b + 1);
              ctx.fillStyle = C.black; ctx.fillRect(lx - 4, h - 26, ctx.measureText(label).width + 8, 20);
              ctx.fillStyle = C.bone; ctx.fillText(label, lx, h - 11);
            }
          }
          step();
        },
      };
    },

    threads(canvas) { return films.life(canvas, { bands: 4 }); },

    // A request moving through finite states to one output.
    fsm(canvas) {
      const states = ["intent", "clarify", "clarify", "retrieve", "answer"];
      const labels = ["Intent", "Clarify", "Retrieve", "Answer"];
      let t = 0;
      return {
        tick: 33,
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const n = labels.length, pad = w * 0.1, cy = h * 0.5;
          const xs = labels.map((_, i) => pad + (i * (w - 2 * pad)) / (n - 1));
          const r = Math.max(14, Math.min(34, w / 30));
          // edges
          ctx.strokeStyle = C.faint; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(xs[0], cy); ctx.lineTo(xs[n - 1], cy); ctx.stroke();
          // clarify self-loop
          ctx.beginPath(); ctx.arc(xs[1], cy - r * 1.9, r * 0.9, 0.2 * Math.PI, 0.8 * Math.PI, true); ctx.stroke();
          // decoy branches that never fire
          ctx.setLineDash([3, 5]);
          [2, 3].forEach((i) => { ctx.beginPath(); ctx.moveTo(xs[i - 1] + r, cy); ctx.lineTo(xs[i] - r * 0.4, cy + h * 0.28); ctx.stroke(); });
          ctx.setLineDash([]);
          // progress along path: intent → clarify → (loop) → retrieve → answer
          const cycle = 360, p = (t % cycle) / cycle;
          const seg = Math.min(states.length - 1, Math.floor(p * states.length));
          const activeLabel = { intent: 0, clarify: 1, retrieve: 2, answer: 3 }[states[seg]];
          labels.forEach((lab, i) => {
            const on = i === activeLabel, done = i < activeLabel;
            ctx.beginPath(); ctx.arc(xs[i], cy, r, 0, Math.PI * 2);
            ctx.fillStyle = on ? C.bone : done ? C.steel : C.black; ctx.fill();
            ctx.strokeStyle = on || done ? C.grade : C.faint; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = on ? C.bone : C.dim; ctx.font = FONT; ctx.textAlign = "center";
            ctx.fillText(lab, xs[i], cy + r + 22);
          });
          if (activeLabel === 3) {
            ctx.strokeStyle = C.bone; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(xs[3], cy, r + 8 + (t % 30) / 3, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.textAlign = "start";
          t++;
        },
      };
    },

    // One hundred scans running at once.
    scans(canvas) {
      const rand = rng(42);
      const speed = Array.from({ length: 100 }, () => 0.7 + rand() * 0.6);
      let t = 0;
      return {
        tick: 40,
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const cols = w < 520 ? 10 : 20, rows = 100 / cols;
          const gx = w * 0.06, gy = h * 0.14, gw = w - 2 * gx, gh = h - 2 * gy;
          const cw = gw / cols, ch = gh / rows;
          const cycle = 220, p = (t % cycle) / (cycle * 0.8);
          for (let i = 0; i < 100; i++) {
            const x = gx + (i % cols) * cw, y = gy + Math.floor(i / cols) * ch;
            const prog = Math.min(1, p * speed[i]);
            ctx.fillStyle = C.deep; ctx.fillRect(x + 2, y + ch * 0.35, cw - 4, ch * 0.3);
            ctx.fillStyle = prog >= 1 ? C.bone : C.grade;
            ctx.fillRect(x + 2, y + ch * 0.35, (cw - 4) * prog, ch * 0.3);
          }
          const done = speed.filter((s) => p * s >= 1).length;
          ctx.fillStyle = C.dim; ctx.font = FONT;
          ctx.fillText(done + " of 100 complete", gx, gy - 14);
          t++;
        },
      };
    },

    // Visitors flowing toward an edge gate; flagged ones are held.
    traffic(canvas) {
      const rand = rng(3);
      let dots = null;
      return {
        tick: 33,
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const gate = w * 0.62;
          if (!dots) dots = Array.from({ length: 70 }, () => { const bad = rand() < 0.18; return { x: bad ? gate - 10 : rand() * w, y: h * (0.1 + rand() * 0.8), v: 1 + rand() * 1.6, bad, held: bad ? Math.floor(rand() * 100) : 0 }; });
          ctx.fillStyle = C.faint; ctx.fillRect(gate, h * 0.08, 1, h * 0.84);
          ctx.fillStyle = C.dim; ctx.font = FONT; ctx.fillText("edge", gate + 8, h * 0.08 + 12);
          if (dots.length < 90 && rand() < 0.5) dots.push({ x: -4, y: h * (0.1 + rand() * 0.8), v: 1 + rand() * 1.6, bad: rand() < 0.18 });
          dots = dots.filter((d) => d.x < w + 6);
          for (const d of dots) {
            if (d.bad && d.x >= gate - 10) { d.x = gate - 10; d.held = (d.held || 0) + 1; }
            else d.x += d.v;
            if (d.held > 120) d.x = w + 10;
            ctx.fillStyle = d.bad ? C.bone : C.grade;
            ctx.globalAlpha = d.bad ? 1 : 0.55;
            ctx.fillRect(d.x, d.y, d.bad ? 4 : 3, d.bad ? 4 : 3);
          }
          ctx.globalAlpha = 1;
        },
      };
    },

    // A robot following move commands on a grid.
    robot(canvas) {
      const path = "RRRDDLLURRRRDDDLLLLUURRR".split("");
      let i = 0, pos = { x: 2, y: 2 }, trail = [];
      return {
        tick: 260,
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          const s = Math.max(16, Math.min(w, h) / 9);
          const cols = Math.floor(w / s), rows = Math.floor(h / s);
          const ox = (w - cols * s) / 2, oy = (h - rows * s) / 2;
          ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
          for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(ox + c * s, oy); ctx.lineTo(ox + c * s, oy + rows * s); ctx.stroke(); }
          for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(ox, oy + r * s); ctx.lineTo(ox + cols * s, oy + r * s); ctx.stroke(); }
          trail.forEach((p, k) => { ctx.fillStyle = C.steel; ctx.globalAlpha = (k + 1) / trail.length; ctx.fillRect(ox + p.x * s + s * 0.3, oy + p.y * s + s * 0.3, s * 0.4, s * 0.4); });
          ctx.globalAlpha = 1;
          ctx.fillStyle = C.bone; ctx.fillRect(ox + pos.x * s + s * 0.15, oy + pos.y * s + s * 0.15, s * 0.7, s * 0.7);
          const cmd = path[i % path.length];
          ctx.fillStyle = C.dim; ctx.font = FONT;
          ctx.fillText("UDP > MOVE " + { R: "RIGHT", L: "LEFT", U: "UP", D: "DOWN" }[cmd], ox + 6, oy - 8 > 10 ? oy - 8 : 16);
          trail.push({ ...pos }); if (trail.length > 10) trail.shift();
          pos.x += cmd === "R" ? 1 : cmd === "L" ? -1 : 0;
          pos.y += cmd === "D" ? 1 : cmd === "U" ? -1 : 0;
          pos.x = Math.max(0, Math.min(cols - 1, pos.x)); pos.y = Math.max(0, Math.min(rows - 1, pos.y));
          i++;
        },
      };
    },

    // A histogram filling in, then a fitted curve drawn over it.
    fit(canvas) {
      const rand = rng(11);
      const bins = new Array(28).fill(0);
      let t = 0;
      return {
        tick: 40,
        draw() {
          const { ctx, w, h } = fit(canvas);
          ctx.fillStyle = C.black; ctx.fillRect(0, 0, w, h);
          if (t % 300 === 0) bins.fill(0);
          for (let k = 0; k < 6; k++) {
            // sum of uniforms ~ normal
            const v = (rand() + rand() + rand() + rand()) / 4;
            bins[Math.min(bins.length - 1, Math.floor(v * bins.length))]++;
          }
          const max = Math.max(1, ...bins), base = h * 0.85, top = h * 0.15, bw = (w * 0.8) / bins.length, x0 = w * 0.1;
          bins.forEach((b, k) => {
            const bh = ((base - top) * b) / max;
            ctx.fillStyle = C.steel; ctx.fillRect(x0 + k * bw + 1, base - bh, bw - 2, bh);
          });
          const prog = Math.min(1, ((t % 300) - 120) / 120);
          if (prog > 0) {
            ctx.strokeStyle = C.bone; ctx.lineWidth = 2; ctx.beginPath();
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

  // Run each film only while it is on screen.
  const players = [];
  document.querySelectorAll("canvas[data-film]").forEach((canvas) => {
    const make = films[canvas.dataset.film];
    if (!make) return;
    const film = make(canvas);
    const p = { canvas, film, visible: false, last: 0 };
    players.push(p);
    if (reduce) {
      // A few frames in, then hold a still.
      for (let k = 0; k < 40; k++) film.draw();
    } else film.draw();
  });

  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => players.forEach((p) => { if (p.box === e.target) p.visible = e.isIntersecting; }));
    }, { rootMargin: "100px" });
    players.forEach((p) => { p.box = p.canvas.closest(".scene, .reel, .title") || p.canvas; io.observe(p.box); });
    const loop = (now) => {
      if (!document.hidden) players.forEach((p) => {
        if (p.visible && now - p.last >= p.film.tick) { p.last = now; p.film.draw(); }
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

  // The cut: footage opens like a shutter as its scene arrives.
  const shutters = document.querySelectorAll(".footage");
  if (reduce || !("IntersectionObserver" in window)) {
    shutters.forEach((f) => f.classList.add("is-open"));
  } else {
    // Observe each scene, not the clipped footage: a fully clipped box never intersects.
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

  // Scene counter in the bottom bar.
  const num = document.querySelector(".counter-num");
  const name = document.querySelector(".counter-name");
  const scenes = document.querySelectorAll("[data-scene]");
  if (num && "IntersectionObserver" in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { num.textContent = e.target.dataset.scene; name.textContent = e.target.dataset.sceneName; }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    scenes.forEach((s) => co.observe(s));
  }
})();
