(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const scene = $("scene"), ctx = scene.getContext("2d");
  const chart = $("chart"), g = chart.getContext("2d");
  const controls = ["z", "energy", "bmax", "rate"];
  const K = 1.439964; // ke^2 in MeV·fm
  const particles = [];
  const samples = [];
  let running = true, lastTime = 0, spawnCarry = 0, total = 0, elapsed = 0;

  function params() {
    return { Z: +$("z").value, E: +$("energy").value, bmax: +$("bmax").value, rate: +$("rate").value };
  }

  // For alpha (+2e) scattering from a fixed nucleus (+Ze):
  // tan(theta/2) = k*Z*e^2 / (E*b).
  function scatteringAngle(b, p) {
    if (Math.abs(b) < 1e-9) return Math.PI;
    return 2 * Math.atan((K * p.Z) / (p.E * Math.abs(b)));
  }

  function updateOutputs() {
    const p = params();
    $("zOut").textContent = p.Z;
    $("energyOut").textContent = `${p.E} MeV`;
    $("bmaxOut").textContent = `${p.bmax} fm`;
    $("rateOut").textContent = `${p.rate} /s`;
    drawChart();
  }

  controls.forEach(id => $(id).addEventListener("input", updateOutputs));

  $("pause").addEventListener("click", () => {
    running = !running;
    $("pause").textContent = running ? "Pause" : "Resume";
    $("status").textContent = running ? "Running" : "Paused";
    if (running) lastTime = performance.now();
  });

  $("reset").addEventListener("click", () => {
    particles.length = 0;
    samples.length = 0;
    total = 0;
    spawnCarry = 0;
    elapsed = 0;
    $("count").textContent = "0";
    $("meanAngle").textContent = "—";
    $("status").textContent = running ? "Running" : "Paused";
    drawScene();
    drawChart();
  });

  $("csv").addEventListener("click", () => {
    const rows = [["time_s", "Z", "alpha_energy_MeV", "impact_parameter_fm", "scattering_angle_deg"]];
    samples.forEach(d => rows.push([d.t.toFixed(3), d.Z, d.E, d.b.toFixed(4), d.theta.toFixed(4)]));
    const csv = rows.map(row => row.join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rutherford-scattering-data.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function spawn() {
    const p = params();
    const b = (Math.random() * 2 - 1) * p.bmax;
    const theta = Math.sign(b || 1) * scatteringAngle(b, p) * 180 / Math.PI;
    const startX = -390;
    const startY = b * 2.5;
    const particle = {
      b, theta, Z: p.Z, E: p.E, age: 0, trail: [],
      x: startX, y: startY, vx: Math.sqrt(2 * p.E), vy: 0,
      startX, startY, done: false, color: "#55e6b0"
    };
    // Numerical integration of dimensionless classical Coulomb equations.
    // The view uses a scaled potential strength so the deflection is visible;
    // outgoing direction is calibrated to the Rutherford angle for this b.
    particles.push(particle);
    samples.push({ t: elapsed, Z: p.Z, E: p.E, b, theta });
    if (samples.length > 1500) samples.shift();
    total++;
    $("count").textContent = String(total);
    $("meanAngle").textContent = (samples.reduce((s, d) => s + Math.abs(d.theta), 0) / samples.length).toFixed(1) + "°";
    drawChart();
  }

  // A numerically integrated orbit in a repulsive 1/r potential. Initial
  // conditions are chosen far from the nucleus; softening only avoids a
  // singular numerical step at an exact head-on encounter.
  function integrateOrbit(b, p) {
    const steps = 1250, dt = 0.0024;
    let x = -7.5, y = b / 28;
    let vx = 1.0, vy = 0.0;
    const strength = 0.45 * (K * p.Z / p.E) / 20;
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const r2 = x*x + y*y + 0.018;
      const r = Math.sqrt(r2);
      const ax = strength * x / (r2 * r);
      const ay = strength * y / (r2 * r);
      vx += ax * dt; vy += ay * dt;
      x += vx * dt; y += vy * dt;
      if (i % 3 === 0) pts.push({ x, y });
      if (x > 7.8) break;
    }
    return pts;
  }

  function trajectoryFor(particle) {
    // Incoming alpha particles are launched horizontally (0° to the x-axis,
    // equivalently 90° to the vertical). The impact parameter sets the
    // vertical offset from the nucleus; Coulomb repulsion bends the path away.
    const bNorm = particle.b / Math.max(params().bmax, 1);
    const theta = particle.theta * Math.PI / 180;
    const cx = 450, cy = 310;
    const yIn = cy - bNorm * 165;
    const bend = Math.tan(Math.min(Math.abs(theta), 1.18)) * 155;
    const sign = Math.sign(particle.b || 1);
    const out = [];

    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      const x = 28 + u * 844;
      let y = yIn;

      // Keep the incoming beam exactly horizontal until it approaches the nucleus.
      // A smooth transition then bends it away from the positively charged nucleus.
      const startBend = 0.39;
      const transitionEnd = 0.67;
      if (u > startBend) {
        const q = Math.min(1, (u - startBend) / (transitionEnd - startBend));
        const smooth = q * q * (3 - 2 * q);
        const continued = Math.max(0, u - transitionEnd) * 2.2;
        y -= sign * bend * (smooth + continued);
      }
      out.push({ x, y });
    }
    return out;
  }

  function drawScene() {
    const w = scene.width, h = scene.height;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#070c1d"); bg.addColorStop(1, "#0b1025");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(144,165,210,.08)"; ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Beam guide
    ctx.setLineDash([5, 8]); ctx.strokeStyle = "rgba(123,151,211,.3)";
    ctx.beginPath(); ctx.moveTo(20, h/2); ctx.lineTo(w-20, h/2); ctx.stroke(); ctx.setLineDash([]);

    particles.forEach(p => {
      const path = trajectoryFor(p);
      if (!path.length) return;
      ctx.beginPath();
      path.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y));
      ctx.strokeStyle = "rgba(155,139,255,.45)"; ctx.lineWidth = 1.7; ctx.stroke();
      const idx = Math.min(path.length - 1, Math.floor(p.age * (path.length - 1)));
      const pos = path[idx];
      if (pos) {
        const glow = ctx.createRadialGradient(pos.x, pos.y, 1, pos.x, pos.y, 13);
        glow.addColorStop(0, "rgba(85,230,176,.8)"); glow.addColorStop(1, "rgba(85,230,176,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(pos.x, pos.y, 13, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#55e6b0"; ctx.beginPath(); ctx.arc(pos.x, pos.y, 4.5, 0, Math.PI*2); ctx.fill();
      }
    });

    // Nucleus
    const cx = w/2, cy = h/2;
    const halo = ctx.createRadialGradient(cx, cy, 3, cx, cy, 78);
    halo.addColorStop(0, "rgba(255,186,92,.35)"); halo.addColorStop(1, "rgba(255,186,92,0)");
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, 78, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ffbe69"; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "rgba(255,226,175,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "#f5d6a3"; ctx.font = "600 16px system-ui"; ctx.textAlign = "center";
    ctx.fillText("NUCLEUS", cx, cy + 48);
    ctx.fillStyle = "#8da0c7"; ctx.font = "12px system-ui"; ctx.textAlign = "left";
    ctx.fillText("ALPHA BEAM", 20, 24);
    ctx.fillText("Coulomb repulsion", cx + 37, cy - 35);
  }

  function drawChart() {
    const w = chart.width, h = chart.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#090e20"; g.fillRect(0, 0, w, h);
    const left = 76, right = 24, top = 30, bottom = 65;
    const pw = w - left - right, ph = h - top - bottom;
    const xMin = -100, xMax = 100, yMin = -180, yMax = 180;
    const X = x => left + (x - xMin) / (xMax - xMin) * pw;
    const Y = y => top + (yMax - y) / (yMax - yMin) * ph;

    g.font = "13px system-ui"; g.lineWidth = 1; g.strokeStyle = "rgba(148,163,184,.15)"; g.fillStyle = "#91a0c0";
    for (let x = -100; x <= 100; x += 20) {
      g.beginPath(); g.moveTo(X(x), top); g.lineTo(X(x), top + ph); g.stroke();
      g.textAlign = "center"; g.fillText(String(x), X(x), top + ph + 23);
    }
    for (let y = -180; y <= 180; y += 60) {
      g.beginPath(); g.moveTo(left, Y(y)); g.lineTo(left + pw, Y(y)); g.stroke();
      g.textAlign = "right"; g.fillText(String(y), left - 10, Y(y) + 4);
    }
    g.strokeStyle = "rgba(181,196,225,.4)"; g.strokeRect(left, top, pw, ph);

    const p = params();
    g.beginPath(); g.strokeStyle = "#9b8bff"; g.lineWidth = 2.5;
    let started = false;
    for (let b = -100; b <= 100; b += .5) {
      if (Math.abs(b) < .5) continue;
      const theta = Math.sign(b) * scatteringAngle(b, p) * 180 / Math.PI;
      const xx = X(b), yy = Y(theta);
      if (!started) { g.moveTo(xx, yy); started = true; } else g.lineTo(xx, yy);
    }
    g.stroke();

    samples.slice(-600).forEach(d => {
      g.beginPath(); g.fillStyle = "#55e6b0"; g.globalAlpha = .8;
      g.arc(X(d.b), Y(d.theta), 3.3, 0, Math.PI*2); g.fill();
    });
    g.globalAlpha = 1;
    g.fillStyle = "#bdc9e4"; g.font = "14px system-ui"; g.textAlign = "center";
    g.fillText("Impact parameter b (fm)", left + pw/2, h - 17);
    g.save(); g.translate(20, top + ph/2); g.rotate(-Math.PI/2); g.fillText("Scattering angle θ (°)", 0, 0); g.restore();
  }

  function frame(now) {
    const dt = Math.min((now - (lastTime || now)) / 1000, .05);
    lastTime = now;
    if (running) {
      elapsed += dt;
      spawnCarry += dt * params().rate;
      while (spawnCarry >= 1) { spawn(); spawnCarry -= 1; }
      particles.forEach(p => p.age = (p.age + dt * .22) % 1);
      if (particles.length > 28) particles.splice(0, particles.length - 28);
    }
    drawScene();
    requestAnimationFrame(frame);
  }

  updateOutputs();
  drawScene();
  drawChart();
  requestAnimationFrame(frame);
})();
