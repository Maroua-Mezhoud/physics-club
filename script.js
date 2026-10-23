/* ==========================================================================
   PHYSICS CLUB — site behaviour
   --------------------------------------------------------------------------
   1. Helpers
   2. Interface  (menu, header, progress, reveal, active link, spotlight)
   3. Scroll-lit statements
   4. Hero       (live Lorenz attractor, RK4 integration)
   5. Plot       (exact solution vs Euler method)
   6. Gravity lab (N-body simulation: drag to launch, tap to orbit)
   ========================================================================== */

(() => {
    "use strict";

    /* ---------- 1. Helpers ---------- */

    const $  = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    /** Size a canvas to its CSS box (capped at 2x pixel density). */
    function fitCanvas(canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const pw = Math.round(w * dpr);
        const ph = Math.round(h * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx, w, h };
    }

    /** Run `frame` every animation frame, but only while `el` is on screen. */
    function animateWhenVisible(el, frame) {
        let raf = 0;
        let visible = false;

        const tick = (time) => {
            if (!visible || document.hidden) { raf = 0; return; }
            frame(time);
            raf = requestAnimationFrame(tick);
        };
        const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };

        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            start();
        }).observe(el);

        document.addEventListener("visibilitychange", start);
    }


    /* ---------- 2. Interface ---------- */

    const header = $(".site-header");
    const toggle = $(".nav-toggle");
    const nav    = $("#primary-nav");

    const setMenu = (open) => {
        if (!toggle || !nav) return;
        nav.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };

    if (toggle && nav) {
        toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
        nav.addEventListener("click", (event) => { if (event.target.closest("a")) setMenu(false); });
        document.addEventListener("keydown", (event) => { if (event.key === "Escape") setMenu(false); });
        window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => { if (event.matches) setMenu(false); });
    }

    // Header state + reading progress + scroll-lit words (one rAF-throttled handler)
    const progressBar = $(".scroll-progress");
    const scrollHandlers = [];
    let scrollQueued = false;

    const onScroll = () => {
        if (scrollQueued) return;
        scrollQueued = true;
        requestAnimationFrame(() => {
            scrollQueued = false;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
            if (progressBar && max > 0) progressBar.style.transform = `scaleX(${clamp(window.scrollY / max, 0, 1)})`;
            scrollHandlers.forEach((handler) => handler());
        });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // Reveal on scroll
    const revealItems = $$(".reveal");
    if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
        revealItems.forEach((item) => revealObserver.observe(item));
    } else {
        revealItems.forEach((item) => item.classList.add("is-visible"));
    }

    // Active nav link
    const navLinks = $$(".nav-list a[href^='#']");
    const navTargets = navLinks.map((link) => document.getElementById(link.getAttribute("href").slice(1))).filter(Boolean);
    if ("IntersectionObserver" in window && navTargets.length) {
        const activeObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                navLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`));
            });
        }, { rootMargin: "-45% 0px -50% 0px" });
        navTargets.forEach((target) => activeObserver.observe(target));
    }

    // Cursor spotlight on [data-spot] elements
    document.addEventListener("pointermove", (event) => {
        const el = event.target.closest && event.target.closest("[data-spot]");
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        el.style.setProperty("--my", `${event.clientY - rect.top}px`);
    }, { passive: true });

    // Footer year
    $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });


    /* ---------- 3. Scroll-lit statements ---------- */

    $$("[data-words]").forEach((el) => {
        const words = el.textContent.trim().split(/\s+/);
        el.textContent = "";
        const spans = words.map((word, index) => {
            const span = document.createElement("span");
            span.className = "w";
            span.textContent = word;
            el.append(span, index < words.length - 1 ? " " : "");
            return span;
        });

        let lit = -1;
        const update = () => {
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight;
            const progress = reduceMotion ? 1 : clamp((vh * 0.85 - rect.top) / (vh * 0.4 + rect.height), 0, 1);
            const count = Math.round(progress * spans.length);
            if (count === lit) return;
            lit = count;
            spans.forEach((span, i) => span.classList.toggle("is-lit", i < count));
        };
        scrollHandlers.push(update);
        update();
    });
    onScroll();


    /* ---------- 4. Hero: Lorenz attractor ---------- */

    function initLorenz() {
        const canvas = $("#lorenz");
        if (!canvas) return;

        const hero = canvas.parentElement;
        const readout = $("#hud-readout");

        const SIGMA = 10, RHO = 28, BETA = 8 / 3;
        const DT = 0.006;
        const TRAIL = window.innerWidth < 700 ? 1100 : 1900;
        const STEPS_PER_FRAME = 2;
        const SEGMENTS = 36;

        const palette = ["0,229,245", "168,85,247", "96,165,250"];

        const f = (x, y, z) => [SIGMA * (y - x), x * (RHO - z) - y, x * y - BETA * z];

        // 4th-order Runge–Kutta
        function rk4(p, dt) {
            const [x, y, z] = p;
            const k1 = f(x, y, z);
            const k2 = f(x + dt / 2 * k1[0], y + dt / 2 * k1[1], z + dt / 2 * k1[2]);
            const k3 = f(x + dt / 2 * k2[0], y + dt / 2 * k2[1], z + dt / 2 * k2[2]);
            const k4 = f(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
            p[0] += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
            p[1] += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
            p[2] += dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
        }

        // Three nearly identical starts: sensitive dependence on initial conditions
        const orbits = palette.map((color, i) => ({
            color,
            p: [1 + i * 0.012, 1, 1],
            buf: new Float32Array(TRAIL * 3),
            head: 0,
            count: 0,
        }));

        function push(orbit) {
            rk4(orbit.p, DT);
            const i = orbit.head * 3;
            orbit.buf[i] = orbit.p[0];
            orbit.buf[i + 1] = orbit.p[1];
            orbit.buf[i + 2] = orbit.p[2];
            orbit.head = (orbit.head + 1) % TRAIL;
            orbit.count = Math.min(orbit.count + 1, TRAIL);
        }

        // Skip the transient and pre-fill the trails
        orbits.forEach((orbit) => {
            for (let i = 0; i < 800; i++) rk4(orbit.p, DT);
            for (let i = 0; i < TRAIL; i++) push(orbit);
        });

        let targetX = 0, targetY = 0, mouseX = 0, mouseY = 0, frameCount = 0;

        hero.addEventListener("pointermove", (event) => {
            const rect = hero.getBoundingClientRect();
            targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
            targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        }, { passive: true });

        function render(time, advance) {
            const { ctx, w, h } = fitCanvas(canvas);
            ctx.clearRect(0, 0, w, h);

            if (advance) {
                for (const orbit of orbits) for (let s = 0; s < STEPS_PER_FRAME; s++) push(orbit);
                mouseX += (targetX - mouseX) * 0.05;
                mouseY += (targetY - mouseY) * 0.05;
            }

            const wide = w > 900;
            const cx = wide ? w * 0.7 : w * 0.5;
            const cy = wide ? h * 0.5 : h * 0.27;
            const size = wide ? Math.min(h * 0.86, w * 0.5) : Math.min(w * 0.98, h * 0.5);
            const scale = size / 58;

            const angle = time * 0.00011 + mouseX * 0.75;
            const tilt = 0.32 + mouseY * 0.22;
            const ca = Math.cos(angle), sa = Math.sin(angle);
            const ct = Math.cos(tilt), st = Math.sin(tilt);

            const project = (x, y, z) => {
                z -= 25;
                const x1 = x * ca - y * sa;
                const y1 = x * sa + y * ca;
                const y2 = y1 * ct - z * st;
                const z2 = y1 * st + z * ct;
                const s = 170 / (170 - y2);
                return [cx + x1 * scale * s, cy - z2 * scale * s];
            };

            ctx.globalCompositeOperation = "lighter";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            for (const orbit of orbits) {
                const { buf, head, count, color } = orbit;
                const per = Math.ceil(count / SEGMENTS);

                for (let s = 0; s < SEGMENTS; s++) {
                    const a = s * per;
                    const e = Math.min(count - 1, (s + 1) * per);
                    if (a >= e) break;
                    const k = (s + 1) / SEGMENTS;

                    ctx.beginPath();
                    for (let i = a; i <= e; i++) {
                        const idx = (((head - count + i) % TRAIL) + TRAIL) % TRAIL * 3;
                        const [px, py] = project(buf[idx], buf[idx + 1], buf[idx + 2]);
                        if (i === a) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.strokeStyle = `rgba(${color},${(k * k * 0.8).toFixed(3)})`;
                    ctx.lineWidth = 0.6 + k * 1.7;
                    ctx.stroke();
                }

                // Glowing head
                const last = (((head - 1) % TRAIL) + TRAIL) % TRAIL * 3;
                const [hx, hy] = project(buf[last], buf[last + 1], buf[last + 2]);
                const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
                glow.addColorStop(0, `rgba(${color},0.95)`);
                glow.addColorStop(1, `rgba(${color},0)`);
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(hx, hy, 16, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalCompositeOperation = "source-over";

            if (readout && advance && ++frameCount % 8 === 0) {
                const [x, y, z] = orbits[0].p;
                const sign = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2).padStart(5, "0");
                readout.innerHTML = `x ${sign(x)} &nbsp; y ${sign(y)} &nbsp; z ${z.toFixed(2).padStart(5, "0")}`;
            }
        }

        if (reduceMotion) {
            render(0, false);
            window.addEventListener("resize", () => render(0, false));
        } else {
            animateWhenVisible(hero, (time) => render(time, true));
        }
    }


    /* ---------- 5. Plot: exact vs Euler ---------- */

    function initPlot() {
        const exact = $("#plot-exact");
        const euler = $("#plot-euler");
        if (!exact || !euler) return;

        // Harmonic oscillator  x'' = -x,  x(0) = 1
        const W = 400, MID = 70, AMP = 28, DT = 0.1;
        const steps = Math.round((4 * Math.PI) / DT);
        let x = 1, v = 0, dExact = "", dEuler = "";

        for (let i = 0; i <= steps; i++) {
            const t = i * DT;
            const px = ((t / (4 * Math.PI)) * W).toFixed(1);
            dExact += `${i ? "L" : "M"}${px} ${(MID - AMP * Math.cos(t)).toFixed(1)} `;
            dEuler += `${i ? "L" : "M"}${px} ${(MID - AMP * x).toFixed(1)} `;
            const nextX = x + v * DT;   // explicit Euler: energy grows every step
            v -= x * DT;
            x = nextX;
        }
        exact.setAttribute("d", dExact);
        euler.setAttribute("d", dEuler);
    }


    /* ---------- 6. Gravity lab ---------- */

    function initGravity() {
        const canvas = $("#gravity");
        if (!canvas) return;

        const stage = canvas.parentElement;
        const hint = $("#sandbox-hint");
        const readout = $("#sandbox-readout");

        const G = 1;
        const STAR_MASS = 370;
        const SOFT = 64;            // softening (px²) avoids singular close encounters
        const SUBSTEPS = 4;
        const DT = 1 / SUBSTEPS;
        const MAX_BODIES = 60;
        const TRAIL_LENGTH = 70;

        let W = 0, H = 0;
        let bodies = [];
        let star = null;
        let showTrails = true;
        let showGrid = true;
        let paused = reduceMotion;
        let drag = null;
        let frame = 0;

        // Speed of a circular orbit under softened gravity
        const circularSpeed = (r) => Math.sqrt(G * STAR_MASS * r * r / Math.pow(r * r + SOFT, 1.5));

        function addBody(x, y, vx, vy) {
            const m = 2 + Math.random() * 4;
            bodies.push({
                x, y, vx, vy, m,
                r: 2.2 + Math.sqrt(m) * 1.1,
                hue: 170 + Math.random() * 120,
                trail: [],
            });
            if (bodies.length > MAX_BODIES + 1) bodies.splice(1, 1);
        }

        function addOrbiting(x, y, direction = 1) {
            const dx = x - star.x, dy = y - star.y;
            const r = Math.hypot(dx, dy) || 1;
            const v = circularSpeed(r) * direction;
            addBody(x, y, (-dy / r) * v, (dx / r) * v);
        }

        function reset() {
            const size = fitCanvas(canvas);
            W = size.w; H = size.h;
            star = { x: W / 2, y: H / 2, vx: 0, vy: 0, m: STAR_MASS, r: 14, isStar: true, trail: [] };
            bodies = [star];
            const base = Math.min(W, H) / 2;
            [[0.28, 0.4], [0.5, 2.5], [0.72, 4.6]].forEach(([k, angle]) => {
                addOrbiting(star.x + Math.cos(angle) * base * k, star.y + Math.sin(angle) * base * k);
            });
        }

        function clear() { bodies = [star]; }

        /* ---- physics ---- */

        function accelerate() {
            const n = bodies.length;
            for (let i = 0; i < n; i++) { bodies[i].ax = 0; bodies[i].ay = 0; }
            for (let i = 0; i < n; i++) {
                const a = bodies[i];
                for (let j = i + 1; j < n; j++) {
                    const b = bodies[j];
                    const dx = b.x - a.x, dy = b.y - a.y;
                    const d2 = dx * dx + dy * dy + SOFT;
                    const inv = 1 / (d2 * Math.sqrt(d2));
                    a.ax += dx * G * b.m * inv; a.ay += dy * G * b.m * inv;
                    b.ax -= dx * G * a.m * inv; b.ay -= dy * G * a.m * inv;
                }
            }
        }

        function step() {
            accelerate();
            for (const body of bodies) {
                if (body.isStar) continue;                 // the star is pinned
                body.vx += body.ax * DT; body.vy += body.ay * DT;   // symplectic Euler
                body.x += body.vx * DT;  body.y += body.vy * DT;
            }
        }

        function resolveCollisions() {
            for (let i = 0; i < bodies.length; i++) {
                for (let j = i + 1; j < bodies.length; j++) {
                    const a = bodies[i], b = bodies[j];
                    if (Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r) continue;

                    if (a.isStar) {
                        a.m += b.m * 0.2;                    // the star swallows planets
                        a.pulse = 1;
                    } else {
                        // Perfectly inelastic merger: momentum is conserved
                        const m = a.m + b.m;
                        a.vx = (a.vx * a.m + b.vx * b.m) / m;
                        a.vy = (a.vy * a.m + b.vy * b.m) / m;
                        a.x = (a.x * a.m + b.x * b.m) / m;
                        a.y = (a.y * a.m + b.y * b.m) / m;
                        a.m = m;
                        a.r = 2.2 + Math.sqrt(m) * 1.1;
                    }
                    bodies.splice(j, 1);
                    j--;
                }
            }
            // Drop bodies that escaped far away
            bodies = bodies.filter((b) => b.isStar || (Math.abs(b.x - star.x) < W * 2.5 && Math.abs(b.y - star.y) < H * 2.5));
        }

        /* ---- drawing ---- */

        function drawGrid(ctx) {
            const spacing = 36, sample = 12;
            const warp = (x, y) => {
                const dx = star.x - x, dy = star.y - y;
                const r = Math.hypot(dx, dy) || 1;
                const pull = Math.min(r * 0.92, 64 * Math.exp(-r / 150));
                return [x + (dx / r) * pull, y + (dy / r) * pull];
            };
            ctx.strokeStyle = "rgba(129,140,248,0.17)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0; x <= W; x += spacing) {
                for (let y = 0; y <= H + sample; y += sample) {
                    const [px, py] = warp(x, y);
                    if (y === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
            }
            for (let y = 0; y <= H; y += spacing) {
                for (let x = 0; x <= W + sample; x += sample) {
                    const [px, py] = warp(x, y);
                    if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
            }
            ctx.stroke();
        }

        function drawTrail(ctx, body) {
            const t = body.trail;
            if (t.length < 2) return;
            const chunks = 5;
            const per = Math.ceil(t.length / chunks);
            for (let c = 0; c < chunks; c++) {
                const a = c * per, e = Math.min(t.length - 1, (c + 1) * per);
                if (a >= e) break;
                ctx.beginPath();
                ctx.moveTo(t[a].x, t[a].y);
                for (let i = a + 1; i <= e; i++) ctx.lineTo(t[i].x, t[i].y);
                ctx.strokeStyle = `hsla(${body.hue},90%,70%,${(((c + 1) / chunks) * 0.55).toFixed(2)})`;
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }
        }

        function drawStar(ctx) {
            const pulse = star.pulse || 0;
            star.pulse = Math.max(0, pulse - 0.04);
            const radius = star.r * (1 + pulse * 0.35);
            const halo = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, radius * 6);
            halo.addColorStop(0, "rgba(199,210,254,0.55)");
            halo.addColorStop(0.25, "rgba(129,140,248,0.22)");
            halo.addColorStop(1, "rgba(129,140,248,0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(star.x, star.y, radius * 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#EEF2FF";
            ctx.beginPath();
            ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        function drawBody(ctx, body) {
            const glow = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, body.r * 4);
            glow.addColorStop(0, `hsla(${body.hue},95%,70%,0.55)`);
            glow.addColorStop(1, `hsla(${body.hue},95%,70%,0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(body.x, body.y, body.r * 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `hsl(${body.hue},92%,78%)`;
            ctx.beginPath();
            ctx.arc(body.x, body.y, body.r, 0, Math.PI * 2);
            ctx.fill();
        }

        function launchVelocity() {
            return [(drag.x - drag.startX) * 0.022, (drag.y - drag.startY) * 0.022];
        }

        function drawDrag(ctx) {
            if (!drag) return;
            const [vx0, vy0] = launchVelocity();

            // Predicted path under the star's gravity
            let x = drag.startX, y = drag.startY, vx = vx0, vy = vy0;
            ctx.fillStyle = "rgba(0,229,245,0.8)";
            for (let i = 0; i < 520; i++) {
                const dx = star.x - x, dy = star.y - y;
                const d2 = dx * dx + dy * dy + SOFT;
                const inv = G * STAR_MASS / (d2 * Math.sqrt(d2));
                vx += dx * inv * DT; vy += dy * inv * DT;
                x += vx * DT; y += vy * DT;
                if (i % 9 === 0) {
                    ctx.globalAlpha = 1 - i / 560;
                    ctx.beginPath();
                    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
                    ctx.fill();
                }
                if (Math.hypot(x - star.x, y - star.y) < star.r) break;
            }
            ctx.globalAlpha = 1;

            // Launch vector
            ctx.strokeStyle = "rgba(255,255,255,0.85)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(drag.startX, drag.startY);
            ctx.lineTo(drag.x, drag.y);
            ctx.stroke();
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(drag.startX, drag.startY, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        function render() {
            const size = fitCanvas(canvas);
            const ctx = size.ctx;
            if (size.w !== W || size.h !== H) {      // keep the system centred when resized
                const dx = size.w / 2 - star.x, dy = size.h / 2 - star.y;
                bodies.forEach((b) => { b.x += dx; b.y += dy; b.trail.length = 0; });
                W = size.w; H = size.h;
            }

            ctx.clearRect(0, 0, W, H);
            if (showGrid) drawGrid(ctx);

            ctx.globalCompositeOperation = "lighter";
            if (showTrails) bodies.forEach((b) => { if (!b.isStar) drawTrail(ctx, b); });
            drawStar(ctx);
            bodies.forEach((b) => { if (!b.isStar) drawBody(ctx, b); });
            ctx.globalCompositeOperation = "source-over";

            drawDrag(ctx);
        }

        function tick() {
            if (!paused) {
                for (let s = 0; s < SUBSTEPS; s++) step();
                resolveCollisions();
                if (showTrails) {
                    for (const body of bodies) {
                        if (body.isStar) continue;
                        body.trail.push({ x: body.x, y: body.y });
                        if (body.trail.length > TRAIL_LENGTH) body.trail.shift();
                    }
                }
            }
            render();
            if (readout && ++frame % 10 === 0) readout.textContent = `bodies ${bodies.length}`;
        }

        /* ---- input ---- */

        const point = (event) => {
            const rect = canvas.getBoundingClientRect();
            return [event.clientX - rect.left, event.clientY - rect.top];
        };

        const dismissHint = () => { if (hint) hint.classList.add("is-hidden"); };

        canvas.addEventListener("pointerdown", (event) => {
            if (event.button > 0) return;
            const [x, y] = point(event);
            drag = { startX: x, startY: y, x, y };
            canvas.setPointerCapture(event.pointerId);
            dismissHint();
        });

        canvas.addEventListener("pointermove", (event) => {
            if (!drag) return;
            [drag.x, drag.y] = point(event);
            if (paused) render();
        });

        const release = (event) => {
            if (!drag) return;
            [drag.x, drag.y] = point(event);
            const length = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);

            if (length < 10) {
                addOrbiting(drag.startX, drag.startY, Math.random() < 0.5 ? 1 : -1);  // a tap: circular orbit
            } else {
                const [vx, vy] = launchVelocity();
                addBody(drag.startX, drag.startY, vx, vy);                             // a drag: slingshot
            }
            drag = null;
            if (paused) render();
        };
        canvas.addEventListener("pointerup", release);
        canvas.addEventListener("pointercancel", () => { drag = null; });

        stage.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");
            if (!button) return;
            const action = button.dataset.action;

            if (action === "reset") reset();
            if (action === "clear") clear();
            if (action === "pause") {
                paused = !paused;
                button.setAttribute("aria-pressed", String(paused));
                button.textContent = paused ? "Resume" : "Pause";
            }
            if (action === "trails") {
                showTrails = !showTrails;
                button.setAttribute("aria-pressed", String(showTrails));
                bodies.forEach((b) => { b.trail.length = 0; });
            }
            if (action === "grid") {
                showGrid = !showGrid;
                button.setAttribute("aria-pressed", String(showGrid));
            }
            if (paused) render();
        });

        // Start state
        const pauseButton = $('[data-action="pause"]', stage);
        if (paused && pauseButton) { pauseButton.setAttribute("aria-pressed", "true"); pauseButton.textContent = "Resume"; }

        reset();
        render();
        animateWhenVisible(stage, tick);
    }


    /* ---------- Boot ---------- */

    initLorenz();
    initPlot();
    initGravity();
})();
