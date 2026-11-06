/* =========================================================
   Alfred Wong Kai Xiang, portfolio
   Vanilla JS, no dependencies. Everything degrades gracefully:
   if this file fails to load the page is still fully usable.
   ========================================================= */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const body = document.body;

  // small helper for building elements without innerHTML
  const el = (tag, props, kids) => {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, val]) => {
      if (k === "class") node.className = val;
      else if (k === "text") node.textContent = val;
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), val);
      else node.setAttribute(k, val);
    });
    (kids || []).forEach((kid) => { if (kid) node.appendChild(kid); });
    return node;
  };
  const root = document.documentElement;

  /* ---------- one scroll loop drives every scroll scene below ---------- */
  // Smooth scrolling depends on two rules. Each frame only reads window.scrollY and writes styles: where things
  // sit on the page is measured once (measures, below) and again only when the page changes size, because
  // measuring in between writes makes the browser lay the page out again several times a frame. And every
  // scene moves in the same frame as the page, so nothing trails a frame behind the scroll.
  const scenes = [];   // (y, vh) => void, run every frame the page has moved
  const measures = []; // run when the page changes size: they note where their sections are
  const layouts = [];  // run when the window changes size: the scenes that build themselves to fit the screen
  let sceneRaf = 0, sceneY = -1, VH = window.innerHeight;
  const runScenes = (force) => {
    if (sceneRaf) { cancelAnimationFrame(sceneRaf); sceneRaf = 0; }
    const y = window.scrollY;
    if (!force && y === sceneY) return;
    sceneY = y;
    for (let i = 0; i < scenes.length; i++) scenes[i](y, VH);
  };
  const requestScenes = () => { if (!sceneRaf) sceneRaf = requestAnimationFrame(() => { sceneRaf = 0; runScenes(false); }); };
  window.addEventListener("scroll", requestScenes, { passive: true });
  // where an element starts on the page, ignoring any transform (so a scene's own movement never feeds back into it)
  const docTop = (node) => { let t = 0; while (node) { t += node.offsetTop; node = node.offsetParent; } return t; };
  // loads a whole film into memory and plays it from there. Some hosts (Cloudflare Workers, which serves the live
  // site, is one) send the whole file even when the browser asks for part of it; the browser then cannot jump to
  // another point in the film, and Safari may not play it at all. A film already in memory can always jump. If
  // fetching does not work (for example when index.html is opened straight from a folder), it loads the normal way.
  const loadFilm = (video, url) => new Promise((done) => {
    const direct = () => { video.src = url; done(); };
    if (!window.fetch || !window.URL || !URL.createObjectURL || location.protocol === "file:") { direct(); return; }
    fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then((b) => { video.src = URL.createObjectURL(b); done(); })
      .catch(direct);
  });
  // writes a style only when it changes
  const put = (node, prop, v) => { const k = "__" + prop; if (node[k] !== v) { node[k] = v; node.style[prop] = v; } };
  const remeasure = () => { measures.forEach((fn) => fn()); runScenes(true); };
  const relayout = () => { VH = window.innerHeight; layouts.forEach((fn) => fn()); remeasure(); };
  {
    // phones change height while the address bar slides in and out; that is not a real resize, and laying the
    // scenes out again for it would make the page jump, so only a change of width or a big change of height counts
    let lastW = window.innerWidth, lastH = window.innerHeight, timer = 0;
    window.addEventListener("resize", () => {
      const w = window.innerWidth, h = window.innerHeight;
      if (!finePointer && w === lastW && Math.abs(h - lastH) < 160) return;
      lastW = w; lastH = h;
      clearTimeout(timer);
      timer = setTimeout(relayout, 120);
    });
    window.addEventListener("load", relayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    // content that grows later (pictures arriving, the helper opening) moves the sections below it
    if ("ResizeObserver" in window) {
      let pending = 0, lastBodyH = 0;
      new ResizeObserver(() => {
        const h = document.body.offsetHeight;
        if (h === lastBodyH || pending) return;
        lastBodyH = h;
        pending = requestAnimationFrame(() => { pending = 0; remeasure(); });
      }).observe(document.body);
    }
  }

  /* ---------- smooth scrolling, the Lenis way ---------- */
  // Works like the Lenis library: the mouse wheel sets a target and the page eases towards it (lerp 0.1 at 60
  // frames a second, the same feel on faster screens), and in-page links glide there with an exponential ease.
  // The scenes move in the same frame as the page. Native scrolling stays in place underneath, so touch,
  // keyboard, the scrollbar and reduced-motion visitors simply get the browser's own scrolling.
  const smooth = { to: (y) => window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" }) };
  if (finePointer && !reduceMotion) {
    root.classList.add("lenis");
    let target = window.scrollY, current = target, lastSet = target, raf = 0, glide = null, lastNow = 0;
    const limit = () => root.scrollHeight - window.innerHeight;
    const step = (now) => {
      const dt = lastNow ? Math.min(64, now - lastNow) : 16.7;
      lastNow = now;
      // someone else moved the page (keys, scrollbar, find in page): hand control back
      if (Math.abs(window.scrollY - lastSet) > 3) { target = current = lastSet = window.scrollY; glide = null; raf = 0; lastNow = 0; return; }
      if (glide) {
        const t = Math.min(1, (now - glide.start) / glide.dur);
        current = glide.from + (glide.to - glide.from) * Math.min(1, 1.001 - Math.pow(2, -10 * t));
        if (t >= 1) { current = target = glide.to; glide = null; }
      } else {
        current += (target - current) * (1 - Math.pow(0.9, dt / 16.7));
        if (Math.abs(target - current) < 0.5) current = target;
      }
      window.scrollTo(0, current);
      lastSet = window.scrollY;
      runScenes(false);
      raf = glide || current !== target ? requestAnimationFrame(step) : 0;
      if (!raf) lastNow = 0;
    };
    const run = () => { if (!raf) raf = requestAnimationFrame(step); };
    window.addEventListener("wheel", (e) => {
      if (e.ctrlKey || root.style.overflow === "hidden") return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // sideways gestures stay native
      if (e.target.closest && e.target.closest("textarea, select, [data-lenis-prevent]")) return;
      e.preventDefault();
      if (!raf) { current = lastSet = target = window.scrollY; }
      glide = null;
      target = clamp(target + e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1), 0, limit());
      run();
    }, { passive: false });
    smooth.to = (y) => {
      if (!raf) { current = lastSet = window.scrollY; }
      const to = clamp(y, 0, limit());
      glide = { from: current, to, start: performance.now(), dur: Math.min(2200, 800 + Math.abs(to - current) * 0.2) };
      target = to;
      run();
    };
  }

  // in-page links glide to their section and move keyboard focus there
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute("data-menu-toggle") || a.hasAttribute("data-menu-close") || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute("href");
    const dest = id && id.length > 1 ? document.getElementById(id.slice(1)) : null;
    if (!dest) return;
    e.preventDefault();
    const pad = id === "#top" ? 0 : parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    smooth.to(dest.getBoundingClientRect().top + window.scrollY - pad);
    if (history.pushState) history.pushState(null, "", id);
    if (!dest.hasAttribute("tabindex")) dest.setAttribute("tabindex", "-1");
    dest.focus({ preventScroll: true });
  });

  root.classList.add("js-ready");
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  /* ---------- menu: a full-screen list of the sections ---------- */
  const menu = $("[data-menu]");
  const menuToggle = $("[data-menu-toggle]");
  if (menu && menuToggle) {
    const label = $("[data-menu-label]", menuToggle);
    const links = $$("a", menu);
    const isOpen = () => menu.classList.contains("is-open");
    const setOpen = (open, focusBack) => {
      menu.classList.toggle("is-open", open);
      root.classList.toggle("menu-open", open);
      root.style.overflow = open ? "hidden" : "";
      menuToggle.setAttribute("aria-expanded", String(open));
      if (label) label.textContent = open ? "Close" : "Menu";
      if (open) setTimeout(() => { if (links[0]) links[0].focus({ preventScroll: true }); }, 60);
      else if (focusBack) menuToggle.focus({ preventScroll: true });
    };
    menuToggle.addEventListener("click", (e) => { e.preventDefault(); setOpen(!isOpen(), true); });
    links.forEach((a) => a.addEventListener("click", (e) => {
      if (a.hasAttribute("data-menu-close")) { e.preventDefault(); setOpen(false, true); return; }
      setOpen(false, false);
    }));
    document.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape") { setOpen(false, true); return; }
      if (e.key !== "Tab") return;
      // keep keyboard focus inside the open menu (the Close button in the bar counts as part of it)
      const ring = [menuToggle].concat(links);
      const i = ring.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); ring[ring.length - 1].focus(); }
      else if (!e.shiftKey && i === ring.length - 1) { e.preventDefault(); ring[0].focus(); }
    });
  }


  /* ---------- scroll reveal ---------- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const revealIo = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      revealIo.unobserve(en.target);
    }), { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((r) => revealIo.observe(r));
  } else {
    reveals.forEach((r) => r.classList.add("is-in"));
  }

  /* ---------- nav: tucks away while you scroll down, comes back with a solid background when you scroll up ---------- */
  const nav = $("[data-nav]");
  if (nav) {
    let lastY = window.scrollY, heroEnd = 0;
    const heroEl = $("[data-hero]");
    const show = () => { nav.classList.remove("is-hidden"); root.classList.remove("nav-hidden"); };
    nav.addEventListener("focusin", show);
    measures.push(() => { heroEnd = heroEl ? heroEl.offsetHeight : 0; });
    scenes.push((y, vh) => {
      const fold = vh * 0.8;
      nav.classList.toggle("is-solid", y > (heroEnd ? heroEnd - vh * 0.5 : vh * 0.5));
      if (!root.classList.contains("menu-open")) {
        if (y > fold && y > lastY + 6) { nav.classList.add("is-hidden"); root.classList.add("nav-hidden"); }
        else if (y < lastY - 6 || y < fold) show();
      }
      if (Math.abs(y - lastY) > 6) lastY = y;
    });
  }

  /* ---------- hero: the ink T-rex bites a chunk out of "excuses." ---------- */
  // Everything in this scene is worked out from how far you have scrolled through the hero (p, 0 to 1), so scrolling
  // back plays it in reverse. "excuses." stays in front of the T-rex while it rises and bites (styles.css gives it
  // the higher z-index); "Good websites." stays behind it: the inside of the mouth is dark, and the page shows in front of the jaws.
  // The bite removes the part of the word inside the jaws and leaves a scalloped tooth mark on what is left. The
  // bitten piece stays between the teeth while the head shakes (only the inside of the mouth shows it, so the teeth
  // overlap it) and is chewed away as the T-rex leaves. What is left of the word tumbles to the ground.
  // BITE says where the mouth is in each drawing, as fractions of the picture. Measure again if you replace them.
  const BITE = {
    open: [0.30, 0.41],  // middle of the open mouth (rex-open-6.webp)
    half: [0.28, 0.345], // middle of the half-open mouth (rex-half-6.webp)
    bite: [0.22, 0.31],  // where the closed teeth meet (rex-bite.webp)
    span: [0.10, 0.36]   // front and back of the closed jaws
  };
  // when each part happens, as fractions of the hero's scroll; fall is when the letters in front of the jaws drop
  const ACT = { rise: 0.05, coil: 0.33, snap: 0.40, hold: 0.43, fall: 0.47, tear: 0.58, gone: 0.84 };
  const fx = { bite: 0 }; // shared with the fog, which flushes red for a moment at the bite
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIn = (x) => x * x * x;
  // a ball dropped on the floor: speeds up, lands, bounces twice and settles
  const bounce = (x) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75; }
    if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; }
    x -= 2.625 / d; return n * x * x + 0.984375;
  };
  // small seeded random numbers, so the blood and the letters land in the same places every time
  const seeded = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const hero = $("[data-hero]");
  const rex = $("[data-rex]");
  const prey = $("[data-prey]");
  if (hero && rex && prey) {
    const stage = $(".hero__stage", hero);
    const inner = $("[data-hero-inner]", hero);
    const bob = $(".rex__bob", rex);
    const bloodCanvas = $("[data-blood]", hero);
    const bctx = bloodCanvas && bloodCanvas.getContext ? bloodCanvas.getContext("2d") : null;
    const TAU = Math.PI * 2;

    // the three drawings: only one shows at a time
    const frames = {};
    $$("img[data-frame]", rex).forEach((im) => { frames[im.dataset.frame] = im; });
    // the inside of the mouth, where the bitten piece shows (rex-half-3-m.webp and rex-bite-m.webp, in styles.css)
    const mouth = el("div", { class: "rex__mouth" });
    bob.appendChild(mouth);
    let shown = "";
    const showFrame = (name) => {
      if (name === shown) return;
      Object.keys(frames).forEach((k) => frames[k].classList.toggle("is-on", k === name));
      mouth.dataset.f = name;
      shown = name;
    };
    // they start loading straight away, after the fonts and stylesheet (the headline is what shows first)
    Object.keys(frames).forEach((k) => {
      const im = frames[k];
      if (im.dataset.srcset) im.srcset = im.dataset.srcset;
      im.src = im.dataset.src;
    });
    ["rex-half-3-m.webp", "rex-bite-m.webp"].forEach((src) => { const im = new Image(); im.src = src; });

    // the word, as letters, plus a copy of it that becomes the bitten-off piece; screen readers read the word once
    const word = prey.textContent.trim();
    prey.textContent = "";
    prey.appendChild(el("span", { class: "sr", text: word }));
    const vis = el("span", { class: "hero__vis", "aria-hidden": "true" });
    const letters = Array.from(word).map((ch) => el("span", { class: "hero__l", text: ch }));
    letters.forEach((l) => vis.appendChild(l));
    const chunk = el("span", { class: "hero__chunk", "aria-hidden": "true" }, Array.from(word).map((ch) => el("span", { class: "hero__l", text: ch })));
    prey.appendChild(vis);
    mouth.appendChild(chunk);
    const setMask = (node, url) => { node.style.webkitMaskImage = url; node.style.maskImage = url; };

    // ----- layout: sizes and positions, measured again whenever the window changes
    let L = null;
    const layout = () => {
      letters.forEach((l) => { put(l, "transform", ""); l.style.backgroundImage = ""; l.style.visibility = ""; setMask(l, ""); l.classList.remove("is-cut"); });
      chunk.classList.remove("is-on");
      put(inner, "transform", "");
      const s = stage.getBoundingClientRect();
      const W = s.width, H = s.height;
      if (!W || !H) return;
      const wr = vis.getBoundingClientRect();
      const wx0 = wr.left - s.left, wy0 = wr.top - s.top, ww = wr.width, wh = wr.height, by = wy0 + wh / 2;
      const ax = BITE.bite[0], ay = BITE.bite[1];
      const lead = ww * 0.26; // the start of the word stays outside the jaws; the tooth marks cut through the letters either side
      // big enough that the cut-off edges of the drawing stay off screen while it bites
      let rw = ww * 2.1, bx = 0;
      for (let k = 0; k < 3; k++) {
        bx = wx0 + lead + (ax - BITE.span[0]) * rw;
        rw = Math.min(W * 2.4, Math.max(ww * 2.1, (W - bx) / (1 - ax) + 30, (H - by) / ((1 - ay) * 0.8) + 30));
      }
      bx = wx0 + lead + (ax - BITE.span[0]) * rw;
      const rh = rw * 0.8;
      rex.style.width = rw.toFixed(1) + "px";
      const s0 = bx - (ax - BITE.span[0]) * rw, s1 = bx + (BITE.span[1] - ax) * rw;

      // the bite mark, in the word's own coordinates: a scalloped arc of tooth marks on each side of the bitten part
      // (never past the last fifth of the word, so on narrow screens the end of the word survives too)
      const cl = s0 - wx0, cr = Math.min(s1 - wx0, ww * 0.82), bulge = wh * 0.16, notch = wh * 0.065, teeth = 7;
      const edge = (x, dir) => {
        const pts = [];
        for (let i = 0; i <= 64; i++) {
          const y = -wh * 0.3 + wh * 1.6 * (i / 64), u = clamp(y / wh, 0, 1);
          pts.push([x + dir * (bulge * Math.sin(Math.PI * u) + notch * Math.abs(Math.sin(teeth * Math.PI * u))), y]);
        }
        return pts;
      };
      const poly = edge(cl, -1).concat(edge(cr, 1).reverse());
      const path = "M" + poly.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z";
      const svg = (d, rule) => 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + ww.toFixed(1) + " " + wh.toFixed(1) +
        '" preserveAspectRatio="none"><path fill="#fff" fill-rule="' + rule + '" d="' + d + '"/></svg>') + '")';
      const keep = svg("M-99 -99H" + (ww + 99).toFixed(1) + "V" + (wh + 99).toFixed(1) + "H-99Z" + path, "evenodd");

      // the bitten piece sits inside the T-rex, placed so that it lines up with the word at the moment of the bite
      const cs = getComputedStyle(prey);
      ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight"].forEach((k) => { chunk.style[k] = cs[k]; });
      chunk.style.width = ww.toFixed(1) + "px";
      chunk.style.height = wh.toFixed(1) + "px";
      setMask(chunk, svg(path, "nonzero"));
      const bpx = bx - wx0, bpy = by - wy0;
      chunk.style.left = (ax * rw - bpx).toFixed(1) + "px";
      chunk.style.top = (ay * rh - bpy).toFixed(1) + "px";
      chunk.style.transformOrigin = bpx.toFixed(1) + "px " + bpy.toFixed(1) + "px";

      // what is left of each letter darkens to blood red towards the bite; letters wholly inside the jaws are eaten,
      // the others tumble to the ground: the ones in front of the jaws first, the ones behind once the head lifts
      const fade = ww * 0.16, reach = bulge + notch;
      const R2 = seeded(5);
      const floor = H * 0.94;
      const lets = letters.map((l) => {
        const r = l.getBoundingClientRect(), lx = r.left - wr.left, ly = r.top - wr.top, lw = Math.max(1, r.width), lh = r.height;
        const side = lx + lw / 2 < (cl + cr) / 2 ? -1 : 1;
        const pct = (x) => ((x - lx) / lw * 100).toFixed(1) + "%";
        const grad = side < 0
          ? "linear-gradient(90deg, var(--accent) " + pct(cl - fade) + ", #c42a18 " + pct(cl - fade * 0.3) + ", #8e1209 " + pct(cl) + ")"
          : "linear-gradient(90deg, #8e1209 " + pct(cr) + ", #c42a18 " + pct(cr + fade * 0.3) + ", var(--accent) " + pct(cr + fade) + ")";
        const eaten = lx >= cl - 1 && lx + lw <= cr + 1;
        const cut = !eaten && lx + lw > cl - reach && lx < cr + reach;
        // where it ends up: lying on the floor at an angle, a little away from the bite
        const flat = R2() < 0.6;
        const rot = (R2() < 0.5 ? -1 : 1) * (flat ? 78 + R2() * 24 : 8 + R2() * 30);
        const th = rot * Math.PI / 180;
        const ext = Math.abs(Math.cos(th)) * lh * 0.3 + Math.abs(Math.sin(th)) * lw * 0.42;
        const cx = wx0 + lx + lw / 2, cy = wy0 + ly + lh / 2;
        const tx = side * (ww * 0.03 + R2() * ww * 0.14);
        return {
          el: l, side, grad, eaten, cut, lx, ly, rot, cx,
          tx: clamp(cx + tx, lw, W - lw) - cx,
          ty: floor - ext - cy - R2() * H * 0.025,
          dur: 0.13 + R2() * 0.05,
          start: 0
        };
      });
      // the letters nearest the bite go first
      [-1, 1].forEach((sd) => {
        lets.filter((o) => o.side === sd && !o.eaten)
          .sort((a, b) => (sd < 0 ? b.cx - a.cx : a.cx - b.cx))
          .forEach((o, i) => { o.start = (sd < 0 ? ACT.fall : ACT.tear + 0.03) + i * 0.014; });
      });

      // blood: droplets thrown out of the bite, splats and drips at the torn edges of the word
      const R = seeded(11);
      const unit = Math.max(ww, 150);
      const shades = ["#9e140c", "#c4241a", "#e23b22"];
      const drops = [[], [], []];
      const n = W < 700 ? 90 : 160;
      for (let i = 0; i < n; i++) {
        const ox = R() < 0.6 ? s0 + R() * (s1 - s0) * 0.3 : s0 + R() * (s1 - s0);
        const oy = by + (R() - 0.5) * wh * 0.55;
        const a = (150 + (R() - 0.5) * 150) * Math.PI / 180; // mostly to the left, fanning up and down
        const sp = unit * (0.6 + R() * 2.6);
        const late = R() < 0.3; // some spurt out while the head shakes
        drops[Math.floor(R() * 3)].push({
          ox, oy, vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp - unit * 0.25,
          te: ACT.snap + R() * 0.01 + (late ? 0.04 + R() * 0.1 : 0),
          life: 0.14 + R() * 0.34,
          r: 0.7 + R() * R() * unit * 0.02
        });
      }
      const splats = [];
      const ns = W < 700 ? 6 : 9;
      for (let i = 0; i < ns; i++) {
        const atLeft = i % 3 !== 2 || cr > ww; // most at the front edge; at the back edge too when something is left there
        const r0 = unit * (0.014 + R() * 0.03);
        const lobes = [[0, 0, r0]];
        const nl = 3 + Math.floor(R() * 4);
        for (let j = 0; j < nl; j++) { const a = R() * TAU, d = r0 * (0.5 + R() * 0.5); lobes.push([Math.cos(a) * d, Math.sin(a) * d, r0 * (0.35 + R() * 0.4)]); }
        const sats = [];
        const nsat = 4 + Math.floor(R() * 8);
        for (let j = 0; j < nsat; j++) { const a = R() * TAU, d = r0 * (1.4 + R() * 2.4); sats.push([Math.cos(a) * d, Math.sin(a) * d, r0 * (0.06 + R() * 0.16)]); }
        const drips = [];
        if (R() < 0.85) drips.push({ dx: (R() - 0.5) * r0, w: r0 * (0.16 + R() * 0.16), max: unit * (0.05 + R() * 0.22), speed: 1.5 + R() * 2.5 });
        const x = atLeft ? s0 - R() * ww * 0.06 : s1 + R() * ww * 0.06;
        splats.push({ x, y: by + (R() - 0.5) * wh * 0.8, r: r0, te: ACT.snap + 0.003 + i * 0.003, lobes, sats, drips });
      }
      L = { W, H, bx, by, rw, rh, ww, wh, unit, lets, keep, drops, shades, splats, bitten: null };
      if (bctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        bloodCanvas.width = Math.round(W * dpr);
        bloodCanvas.height = Math.round(H * dpr);
        bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    // ----- where the bite point is, how the head is tilted and which drawing shows, at progress p
    // (a positive angle lifts the snout, a negative one drops it)
    const rexAt = (p) => {
      const { W, H, bx, by, rw } = L;
      const coilX = bx + rw * 0.1, coilY = by - rw * 0.08;
      if (p < ACT.coil) { // rises from below the screen with its jaws open
        const k = easeOut(clamp((p - ACT.rise) / (ACT.coil - ACT.rise), 0, 1));
        return { x: lerp(bx + W * 0.55, coilX, k), y: lerp(by + H * 1.05, coilY, k), rot: lerp(20, 9, k), a: BITE.open, f: "open" };
      }
      if (p < ACT.snap) { // lunges at the word, the jaws closing as it lands
        const t = (p - ACT.coil) / (ACT.snap - ACT.coil), k = easeIn(t);
        return {
          x: lerp(coilX, bx, k), y: lerp(coilY, by, k), rot: lerp(9, -4, k),
          a: [lerp(BITE.open[0], BITE.bite[0], k), lerp(BITE.open[1], BITE.bite[1], k)],
          f: t < 0.62 ? "open" : t < 0.9 ? "half" : "bite"
        };
      }
      if (p < ACT.hold) return { x: bx, y: by, rot: -4, a: BITE.bite, f: "bite" }; // the jaws slam shut
      if (p < ACT.tear) { // holds the bitten piece between its teeth and shakes it
        const t = (p - ACT.hold) / (ACT.tear - ACT.hold);
        const g = easeOut(clamp(t / 0.25, 0, 1));
        const shake = Math.sin(t * 19) * 6 * (1 - t) * (1 - t);
        const pull = easeOut(clamp((t - 0.35) / 0.65, 0, 1));
        return {
          x: bx + rw * 0.05 * pull, y: by - rw * 0.04 * pull, rot: -4 + shake + 6 * pull,
          a: [lerp(BITE.bite[0], BITE.half[0], g), lerp(BITE.bite[1], BITE.half[1], g)], f: "half"
        };
      }
      // leaves, chewing
      const t = clamp((p - ACT.tear) / (ACT.gone - ACT.tear), 0, 1), k = easeIn(t);
      return {
        x: lerp(bx + rw * 0.05, bx + W * 0.6, k), y: lerp(by - rw * 0.04, by + H * 1.1, k), rot: lerp(2, 16, k),
        a: BITE.half, f: Math.floor(t * 9) % 2 ? "bite" : "half"
      };
    };

    const poseWord = (p, r) => {
      const bitten = p >= ACT.snap;
      if (bitten !== L.bitten) {
        L.bitten = bitten;
        L.lets.forEach((o) => {
          o.el.classList.toggle("is-cut", bitten);
          o.el.style.backgroundImage = bitten ? o.grad : "";
          o.el.style.visibility = bitten && o.eaten ? "hidden" : "";
          if (o.cut) {
            // each letter carries its own piece of the tooth mark, so it keeps it while it falls
            setMask(o.el, bitten ? L.keep : "");
            const size = bitten ? L.ww.toFixed(1) + "px " + L.wh.toFixed(1) + "px" : "";
            const pos = bitten ? (-o.lx).toFixed(1) + "px " + (-o.ly).toFixed(1) + "px" : "";
            o.el.style.webkitMaskSize = o.el.style.maskSize = size;
            o.el.style.webkitMaskPosition = o.el.style.maskPosition = pos;
          }
        });
        chunk.classList.toggle("is-on", bitten);
      }
      // what is left of the word jolts apart as the jaws tear the piece out, then tumbles to the ground
      const j = bitten ? Math.sin(clamp((p - ACT.snap) / 0.035, 0, 1) * Math.PI) : 0;
      L.lets.forEach((o) => {
        if (o.eaten) return;
        const t = bitten ? clamp((p - o.start) / o.dur, 0, 1) : 0;
        let tf = "";
        if (t > 0) {
          const e = easeOut(t);
          tf = "translate3d(" + (o.tx * e).toFixed(1) + "px," + (o.ty * bounce(t)).toFixed(1) + "px,0) rotate(" + (o.rot * easeOut(Math.min(1, t * 1.25))).toFixed(1) + "deg)";
        } else if (j) {
          tf = "translate3d(" + (o.side * 7 * j).toFixed(1) + "px," + (3 * j).toFixed(1) + "px,0)";
        }
        put(o.el, "transform", tf);
      });
      if (bitten) {
        // the bitten piece stays in the jaws (it follows the mouth from one drawing to the next) and shrinks away
        // as it is chewed
        const k = clamp((p - ACT.tear) / (ACT.gone - ACT.tear - 0.06), 0, 1);
        put(chunk, "transform", "translate3d(" + ((r.a[0] - BITE.bite[0]) * L.rw).toFixed(1) + "px," + ((r.a[1] - BITE.bite[1]) * L.rh).toFixed(1) + "px,0) rotate(4deg) scale(" + (1 - 0.5 * k).toFixed(3) + ")");
        put(chunk, "opacity", (1 - k).toFixed(3));
      }
    };

    // the blood is only drawn after the bite; before it the canvas is cleared once and left alone
    let bloodOn = false;
    const drawBlood = (p) => {
      if (!bctx) return;
      if (p < ACT.snap && !bloodOn) return;
      bctx.clearRect(0, 0, L.W, L.H);
      bloodOn = p >= ACT.snap;
      if (!bloodOn) return;
      const g = L.unit * 8;
      L.splats.forEach((s) => {
        const k = clamp((p - s.te) / 0.014, 0, 1);
        if (k <= 0) return;
        const e = easeOut(k);
        bctx.fillStyle = "#a8150d";
        bctx.beginPath();
        s.lobes.forEach(([dx, dy, rr]) => { const x = s.x + dx * e, y = s.y + dy * e; bctx.moveTo(x + rr * e, y); bctx.arc(x, y, rr * e, 0, TAU); });
        s.sats.forEach(([dx, dy, rr]) => { const x = s.x + dx * e, y = s.y + dy * e; bctx.moveTo(x + rr, y); bctx.arc(x, y, rr, 0, TAU); });
        s.drips.forEach((d) => {
          const len = Math.min(d.max, Math.max(0, p - s.te - 0.012) * L.unit * d.speed * 3);
          if (len < 1) return;
          const x = s.x + d.dx;
          bctx.rect(x - d.w / 2, s.y, d.w, len);
          bctx.moveTo(x + d.w * 0.85, s.y + len);
          bctx.arc(x, s.y + len, d.w * 0.85, 0, TAU);
        });
        bctx.fill();
        bctx.fillStyle = "rgba(255, 120, 90, .22)"; // a wet highlight
        bctx.beginPath();
        bctx.arc(s.x - s.r * 0.28, s.y - s.r * 0.3, s.r * 0.32 * e, 0, TAU);
        bctx.fill();
      });
      bctx.lineCap = "round";
      L.drops.forEach((group, gi) => {
        bctx.fillStyle = bctx.strokeStyle = L.shades[gi];
        group.forEach((d) => {
          const tt = (p - d.te) * 3;
          if (tt <= 0) return;
          const t1 = Math.min(tt, d.life);
          const at = (t) => [d.ox + d.vx * t * (1 - 0.3 * t), d.oy + d.vy * t + 0.5 * g * t * t];
          const [x, y] = at(t1);
          if (tt < d.life) { // in flight: a short streak
            const [x0, y0] = at(Math.max(0, t1 - 0.025));
            bctx.lineWidth = d.r * 1.7;
            bctx.beginPath(); bctx.moveTo(x0, y0); bctx.lineTo(x, y); bctx.stroke();
          } else { // landed: a small stretched drop
            bctx.beginPath();
            bctx.ellipse(x, y, d.r * 1.5, d.r * 1.05, Math.atan2(d.vy + g * t1, d.vx), 0, TAU);
            bctx.fill();
          }
        });
      });
    };

    const pose = (p, still) => {
      if (!L) return;
      hero.classList.toggle("is-moving", p > 0.02);
      const on = p > ACT.rise && p < ACT.gone;
      rex.classList.toggle("is-on", on);
      const r = rexAt(clamp(p, ACT.rise, ACT.gone));
      if (on) {
        showFrame(r.f);
        put(rex, "transformOrigin", (r.a[0] * 100).toFixed(2) + "% " + (r.a[1] * 100).toFixed(2) + "%");
        put(rex, "transform", "translate3d(" + (r.x - r.a[0] * L.rw).toFixed(1) + "px," + (r.y - r.a[1] * L.rh).toFixed(1) + "px,0) rotate(" + r.rot.toFixed(2) + "deg)");
      }
      poseWord(p, r);
      // a short shudder through the whole scene as the jaws close
      const sk = (p - ACT.snap) / 0.06;
      if (!still && sk > 0 && sk < 1) {
        const amp = 10 * (1 - sk) * (1 - sk);
        put(inner, "transform", "translate3d(" + (Math.sin(sk * 40) * amp).toFixed(1) + "px," + (Math.cos(sk * 33) * amp * 0.6).toFixed(1) + "px,0)");
      } else {
        put(inner, "transform", "");
      }
      fx.bite = still || p < ACT.snap ? 0 : clamp(1 - (p - ACT.snap) / 0.22, 0, 1);
    };

    if (reduceMotion) {
      // one still picture: the bitten piece in its teeth, the tooth mark and the blood already there
      hero.classList.add("is-static");
      layouts.push(() => { layout(); if (L) { pose(ACT.snap + 0.04, true); drawBlood(ACT.snap + 0.3); } });
    } else {
      // where the hero sits on the page, noted once (and again when the page changes size)
      let heroTop = 0, heroH = 1;
      measures.push(() => { heroTop = docTop(hero); heroH = hero.offsetHeight; });
      layouts.push(layout);
      scenes.push((y, vh) => {
        if (!L) return;
        if (y > heroTop + heroH || y + vh < heroTop) { fx.bite = 0; return; }
        const p = clamp((y - heroTop) / Math.max(1, heroH - vh), 0, 1);
        pose(p, false);
        drawBlood(p);
      });
    }
  }

  /* ---------- showreel: plays by itself, muted, behind the introduction ---------- */
  // The film is fixed to the screen and the introduction is a window onto it (styles.css, .intro), so it never
  // moves while the words scroll over it. It starts while the introduction fills the middle of the screen and pauses
  // when it leaves. Never by itself with reduced motion or data saver: then the Play button starts it. Sound stays
  // off until the visitor turns it on. The film is only drawn while the introduction is near the screen.
  const reel = $("[data-reel]");
  if (reel) {
    const video = $("video", reel);
    const ui = $("[data-reel-ui]", reel);
    const playBtn = $("[data-reel-play]", reel);
    const soundBtn = $("[data-reel-sound]", reel);
    if (video && ui && playBtn && soundBtn) {
      video.removeAttribute("controls");
      video.muted = true;
      ui.hidden = false;
      let userPaused = false, inView = false, film = null;
      const src = (video.querySelector("source") || video).getAttribute("src");
      const getFilm = () => { if (!film) film = loadFilm(video, src); return film; };
      const sync = () => {
        const playing = !video.paused && !video.ended;
        playBtn.textContent = playing ? "Pause" : "Play";
        playBtn.setAttribute("aria-pressed", String(playing));
        soundBtn.textContent = video.muted ? "Sound off" : "Sound on";
        soundBtn.setAttribute("aria-pressed", String(!video.muted));
      };
      // asked: play once the film is in memory (by itself, only if the introduction is still in view by then)
      const play = (asked) => getFilm().then(() => {
        if (!asked && !inView) return;
        const pr = video.play(); if (pr && pr.catch) pr.catch(sync);
      });
      playBtn.addEventListener("click", () => {
        if (video.paused) { userPaused = false; play(true); } else { userPaused = true; video.pause(); }
      });
      soundBtn.addEventListener("click", () => {
        video.muted = !video.muted;
        if (!video.muted && video.paused) { userPaused = false; play(true); }
        sync();
      });
      ["play", "pause", "volumechange", "ended"].forEach((ev) => video.addEventListener(ev, sync));
      sync();
      // the buttons only show while the introduction covers the bottom of the screen, so tabbing to them
      // brings the introduction into view first
      ui.addEventListener("focusin", () => {
        const r = reel.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.5 || r.bottom < window.innerHeight) smooth.to(window.scrollY + r.top);
      });
      const auto = !reduceMotion && !saveData;
      if ("IntersectionObserver" in window) {
        reel.classList.add("is-far");
        // a screen or so before it arrives: draw the film, and start downloading it so it is ready to play
        new IntersectionObserver((entries) => entries.forEach((en) => {
          reel.classList.toggle("is-far", !en.isIntersecting);
          if (en.isIntersecting && auto) getFilm();
        }), { rootMargin: "100% 0px" }).observe(reel);
        // the introduction covers the middle of the screen: play; it has gone: pause
        new IntersectionObserver((entries) => entries.forEach((en) => {
          inView = en.isIntersecting;
          if (inView) { if (auto && !userPaused) play(false); }
          else if (!video.paused) video.pause();
        }), { rootMargin: "-30% 0px -30% 0px" }).observe(reel);
      }
    }
  }

  /* ---------- contact: the T-rex peeks over "Let's work together" ---------- */
  // Its eyes show above the button; point at the button (or tab to it) and it rises with a phone in its hands.
  // Touch screens have no pointing, so there it rises while the button sits in the middle of the screen.
  const cta = $("[data-cta]");
  if (cta) {
    const link = $(".cta__link", cta);
    const up = () => cta.classList.add("is-peek");
    const down = () => cta.classList.remove("is-peek");
    if (link) {
      if (finePointer) {
        link.addEventListener("pointerenter", up);
        link.addEventListener("pointerleave", () => { if (document.activeElement !== link) down(); });
      }
      link.addEventListener("focus", up);
      link.addEventListener("blur", down);
      if (!finePointer && "IntersectionObserver" in window) {
        new IntersectionObserver((entries) => entries.forEach((en) => (en.isIntersecting ? up() : down())),
          { rootMargin: "-30% 0px -30% 0px" }).observe(link);
      }
    }
  }

  /* ---------- intro: client names drift at different speeds ---------- */
  const names = $("[data-names]");
  if (names && !reduceMotion) {
    const items = $$("[data-depth]", names).map((n) => [n, parseFloat(n.dataset.depth) || 0]);
    const sec = names.parentElement;
    const narrow = window.matchMedia("(max-width: 640px)"); // on phones the names sit still in a list
    let top = 0, h = 0;
    measures.push(() => { top = docTop(sec); h = sec.offsetHeight; });
    scenes.push((y, vh) => {
      if (narrow.matches) return;
      const t = top - y;
      if (t + h < -200 || t > vh + 200) return;
      const c = t + h / 2 - vh / 2;
      items.forEach(([n, d]) => { put(n, "transform", "translate3d(0, " + (-c * d * 0.55).toFixed(1) + "px, 0)"); });
    });
  }

  /* ---------- the village: caves, cave people and dinosaurs, then the meteorite ---------- */
  // The street of homes slides sideways while the dinosaurs and cave people go about their day. Then a meteorite
  // strikes and the ground, the homes, the creatures and the sentence above all crumble and fall out of the bottom
  // of the screen, onto "Things I do". Everything is worked out from the scroll, so it also plays backwards.
  // How long the strike and the crumble last, in screen heights of scrolling:
  const VILLAGE = { strike: 0.6, crumble: 1.0 };
  const street = $("[data-street]");
  if (street) {
    const section = street.closest(".street");
    const stage = $("[data-street-stage]", street);
    const village = $("[data-village]", street);
    const world = $("[data-street-row]", street);
    const ground = $("[data-ground]", street);
    const headEl = $("[data-crumble-head] .statement", street);
    const huts = $$(".hut", street);
    const S = {};
    $$("[data-sprite]", street).forEach((n) => { S[n.dataset.sprite] = n; });
    const meteor = $("[data-meteor]", street), ring = $("[data-impact-ring]", street);
    const flash = $("[data-impact-flash]", street), sky = $("[data-impact-sky]", street);
    const debris = $("[data-debris]", street);
    const dctx = debris && debris.getContext ? debris.getContext("2d") : null;
    const TAU2 = Math.PI * 2;
    if (reduceMotion) {
      section.classList.add("is-static");
    } else {
      // the sentence breaks apart word by word (screen readers still read it as one sentence)
      const words = [];
      const split = (node) => {
        Array.from(node.childNodes).forEach((c) => {
          if (c.nodeType === 3) {
            const frag = document.createDocumentFragment();
            c.textContent.split(/(\s+)/).forEach((t) => {
              if (!t) return;
              if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
              const w = el("span", { class: "word", text: t });
              words.push(w);
              frag.appendChild(w);
            });
            node.replaceChild(frag, c);
          } else if (c.nodeType === 1) split(c);
        });
      };
      if (headEl) split(headEl);
      const lifeSprites = ["brachio", "trike", "chase"].filter((k) => S[k]);

      let L = null;
      const layout = () => {
        const R = seeded(23);
        put(world, "transform", "none");
        put(village, "transform", "");
        huts.concat(words, lifeSprites.map((k) => S[k])).forEach((n) => { put(n, "transform", ""); });
        const W = window.innerWidth, H = stage.clientHeight || window.innerHeight;
        const sr = stage.getBoundingClientRect(), wr = world.getBoundingClientRect();
        const shop = huts[0] ? huts[0].getBoundingClientRect().width : 300;
        const start = W * 0.42;
        const travel = Math.max(0, start + wr.width - W * 0.98);
        // the long-necked dinosaur walks in front of two homes: data-walk="4,5" on it means from the right side of the
        // 4th home ("Reels and video") to the middle of the 5th ("WhatsApp chatbots"). It walks while that stretch of
        // street crosses the screen and stands still before and after. Its frames are mirrored, so its body is a
        // little right of the middle of its picture.
        let brachio = null;
        if (S.brachio) {
          const pair = (S.brachio.dataset.walk || "4,5").split(",").map((n) => huts[parseInt(n, 10) - 1]);
          if (pair[0] && pair[1]) {
            const a = pair[0].getBoundingClientRect(), b = pair[1].getBoundingClientRect();
            const x0 = a.left + a.width * 0.8 - wr.left, x1 = b.left + b.width * 0.5 - wr.left;
            S.brachio.style.left = (x0 - S.brachio.offsetWidth * 0.56).toFixed(1) + "px";
            // the world sits at start - pw * travel, so a point x in it is on screen at wr.left + x + start - pw * travel
            const at = (x, sx) => (travel ? (wr.left + x + start - sx) / travel : 0);
            const pIn = clamp(at(x0, W * 0.85), 0, 0.95), pOut = clamp(Math.max(at(x1, W * 0.35), pIn + 0.05), 0, 1);
            brachio = { span: x1 - x0, pIn, pOut, steps: (x1 - x0) / (shop * 0.5) };
          }
        }
        const walk = travel * 0.85, strike = H * VILLAGE.strike, crumble = H * VILLAGE.crumble;
        street.style.height = Math.round(H + walk + strike + crumble) + "px";
        const shift = start - travel;       // where the world sits once the walk is over
        const wOff = wr.left - sr.left;     // the world's own offset inside the stage
        const toStage = (r) => ({ x: r.left - wr.left + wOff + shift + r.width / 2, y: r.top - sr.top + r.height / 2 });

        // the ground, cut into rough chunks that can fall one by one
        ground.textContent = "";
        ground.classList.add("is-split");
        const gw = ground.offsetWidth, gh = ground.offsetHeight;
        const gr = ground.getBoundingClientRect();
        const gx0 = gr.left - wr.left, gy0 = gr.top - sr.top;
        const cols = Math.max(6, Math.round(gw / (gh * 0.95)));
        const jit = (k) => (R() - 0.5) * k;
        const xs = [];
        for (let j = 0; j <= cols; j++) {
          const X = (j / cols) * gw;
          xs.push(j === 0 || j === cols ? [X, X, X] : [X + jit(gh * 0.5), X + jit(gh * 0.5), X + jit(gh * 0.5)]);
        }
        const mids = [];
        for (let j = 0; j <= cols; j++) mids.push(gh * (0.42 + jit(0.3)));
        const chunks = [];
        const addChunk = (pts) => {
          const px = pts.map((p) => p[0]), py = pts.map((p) => p[1]);
          const minx = Math.min.apply(null, px), maxx = Math.max.apply(null, px), miny = Math.min.apply(null, py), maxy = Math.max.apply(null, py);
          const c = el("div", { class: "chunk" });
          // each chunk shows its own piece of the ground picture; 1px of overlap hides the seams
          const poly = pts.map((p) => (p[0] - minx + (p[0] > (minx + maxx) / 2 ? 1 : 0)).toFixed(1) + "px " + (p[1] - miny + (p[1] > (miny + maxy) / 2 ? 1 : 0)).toFixed(1) + "px").join(",");
          c.style.cssText = "left:" + minx.toFixed(1) + "px;top:" + miny.toFixed(1) + "px;width:" + Math.ceil(maxx - minx + 2) + "px;height:" + Math.ceil(maxy - miny + 2) +
            "px;background-size:auto " + gh + "px;background-position:" + (-minx).toFixed(1) + "px " + (-miny).toFixed(1) + "px;clip-path:polygon(" + poly + ")";
          ground.appendChild(c);
          chunks.push({ el: c, x: gx0 + (minx + maxx) / 2 + wOff + shift, y: gy0 + (miny + maxy) / 2 });
        };
        for (let j = 0; j < cols; j++) {
          addChunk([[xs[j][0], 0], [xs[j + 1][0], 0], [xs[j + 1][1], mids[j + 1]], [xs[j][1], mids[j]]]);
          addChunk([[xs[j][1], mids[j]], [xs[j + 1][1], mids[j + 1]], [xs[j + 1][2], gh], [xs[j][2], gh]]);
        }

        // where the meteorite lands, and how every piece flies off when it does
        const ix = W * 0.56, iy = gy0 + gh * 0.12;
        if (flash) { flash.style.setProperty("--ix", (ix / W * 100).toFixed(1) + "%"); flash.style.setProperty("--iy", (iy / H * 100).toFixed(1) + "%"); }
        const fallers = [];
        const addFaller = (node, x, y, heavy, sprite) => {
          const dist = Math.min(1, Math.abs(x - ix) / W + Math.abs(y - iy) / (H * 2));
          fallers.push({
            el: node, sprite,
            delay: dist * 0.24 + R() * 0.04,
            vx: Math.sign(x - ix || 1) * W * (0.1 + R() * 0.32) * (1.25 - dist),
            vy: -H * (0.35 + R() * 0.85) * (1.1 - dist) * (heavy ? 0.6 : 1),
            spin: (R() - 0.5) * (heavy ? 140 : 480)
          });
        };
        chunks.forEach((c) => addFaller(c.el, c.x, c.y, false));
        huts.forEach((h) => { const p = toStage(h.getBoundingClientRect()); addFaller(h, p.x, p.y, true); });
        lifeSprites.forEach((k) => { const p = toStage(S[k].getBoundingClientRect()); addFaller(S[k], p.x, p.y, k === "brachio", k); });
        words.forEach((w) => { const r = w.getBoundingClientRect(); addFaller(w, r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2, false); });
        // rocks and embers thrown up by the strike
        const bits = [];
        const nb = W < 700 ? 70 : 140;
        for (let i = 0; i < nb; i++) {
          const a = -Math.PI * (0.08 + R() * 0.84), sp = H * (0.5 + R() * 1.7);
          bits.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.2 + R() * R() * 8, ember: R() < 0.45, spin: R() * 8, t0: R() * 0.05 });
        }
        if (dctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          debris.width = Math.round(W * dpr); debris.height = Math.round(H * dpr);
          dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        L = { W, H, shop, start, travel, walk, strike, crumble, ix, iy, fallers, bits, brachio, mw: meteor ? meteor.offsetWidth : 0, mh: meteor ? meteor.offsetHeight : 0 };
      };

      // how far along its walk the long-necked dinosaur is (0 to 1); its legs move only while it walks, one stride
      // for about half a home of ground covered
      const walked = (pw) => (L.brachio ? clamp((pw - L.brachio.pIn) / (L.brachio.pOut - L.brachio.pIn), 0, 1) : 0);
      const brachioAnim = S.brachio ? $(".anim", S.brachio) : null;
      // what each creature is doing at scroll position s (frozen once the meteorite has landed)
      const life = (k, s, pw, flee) => {
        if (k === "brachio") return "translate3d(" + (L.brachio ? walked(pw) * L.brachio.span : 0).toFixed(1) + "px,0,0) rotate(" + (-flee * 5).toFixed(2) + "deg)";
        if (k === "trike") return "translate3d(" + (pw * L.travel * 0.32 + flee * L.W * 0.5).toFixed(1) + "px,0,0)";
        if (k === "chase") return "translate3d(" + (-pw * L.travel * 0.28 - flee * L.W * 0.45).toFixed(1) + "px,0,0)";
        return "";
      };

      // where the street sits on the page, noted once (and again when the page changes size)
      let streetTop = 0, streetH = 0, debrisDrawn = false;
      measures.push(() => { streetTop = docTop(street); streetH = street.offsetHeight; });
      const update = (y, vh) => {
        if (!L) return;
        const top = streetTop - y;
        if (top + streetH < 0 || top > vh) return;
        const { W, H } = L;
        const s = clamp(-top, 0, L.walk + L.strike + L.crumble);
        const pw = L.walk ? clamp(s / L.walk, 0, 1) : 1;
        const m = clamp((s - L.walk) / L.strike, 0, 1);               // the meteorite on its way
        const q = clamp((s - L.walk - L.strike) / L.crumble, 0, 1);   // after it lands
        const sLife = Math.min(s, L.walk + L.strike), flee = easeIn(m);
        put(world, "transform", "translate3d(" + (L.start - pw * L.travel).toFixed(1) + "px,0,0)");
        if (brachioAnim && L.brachio) brachioAnim.__frame = Math.floor(walked(pw) * L.brachio.steps * (+brachioAnim.dataset.n || 1));
        if (S.ptero) { // flies across the sky and escapes upwards when the meteorite comes
          const span = W * 1.5, x = W * 1.1 - ((s * 0.55) % span), y = Math.sin(s / 160) * L.shop * 0.06 - flee * H * 0.7;
          put(S.ptero, "transform", "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)");
        }
        if (meteor) { // falls faster and faster from the top right, its rock landing on the ground
          const k = Math.pow(m, 2.2), mw = L.mw, mh = L.mh;
          const x = lerp(W + mw * 0.3, L.ix, k) - mw * 0.2, y = lerp(-mh * 0.5, L.iy, k) - mh * 0.8;
          put(meteor, "opacity", m > 0 && q <= 0 ? "1" : "0");
          if (m > 0 && q <= 0) put(meteor, "transform", "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + (0.45 + 0.7 * k).toFixed(3) + ")");
        }
        if (sky) put(sky, "opacity", (m * 0.95 * (1 - Math.min(1, q * 2))).toFixed(3));
        if (flash) put(flash, "opacity", (q > 0 ? Math.max(0, 1 - q / 0.12) : 0).toFixed(3));
        if (ring) {
          const rk = clamp(q / 0.3, 0, 1);
          put(ring, "opacity", (q > 0 ? 1 - rk : 0).toFixed(3));
          if (q > 0) ring.style.transform = "translate3d(" + L.ix.toFixed(1) + "px," + L.iy.toFixed(1) + "px,0) scale(" + (1 + easeOut(rk) * W / 9).toFixed(2) + ")";
        }
        // the whole scene shudders as it lands
        const sh = q > 0 && q < 0.18 ? 1 - q / 0.18 : 0;
        put(village, "transform", sh ? "translate3d(" + (Math.sin(q * 95) * 16 * sh).toFixed(1) + "px," + (Math.cos(q * 70) * 10 * sh).toFixed(1) + "px,0)" : "");
        // and everything crumbles
        L.fallers.forEach((f) => {
          const pre = f.sprite ? life(f.sprite, sLife, pw, flee) : "";
          const t = Math.max(0, q - f.delay) * 1.7;
          if (t <= 0) { put(f.el, "transform", pre); return; }
          const x = f.vx * t, y = f.vy * t + 0.5 * H * 3.4 * t * t;
          put(f.el, "transform", pre + " translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) rotate(" + (f.spin * t).toFixed(1) + "deg)");
        });
        if (dctx && (debrisDrawn || (q > 0 && q < 0.9))) {
          dctx.clearRect(0, 0, W, H);
          debrisDrawn = q > 0 && q < 0.9;
          if (debrisDrawn) {
            const g = H * 3.4;
            L.bits.forEach((b) => {
              const t = Math.max(0, q - b.t0) * 1.4;
              if (t <= 0) return;
              const x = L.ix + b.vx * t, y = L.iy + b.vy * t + 0.5 * g * t * t;
              if (y > H + 20) return;
              if (b.ember) {
                dctx.fillStyle = "rgba(255," + (110 + Math.round(b.r * 12)) + ",60," + Math.max(0, 1 - t).toFixed(2) + ")";
                dctx.beginPath(); dctx.arc(x, y, b.r * 0.6, 0, TAU2); dctx.fill();
              } else {
                dctx.save(); dctx.translate(x, y); dctx.rotate(b.spin * t);
                dctx.fillStyle = "#24252b"; dctx.strokeStyle = "rgba(242,239,233,.55)"; dctx.lineWidth = 1;
                dctx.beginPath(); dctx.moveTo(-b.r, -b.r * 0.6); dctx.lineTo(b.r * 0.8, -b.r); dctx.lineTo(b.r, b.r * 0.7); dctx.lineTo(-b.r * 0.6, b.r); dctx.closePath();
                dctx.fill(); dctx.stroke(); dctx.restore();
              }
            });
          }
        }
      };
      scenes.push(update);
      layouts.push(layout);
    }
  }

  /* ---------- the creatures' own movement: frame-by-frame loops made from Higgsfield clips, driven by the scroll ---------- */
  // Each creature's frames sit in one grid picture (anim-*.webp; data-n frames, data-cols across, data-rows down).
  // The scroll picks the frame: they walk, run and flap while you scroll and stand still when you stop, forwards
  // when you scroll down and backwards when you scroll up. data-fps sets the pace, in frames for every 800 pixels
  // scrolled. The long-necked dinosaur is the exception: the village above picks its frame (__frame), so its legs
  // only move while it walks.
  // The pictures only load once the village is near the screen.
  const anims = $$(".anim[data-anim]");
  if (anims.length) {
    const A = anims.map((n) => ({ el: n, n: +n.dataset.n, cols: +n.dataset.cols, rows: +n.dataset.rows, step: 800 / (+n.dataset.fps || 12), last: -1 }));
    const show = (a, f) => {
      if (f === a.last) return;
      a.last = f;
      const c = f % a.cols, r = Math.floor(f / a.cols);
      a.el.style.backgroundPosition = (a.cols > 1 ? c / (a.cols - 1) * 100 : 0).toFixed(3) + "% " + (a.rows > 1 ? r / (a.rows - 1) * 100 : 0).toFixed(3) + "%";
    };
    let started = false, near = false;
    const frames = (y) => {
      if (!near || reduceMotion) return;
      A.forEach((a) => { const f = a.el.__frame != null ? a.el.__frame : Math.floor(y / a.step); show(a, ((f % a.n) + a.n) % a.n); });
    };
    const start = () => {
      if (started) return;
      started = true;
      A.forEach((a) => {
        a.el.style.backgroundImage = 'url("' + a.el.dataset.anim + '")';
        a.el.style.backgroundSize = (a.cols * 100) + "% " + (a.rows * 100) + "%";
        show(a, 0);
      });
    };
    const zone = anims[0].closest("section") || document.body;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((en) => {
        near = en.some((e) => e.isIntersecting);
        if (near) { start(); frames(window.scrollY); }
      }, { rootMargin: "100% 0px" }).observe(zone);
    } else { start(); near = true; }
    scenes.push(frames);
  }

  /* ---------- after the strike: a caveman and a baby triceratops land on two of the cards ---------- */
  const landers = $$("[data-lander]");
  if (landers.length && !reduceMotion) {
    const bounce = (x) => {
      const n = 7.5625, d = 2.75;
      if (x < 1 / d) return n * x * x;
      if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75; }
      if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; }
      x -= 2.625 / d; return n * x * x + 0.984375;
    };
    const spots = landers.map(() => ({ top: 0, h: 0 }));
    measures.push(() => landers.forEach((im, i) => { spots[i].top = docTop(im.parentElement); spots[i].h = im.parentElement.offsetHeight; }));
    scenes.push((y, vh) => {
      landers.forEach((im, i) => {
        const top = spots[i].top - y;
        if (top > vh * 1.6 || top + spots[i].h < -300) return;
        const k = clamp((vh * 0.95 - top) / (vh * 0.5), 0, 1);
        const dy = -(1 - bounce(k)) * vh * 0.95;
        put(im, "transform", "translate3d(0," + dy.toFixed(1) + "px,0) rotate(" + ((1 - k) * (i % 2 ? -55 : 45)).toFixed(1) + "deg)");
      });
    });
  }

  /* ---------- how I work: the line through the four steps fills in as you scroll ---------- */
  const steps = $("[data-steps]");
  if (steps) {
    // the height of the last step, so the line on phones stops at its number
    const lastStep = () => { const items = steps.children; return items.length ? items[items.length - 1].offsetHeight : 0; };
    measures.push(() => steps.style.setProperty("--last", lastStep() + "px"));
    if (reduceMotion) steps.style.setProperty("--steps", "1");
    else {
      // on phones the steps stack and the line runs down through the numbers: its tip follows a point two
      // thirds of the way down the screen. On wider screens it runs across them.
      const stacked = window.matchMedia("(max-width: 699px)");
      let top = 0, h = 0, lineTop = 0, lineLen = 1, last = "";
      measures.push(() => {
        top = docTop(steps); h = steps.offsetHeight;
        const lastH = lastStep(), rem = parseFloat(getComputedStyle(root).fontSize) || 16;
        lineTop = top + 2.9 * rem;
        lineLen = Math.max(1, h - lastH);
      });
      scenes.push((y, vh) => {
        const t = top - y;
        if (t + h < 0 || t > vh) return;
        const v = (stacked.matches ? clamp((y + vh * 0.66 - lineTop) / lineLen, 0, 1) : clamp((vh * 0.85 - t) / (vh * 0.55), 0, 1)).toFixed(3);
        if (v !== last) { last = v; steps.style.setProperty("--steps", v); }
      });
    }
  }

  /* ---------- through the ages: the same man, from cave people to the stars, behind "How I work" to "Now picture yours" ---------- */
  // One continuous ink film (evolution.mp4, made with Higgsfield) follows the scroll frame by frame: it plays
  // forwards as you scroll down and backwards as you scroll up. The label says which age you are in.
  const ERAS = [
    [0, "Long, long ago", "The age of cave people"],
    [0.22, "Today", "Kuala Lumpur"],
    [0.66, "Someday", "Interstellar"]
  ];
  const eras = $("[data-eras]");
  const evo = $("[data-evo]");
  const erasFrom = $("#how"), erasTo = $("#yours") || $("#speed");
  if (eras && evo && erasFrom && erasTo) {
    const when = $("[data-era-when]", eras), name = $("[data-era-name]", eras), tag = $(".eras__tag", eras);
    const fill = $("[data-era-fill]", eras);
    let loaded = false, shown = -1, swapTimer = 0, dur = 0, target = 0, current = 0, seeking = false, raf = 0;
    const load = () => {
      if (loaded) return;
      loaded = true;
      evo.preload = "auto";
      loadFilm(evo, evo.dataset.src);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { load(); io.disconnect(); } }, { rootMargin: "150% 0px" });
      io.observe(erasFrom);
    } else load();

    // the colour: Kuala Lumpur starts to take on colour, which spreads out from the walking man, and the
    // interstellar city turns to Alfred's tangerine. COLOUR gives the points in the film (0 to 1) where the colour
    // starts, where it has spread over the whole picture, where it is at full strength, and where the Kuala Lumpur
    // colours change into the tangerine ones.
    const COLOUR = { from: 0.26, spread: 0.6, full: 0.88, swapFrom: 0.6, swapTo: 0.74 };
    const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const look = (e) => {
      const c = smoothstep(COLOUR.from, COLOUR.full, e), m = smoothstep(COLOUR.swapFrom, COLOUR.swapTo, e);
      return { c, now: c * (1 - m), far: c * m, r: smoothstep(COLOUR.from, COLOUR.spread, e) * 1.1 };
    };

    // The film and its colour are drawn together by one small WebGL program (one picture, redrawn only when the
    // film moves on a frame or the colour changes), which keeps scrolling smooth. The colours follow the same
    // recipe as CSS blend modes: in Kuala Lumpur the light lines take on colour (multiply) and the dark spaces glow
    // softly (screen); in the interstellar city the whole picture is graded from near-black through ember to
    // tangerine and peach, with a tangerine glow over it. Without WebGL, or when the browser will not let WebGL read
    // the film (for example when index.html is opened straight from a folder rather than from a web address), the
    // plain ink film shows instead, turning tangerine for the interstellar city (.eras.is-far in styles.css).
    const glCanvas = $("[data-evo-gl]", eras);
    let gl = null, G = null, frameNew = true, drawn = "";
    if (glCanvas && glCanvas.getContext) {
      try { gl = glCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" }); } catch (_) { gl = null; }
    }
    if (gl) {
      const VS = "attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";
      const FS = [
        "precision mediump float;",
        "varying vec2 uv;uniform sampler2D uVid;uniform float uC,uNow,uFar,uR;",
        // one soft radial blob, like radial-gradient(rx ry at cx cy, colour, transparent 70%)
        "float blob(vec2 c,vec2 r){return 1.-clamp(length((uv-c)/r)/.7,0.,1.);}",
        // paints a blob of colour col and strength a over a glow layer (premultiplied colour p, alpha w)
        "void over(inout vec3 p,inout float w,vec3 col,float a){p=col*a+p*(1.-a);w=a+w*(1.-a);}",
        "vec3 scr(vec3 a,vec3 b){return a+b-a*b;}",
        "vec3 hex(float r,float g,float b){return vec3(r,g,b)/255.;}",
        "void main(){",
        " vec3 col=texture2D(uVid,uv).rgb;",
        // the colour spreads out from the walking man (radial-gradient(farthest-corner at 44% 70%))
        " float d=length(vec2((uv.x-.44)/.56,(uv.y-.70)/.70))/1.41421;",
        " float m=1.-clamp((d-uR)/.22,0.,1.);",
        " float an=uNow*m,af=uFar*m;",
        // Kuala Lumpur, lines: green palms and gardens on the left, warm towers on the right, a sunset glow
        " float x=uv.x;",
        " vec3 lin=x<.32?mix(hex(127.,224.,168.),hex(143.,230.,184.),x/.32):x<.52?mix(hex(143.,230.,184.),hex(255.,210.,174.),(x-.32)/.2):mix(hex(255.,210.,174.),hex(255.,194.,154.),(x-.52)/.48);",
        " vec3 inkNow=mix(lin,hex(255.,160.,112.),blob(vec2(.74,.30),vec2(.45,.75)));",
        " col=mix(col,col*inkNow,an);",
        // the interstellar city, in tangerine: a grade from near-black through ember to tangerine and peach
        " float l=dot(col,vec3(.299,.587,.114));",
        " vec3 g=l<.16?mix(hex(13.,14.,17.),hex(70.,20.,8.),l/.16):l<.42?mix(hex(70.,20.,8.),hex(217.,78.,38.),(l-.16)/.26):l<.7?mix(hex(217.,78.,38.),hex(255.,106.,61.),(l-.42)/.28):mix(hex(255.,106.,61.),hex(255.,214.,186.),(l-.7)/.3);",
        " col=mix(col,g,af);",
        // Kuala Lumpur glow in the dark spaces (screen)
        " vec3 p=vec3(0.);float w=0.;",
        " over(p,w,hex(60.,200.,120.),.16*blob(vec2(.15,.40),vec2(.35,.50)));",
        " over(p,w,hex(255.,140.,60.),.18*blob(vec2(.50,.78),vec2(.70,.30)));",
        " over(p,w,hex(255.,110.,50.),.42*blob(vec2(.72,.38),vec2(.40,.55)));",
        " if(w>.001)col=mix(col,scr(col,p/w),w*an);",
        // tangerine glow over the interstellar city: an overall wash, brighter round the planet and the ground
        " p=vec3(0.);w=0.;",
        " over(p,w,hex(255.,106.,61.),.13);",
        " over(p,w,hex(255.,80.,30.),.3*blob(vec2(.18,.34),vec2(.40,.55)));",
        " over(p,w,hex(255.,120.,60.),.3*blob(vec2(.86,.56),vec2(.36,.46)));",
        " over(p,w,hex(255.,90.,40.),.42*blob(vec2(.50,.92),vec2(.75,.36)));",
        " over(p,w,hex(255.,150.,90.),.48*blob(vec2(.64,.18),vec2(.42,.42)));",
        " col=mix(col,scr(col,p/w),w*af);",
        // fades out towards the top (like mask-image: linear-gradient(to top, #000 42%, transparent 82%)) and
        // grows stronger as the colour comes in, strongest in the tangerine city
        " float a=clamp((uv.y-.18)/.4,0.,1.)*(.46+.16*uC+.24*uFar);",
        " gl_FragColor=vec4(col*a,a);",
        "}"
      ].join("\n");
      const make = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      const vs = make(gl.VERTEX_SHADER, VS), fs = make(gl.FRAGMENT_SHADER, FS);
      let prog = null;
      if (vs && fs) {
        prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null;
      }
      if (prog) {
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        gl.uniform1i(gl.getUniformLocation(prog, "uVid"), 0);
        G = {};
        ["uC", "uNow", "uFar", "uR"].forEach((k) => { G[k] = gl.getUniformLocation(prog, k); });
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        eras.classList.add("is-gl");
        glCanvas.addEventListener("webglcontextlost", (ev) => { ev.preventDefault(); plain(); });
      } else gl = null;
    }
    // the plain film: shown when WebGL cannot draw it
    function plain() { G = null; eras.classList.remove("is-gl"); }
    // draws the current frame of the film with the colour for point e; skipped when nothing has changed
    const paint = (e) => {
      const k = look(e);
      eras.classList.toggle("is-far", k.far > 0.5);
      if (!G) return;
      const key = k.c.toFixed(3) + "|" + k.now.toFixed(3) + "|" + k.far.toFixed(3) + "|" + k.r.toFixed(3);
      if (!frameNew && key === drawn) return;
      if (frameNew) {
        if (evo.readyState < 2) return;
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, evo); } catch (_) { plain(); return; }
        if (gl.getError() !== gl.NO_ERROR) { plain(); return; }
        frameNew = false;
      }
      drawn = key;
      gl.uniform1f(G.uC, k.c);
      gl.uniform1f(G.uNow, k.now);
      gl.uniform1f(G.uFar, k.far);
      gl.uniform1f(G.uR, k.r);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // seek one step at a time, easing towards where the scroll says the film should be
    let seekTimer = 0;
    const seek = () => {
      if (!dur || seeking || evo.readyState < 1) return;
      const t = clamp(current, 0, 1) * Math.max(0, dur - 0.05);
      if (Math.abs(t - evo.currentTime) < 1 / 48) return;
      seeking = true;
      evo.currentTime = t;
      // never wait for ever on a seek that does not report back
      clearTimeout(seekTimer);
      seekTimer = setTimeout(() => { seeking = false; seek(); }, 400);
    };
    const glide = () => {
      raf = 0;
      current += (target - current) * (reduceMotion ? 1 : 0.18);
      if (Math.abs(target - current) < 0.0005) current = target;
      seek();
      paint(current);
      if (current !== target) raf = requestAnimationFrame(glide);
    };
    const fresh = () => { frameNew = true; paint(current); };
    evo.addEventListener("loadedmetadata", () => { dur = evo.duration || 0; seek(); });
    evo.addEventListener("loadeddata", fresh);
    evo.addEventListener("seeked", () => { clearTimeout(seekTimer); seeking = false; fresh(); if (!raf) seek(); });
    evo.addEventListener("canplay", () => { fresh(); seek(); });
    const label = (i) => {
      if (i === shown) return;
      const first = shown < 0;
      shown = i;
      const write = () => { when.textContent = ERAS[i][1]; name.textContent = ERAS[i][2]; tag.classList.remove("is-swapping"); };
      clearTimeout(swapTimer);
      if (first || reduceMotion) write(); else { tag.classList.add("is-swapping"); swapTimer = setTimeout(write, 220); }
    };
    // where the film starts and ends on the page, noted once (and again when the page changes size)
    let a = 0, b = 0, lastFill = "";
    measures.push(() => { a = docTop(erasFrom); b = docTop(erasTo) + erasTo.offsetHeight; });
    scenes.push((y, vh) => {
      const mid = y + vh * 0.5;
      const on = mid > a - vh * 0.15 && mid < b + vh * 0.05;
      eras.classList.toggle("is-on", on);
      if (!on) return;
      load(); // in case the visitor jumped straight here from the menu
      // the film reaches the stars a little before the end, so "Now picture yours" sits fully in the future
      const e = clamp((mid - a) / Math.max(1, b - a - vh * 0.7), 0, 1);
      target = e;
      if (!raf) raf = requestAnimationFrame(glide);
      let i = 0;
      ERAS.forEach((era, k) => { if (e >= era[0]) i = k; });
      label(i);
      const f = "scaleY(" + e.toFixed(3) + ")";
      if (fill && f !== lastFill) { lastFill = f; fill.style.transform = f; }
    });
  }

  /* ---------- start: lay every scene out to fit the screen, note where they sit, and draw the first frame ---------- */
  relayout();

  /* ---------- ember fog: a moving WebGL background in the style of Vanta.js FOG, with no library ---------- */
  // Vanta needs three.js from a CDN, and this site loads nothing from outside, so this is a small shader of
  // its own: slow, folded noise in near-black and ember orange, a little brighter towards the mouse, flushed
  // red for a moment when the T-rex bites. It draws at half resolution, about 30 times a second, and only
  // while a section that uses it is on screen (FOG below). Reduced motion and data saver get one still frame.
  // Without WebGL the hero shows a still CSS glow instead (.no-fog in styles.css).
  const fogCanvas = $("[data-fog]");
  if (fogCanvas) {
    let gl = null;
    try { gl = fogCanvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" }); } catch (_) { gl = null; }
    const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const FS = [
      "precision mediump float;",
      "uniform vec2 uRes;uniform float uTime;uniform float uBite;uniform vec2 uMouse;uniform float uLevel;",
      "float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
      "float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);",
      " return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}",
      "float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}",
      "void main(){",
      " vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
      " float t=uTime*.035;",
      " vec2 q=vec2(fbm(p*1.5+vec2(0.,t)),fbm(p*1.5+vec2(5.2,1.3)-t));",
      " vec2 r=vec2(fbm(p*1.5+2.*q+vec2(1.7,9.2)+t*1.4),fbm(p*1.5+2.*q+vec2(8.3,2.8)-t));",
      " float f=fbm(p*1.5+2.4*r);",
      " vec2 m=(uMouse-.5)*vec2(uRes.x/uRes.y,1.);",
      " float glow=smoothstep(.3,.95,f)*(.55+.45*(1.-smoothstep(0.,1.,length(p-m*.6-vec2(.1,-.25)))));",
      " vec3 base=vec3(.051,.055,.067);",
      " vec3 add=vec3(.42,.09,.03)*glow*.9+vec3(1.,.42,.24)*pow(glow,3.)*.4;",
      " add+=vec3(.55,.03,.02)*uBite*smoothstep(.25,.9,f)*.9;",
      " add*=uLevel*(1.-.6*smoothstep(.45,1.25,length(p)));",
      " gl_FragColor=vec4(base+add+(h(gl_FragCoord.xy+fract(uTime))-.5)/255.,1.);",
      "}"
    ].join("\n");
    let prog = null;
    if (gl) {
      const make = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      const vs = make(gl.VERTEX_SHADER, VS), fs = make(gl.FRAGMENT_SHADER, FS);
      if (vs && fs) {
        prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null;
      }
    }
    if (!prog) {
      root.classList.add("no-fog");
    } else {
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle that covers the screen
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = {};
      ["uRes", "uTime", "uBite", "uMouse", "uLevel"].forEach((k) => { U[k] = gl.getUniformLocation(prog, k); });
      const still = reduceMotion || saveData;
      // how strong the fog is behind each section
      const FOG = [["#top", 1], ["#about", 0], ["#skills", 0], ["#services", 0], ["#how", 0], ["#testimonials", 0], ["#work", 0], ["#speed", 0], ["#yours", 0.12], ["#contact", 0.95], [".footer", 0.7]];
      let level = 1, target = 1, bite = 0, mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5, raf = 0, last = 0, lost = false;
      const start = performance.now();
      const draw = (now) => {
        gl.uniform2f(U.uRes, fogCanvas.width, fogCanvas.height);
        gl.uniform1f(U.uTime, still ? 14 : (now - start) / 1000);
        gl.uniform1f(U.uBite, bite);
        gl.uniform2f(U.uMouse, mx, my);
        gl.uniform1f(U.uLevel, level);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const frame = (now) => {
        raf = 0;
        if (document.hidden || lost) return;
        if (!still && now - last < 32) { kick(); return; } // about 30 frames a second is plenty for fog
        last = now;
        const k = still ? 1 : 0.07;
        level += (target - level) * k;
        bite += (fx.bite - bite) * (still ? 1 : 0.35);
        mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
        const idle = target < 0.01 && level < 0.01;
        fogCanvas.classList.toggle("is-on", !idle);
        if (!idle) draw(now);
        if (!still && !idle) kick();
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
      const size = () => {
        const scale = window.innerWidth < 700 ? 0.42 : 0.5;
        fogCanvas.width = Math.max(2, Math.round(window.innerWidth * scale));
        fogCanvas.height = Math.max(2, Math.round(window.innerHeight * scale));
        gl.viewport(0, 0, fogCanvas.width, fogCanvas.height);
        last = 0;
        kick();
      };
      if ("IntersectionObserver" in window) {
        const zones = new IntersectionObserver((entries) => {
          entries.forEach((en) => { if (en.isIntersecting) { target = parseFloat(en.target.dataset.fogLevel); kick(); } });
        }, { rootMargin: "-48% 0px -48% 0px" });
        FOG.forEach(([sel, v]) => { const sec = $(sel); if (sec) { sec.dataset.fogLevel = v; zones.observe(sec); } });
      }
      if (!still) {
        window.addEventListener("scroll", kick, { passive: true });
        if (finePointer) window.addEventListener("pointermove", (e) => { tmx = e.clientX / window.innerWidth; tmy = 1 - e.clientY / window.innerHeight; kick(); }, { passive: true });
      }
      fogCanvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; fogCanvas.classList.remove("is-on"); root.classList.add("no-fog"); });
      document.addEventListener("visibilitychange", kick);
      // (phones change height while the address bar slides in and out: the fog simply stretches for that)
      let fogW = window.innerWidth, fogH = window.innerHeight;
      window.addEventListener("resize", () => {
        if (!finePointer && window.innerWidth === fogW && Math.abs(window.innerHeight - fogH) < 160) return;
        fogW = window.innerWidth; fogH = window.innerHeight;
        size();
      });
      size();
    }
  }

  /* ---------- background field: an abstract clip, redrawn as tangerine dots ---------- */
  // field-sprite.webp holds 120 small frames of a slow flowing-wave clip (made with Higgsfield).
  // How far you have scrolled picks the frame, each frame is read as a coarse grid of brightness
  // values, and every grid cell becomes a dot sized by that brightness. Dots near the mouse swell
  // and move aside. On touch screens they gather under your finger, and a tap sends a ripple across
  // the screen. Reduced motion and data saver get one still frame.
  // how strong the field is behind each section: full where there is little text, faint behind reading.
  // It is switched off everywhere for now (every level is 0), so the page skips it completely: nothing is
  // downloaded or drawn. Give a section a level above 0 to bring it back.
  const LEVELS = [["#top", 0], ["#about", 0], ["#skills", 0], ["#services", 0], ["#how", 0], ["#testimonials", 0], ["#work", 0], ["#speed", 0], ["#yours", 0], ["#contact", 0], [".footer", 0]];
  const fieldCanvas = $("[data-field]");
  if (fieldCanvas && !LEVELS.some((lv) => lv[1] > 0)) fieldCanvas.hidden = true;
  else if (fieldCanvas && fieldCanvas.getContext) {
    const SPRITE = { src: "field-sprite.webp", frames: 120, cols: 12, w: 160, h: 90 };
    const RIPPLE = { life: 1400, band: 56 };
    const ctx = fieldCanvas.getContext("2d");
    const sample = document.createElement("canvas");
    const sctx = sample.getContext("2d", { willReadFrequently: true });
    const sheet = new Image();
    const still = reduceMotion || saveData;
    const touch = !finePointer;
    let W = 0, H = 0, cell = 14, cols = 0, rows = 0, ready = false, raf = 0, last = 0;
    let frame = 0, frameTarget = 0, idle = 0, mx = -9999, my = -9999, pull = 0, pullTarget = 0;
    let ripples = [];
    let level = 1, levelTarget = 1;
    if ("IntersectionObserver" in window) {
      const zones = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { levelTarget = parseFloat(en.target.dataset.fieldLevel); request(true); } });
      }, { rootMargin: "-48% 0px -48% 0px" });
      LEVELS.forEach(([sel, v]) => { const sec = $(sel); if (sec) { sec.dataset.fieldLevel = v; zones.observe(sec); } });
    }
    const progress = () => {
      const max = root.scrollHeight - window.innerHeight;
      return max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    };
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cell = W < 700 ? 15 : 13;
      cols = Math.ceil(W / cell) + 1; rows = Math.ceil(H / cell) + 1;
      fieldCanvas.width = Math.round(W * dpr); fieldCanvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sample.width = cols; sample.height = rows;
      request(true);
    };
    const paintFrame = (f, alpha) => {
      const i = clamp(Math.floor(f), 0, SPRITE.frames - 1);
      const sx = (i % SPRITE.cols) * SPRITE.w, sy = Math.floor(i / SPRITE.cols) * SPRITE.h;
      const s = Math.max(cols / SPRITE.w, rows / SPRITE.h); // cover the screen like object-fit: cover
      const dw = SPRITE.w * s, dh = SPRITE.h * s;
      sctx.globalAlpha = alpha;
      sctx.drawImage(sheet, sx, sy, SPRITE.w, SPRITE.h, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    };
    const render = (now) => {
      raf = 0;
      if (!ready || document.hidden) return;
      if (!still) {
        // a slow breathing drift keeps the field alive between scrolls
        idle = Math.sin(now / 2600) * 1.6;
        frame += (frameTarget - frame) * 0.1;
        pull += (pullTarget - pull) * (touch ? 0.2 : 0.1);
        level += (levelTarget - level) * 0.06;
      } else {
        level = levelTarget;
      }
      // nothing to show behind this section: rest until a section with dots comes up
      if (levelTarget < 0.005 && level < 0.005) { ctx.clearRect(0, 0, W, H); return; }
      const f = clamp(frame + idle, 0, SPRITE.frames - 1.001);
      sctx.globalAlpha = 1;
      sctx.fillStyle = "#000";
      sctx.fillRect(0, 0, cols, rows);
      const f0 = Math.floor(f), t = f - f0;
      paintFrame(f0, 1);
      if (t > 0.02) paintFrame(f0 + 1, t);
      const px = sctx.getImageData(0, 0, cols, rows).data;
      ctx.clearRect(0, 0, W, H);
      const lv = level * (W < 700 ? 0.65 : 1); // phones put text over more of the screen, so go gentler
      const maxR = cell * 0.46 * (0.55 + 0.45 * lv), reach = touch ? 140 : 180;
      // dots touched by a finger or a ripple go in a second, brighter layer so they show even where the field is faint
      const dots = new Path2D(), lit = new Path2D();
      ripples = ripples.filter((rp) => now - rp.t < RIPPLE.life);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const l = Math.min(1, (px[(y * cols + x) * 4] / 255) * 1.35);
          let r = maxR * Math.pow(l, 1.6), glow = 0;
          let cx = x * cell + cell / 2, cy = y * cell + cell / 2;
          if (pull > 0.01) {
            const dx = cx - mx, dy = cy - my, d = Math.sqrt(dx * dx + dy * dy);
            if (d < reach) {
              const k = (1 - d / reach) * pull;
              r += maxR * 0.55 * k;
              cx += (dx / (d || 1)) * 12 * k;
              cy += (dy / (d || 1)) * 12 * k;
              if (touch) glow = k;
            }
          }
          for (let i = 0; i < ripples.length; i++) {
            const rp = ripples[i], age = Math.max(0, (now - rp.t) / RIPPLE.life);
            const dx = cx - rp.x, dy = cy - rp.y, d = Math.sqrt(dx * dx + dy * dy);
            const ring = Math.abs(d - age * rp.max);
            if (ring < RIPPLE.band) {
              const k = (1 - ring / RIPPLE.band) * (1 - age);
              r += maxR * 0.9 * k;
              cx += (dx / (d || 1)) * 8 * k;
              cy += (dy / (d || 1)) * 8 * k;
              glow = Math.max(glow, k);
            }
          }
          if (r < 0.5) continue;
          const path = touch && glow > 0.3 ? lit : dots;
          path.moveTo(cx + r, cy);
          path.arc(cx, cy, r, 0, 6.2832);
        }
      }
      ctx.fillStyle = "rgba(255, 106, 61, " + (0.7 * lv).toFixed(3) + ")";
      ctx.fill(dots);
      if (touch) {
        ctx.fillStyle = "rgba(255, 106, 61, 0.85)";
        ctx.fill(lit);
      }
      if (!still) request();
    };
    // about 30 frames a second is plenty for a background, and kinder to batteries
    const request = (force) => {
      if (raf || !ready) return;
      raf = requestAnimationFrame((now) => {
        if (!force && now - last < 32) { raf = 0; request(); return; }
        last = now;
        render(now);
      });
    };
    sheet.onload = () => {
      ready = true;
      size();
      frame = frameTarget = progress() * (SPRITE.frames - 1);
      fieldCanvas.classList.add("is-on");
      request(true);
    };
    sheet.src = SPRITE.src;
    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", () => request(true));
    if (!still) {
      window.addEventListener("scroll", () => { frameTarget = progress() * (SPRITE.frames - 1); }, { passive: true });
      if (finePointer) {
        window.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; pullTarget = 1; }, { passive: true });
        root.addEventListener("mouseleave", () => { pullTarget = 0; });
      } else {
        // touch: the dots gather under your finger while it is down (scrolling included),
        // and a quick tap sends a ripple out from where you tapped
        let down = null;
        window.addEventListener("touchstart", (e) => {
          const t = e.touches[0];
          mx = t.clientX; my = t.clientY; pullTarget = 1;
          down = { x: mx, y: my, t: performance.now() };
        }, { passive: true });
        window.addEventListener("touchmove", (e) => {
          const t = e.touches[0];
          mx = t.clientX; my = t.clientY;
        }, { passive: true });
        const lift = () => {
          pullTarget = 0;
          if (down && performance.now() - down.t < 350 && Math.abs(mx - down.x) + Math.abs(my - down.y) < 14) {
            ripples.push({ x: down.x, y: down.y, t: performance.now(), max: Math.sqrt(W * W + H * H) });
            if (ripples.length > 4) ripples.shift();
          }
          down = null;
        };
        window.addEventListener("touchend", lift, { passive: true });
        window.addEventListener("touchcancel", () => { pullTarget = 0; down = null; }, { passive: true });
      }
    }
  }

  /* ---------- speed: real measurements of the example sites, drawn as interactive bars ---------- */
  // Measured by Alfred's own test run on 29 October 2026, Baby Boss on 4 November 2026 (see the note under the chart). Update these numbers and the
  // table in index.html together if you re-measure. lcp = seconds until the main content is visible,
  // kb = everything the homepage downloads.
  const SPEED = {
    sites: [
      { name: "V2 Development", lcp: 2.84, kb: 2565 },
      { name: "Starwill Chemicals", lcp: 2.34, kb: 550 },
      { name: "Hebron Lifts", lcp: 1.19, kb: 755 },
      { name: "Best Sister Florist", lcp: 0.99, kb: 1451 },
      { name: "EPS Sports Academy", lcp: 3.16, kb: 5246 },
      { name: "Yakiniku Ichiban", lcp: 1.30, kb: 1862 },
      { name: "MasterPiece Tailor", lcp: 1.16, kb: 1045 },
      { name: "Safiyya Pet Shop", lcp: 1.29, kb: 1222 },
      { name: "Baby Boss Lash Studio", lcp: 0.94, kb: 3286 },
      { name: "Sunshine Tots", lcp: 1.34, kb: 632 }
    ],
    metrics: {
      lcp: { caption: "median time until the main content is visible", fmt: (v) => v.toFixed(1) + " s", tick: (v) => v + " s" },
      kb: { caption: "median page weight, everything the homepage downloads when it opens", fmt: (v) => (v / 1024).toFixed(1) + " MB", tick: (v) => (v / 1024).toFixed(0) + " MB" }
    }
  };

  const chart = $("[data-chart]");
  if (chart) {
    const plot = $("[data-chart-plot]", chart);
    const big = $("[data-chart-big]", chart);
    const caption = $("[data-chart-caption]", chart);
    const toggleWrap = $("[data-chart-toggle]", chart);
    const NS = "http://www.w3.org/2000/svg";
    const svg = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
      if (text != null) n.textContent = text;
      return n;
    };
    const median = (arr) => {
      const s = arr.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    // round the axis up to a tidy number with whole-unit ticks
    const niceMax = (v, metric) => metric === "kb" ? Math.ceil(v / 1024) * 1024 : Math.ceil(v);
    // bar with a square start on the baseline and a 4px rounded data end
    const barPath = (y, w, h) => {
      const r = Math.min(4, h / 2, w);
      return "M0," + y + "H" + (w - r) + "A" + r + "," + r + " 0 0 1 " + w + "," + (y + r) + "V" + (y + h - r) + "A" + r + "," + r + " 0 0 1 " + (w - r) + "," + (y + h) + "H0Z";
    };
    const tip = el("div", { class: "chart__tip", "aria-hidden": "true" });
    let metric = "lcp", shown = false, rowsEls = [];

    // CAVEMAN: he stands at the right end of one row, starting with Baby Boss Lash Studio (the top row).
    // Click or tap that row (or him) and a wooden club swings down onto his head: his face goes cross-eyed,
    // stars and birds circle, he wobbles, then he hops off to another row picked at random. Decorative only.
    const CAVEMAN = { start: "Baby Boss Lash Studio" };
    const img = (src, cls) => el("img", { src, class: cls, alt: "", width: "164", height: "300", loading: "lazy", decoding: "async" });
    const caveBody = el("div", { class: "cave__body" }, [img("caveman-stand.webp", "cave__man"), img("caveman-bonk.webp", "cave__man cave__man--bonk")]);
    const club = el("img", { src: "caveman-club.webp", class: "cave__club", alt: "", width: "220", height: "240", loading: "lazy", decoding: "async" });
    const cave = el("div", { class: "cave", "aria-hidden": "true" }, [caveBody, club]);
    let caveSite = CAVEMAN.start, caveBusy = false, caveSpots = {}, caveX = 0, caveH = 0; // caveSpots: where each row's bars end at the bottom
    const cavePos = (name) => caveSpots[name] || caveSpots[CAVEMAN.start] || 0;
    const caveAt = (y) => "translate3d(" + caveX.toFixed(1) + "px," + (y - caveH).toFixed(1) + "px,0)";
    const markCaveRow = () => rowsEls.forEach((g) => g.classList.toggle("has-cave", g.dataset.site === caveSite));
    const bonk = () => {
      if (caveBusy) return;
      caveBusy = true;
      hideTip();
      const others = SPEED.sites.map((s) => s.name).filter((n) => n !== caveSite);
      const next = others[Math.floor(Math.random() * others.length)];
      const y0 = cavePos(caveSite), y1 = cavePos(next);
      const land = () => {
        caveSite = next;
        cave.style.transform = caveAt(y1);
        markCaveRow();
      };
      const done = () => { cave.classList.remove("is-bonked"); caveBusy = false; };
      if (reduceMotion || !cave.animate) {
        // no swinging or hopping: the dazed face for a moment, then he is simply at his new row
        cave.classList.add("is-bonked");
        setTimeout(() => { land(); done(); }, 900);
        return;
      }
      // the club swings over from behind him and lands on his head
      club.animate([
        { opacity: 0, transform: "rotate(175deg)" },
        { opacity: 1, transform: "rotate(160deg)", offset: 0.2, easing: "cubic-bezier(.55, 0, 1, .45)" },
        { opacity: 1, transform: "rotate(0deg)", offset: 0.55 },
        { opacity: 1, transform: "rotate(24deg)", offset: 0.72 },
        { opacity: 0, transform: "rotate(30deg)" }
      ], { duration: 720, fill: "both" });
      setTimeout(() => {
        // bonk: the dazed face, squashed by the blow, then a woozy wobble
        cave.classList.add("is-bonked");
        caveBody.animate([
          { transform: "none" },
          { transform: "scale(1.14, .8)", offset: 0.12 },
          { transform: "scale(.94, 1.06)", offset: 0.26 },
          { transform: "rotate(-6deg)", offset: 0.42 },
          { transform: "rotate(5deg)", offset: 0.58 },
          { transform: "rotate(-4deg)", offset: 0.74 },
          { transform: "rotate(2deg)", offset: 0.88 },
          { transform: "none" }
        ], { duration: 1100, easing: "ease-in-out" });
      }, 396);
      // then he hops off to another row, still seeing stars, and comes round once he lands
      setTimeout(() => {
        const peak = Math.min(y0, y1) - 46;
        const hop = cave.animate([
          { transform: caveAt(y0) },
          { transform: caveAt(y0 + 6), offset: 0.12 },
          { transform: caveAt(peak), offset: 0.5, easing: "cubic-bezier(.5, 0, .9, .5)" },
          { transform: caveAt(y1) }
        ], { duration: 520 + Math.abs(y1 - y0) * 0.9, easing: "cubic-bezier(.2, .6, .4, 1)" });
        hop.onfinish = () => { land(); setTimeout(done, 380); };
      }, 1500);
    };
    cave.addEventListener("click", (e) => { e.stopPropagation(); bonk(); });

    const showTip = (row, site) => {
      rowsEls.forEach((g) => g.classList.toggle("is-active", g === row));
      plot.classList.add("is-hovering");
      tip.textContent = "";
      tip.appendChild(el("strong", { text: site.name }));
      tip.appendChild(el("span", {}, [document.createTextNode("Main content visible"), el("b", { text: SPEED.metrics.lcp.fmt(site.lcp) })]));
      tip.appendChild(el("span", {}, [document.createTextNode("Page weight"), el("b", { text: SPEED.metrics.kb.fmt(site.kb) })]));
      const bar = row.querySelector(".bar").getBBox();
      const plotW = plot.clientWidth;
      const left = clamp(bar.x + bar.width + 14, 0, plotW - 200);
      tip.style.left = left + "px";
      tip.style.top = Math.max(0, bar.y - 30) + "px";
      tip.classList.add("is-on");
    };
    const hideTip = () => {
      rowsEls.forEach((g) => g.classList.remove("is-active"));
      plot.classList.remove("is-hovering");
      tip.classList.remove("is-on");
    };

    const draw = (animate) => {
      const width = plot.clientWidth;
      if (!width) return;
      const m = SPEED.metrics[metric];
      const sites = SPEED.sites.slice().sort((a, b) => a[metric] - b[metric]);
      const values = sites.map((s) => s[metric]);
      const max = niceMax(Math.max.apply(null, values), metric);
      const med = median(values);
      const rowH = 46, top = 30, bottom = 28, barH = 10, valueW = 70;
      const innerW = Math.max(120, width - valueW);
      const xs = (v) => (v / max) * innerW;
      const height = top + sites.length * rowH + bottom;
      const s = svg("svg", { viewBox: "0 0 " + width + " " + height, width: width, height: height, role: "img", "aria-label": "Bar chart of " + m.caption + " for the ten websites above" });

      // recessive grid with whole-unit ticks along the bottom
      const grid = svg("g", { class: "chart__grid", "aria-hidden": "true" });
      const step = metric === "kb" ? 1024 : 1;
      for (let v = 0; v <= max + 0.0001; v += step) {
        const x = Math.round(xs(v)) + 0.5;
        grid.appendChild(svg("line", { x1: x, x2: x, y1: top - 6, y2: height - bottom + 4 }));
        grid.appendChild(svg("text", { x: x, y: height - 8, "text-anchor": v === 0 ? "start" : "middle" }, m.tick(v)));
      }
      s.appendChild(grid);

      // dashed median line, the number in the big headline
      const mx = Math.round(xs(med)) + 0.5;
      const medG = svg("g", { class: "chart__median", "aria-hidden": "true" });
      medG.appendChild(svg("line", { x1: mx, x2: mx, y1: top - 10, y2: height - bottom }));
      medG.appendChild(svg("text", { x: mx + 6, y: top - 14 }, "Median " + m.fmt(med)));
      s.appendChild(medG);

      rowsEls = [];
      sites.forEach((site, i) => {
        const y = top + i * rowH;
        const w = Math.max(2, xs(site[metric]));
        const g = svg("g", { class: "chart__row", "data-site": site.name, tabindex: "0", role: "listitem", "aria-label": site.name + ": " + SPEED.metrics.lcp.fmt(site.lcp) + " until the main content is visible, " + SPEED.metrics.kb.fmt(site.kb) + " page weight" });
        g.appendChild(svg("rect", { class: "hit", x: 0, y: y - 4, width: width, height: rowH - 2 }));
        g.appendChild(svg("text", { class: "name", x: 0, y: y + 12 }, site.name));
        const bar = svg("path", { class: "bar", d: barPath(y + 20, w, barH) });
        g.appendChild(bar);
        const val = svg("text", { class: "val", x: w + 8, y: y + 29 }, m.fmt(site[metric]));
        g.appendChild(val);
        if (animate && !reduceMotion) {
          // grow from the baseline, one after another
          bar.style.transformBox = "fill-box";
          bar.style.transformOrigin = "left center";
          bar.style.transform = "scaleX(0)";
          bar.style.transition = "transform 1.1s cubic-bezier(.16, 1, .3, 1) " + (i * 70) + "ms";
          val.style.opacity = "0";
          val.style.transition = "opacity .5s ease " + (400 + i * 70) + "ms";
          requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = "scaleX(1)"; val.style.opacity = "1"; }));
        }
        g.addEventListener("pointerenter", () => showTip(g, site));
        g.addEventListener("focus", () => showTip(g, site));
        g.addEventListener("blur", hideTip);
        g.addEventListener("click", () => { if (site.name === caveSite) bonk(); else showTip(g, site); });
        g.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && site.name === caveSite) { e.preventDefault(); bonk(); } });
        caveSpots[site.name] = y + 31;
        rowsEls.push(g);
        s.appendChild(g);
      });
      s.setAttribute("role", "list");
      s.addEventListener("pointerleave", hideTip);

      plot.textContent = "";
      plot.appendChild(s);
      plot.appendChild(cave);
      plot.appendChild(tip);
      // he stands on the bar line at the right edge of the chart, his feet level with the bottom of the bars
      caveX = width - cave.offsetWidth - 2;
      caveH = cave.offsetHeight;
      if (!caveBusy) cave.style.transform = caveAt(cavePos(caveSite));
      markCaveRow();
      big.textContent = m.fmt(med);
      caption.textContent = m.caption + ", across the ten websites above";
    };

    const setMetric = (next) => {
      metric = next;
      $$("[data-metric]", chart).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.metric === metric)));
      hideTip();
      draw(true);
    };
    $$("[data-metric]", chart).forEach((b) => b.addEventListener("click", () => setMetric(b.dataset.metric)));
    if (toggleWrap) toggleWrap.hidden = false;
    chart.classList.add("is-live");
    draw(false);

    // bars grow in the first time the chart comes into view
    if ("IntersectionObserver" in window && !reduceMotion) {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((en) => en.isIntersecting)) return;
        io.disconnect();
        shown = true;
        draw(true);
      }, { threshold: 0.35 });
      io.observe(chart);
    }
    // redraw whenever the chart's own width changes (window resize, or the first time it gets a size)
    let resizeTimer = 0, lastW = plot.clientWidth;
    const redraw = () => {
      if (plot.clientWidth === lastW && plot.querySelector("svg")) return;
      lastW = plot.clientWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => draw(false), 120);
    };
    if ("ResizeObserver" in window) new ResizeObserver(redraw).observe(plot);
    else window.addEventListener("resize", redraw);
  }

  /* ---------- footer year ---------- */
  $$("[data-year]").forEach((elm) => { elm.textContent = new Date().getFullYear(); });

  /* ---------- WhatsApp: the helper and the phone sketch send their answers straight to Alfred ---------- */
  const WHATSAPP = "60173534960";
  const waLink = (text) => "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(text);

  /* ---------- services helper: four questions, one suggestion ---------- */
  // Edit the wording here. Each answer has a value (used in the logic below) and a label (shown on the button).
  const HELPER = {
    questions: [
      { id: "site", q: "Does your business have a website today?",
        options: [["none", "No, not yet"], ["weak", "Yes, but it needs work"], ["good", "Yes, and it works well"]] },
      { id: "find", q: "How do most new customers find you?",
        options: [["search", "Searching on Google"], ["social", "Facebook, Instagram or TikTok"], ["word", "Word of mouth"]] },
      { id: "post", q: "How often do you post on social media?",
        options: [["often", "Most weeks"], ["sometimes", "Now and then"], ["rarely", "Rarely or never"]] },
      { id: "chat", q: "How do you keep up with customer messages on WhatsApp?",
        options: [["quick", "I reply quickly myself"], ["busy", "I fall behind when it gets busy"], ["none", "I don't use WhatsApp for business yet"]] }
    ],
    why: {
      site: {
        none: "Without a website, people who look you up have nowhere to check your prices, hours and location before they get in touch.",
        weak: "A website that looks dated or is hard to use on a phone can quietly send customers elsewhere. A redesign keeps what works and fixes the rest.",
        good: "Your website already does its job, so there is no need to rebuild it."
      },
      find: {
        search: "Most of your customers search on Google, so a clear website and Google Business Profile help turn those searches into calls.",
        social: "Most of your customers find you on social media, so a website gives them one place to check you are real and get in touch.",
        word: "When someone recommends you, the next thing people do is look you up, so that first impression matters."
      },
      post: {
        more: "Posting regularly, in the language your customers speak, keeps you in front of them between visits. I can plan and run that for you.",
        keep: "You already post regularly, so keep going and link your posts to your website.",
        fine: "You already post regularly too, so you may be in good shape. A short chat can still turn up small improvements."
      },
      chat: {
        busy: "When messages pile up, customers wait and some go elsewhere. An AI WhatsApp chatbot answers the common questions straight away, at any hour, and passes the rest to you."
      }
    },
    // written into the contact form so Alfred sees the answers
    note: {
      site: { none: "I do not have a website yet", weak: "I have a website that needs work", good: "I have a website that works well" },
      find: { search: "most customers find me on Google", social: "most customers find me on social media", word: "most customers find me through word of mouth" },
      post: { often: "I post on social media most weeks", sometimes: "I post on social media now and then", rarely: "I rarely post on social media" },
      chat: { quick: "I reply to WhatsApp messages myself", busy: "I fall behind on WhatsApp messages when it gets busy", none: "I do not use WhatsApp for business yet" }
    }
  };

  const helper = $("[data-helper]");
  const helperPanel = $("[data-helper-panel]");
  if (helper && helperPanel) {
    const Q = HELPER.questions;
    let answers = {};
    let step = 0;
    const listOf = (parts) => parts.length < 2 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];

    const suggest = (a) => {
      const web = a.site === "none" ? "new" : a.site === "weak" ? "redesign" : "";
      const social = a.post !== "often";
      const bot = a.chat === "busy";
      const parts = [];
      if (web === "new") parts.push("a new website");
      if (web === "redesign") parts.push("a redesign of your website");
      if (social) parts.push("social media marketing");
      if (bot) parts.push("an AI WhatsApp chatbot");
      const list = parts.length ? listOf(parts) : "";
      const title = list ? list.charAt(0).toUpperCase() + list.slice(1) : "A short chat first";
      // the option picked in the contact form's "What do you need" list
      const need = web && social ? "Website and social media"
        : web === "new" ? "A new website"
        : web === "redesign" ? "Redesign of my current website"
        : social ? "Social media marketing"
        : bot ? "AI WhatsApp chatbot"
        : "Something else";
      const postWhy = social ? HELPER.why.post.more : (web || bot) ? HELPER.why.post.keep : HELPER.why.post.fine;
      const notes = Q.map((item) => HELPER.note[item.id][a[item.id]]);
      return {
        title, need,
        why: [HELPER.why.site[a.site], HELPER.why.find[a.find], postWhy, bot ? HELPER.why.chat.busy : ""].filter(Boolean).join(" "),
        note: notes.slice(0, -1).join(", ") + ", and " + notes[notes.length - 1] + "."
      };
    };

    const progress = (done) => el("div", { class: "helper__progress", "aria-hidden": "true" },
      Q.map((_, i) => el("span", { class: i < done ? "is-done" : "" })));

    const render = (moveFocus) => {
      helperPanel.textContent = "";
      let target;
      if (step < Q.length) {
        const item = Q[step];
        target = el("p", { class: "helper__q", id: "helper-q", tabindex: "-1", text: item.q });
        helperPanel.appendChild(el("div", { class: "helper__step" }, [
          progress(step + 1),
          el("p", { class: "helper__count", text: "Question " + (step + 1) + " of " + Q.length }),
          target,
          el("div", { class: "helper__options", role: "group", "aria-labelledby": "helper-q" },
            item.options.map(([value, label]) => el("button", {
              type: "button",
              class: "helper__opt" + (answers[item.id] === value ? " is-picked" : ""),
              text: label,
              onclick: () => { answers[item.id] = value; step += 1; render(true); }
            }))),
          step > 0 ? el("button", { type: "button", class: "helper__back", text: "Back", onclick: () => { step -= 1; render(true); } }) : null
        ]));
      } else {
        const r = suggest(answers);
        target = el("p", { class: "helper__pick", tabindex: "-1", text: r.title });
        helperPanel.appendChild(el("div", { class: "helper__step" }, [
          progress(Q.length),
          el("p", { class: "helper__count", text: "My suggestion" }),
          target,
          el("p", { class: "helper__why", text: r.why }),
          el("div", { class: "helper__actions" }, [
            el("a", { class: "btn btn--primary", href: waLink("Hi Alfred, I answered the questions on your website. Your suggestion was: " + r.title + ". About my business: " + r.note), target: "_blank", rel: "noopener", text: "Send this to me on WhatsApp" }),
            el("button", { type: "button", class: "btn btn--ghost", text: "Change answers", onclick: () => { answers = {}; step = 0; render(true); } })
          ])
        ]));
      }
      if (moveFocus && target) target.focus({ preventScroll: true });
    };

    helper.hidden = false;
    render(false);
  }

  /* ---------- social tile: example caption in three languages ---------- */
  const sample = $("[data-sample]");
  if (sample) {
    const langButtons = $$("[data-lang]", sample);
    const captions = $$("[data-caption]", sample);
    const group = $("[data-sample-langs]", sample);
    const pick = (lang) => {
      langButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
      captions.forEach((c) => { c.hidden = c.dataset.caption !== lang; });
    };
    langButtons.forEach((b) => b.addEventListener("click", () => pick(b.dataset.lang)));
    if (group) group.hidden = false;
    pick("en");
    sample.classList.add("is-live"); // captions fade in on later switches only
  }

  /* ---------- picture yours: a live phone sketch from the visitor's business name ---------- */
  // Wording for each business type. {area} is replaced with what the visitor types (or Klang).
  const TYPES = {
    food: { tag: "Restaurant", label: "restaurant or café", title: "Fresh food, cooked every day in {area}.", sub: "Dine in, take away or order on WhatsApp.", list: ["Today's menu", "Opening hours", "Book a table"] },
    shop: { tag: "Shop", label: "shop", title: "Everything you need, right here in {area}.", sub: "See what is in stock and order on WhatsApp.", list: ["New arrivals", "Best sellers", "Delivery and pickup"] },
    trade: { tag: "Workshop", label: "workshop or trade business", title: "Solid work, done properly in {area}.", sub: "Send a photo of the job on WhatsApp for a quote.", list: ["Our services", "Recent jobs", "Get a quote"] },
    care: { tag: "Clinic", label: "clinic or wellness business", title: "Care you can trust in {area}.", sub: "Book your appointment in a few taps.", list: ["Treatments", "Meet the team", "Book a visit"] },
    service: { tag: "Local services", label: "service business", title: "Help you can count on in {area}.", sub: "Tell us what you need and we reply on WhatsApp.", list: ["What we do", "How it works", "Areas we cover"] }
  };

  const builder = $("[data-builder]");
  const mock = $("[data-mock]");
  if (builder && mock) {
    const nameIn = $("[data-builder-name]", builder);
    const areaIn = $("[data-builder-area]", builder);
    const setText = (sel, text) => $$(sel, mock).forEach((n) => { n.textContent = text; });
    const checked = (name, fallback) => { const r = $('input[name="' + name + '"]:checked', builder); return r ? r.value : fallback; };
    const state = () => ({
      typed: nameIn ? nameIn.value.trim() : "",
      name: (nameIn && nameIn.value.trim()) || "Your business",
      area: (areaIn && areaIn.value.trim()) || "Klang",
      type: TYPES[checked("y-type", "food")] ? checked("y-type", "food") : "food",
      colour: checked("y-colour", "#c53030")
    });
    const writeCopy = (s) => {
      const t = TYPES[s.type];
      setText("[data-mock-tag]", t.tag + " in " + s.area);
      setText("[data-mock-title]", t.title.replace("{area}", s.area));
      setText("[data-mock-sub]", t.sub);
      $$("[data-mock-list] li", mock).forEach((li, i) => { li.textContent = t.list[i] || ""; });
    };
    let lastType = "", swapTimer = 0;
    const go = $("[data-builder-go]", builder);
    const page = $("[data-mock-page]", mock), screen = $(".mock__screen", mock);
    // how far the demo page scrolls inside the phone
    const setTravel = () => { if (page && screen) mock.style.setProperty("--travel", Math.max(0, page.scrollHeight - screen.clientHeight + 12) + "px"); };
    window.addEventListener("resize", setTravel);
    const paint = () => {
      const s = state();
      mock.dataset.type = s.type;
      if (go) {
        const t = TYPES[s.type];
        go.href = waLink("Hi Alfred, I tried the website sketch on your site. " + (s.typed
          ? "My business is " + s.typed + ", a " + t.label + " in " + s.area + "."
          : "I run a " + t.label + " in " + s.area + "."));
      }
      builder.style.setProperty("--c", s.colour);
      setText("[data-mock-name]", s.name);
      setText("[data-mock-area]", s.area);
      if (lastType && s.type !== lastType && !reduceMotion) {
        mock.classList.add("is-swapping");
        clearTimeout(swapTimer);
        swapTimer = setTimeout(() => { writeCopy(state()); mock.classList.remove("is-swapping"); }, 200);
      } else if (!mock.classList.contains("is-swapping")) {
        writeCopy(s);
      }
      lastType = s.type;
      setTimeout(setTravel, 260);
    };

    // the phone's clock shows Kuala Lumpur time
    const clock = $("[data-mock-time]", mock);
    const tick = () => {
      try {
        clock.textContent = new Date().toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kuala_Lumpur" }).replace(/\s*[ap]\.?\s?m\.?$/i, "");
      } catch (_) { /* keep the placeholder */ }
    };
    if (clock) { tick(); setInterval(tick, 30000); }

    builder.addEventListener("input", paint);
    builder.addEventListener("change", paint);
    builder.hidden = false;
    paint();
  }
})();
