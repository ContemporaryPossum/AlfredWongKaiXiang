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
      // (nor is the on-screen keyboard of browsers that shrink the page for it)
      // (only fields that bring up the keyboard: a tapped radio or checkbox keeps focus too, and must not block a real resize)
      const typing = document.activeElement && document.activeElement.matches && document.activeElement.matches("textarea, [contenteditable]:not([contenteditable='false']), input:not([type]), input[type='text'], input[type='search'], input[type='email'], input[type='tel'], input[type='url'], input[type='number'], input[type='password']");
      if (!finePointer && w === lastW && (Math.abs(h - lastH) < 160 || typing)) return;
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
    const masks = ["rex-half-3-m.webp", "rex-bite-m.webp"].map((src) => { const im = new Image(); im.src = src; return im; });
    // and are unpacked (decoded) ahead of time, while the page sits still at the top. Otherwise a phone unpacks each
    // drawing the moment it first shows, and the T-rex stalls for a moment just as the visitor starts to scroll.
    const warm = () => Object.keys(frames).map((k) => frames[k]).concat(masks).forEach((im) => { if (im.decode) im.decode().catch(() => {}); });
    if (document.readyState === "complete") warm(); else window.addEventListener("load", warm, { once: true });

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
      // the point after which nothing in the blood moves any more: every drop has landed, every splat has spread
      // and every drip has reached its full length (drawBlood stops redrawing there)
      let settle = ACT.snap;
      drops.forEach((group) => group.forEach((d) => { settle = Math.max(settle, d.te + d.life / 3); }));
      splats.forEach((s) => {
        settle = Math.max(settle, s.te + 0.014);
        s.drips.forEach((d) => { settle = Math.max(settle, s.te + 0.012 + d.max / (unit * d.speed * 3)); });
      });
      L = { W, H, bx, by, rw, rh, ww, wh, unit, lets, keep, drops, shades, splats, bitten: null, settle, park: 0 };
      // how far from its first pose the T-rex waits before it rises (see pose): with the top corner of the tilted
      // drawing 2px below the bottom of the screen, out of sight but close enough for the browser to prepare it
      {
        const r = rexAt(ACT.rise), th = r.rot * Math.PI / 180, ox = r.a[0] * rw, oy = r.a[1] * rh;
        const top = Math.min.apply(null, [[0, 0], [rw, 0], [0, rh], [rw, rh]].map(([cx, cy]) => (cx - ox) * Math.sin(th) + (cy - oy) * Math.cos(th)));
        L.park = H + 2 - (r.y + top);
      }
      bloodAt = -1;
      if (bctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        bloodCanvas.width = Math.round(W * dpr);
        bloodCanvas.height = Math.round(H * dpr);
        bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      rex.classList.remove("is-sizing"); // placed for this size (the next scroll scene poses it)
    };
    // when the hero changes size, the T-rex waiting below it hides until layout has placed it for the new size: its
    // place was worked out for the old size, and in a taller or wider hero it would show (is-sizing in styles.css)
    window.addEventListener("resize", () => {
      if (!L) return;
      const s = stage.getBoundingClientRect();
      if (Math.abs(s.width - L.W) > 0.5 || Math.abs(s.height - L.H) > 0.5) rex.classList.add("is-sizing");
    }, { passive: true });

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
    // (and once it has all landed it is drawn one last time and left alone too)
    let bloodOn = false, bloodAt = -1;
    // a reset of the graphics card hands the canvas back blank, with its scale reset: set the scale again and draw it anew
    if (bctx) bloodCanvas.addEventListener("contextrestored", () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bloodAt = -1;
      requestAnimationFrame(() => runScenes(true));
    });
    const drawBlood = (pScroll) => {
      if (!bctx) return;
      if (pScroll < ACT.snap && !bloodOn) return;
      const p = Math.min(pScroll, L.settle);
      if (bloodOn && pScroll >= ACT.snap && p === bloodAt) return; // nothing has moved since the last drawing
      bctx.clearRect(0, 0, L.W, L.H);
      bloodOn = pScroll >= ACT.snap;
      bloodAt = bloodOn ? p : -1;
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
      // before it rises, the T-rex waits just below the screen: out of sight, but drawn, so the browser has it ready
      // before the first scroll instead of preparing it in the middle of one (which made it stall on phones)
      const parked = !still && p <= ACT.rise;
      rex.classList.toggle("is-on", on);
      rex.classList.toggle("is-parked", parked);
      const r = rexAt(clamp(p, ACT.rise, ACT.gone));
      if (on || parked) {
        showFrame(r.f);
        put(rex, "transformOrigin", (r.a[0] * 100).toFixed(2) + "% " + (r.a[1] * 100).toFixed(2) + "%");
        put(rex, "transform", "translate3d(" + (r.x - r.a[0] * L.rw).toFixed(1) + "px," + (r.y - r.a[1] * L.rh + (parked ? L.park : 0)).toFixed(1) + "px,0) rotate(" + r.rot.toFixed(2) + "deg)");
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
      let heroAway = false;
      scenes.push((y, vh) => {
        if (!L) return;
        if (y > heroTop + heroH || y + vh < heroTop) {
          fx.bite = 0;
          // out of sight, whatever pose a fast fling or a glide left it in: the T-rex (and its endless bob) and the scroll
          // cue rest, as they would otherwise keep the browser busy every frame; coming back poses everything again
          if (!heroAway) { heroAway = true; rex.classList.remove("is-on"); hero.classList.add("is-moving"); }
          return;
        }
        heroAway = false;
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

  /* ---------- SCAN: an 8-bit voxel tree that is secretly a QR code ---------- */
  // Every leaf, branch and hedge stands in a column above a dark square of a real QR code that opens
  // https://wa.me/60173534960, and nothing at all stands above a light square. From the side that is just a leafy tree
  // on some paving. Tap the tree and the camera rises and swings round until it looks straight down, and the tree itself
  // lines up into the QR code, flat and ready to scan: nothing moves but the camera. Tap again and the camera comes back
  // down. It starts from above and comes down once when it first comes into view.
  // A caveman naps against the trunk while another runs laps around the tree, chased by a T-rex. The wind blows: leaves
  // drift sideways as they fall, the crown sways and the leaves shimmer in waves.
  // The voxels are drawn by hand onto a small canvas, one hard-edged pixel at a time, and scaled up without smoothing: that
  // is the 8-bit look, and it keeps the code perfectly sharp for scanning. The characters come from scan-sprites.webp.
  // It only draws while it is on screen. With reduced motion it stays still, starts from above, and tapping just swaps the views.
  // QR_ROWS is the code itself, made for that one address. If the WhatsApp number changes it must be remade (see the README).
  const scanBtn = $("[data-scan-toggle]"), scanCanvas = $("[data-scan-canvas]");
  if (scanBtn && scanCanvas && scanCanvas.getContext) {
    const QR_ROWS = [
      "11111110011111100111001111111",
      "10000010011111000100101000001",
      "10111010111100011101101011101",
      "10111010001101000011001011101",
      "10111010110001010010101011101",
      "10000010100010001011001000001",
      "11111110101010101010101111111",
      "00000000000000001110000000000",
      "01001010100111100011010110100",
      "11100101100110100101100011011",
      "01101110100111001110110101101",
      "01000100001111000110010100011",
      "01111110101110101101100100001",
      "00111101011000001110001010100",
      "11011110111111000010100010000",
      "00001101110011111001110101001",
      "10000110111101101001111100010",
      "11010001000011000011000100101",
      "00110111100110110111000110101",
      "00011001110000111111100111101",
      "11101010010011000110111110011",
      "00000000110111011010100010100",
      "11111110001000110101101010011",
      "10000010001001010111100011010",
      "10111010101000110011111110000",
      "10111010000111101000000101000",
      "10111010011110001101110000111",
      "10000010100000000101011100111",
      "11111110010010110011110010010"
    ];
    const n = QR_ROWS.length, QUIET = 4, N = n + QUIET * 2;                 // the code, plus its blank margin
    const W = scanCanvas.width, H = scanCanvas.height, MID = N / 2;
    const TILE = 8, FY = 34;                                                // from above: size of a square, top of the plate
    const ZOOM0 = 4 * Math.SQRT2, ZK = 4 / (ZOOM0 * Math.cos(Math.PI / 6)); // the slanted view: a 2:1 pixel-art tile, cubes 4 pixels tall
    const CY0 = 170, CY1 = FY + (N * TILE) / 2;                             // where the middle of the ground sits on the canvas
    const FOLD = 1500, GROW = 1500;                                         // how long the camera takes each way, in milliseconds
    const SPR = {"run":{"y":0,"w":33,"h":40,"n":8},"dino":{"y":40,"w":75,"h":46,"n":8},"rest":{"y":86,"w":48,"h":28,"n":6}};                                                // where the characters are in scan-sprites.webp
    const LAP = { radius: 12.5, speed: 0.95, gap: 0.78 };                   // the chase: cells from the trunk, radians a second, the T-rex's lead
    const ctx = scanCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const img = ctx.createImageData(W, H);
    const buf = new Uint32Array(img.data.buffer);
    const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const pack = (c) => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
    const shade = (c, k) => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
    const faces = (hex) => { const c = rgb(hex); return { c, t: pack(c), l: pack(shade(c, 0.84)), r: pack(shade(c, 0.66)) }; };
    const R = seeded(2026);
    const pick = (list) => list[Math.floor(R() * list.length)];
    // the wind: a steady breeze from the left with slower gusts on top (0 to about 1)
    const gustAt = (t) => clamp(0.45 + 0.35 * Math.sin(t * 0.7) + 0.2 * Math.sin(t * 1.9 + 1), 0, 1);

    // the palette: a small set of colours, as an 8-bit console would have
    const CREAM = pack(rgb("#f2efe9")), CREAM_SHADOW = pack(rgb("#d9d0c2"));
    const SIDE_L = pack(rgb("#d4cabb")), SIDE_R = pack(rgb("#b3a897")), SOIL_L = pack(rgb("#5c3a24")), SOIL_R = pack(rgb("#452a19"));
    const STONES = ["#bdb4a7", "#aca395", "#c9c2b5", "#a0978a"].map(faces);                 // the dark squares, seen from the side: plain paving
    const MODULES = ["#a63a12", "#8f2f0e", "#b0401a", "#7a2609", "#9c3610"].map(faces);     // from above, tops deepen to these: dark enough on cream to scan
    const LEAVES = ["#ffc18a", "#ffa05f", "#ff8347", "#ff6a3d", "#e8562a", "#c9441d"].map(faces);
    const BARK = ["#7a4a28", "#6b3f22", "#5c341b"].map(faces);
    const HEDGE = ["#e8a33d", "#d98a2b", "#c9781f"].map(faces);
    const TUFT = ["#e8a33d", "#f0b95a", "#d98a2b"].map(faces);
    const FINDER_FLAT = faces("#5a1f08");
    const TANGERINE = "#ff6a3d";

    const cubes = [];
    const isDark = (x, y) => { const c = x - QUIET, r = y - QUIET; return r >= 0 && c >= 0 && r < n && c < n && QR_ROWS[r][c] === "1"; };
    const inFinder = (x, y) => { const c = x - QUIET, r = y - QUIET; return (c < 7 && r < 7) || (c >= n - 7 && r < 7) || (c < 7 && r >= n - 7); };
    // the trunk stands on the thickest patch of dark squares near the middle, because it may only stand on dark squares too
    let CX = Math.floor(MID), CY = Math.floor(MID), bestPatch = -1;
    for (let y = Math.floor(MID) - 5; y <= MID + 5; y++) for (let x = Math.floor(MID) - 5; x <= MID + 5; x++) {
      let dark = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5 && isDark(x + dx, y + dy)) dark++;
      const score = dark - Math.hypot(x - MID, y - MID) * 0.5;
      if (score > bestPatch) { bestPatch = score; CX = x; CY = y; }
    }
    const NAP = { x: CX - 1, y: CY + 5.5 };                                 // where the sleeper lies, with his head at the trunk
    const shadowed = (x, y) => (x + y) % 2 === 0 && Math.hypot(x - CX - 1, y - CY - 1) < 13;  // a dithered shadow under the tree

    // ----- the camera. k = 0 is the slanted view, k = 1 is looking straight down. It really does turn and tilt: the ground
    // rotates from a diamond to a square while the view rises from 30 degrees to overhead, zooming in a little on the way.
    let ax = 0, bx = 0, ay = 0, by = 0, cz = 0, oy = 0, rise = 1;
    const camera = (k) => {
      const yaw = (1 - k) * Math.PI / 4, pitch = Math.PI / 6 + k * Math.PI / 3, zoom = ZOOM0 + (TILE - ZOOM0) * k;
      const sp = Math.sin(pitch), cp = k === 1 ? 0 : Math.cos(pitch);
      ax = zoom * Math.cos(yaw); bx = -zoom * Math.sin(yaw);
      ay = zoom * Math.sin(yaw) * sp; by = zoom * Math.cos(yaw) * sp;
      cz = -zoom * cp * ZK; oy = CY0 + (CY1 - CY0) * k;
      rise = cp / Math.cos(Math.PI / 6);                                    // how tall things standing on the ground look now
    };
    const sx = (x, y) => W / 2 + ax * (x - MID) + bx * (y - MID);
    const sy = (x, y, z) => oy + ay * (x - MID) + by * (y - MID) + cz * z;

    // how far each row of pixels of the tree is pushed sideways by the wind, more towards the top
    const shifts = new Int8Array(H);
    let rowTop = 0, rowEnd = 0, rowFoot = 0, leaning = false;
    const sway = (t, amount) => {
      const gust = gustAt(t);
      for (let y = 0; y < H; y++) {
        const up = clamp((rowFoot - y) / Math.max(1, rowFoot - rowTop), 0, 1);
        shifts[y] = Math.round(up * up * 4.5 * amount * (gust * 0.8 + 0.35 * Math.sin(t * 1.5 + y * 0.03)));
      }
    };

    // fills a four-sided shape with hard edges (the top-left rule, so neighbours never gap or overlap)
    const quad = (x0, y0, x1, y1, x2, y2, x3, y3, c) => {
      const lo = Math.min(y0, y1, y2, y3), hi = Math.max(y0, y1, y2, y3);
      const yMin = Math.max(0, Math.ceil(lo - 0.5)), yMax = Math.min(H - 1, Math.ceil(hi - 0.5) - 1);
      for (let r = yMin; r <= yMax; r++) {
        const yc = r + 0.5;
        let a = Infinity, b = -Infinity, v;
        if ((y0 <= yc) !== (y1 <= yc)) { v = x0 + (yc - y0) * (x1 - x0) / (y1 - y0); if (v < a) a = v; if (v > b) b = v; }
        if ((y1 <= yc) !== (y2 <= yc)) { v = x1 + (yc - y1) * (x2 - x1) / (y2 - y1); if (v < a) a = v; if (v > b) b = v; }
        if ((y2 <= yc) !== (y3 <= yc)) { v = x2 + (yc - y2) * (x3 - x2) / (y3 - y2); if (v < a) a = v; if (v > b) b = v; }
        if ((y3 <= yc) !== (y0 <= yc)) { v = x3 + (yc - y3) * (x0 - x3) / (y0 - y3); if (v < a) a = v; if (v > b) b = v; }
        const lean = leaning ? shifts[r] : 0;
        const i0 = Math.max(0, Math.ceil(a - 0.5) + lean), i1 = Math.min(W, Math.ceil(b - 0.5) + lean), o = r * W;
        for (let i = i0; i < i1; i++) buf[o + i] = c;
      }
    };
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

    // As the view rises, the tops of the cubes deepen to the colours the code needs to scan. Each cube's pair of colours is
    // worked out once per frame here, so that only a few dozen colours are mixed rather than thousands.
    const pairs = [], pairOf = new Map();
    let pairCol = new Uint32Array(0), pairAt = -1;
    const pairIndex = (a, b) => {
      const key = a.t + ">" + b.t;
      if (!pairOf.has(key)) { pairOf.set(key, pairs.length); pairs.push([a.c, b.c]); }
      return pairOf.get(key);
    };
    const mixPairs = (m) => {
      if (m === pairAt) return;
      pairAt = m;
      for (let i = 0; i < pairs.length; i++) {
        const a = pairs[i][0], b = pairs[i][1];
        pairCol[i] = pack([Math.round(a[0] + (b[0] - a[0]) * m), Math.round(a[1] + (b[1] - a[1]) * m), Math.round(a[2] + (b[2] - a[2]) * m)]);
      }
    };

    // draws the voxels from the camera at k. which: 1 the ground, 2 the tree, 3 both. With ids, each face is drawn in its
    // own number instead of its colour, which is what lets the leaves shimmer without drawing the tree again.
    const draw = (k, which, ids, lean) => {
      buf.fill(0);
      camera(k);
      leaning = false;
      mixPairs(clamp((k - 0.3) / 0.7, 0, 1));
      if (which & 1) {
        if (rise > 0.005) {
          quad(sx(0, N), sy(0, N, 0), sx(N, N), sy(N, N, 0), sx(N, N), sy(N, N, -1), sx(0, N), sy(0, N, -1), SIDE_L);
          quad(sx(N, 0), sy(N, 0, 0), sx(N, N), sy(N, N, 0), sx(N, N), sy(N, N, -1), sx(N, 0), sy(N, 0, -1), SIDE_R);
          quad(sx(0, N), sy(0, N, -1), sx(N, N), sy(N, N, -1), sx(N, N), sy(N, N, -3), sx(0, N), sy(0, N, -3), SOIL_L);
          quad(sx(N, 0), sy(N, 0, -1), sx(N, N), sy(N, N, -1), sx(N, N), sy(N, N, -3), sx(N, 0), sy(N, 0, -3), SOIL_R);
        }
        quad(sx(0, 0), sy(0, 0, 0), sx(N, 0), sy(N, 0, 0), sx(N, N), sy(N, N, 0), sx(0, N), sy(0, N, 0), CREAM);
        if (k < 0.3) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          if (!shadowed(x, y) || isDark(x, y)) continue;
          quad(sx(x, y), sy(x, y, 0), sx(x + 1, y), sy(x + 1, y, 0), sx(x + 1, y + 1), sy(x + 1, y + 1, 0), sx(x, y + 1), sy(x, y + 1, 0), CREAM_SHADOW);
        }
      }
      for (let i = 0; i < cubes.length; i++) {
        const q = cubes[i], tree = q.kind === 3;
        if (tree ? !(which & 2) : !(which & 1)) continue;
        leaning = tree && !!lean;
        const x0 = q.x, x1 = q.x + 1, y0 = q.y, y1 = q.y + 1, z0 = q.z;
        let z1 = z0 + q.h;
        if (q.kind === 2) {                                                 // grass on the light squares sinks away, leaving them clean
          if (k > 0.5) continue;
          z1 = z0 + q.h * (1 - k / 0.5);
        }
        const tx0 = sx(x0, y0), ty0 = sy(x0, y0, z1), tx1 = sx(x1, y0), ty1 = sy(x1, y0, z1), tx2 = sx(x1, y1), ty2 = sy(x1, y1, z1), tx3 = sx(x0, y1), ty3 = sy(x0, y1, z1);
        if (rise > 0.005) {
          if (q.left) quad(tx3, ty3, tx2, ty2, tx2, sy(x1, y1, z0), tx3, sy(x0, y1, z0), ids ? i * 3 + 2 : q.f.l);
          if (q.right) quad(tx1, ty1, tx2, ty2, tx2, sy(x1, y1, z0), tx1, sy(x1, y0, z0), ids ? i * 3 + 3 : q.f.r);
        }
        if (q.top) quad(tx0, ty0, tx1, ty1, tx2, ty2, tx3, ty3, ids ? i * 3 + 1 : (q.pi >= 0 ? pairCol[q.pi] : q.f.t));
      }
      leaning = false;
    };

    // ----- the tree in the wind, the old arcade way: every pixel of the tree remembers which face it belongs to (faceAt), so
    // the leaves shimmer by changing the colour of each face rather than drawing the tree again, and the crown sways by
    // sliding each row of pixels a little sideways, more towards the top.
    const treeLayer = document.createElement("canvas"), groundLayer = document.createElement("canvas");
    groundLayer.width = treeLayer.width = W; groundLayer.height = treeLayer.height = H;
    const treeCtx = treeLayer.getContext("2d");
    const treeImg = treeCtx.createImageData(W, H), treeOut = new Uint32Array(treeImg.data.buffer);
    let faceAt = null, faceCol = null, leafCubes = [];
    const paintTree = (t) => {
      const gust = reduceMotion ? 0 : gustAt(t);
      if (reduceMotion) shifts.fill(0);
      else {
        sway(t, 1);
        for (let j = 0; j < leafCubes.length; j++) {
          const i = leafCubes[j], q = cubes[i];
          // a wave of light running through the crown with the wind, and each leaf flickering on its own
          const wave = Math.sin((q.x - q.y) * 0.45 + (q.x + q.y) * 0.2 + q.z * 0.35 - t * 3.4) * (0.35 + gust * 0.6);
          const flick = Math.sin(t * (5 + q.ph * 6) + q.ph * 40) * 0.7;
          const p = clamp(Math.round(q.p + wave + flick), 0, LEAVES.length - 1), L = LEAVES[p];
          faceCol[i * 3 + 1] = L.t; faceCol[i * 3 + 2] = L.l; faceCol[i * 3 + 3] = L.r;
        }
      }
      treeOut.fill(0);
      for (let y = rowTop; y <= rowEnd; y++) {
        const shift = shifts[y], o = y * W;
        for (let x = 0; x < W; x++) {
          const id = faceAt[o + x];
          if (!id) continue;
          const nx = x + shift;
          if (nx >= 0 && nx < W) treeOut[o + nx] = faceCol[id];
        }
      }
      treeCtx.putImageData(treeImg, 0, 0);
    };

    // ----- the characters and the falling leaves, drawn over the voxels
    const sheet = new Image();
    const sprite = (name, frame, footX, footY, flip, squash) => {
      const s = SPR[name], dh = Math.max(1, Math.round(s.h * squash));
      const x = Math.round(footX - s.w / 2), y = Math.round(footY - dh);
      if (flip) {
        ctx.save(); ctx.translate(x + s.w, y); ctx.scale(-1, 1);
        ctx.drawImage(sheet, frame * s.w, s.y, s.w, s.h, 0, 0, s.w, dh);
        ctx.restore();
      } else ctx.drawImage(sheet, frame * s.w, s.y, s.w, s.h, x, y, s.w, dh);
    };
    // the two who are running: their place on the lap, whether they are in front of the tree, and which way they face
    const runner = (name, angle, now, fps) => {
      const x = CX + 0.5 + Math.cos(angle) * LAP.radius, y = CY + 0.5 + Math.sin(angle) * LAP.radius;
      return { name, x, y, front: Math.sin(angle) + Math.cos(angle) > 0, flip: ax * -Math.sin(angle) + bx * Math.cos(angle) < 0, frame: Math.floor(now / 1000 * fps) % SPR[name].n, sy: sy(x, y, 0) };
    };
    const placeRunners = (now) => {
      const a = reduceMotion ? 0.1 : now / 1000 * LAP.speed;                // standing still, they stay clear of the sleeper
      return [runner("run", a, now, 13), runner("dino", a - LAP.gap, now, 11)].sort((p, q) => p.sy - q.sy);
    };
    const drawRunners = (list, wantFront, squash) => {
      list.forEach((p) => {
        if (p.front !== wantFront) return;
        const fx = sx(p.x, p.y), fy = sy(p.x, p.y, 0), w = SPR[p.name].w * 0.5;
        ctx.fillStyle = "rgba(70, 48, 30, 0.38)";                           // a small shadow on the ground
        ctx.fillRect(Math.round(fx - w / 2), Math.round(fy - 1), Math.round(w), 2);
        sprite(p.name, p.frame, fx, fy, p.flip, squash);
      });
    };
    const drawSleeper = (now, squash) => {
      const s = SPR.rest;
      sprite("rest", Math.floor(now / 330) % s.n, sx(NAP.x, NAP.y), sy(NAP.x, NAP.y, 0), true, squash);
    };
    // a 5 by 7 pixel font, just the letters the labels need
    const FONT = { A: "01110100011000111111100011000110001", C: "01110100011000010000100001000101110", E: "11111100001000011110100001000011111", H: "10001100011000111111100011000110001", M: "10001110111010110101100011000110001", N: "10001110011010110011100011000110001", P: "11110100011000111110100001000010000", R: "11110100011000111110101001001010001", S: "01111100001000001110000010000111110", T: "11111001000010000100001000010000100", Z: "11111000010001000100010001000011111" };
    const text = (str, x, y, size, color) => {
      ctx.fillStyle = color;
      for (const ch of str) {
        const g = FONT[ch];
        if (g) for (let i = 0; i < 35; i++) if (g[i] === "1") ctx.fillRect(x + (i % 5) * size, y + Math.floor(i / 5) * size, size, size);
        x += 6 * size;
      }
    };
    const label = (str, y) => text(str, Math.round((W - (str.length * 12 - 2)) / 2), y, 2, TANGERINE);

    // leaves torn off by the wind: they tumble sideways as they fall, and those that reach the ground skitter along it for a moment
    const fall = [], streaks = [];
    // a leaf as it turns over in the air, row by row: where the row starts, how wide it is, whether it ends in the darker edge
    const LEAF = [[1, 3, 0, 0, 5, 1, 1, 3, 1], [2, 2, 0, 1, 3, 1, 0, 2, 1], [0, 5, 1], [0, 2, 0, 1, 3, 1, 2, 2, 1]];
    const onPlate = (x, y) => Math.abs(x - W / 2) / 145 + Math.abs(y - CY0) / 72 < 1;
    const spawnLeaf = (l) => { l.x = W / 2 - 110 + R() * 190; l.y = 70 + R() * 65; l.end = 150 + R() * 95; l.v = 15 + R() * 14; l.d = 0.75 + R() * 0.6; l.land = 0; };
    const spawnStreak = (s) => { s.x = -30 - R() * 120; s.y = 20 + R() * 250; s.len = 8 + Math.floor(R() * 16); s.v = 150 + R() * 130; };
    const windStep = (t, step) => {
      const gust = gustAt(t), wind = 16 + gust * 48;
      fall.forEach((l) => {
        if (l.land > 0) {
          l.x += wind * 0.3 * l.d * step;
          l.land -= step;
          if (l.land <= 0 || !onPlate(l.x, l.y)) spawnLeaf(l);
          return;
        }
        l.x += wind * l.d * step;
        l.y += l.v * step;
        if (l.y > l.end && onPlate(l.x, l.y)) l.land = 0.8 + R() * 1.4;
        else if (l.x > W + 6 || l.y > 272) spawnLeaf(l);                    // blown off the edge: gone before it reaches the label
      });
      streaks.forEach((s) => { s.x += s.v * (0.4 + gust) * step; if (s.x > W + 10) spawnStreak(s); });
    };
    const drawWind = (now) => {
      const t = now / 1000, gust = gustAt(t);
      fall.forEach((l) => {
        // a leaf tumbling: wide, then narrow, then tall
        const shape = LEAF[l.land > 0 ? 0 : Math.floor(t * 6 + l.p) % LEAF.length];
        const x = Math.round(l.x + (l.land > 0 ? 0 : Math.sin(t * 2.4 + l.p) * 3)), y = Math.round(l.y);
        ctx.fillStyle = l.c;
        for (let i = 0; i < shape.length; i += 3) ctx.fillRect(x + shape[i], y + i / 3, shape[i + 1], 1);
        ctx.fillStyle = l.e;                                                // a darker edge, so it shows up against the crown too
        for (let i = 0; i < shape.length; i += 3) if (shape[i + 2]) ctx.fillRect(x + shape[i] + shape[i + 1] - 1, y + i / 3, 1, 1);
      });
      // thin streaks of wind in the gusts
      if (gust > 0.45) {
        ctx.fillStyle = "rgba(242, 239, 233, " + ((gust - 0.45) * 0.55).toFixed(3) + ")";
        streaks.forEach((s) => {
          const x = Math.round(s.x), y = Math.round(s.y);
          ctx.fillRect(x, y, s.len, 1);
          ctx.fillRect(x + s.len + 3, y, 3, 1);
        });
      }
    };

    // ----- the finished views. The slanted one is built from two layers, so that characters can pass behind the tree
    const paintScene = (now) => {
      camera(0);
      const ready = sheet.complete && sheet.naturalWidth > 0;
      const list = ready ? placeRunners(now) : [];
      paintTree(now / 1000);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(groundLayer, 0, 0);
      if (ready) drawRunners(list, false, 1);
      ctx.drawImage(treeLayer, 0, 0);
      if (ready) {
        drawSleeper(now, 1);
        drawRunners(list, true, 1);
        // he is fast asleep
        const zx = sx(NAP.x, NAP.y) + 18, zy = sy(NAP.x, NAP.y, 0) - 34;
        for (let i = 0; i < 3; i++) {
          const z = reduceMotion ? i / 3 : ((now / 2400 + i / 3) % 1);
          text("Z", Math.round(zx + z * 9 + Math.sin(z * 6) * 2), Math.round(zy - z * 22), 1, "#f2efe9");
        }
      }
      if (!reduceMotion) drawWind(now);
      if (reduceMotion || Math.floor(now / 650) % 3 !== 2) label("TAP THE TREE", 288);
    };
    const paintFlat = () => { draw(1, 3); ctx.putImageData(img, 0, 0); label("SCAN ME", 11); };
    // a frame of the camera move: everything standing on the ground flattens and fades as the view rises
    const paintMove = (now, step) => {
      const k = ease(f);
      sway(now / 1000, Math.pow(1 - clamp(k / 0.6, 0, 1), 2));              // the wind's lean dies away as the view rises, so the code lands straight
      draw(k, 3, false, true);
      ctx.putImageData(img, 0, 0);
      const fade = 1 - clamp(k / 0.45, 0, 1);
      if (fade <= 0) return;
      ctx.globalAlpha = fade;
      if (sheet.complete && sheet.naturalWidth) {
        const list = placeRunners(now);
        drawRunners(list, false, rise);
        drawSleeper(now, rise);
        drawRunners(list, true, rise);
      }
      windStep(now / 1000, step);
      drawWind(now);
      ctx.globalAlpha = 1;
    };

    // built once, when the browser is idle after the page has loaded or when the section comes near, whichever is first,
    // so that it never slows down the first load
    let built = false;
    const build = () => {
      if (built) return;
      built = true;
      const crownR = 13;
      const crownX = (CX + MID) / 2, crownY = (CY + MID) / 2;
      // the ground: the corner squares of the code are hedges, the dark squares under the tree are paving, those beyond it grass
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!isDark(x, y)) continue;
        const m = pick(MODULES);
        if (inFinder(x, y)) { const f3 = pick(HEDGE); cubes.push({ kind: 1, x, y, z: 0, h: 1 + R() * 0.9, f: f3, pi: pairIndex(f3, FINDER_FLAT), top: true, left: true, right: true }); }
        else if (Math.hypot(x - crownX, y - crownY) > crownR - 1.5) { const f3 = pick(HEDGE); cubes.push({ kind: 0, x, y, z: 0, h: 0.5 + R() * 0.9, f: f3, pi: pairIndex(f3, m), top: true, left: true, right: true }); }
        else { const f3 = pick(STONES); cubes.push({ kind: 0, x, y, z: 0, h: 0.3, f: f3, pi: pairIndex(f3, m), top: true, left: true, right: true }); }
      }
      // tufts of dry grass on the light squares of the margin; they sink away as the view rises
      for (let i = 0; i < 90; i++) {
        const x = Math.floor(R() * N), y = Math.floor(R() * N);
        const nearEdge = x < QUIET || y < QUIET || x >= N - QUIET || y >= N - QUIET;
        if (isDark(x, y) || !(nearEdge || R() < 0.08)) continue;
        cubes.push({ kind: 2, x, y, z: 0, h: 0.5 + R() * 0.8, f: pick(TUFT), pi: -1, top: true, left: true, right: true });
      }
      // the tree. put3 is the whole trick: nothing can be placed above a light square of the code
      const grid = new Map();
      const key = (x, y, z) => x + "," + y + "," + z;
      const put3 = (x, y, z, f3, p) => { if (z >= 0 && isDark(x, y)) grid.set(key(x, y, z), { x, y, z, f: f3, p }); };
      const TRUNK = 19;
      for (let z = 0; z < TRUNK; z++) {
        const r2 = z < 2 ? 8 : z < 9 ? 5 : 2.5;                             // thick at the root, thinner going up
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= r2) put3(CX + dx, CY + dy, z, pick(BARK), -1);
      }
      // branches climb outwards, stepping only from dark square to dark square
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + R() * 0.3;
        let x = CX, y = CY, z = 9 + R() * 9;
        for (let s = 0; s < 14; s++) {
          const nx = x + Math.round(Math.cos(a) + (R() - 0.5) * 0.9), ny = y + Math.round(Math.sin(a) + (R() - 0.5) * 0.9);
          z += 0.5 + R() * 0.4;
          if (!isDark(nx, ny)) continue;
          x = nx; y = ny;
          put3(x, y, Math.round(z), pick(BARK), -1);
        }
      }
      // the crown: a heart and a ring of lumps around it
      const blobs = [[crownX, crownY, 25, 9], [crownX - 1, crownY - 1, 30, 7]];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + R() * 0.4, d = 6.5 + R() * 4.5;
        const lump = [crownX + Math.cos(a) * d, crownY + Math.sin(a) * d, 18 + R() * 10, 4 + R() * 2.6];
        // lumps at the back of the tree sit higher on the screen: keep them inside the canvas
        const topY = CY0 + (lump[0] - MID + lump[1] - MID) * 2 - (lump[2] + lump[3]) * 4;
        if (topY < 12) lump[2] -= (12 - topY) / 4;
        blobs.push(lump);
      }
      blobs.forEach(([bx3, by3, bz, br]) => {
        const m = Math.ceil(br + 1);
        for (let z = Math.floor(bz - m); z <= bz + m; z++) for (let y = Math.floor(by3 - m); y <= by3 + m; y++) for (let x = Math.floor(bx3 - m); x <= bx3 + m; x++) {
          const d = Math.hypot(x - bx3, y - by3, (z - bz) * 1.08);
          if (d > br * (0.84 + R() * 0.26) || R() < 0.1) continue;          // rough edges and plenty of holes, so it looks leafy
          const idx = clamp(Math.round((1 - (z - 15) / 24) * 4 + R() * 2 - 0.6), 0, LEAVES.length - 1);
          put3(x, y, z, LEAVES[idx], idx);
        }
      });
      // only the three sides that face the camera can show, so cubes hidden on all three are left out
      grid.forEach((v) => {
        const top = !grid.has(key(v.x, v.y, v.z + 1)), left = !grid.has(key(v.x, v.y + 1, v.z)), right = !grid.has(key(v.x + 1, v.y, v.z));
        if (!top && !left && !right) return;
        // from above, whatever is on top of a column turns the colour of that square of the code
        cubes.push({ kind: 3, x: v.x, y: v.y, z: v.z, h: 1, f: v.f, p: v.p, ph: R(), top, left, right, pi: pairIndex(v.f, inFinder(v.x, v.y) ? FINDER_FLAT : pick(MODULES)) });
      });
      cubes.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
      pairCol = new Uint32Array(pairs.length);
      pairAt = -1;
      // the ground layer, and a map of which face each pixel of the tree belongs to
      draw(0, 1); groundLayer.getContext("2d").putImageData(img, 0, 0);
      draw(0, 2, true); faceAt = buf.slice();
      faceCol = new Uint32Array(cubes.length * 3 + 4);
      cubes.forEach((q, i) => { faceCol[i * 3 + 1] = q.f.t; faceCol[i * 3 + 2] = q.f.l; faceCol[i * 3 + 3] = q.f.r; if (q.kind === 3 && q.p >= 0) leafCubes.push(i); });
      rowTop = H; rowEnd = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (faceAt[y * W + x]) { if (y < rowTop) rowTop = y; if (y > rowEnd) rowEnd = y; break; }
      camera(0);
      rowFoot = Math.round(sy(CX, CY, 0));
      for (let i = 0; i < 24; i++) { const l = { x: 0, y: 0, v: 0, end: 0, d: 1, land: 0, p: R() * 6, c: "#" + ["ffe0bd", "ffc18a", "ffa05f", "ffd3a3"][i % 4], e: "#" + ["c9441d", "a63a12"][i % 2] }; spawnLeaf(l); l.y += R() * 90; l.x += R() * 60; fall.push(l); }
      for (let i = 0; i < 6; i++) { const s = { x: 0, y: 0, len: 0, v: 0 }; spawnStreak(s); s.x = R() * W; streaks.push(s); }
      sheet.onload = () => { if (f === 0) paintScene(performance.now()); };
      sheet.src = "scan-sprites.webp";
      if (f === 1) paintFlat(); else if (f === 0) paintScene(performance.now());
    };

    // ----- state: which way the camera is heading, and a loop that only runs while something is moving on screen
    const status = $("[data-scan-status]"), note = $("[data-scan-note]");
    const NOTE = { flat: note ? note.textContent : "", tree: "Tap the tree for the QR code, then point your phone camera at it to open WhatsApp." };
    let f = 1, goal = 1, raf = 0, timer = 0, last = 0, onScreen = false, lastTick = 0;
    const loop = (now) => {
      raf = 0;
      if (!onScreen && f === goal) return;
      const dt = Math.min(64, now - (last || now));
      last = now;
      if (f !== goal) {
        const dur = goal ? FOLD : GROW;
        f = goal ? Math.min(1, f + dt / dur) : Math.max(0, f - dt / dur);
        if (f === goal) { if (goal) paintFlat(); else paintScene(now); } else paintMove(now, dt / 1000);
      } else if (goal === 0 && !reduceMotion && now - lastTick > 66) {      // the scene moves at about 15 frames a second
        const step = Math.min(0.2, (now - lastTick) / 1000);
        lastTick = now;
        windStep(now / 1000, step);
        paintScene(now);
      }
      if (f !== goal) raf = requestAnimationFrame(loop);                     // the camera moves every frame
      else if (goal === 0 && !reduceMotion && onScreen) {
        // at rest the scene changes about 15 times a second: wait for the next change with a timer that ends a little
        // early, so the page is not woken up for each of the frames in between
        const wait = 50 - (performance.now() - lastTick);
        if (wait > 1) timer = setTimeout(() => { timer = 0; if (!raf) raf = requestAnimationFrame(loop); }, wait);
        else raf = requestAnimationFrame(loop);
      }
    };
    const kick = () => { if (timer) { clearTimeout(timer); timer = 0; } if (!raf) { last = 0; raf = requestAnimationFrame(loop); } };
    const setGoal = (g, say) => {
      goal = g;
      scanBtn.setAttribute("aria-pressed", String(g === 1));
      if (note) note.textContent = g ? NOTE.flat : NOTE.tree;
      if (say && status) status.textContent = g ? "QR code showing. Scan it with your phone camera to open WhatsApp." : "Tree and cavemen showing.";
      if (reduceMotion) { f = g; if (g) paintFlat(); else paintScene(performance.now()); return; }
      kick();
    };
    let grown = false;
    scanBtn.addEventListener("click", () => { build(); grown = true; setGoal(goal ? 0 : 1, true); });

    // ----- size: as big as fits, in steps that keep the squares of the code a whole number of screen pixels
    const fit = () => {
      const box = scanBtn.parentElement, cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const dpr = window.devicePixelRatio || 1;
      const s = Math.min(avail / W, (window.innerHeight * 0.86) / H, 2);
      const scale = Math.max(1 / dpr, Math.floor(s * dpr * TILE) / TILE / dpr);
      scanCanvas.style.width = W * scale + "px";
      scanCanvas.style.height = H * scale + "px";
    };
    scanBtn.hidden = false;
    fit();
    let fitW = window.innerWidth;
    window.addEventListener("resize", () => { if (window.innerWidth !== fitW) { fitW = window.innerWidth; fit(); } });
    const whenIdle = window.requestIdleCallback ? (fn) => window.requestIdleCallback(fn, { timeout: 3000 }) : (fn) => setTimeout(fn, 1500);
    if (document.readyState === "complete") whenIdle(build);
    else window.addEventListener("load", () => whenIdle(build), { once: true });
    if ("IntersectionObserver" in window) {
      const nearby = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { build(); nearby.disconnect(); } }, { rootMargin: "150% 0px" });
      nearby.observe(scanCanvas);
      new IntersectionObserver((en) => en.forEach((e) => {
        onScreen = e.isIntersecting;
        if (onScreen) build();
        if (onScreen && goal === 0 && !reduceMotion) kick();
      })).observe(scanCanvas);
      // the first time most of it is in view, the camera comes down from above into the scene
      if (!reduceMotion) {
        const first = new IntersectionObserver((en) => {
          if (!en.some((e) => e.isIntersecting) || grown) return;
          first.disconnect();
          setTimeout(() => { if (!grown) { build(); grown = true; setGoal(0, false); } }, 600);
        }, { threshold: 0.45 });
        first.observe(scanCanvas);
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
      // the ground picture (the one styles.css uses), for painting the chunks
      const groundPic = new Image();
      let chunkPaint = [];
      const paintChunks = () => {
        if (!groundPic.naturalWidth || !chunkPaint.length) return;
        chunkPaint.forEach((fn) => fn());
        chunkPaint = [];
        ground.classList.add("is-split");
      };
      groundPic.onload = paintChunks;
      groundPic.src = "ground.webp";

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
        // the meteorite falls during the last stretch of the walk and hits the ground the moment the street stops
        // sliding. Only on a screen so wide that the street hardly moves is there a short pause for it to finish falling.
        const fallFrom = Math.max(0, walk - strike), landAt = fallFrom + strike;
        street.style.height = Math.round(H + landAt + crumble) + "px";
        const shift = start - travel;       // where the world sits once the walk is over
        const wOff = wr.left - sr.left;     // the world's own offset inside the stage
        const toStage = (r) => ({ x: r.left - wr.left + wOff + shift + r.width / 2, y: r.top - sr.top + r.height / 2 });

        // the ground, cut into rough chunks that can fall one by one
        ground.textContent = "";
        chunkPaint = [];
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
          // each chunk is a small canvas holding its own piece of the ground picture, cut to shape once here (1px of
          // overlap hides the seams). A CSS clip-path would give every chunk a mask layer that the GPU redraws every frame.
          const w = Math.ceil(maxx - minx + 2), h = Math.ceil(maxy - miny + 2), dpr = window.devicePixelRatio || 1;
          const poly = pts.map((p) => [p[0] - minx + (p[0] > (minx + maxx) / 2 ? 1 : 0), p[1] - miny + (p[1] > (miny + maxy) / 2 ? 1 : 0)]);
          const c = el("canvas", { class: "chunk", width: String(Math.ceil(w * dpr)), height: String(Math.ceil(h * dpr)) });
          c.style.cssText = "left:" + minx.toFixed(1) + "px;top:" + miny.toFixed(1) + "px;width:" + w + "px;height:" + h + "px;background:none";
          const paint = () => {
            const g = c.getContext("2d"), k = c.width / w;
            g.setTransform(k, 0, 0, k, 0, 0);
            g.beginPath();
            poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
            g.closePath();
            g.clip();
            // like background: repeat-x, background-size: auto gh, background-position: -minx -miny
            const tw = groundPic.naturalWidth * gh / groundPic.naturalHeight;
            for (let x = -(minx % tw); x < w; x += tw) g.drawImage(groundPic, x, -miny, tw, gh);
          };
          chunkPaint.push(paint);
          // a reset of the graphics card hands the canvas back blank: paint its piece of ground again
          c.addEventListener("contextrestored", () => { if (groundPic.naturalWidth) paint(); });
          ground.appendChild(c);
          chunks.push({ el: c, x: gx0 + (minx + maxx) / 2 + wOff + shift, y: gy0 + (miny + maxy) / 2 });
        };
        for (let j = 0; j < cols; j++) {
          addChunk([[xs[j][0], 0], [xs[j + 1][0], 0], [xs[j + 1][1], mids[j + 1]], [xs[j][1], mids[j]]]);
          addChunk([[xs[j][1], mids[j]], [xs[j + 1][1], mids[j + 1]], [xs[j + 1][2], gh], [xs[j][2], gh]]);
        }
        // the ground picture stays whole underneath until the chunks have been painted
        paintChunks();

        // where the meteorite lands, and how every piece flies off when it does
        const ix = W * 0.56, iy = gy0 + gh * 0.12;
        if (flash) { flash.style.setProperty("--ix", (ix / W * 100).toFixed(1) + "%"); flash.style.setProperty("--iy", (iy / H * 100).toFixed(1) + "%"); }
        const fallers = [];
        const addFaller = (node, x, y, heavy, sprite, text) => {
          const dist = Math.min(1, Math.abs(x - ix) / W + Math.abs(y - iy) / (H * 2));
          fallers.push({
            el: node, sprite, text,
            delay: dist * 0.24 + R() * 0.04,
            vx: Math.sign(x - ix || 1) * W * (0.1 + R() * 0.32) * (1.25 - dist),
            vy: -H * (0.35 + R() * 0.85) * (1.1 - dist) * (heavy ? 0.6 : 1),
            spin: (R() - 0.5) * (heavy ? 140 : 480)
          });
        };
        chunks.forEach((c) => addFaller(c.el, c.x, c.y, false));
        huts.forEach((h) => { const p = toStage(h.getBoundingClientRect()); addFaller(h, p.x, p.y, true, null, true); });
        lifeSprites.forEach((k) => { const p = toStage(S[k].getBoundingClientRect()); addFaller(S[k], p.x, p.y, k === "brachio", k); });
        words.forEach((w) => { const r = w.getBoundingClientRect(); addFaller(w, r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2, false, null, true); });
        // rocks and embers thrown up by the strike
        const bits = [];
        const nb = W < 700 ? 70 : 140;
        for (let i = 0; i < nb; i++) {
          const a = -Math.PI * (0.08 + R() * 0.84), sp = H * (0.5 + R() * 1.7);
          bits.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.2 + R() * R() * 8, ember: R() < 0.45, spin: R() * 8, t0: R() * 0.05 });
        }
        // the debris canvas (a whole screen of pixels) only takes up memory while the street is on screen: update() sizes it
        const ddpr = Math.min(window.devicePixelRatio || 1, 2);
        if (dctx) { debris.width = debris.height = 1; debrisDrawn = false; }
        L = { dw: Math.round(W * ddpr), dh: Math.round(H * ddpr), ddpr, W, H, shop, start, travel, walk, strike, crumble, fallFrom, landAt, ix, iy, fallers, bits, brachio, mw: meteor ? meteor.offsetWidth : 0, mh: meteor ? meteor.offsetHeight : 0 };
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
        if (top + streetH < 0 || top > vh) { if (dctx && debris.width > 1) { debris.width = debris.height = 1; debrisDrawn = false; } return; }
        if (dctx && debris.width !== L.dw) { debris.width = L.dw; debris.height = L.dh; dctx.setTransform(L.ddpr, 0, 0, L.ddpr, 0, 0); }
        const { W, H } = L;
        const s = clamp(-top, 0, L.landAt + L.crumble);
        const pw = L.walk ? clamp(s / L.walk, 0, 1) : 1;
        const m = clamp((s - L.fallFrom) / L.strike, 0, 1);           // the meteorite on its way, landing as the walk ends
        const q = clamp((s - L.landAt) / L.crumble, 0, 1);            // after it lands
        // (tested on the scroll, not on q: rounding can leave q a hair under 1 at the very end)
        const over = s >= L.landAt + L.crumble - 0.5;
        const sLife = Math.min(s, L.landAt), flee = easeIn(m);
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
          // once the crumble is over every piece is far below the screen: it is not drawn at all until the scroll comes back
          // (the words and the homes hold the heading and the services list: they turn transparent instead, which keeps
          // them for screen readers and find-in-page, where visibility: hidden would take them out)
          if (f.text) put(f.el, "opacity", over ? "0" : ""); else put(f.el, "visibility", over ? "hidden" : "");
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
  // (browsers with scroll-driven animations do this in styles.css, on the compositor: search for lander-drop)
  const landers = $$("[data-lander]");
  const cssLanders = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: view()"));
  if (landers.length && !reduceMotion && !cssLanders) {
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
    // the film's first frame as a still picture (evolution-poster.webp). It is small, so it is fetched early, once the
    // page has loaded and gone quiet: on a slow connection it is then there before the visitor reaches the film.
    let pic = null;
    const still = () => {
      if (pic || !evo.dataset.poster) return pic;
      pic = new Image();
      try { pic.fetchPriority = "high"; } catch (_) {}
      pic.src = evo.dataset.poster;
      return pic;
    };
    if (!saveData) {
      const early = () => (window.requestIdleCallback ? requestIdleCallback(still, { timeout: 4000 }) : setTimeout(still, 2000));
      if (document.readyState === "complete") early(); else window.addEventListener("load", early, { once: true });
    }
    const load = () => {
      if (loaded) return;
      loaded = true;
      evo.preload = "auto";
      const film = () => loadFilm(evo, evo.dataset.src).then(prime);
      // the still picture shows until the film itself has loaded; the film is fetched once the picture is there (or
      // after 2.5 s at most), so on a slow connection the small picture never queues behind the large film
      const p = still();
      if (!p) { film(); return; }
      let started = false;
      const go = () => { if (started) return; started = true; clearTimeout(wait); film(); };
      const wait = setTimeout(go, 2500);
      const show = () => { evo.poster = evo.dataset.poster; go(); };
      if (p.complete) { if (p.naturalWidth) show(); else go(); }
      else { p.addEventListener("load", show, { once: true }); p.addEventListener("error", go, { once: true }); }
    };
    // iPhones (and phones saving battery) load nothing of a film that has never played, and then cannot show the
    // frame the scroll asks for. So the film is started and stopped straight away, muted, which makes them load it.
    // If the browser does not allow even that, it is tried again on the visitor's next tap or key press.
    let primed = false;
    const retry = () => { ["pointerup", "keydown"].forEach((t) => window.removeEventListener(t, retry, true)); prime(); };
    function prime() {
      if (primed) return;
      let pr = null;
      try { pr = evo.play(); } catch (_) { pr = null; }
      if (pr && pr.then) {
        pr.then(() => { primed = true; evo.pause(); seeking = false; seek(); },
          () => { ["pointerup", "keydown"].forEach((t) => window.addEventListener(t, retry, { capture: true, passive: true })); });
      } else { primed = true; evo.pause(); }
    }
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
        // (the canvas only takes over from the plain film once it has really drawn a frame: see check below)
        glCanvas.addEventListener("webglcontextlost", (ev) => { ev.preventDefault(); plain(); });
      } else gl = null;
    }
    // the plain film: shown when WebGL cannot draw it
    function plain() { G = null; eras.classList.remove("is-gl"); }
    // Some phones take the film's frames into WebGL without any error and still hand it nothing, which left an empty
    // space where the film should be. So the plain film shows until WebGL has really drawn a frame: after each of the
    // first copies, one row of what WebGL drew is read back and compared with the same row of the film itself. If the
    // film shows something there and WebGL three times draws nothing, the plain film stays for good.
    let glOk = false, glBad = 0, probe = null;
    const check = () => {
      try {
        if (!probe) { probe = document.createElement("canvas"); probe.width = 64; probe.height = 28; }
        const pc = probe.getContext("2d", { willReadFrequently: true });
        pc.drawImage(evo, 0, 0, 64, 28);
        const v = pc.getImageData(0, 20, 64, 1).data;
        let vMax = 0;
        for (let i = 0; i < v.length; i += 4) vMax = Math.max(vMax, v[i], v[i + 1], v[i + 2]);
        const g = new Uint8Array(glCanvas.width * 4);
        gl.readPixels(0, Math.round(glCanvas.height * (1 - 20.5 / 28)), glCanvas.width, 1, gl.RGBA, gl.UNSIGNED_BYTE, g);
        let gMax = 0;
        for (let i = 0; i < g.length; i += 4) gMax = Math.max(gMax, g[i], g[i + 1], g[i + 2]);
        if (gMax > 6) { glOk = true; eras.classList.add("is-gl"); }
        else if (vMax > 40 && ++glBad >= 3) plain();
      } catch (_) { /* cannot tell yet: tried again after the next copy */ }
    };
    // draws the current frame of the film with the colour for point e; skipped when nothing has changed.
    // Each new film frame is copied to the GPU once, into the same texture (texSubImage2D). The texture is given the
    // film's size first, on its own: a first copy straight from the film does not always size it (its first frame may
    // not be decoded yet), and later copies only fit a texture of the right size. Only that first copy is checked
    // with getError, which makes the page stop and wait for the GPU.
    let texW = 0, texH = 0, upAt = -1;
    const paint = (e) => {
      const k = look(e);
      eras.classList.toggle("is-far", k.far > 0.5);
      if (!G) return;
      const key = k.c.toFixed(3) + "|" + k.now.toFixed(3) + "|" + k.far.toFixed(3) + "|" + k.r.toFixed(3);
      if (!frameNew && key === drawn) return;
      const copied = frameNew;
      if (frameNew) {
        if (evo.readyState < 2 || !evo.videoWidth) return;
        try {
          if (texW !== evo.videoWidth || texH !== evo.videoHeight) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, evo.videoWidth, evo.videoHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, evo);
            if (gl.getError() !== gl.NO_ERROR) { plain(); return; }
            texW = evo.videoWidth; texH = evo.videoHeight;
            // and the first frame is copied again a moment later, in case it was not ready the first time
            setTimeout(fresh, 300);
            setTimeout(fresh, 1200);
          } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, evo);
        } catch (_) { plain(); return; }
        frameNew = false;
        upAt = evo.currentTime;
      }
      drawn = key;
      // until WebGL has shown that it really draws the film, each new copy is first drawn bare, without the colour
      // (the colour alone lights up the checked row even when no film arrived), and that bare drawing is checked;
      // the coloured drawing below then replaces it before anything shows
      if (copied && !glOk) {
        gl.uniform1f(G.uC, 0); gl.uniform1f(G.uNow, 0); gl.uniform1f(G.uFar, 0); gl.uniform1f(G.uR, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        check();
        if (!G) return;
      }
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
    let glideLast = 0;
    const glide = (now) => {
      raf = 0;
      // the same ease at 60 and 120 frames a second (0.18 a frame at 60)
      const dt = glideLast ? Math.min(64, now - glideLast) : 16.7;
      glideLast = now;
      current += (target - current) * (reduceMotion ? 1 : 1 - Math.pow(0.82, dt / 16.7));
      if (Math.abs(target - current) < 0.0005) current = target;
      seek();
      paint(current);
      if (current !== target) raf = requestAnimationFrame(glide); else glideLast = 0;
    };
    // a new frame of the film is ready: copy it now, before the next seek starts. 'seeked' and 'canplay' both arrive
    // after every seek; 'seeked' copies the frame, and 'canplay' only when that frame has not been copied yet (Safari
    // can report a seek done before the frame is there to copy).
    const fresh = () => { frameNew = true; paint(current); };
    evo.addEventListener("loadedmetadata", () => { dur = evo.duration || 0; seek(); });
    evo.addEventListener("loadeddata", fresh);
    evo.addEventListener("seeked", () => { clearTimeout(seekTimer); seeking = false; fresh(); if (!raf) seek(); });
    evo.addEventListener("canplay", () => { if (evo.currentTime !== upAt) fresh(); });
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
  // Where the browser allows it, the fog is drawn by a worker of its own (an OffscreenCanvas): the page itself then
  // does nothing for it, so a page sitting still at the top or the bottom is not woken up 30 to 60 times a second.
  // Elsewhere it is drawn here, exactly as before.
  const fogCanvas = $("[data-fog]");
  if (fogCanvas) {
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
    const still = reduceMotion || saveData;
    // how strong the fog is behind each section
    const FOG = [["#top", 1], ["#about", 0], ["#skills", 0], ["#services", 0], ["#how", 0], ["#testimonials", 0], ["#work", 0], ["#speed", 0], ["#yours", 0.12], ["#contact", 0.95], ["#scan", 0.85], [".footer", 0.7]];

    // Everything that draws the fog. It uses nothing else from this file, so the very same code runs here or in the worker.
    // tell() reports back: { on } when the fog shows or rests, { lost } when the graphics card drops it, { fail } when it
    // cannot start. It returns { size(w, h), set({ target, bite, mx, my, hidden }) }, or null without WebGL.
    const fogDrawer = function (canvas, VS, FS, still, tell) {
      let gl = null;
      try { gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" }); } catch (_) { gl = null; }
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
      if (!prog) { tell({ fail: true }); return null; }
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle that covers the screen
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = {};
      ["uRes", "uTime", "uBite", "uMouse", "uLevel"].forEach((k) => { U[k] = gl.getUniformLocation(prog, k); });
      const nextFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn) => setTimeout(() => fn(performance.now()), 16);
      let level = 1, target = 1, bite = 0, biteTarget = 0, mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5;
      let raf = 0, timer = 0, last = 0, lost = false, hidden = false, on = null;
      const start = performance.now();
      const draw = (now) => {
        gl.uniform2f(U.uRes, canvas.width, canvas.height);
        gl.uniform1f(U.uTime, still ? 14 : (now - start) / 1000);
        gl.uniform1f(U.uBite, bite);
        gl.uniform2f(U.uMouse, mx, my);
        gl.uniform1f(U.uLevel, level);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const frame = (now) => {
        raf = 0;
        if (hidden || lost) return;
        if (!still && now - last < 32) { raf = nextFrame(frame); return; } // about 30 frames a second is plenty for fog
        last = now;
        const k = still ? 1 : 0.07;
        level += (target - level) * k;
        bite += (biteTarget - bite) * (still ? 1 : 0.35);
        mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
        const idle = target < 0.01 && level < 0.01;
        if (on !== !idle) { on = !idle; tell({ on }); }
        if (!idle) draw(now);
        if (!still && !idle) kick();
      };
      // between two frames it waits with a timer instead of asking for every frame, so nothing is woken up 60 (or 120)
      // times a second only to find that it is not time yet; the timer ends a little before the frame it is waiting for
      const kick = () => {
        if (raf || timer) return;
        const wait = 16 - (performance.now() - last);
        if (wait > 1) timer = setTimeout(() => { timer = 0; if (!raf) raf = nextFrame(frame); }, wait);
        else raf = nextFrame(frame);
      };
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; tell({ lost: true }); });
      return {
        size(w, h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); last = 0; kick(); },
        set(m) {
          if (m.target != null) target = m.target;
          if (m.bite != null) biteTarget = m.bite;
          if (m.mx != null) { tmx = m.mx; tmy = m.my; }
          if (m.hidden != null) hidden = m.hidden;
          kick();
        }
      };
    };
    // the worker: it checks that it can draw WebGL into an OffscreenCanvas first, then takes over the real canvas
    const fogWorker = function (fogDrawer) {
      let fog = null;
      self.onmessage = (e) => {
        const m = e.data;
        if (m.probe) {
          let ok = false;
          try { ok = !!fogDrawer(new OffscreenCanvas(2, 2), m.VS, m.FS, true, () => {}); } catch (_) { ok = false; }
          self.postMessage({ probe: ok });
        } else if (m.canvas) {
          fog = fogDrawer(m.canvas, m.VS, m.FS, m.still, (r) => self.postMessage(r));
          if (fog) { fog.set(m.state); fog.size(m.w, m.h); }
        } else if (fog) {
          if (m.w) fog.size(m.w, m.h); else fog.set(m);
        }
      };
    };

    const fogSize = () => {
      const scale = window.innerWidth < 700 ? 0.42 : 0.5;
      return [Math.max(2, Math.round(window.innerWidth * scale)), Math.max(2, Math.round(window.innerHeight * scale))];
    };
    const told = (m) => {
      if (m.on != null) fogCanvas.classList.toggle("is-on", m.on);
      if (m.lost || m.fail) { fogCanvas.classList.remove("is-on"); root.classList.add("no-fog"); }
    };
    // the hero sets fx.bite as it scrolls: pass it on only when it changes
    let fog = null, biteNow = fx.bite;
    Object.defineProperty(fx, "bite", { get: () => biteNow, set: (v) => { if (v !== biteNow) { biteNow = v; if (fog) fog.set({ bite: v }); } } });
    const begin = (drawer) => {
      fog = drawer;
      if ("IntersectionObserver" in window) {
        const zones = new IntersectionObserver((entries) => {
          entries.forEach((en) => { if (en.isIntersecting) fog.set({ target: parseFloat(en.target.dataset.fogLevel) }); });
        }, { rootMargin: "-48% 0px -48% 0px" });
        FOG.forEach(([sel, v]) => { const sec = $(sel); if (sec) { sec.dataset.fogLevel = v; zones.observe(sec); } });
      }
      if (!still && finePointer) window.addEventListener("pointermove", (e) => { fog.set({ mx: e.clientX / window.innerWidth, my: 1 - e.clientY / window.innerHeight }); }, { passive: true });
      document.addEventListener("visibilitychange", () => fog.set({ hidden: document.hidden }));
      // (phones change height while the address bar slides in and out: the fog simply stretches for that)
      let fogW = window.innerWidth, fogH = window.innerHeight;
      window.addEventListener("resize", () => {
        if (!finePointer && window.innerWidth === fogW && Math.abs(window.innerHeight - fogH) < 160) return;
        fogW = window.innerWidth; fogH = window.innerHeight;
        fog.size(...fogSize());
      });
      if (biteNow) fog.set({ bite: biteNow });
      fog.size(...fogSize());
    };
    const onPage = () => { const d = fogDrawer(fogCanvas, VS, FS, still, told); if (d) { d.set({ hidden: document.hidden }); begin(d); } };
    if (fogCanvas.transferControlToOffscreen && window.Worker && window.OffscreenCanvas && window.Blob && window.URL && URL.createObjectURL && location.protocol !== "file:") {
      let worker = null, wait = 0, settled = false, url = "";
      const here = () => {
        if (settled) return;
        settled = true; clearTimeout(wait);
        try { worker.terminate(); } catch (_) {}
        onPage();
      };
      try {
        url = URL.createObjectURL(new Blob(["(" + fogWorker + ")(" + fogDrawer + ");"], { type: "text/javascript" }));
        worker = new Worker(url);
        worker.onerror = here;
        worker.onmessage = (e) => {
          if (settled || e.data.probe == null) return;
          URL.revokeObjectURL(url);
          if (!e.data.probe) { here(); return; }
          settled = true; clearTimeout(wait);
          const off = fogCanvas.transferControlToOffscreen();
          const [w, h] = fogSize();
          worker.postMessage({ canvas: off, VS, FS, still, w, h, state: { hidden: document.hidden, bite: biteNow } }, [off]);
          worker.onmessage = (ev) => told(ev.data);
          worker.onerror = () => told({ fail: true });
          begin({ set: (m) => worker.postMessage(m), size: (w2, h2) => worker.postMessage({ w: w2, h: h2 }) });
        };
        worker.postMessage({ probe: true, VS, FS });
        wait = setTimeout(here, 2500); // no answer: draw it here
      } catch (_) { here(); }
    } else onPage();
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
  const LEVELS = [["#top", 0], ["#about", 0], ["#skills", 0], ["#services", 0], ["#how", 0], ["#testimonials", 0], ["#work", 0], ["#speed", 0], ["#yours", 0], ["#contact", 0], ["#scan", 0], [".footer", 0]];
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
    const CAVEMAN = { start: "Baby Boss Lash Studio", says: "My websites are fast, but I'm faster. Try and hit me." };
    const img = (src, cls) => el("img", { src, class: cls, alt: "", width: "164", height: "300", loading: "lazy", decoding: "async" });
    const caveBody = el("div", { class: "cave__body" }, [img("caveman-stand.webp", "cave__man"), img("caveman-bonk.webp", "cave__man cave__man--bonk")]);
    const club = el("img", { src: "caveman-club.webp", class: "cave__club", alt: "", width: "220", height: "240", loading: "lazy", decoding: "async" });
    // his speech bubble (CAVEMAN.says). It pops up once the bars have grown, goes while he is being bonked and comes
    // back when he has landed on his new row, and steps aside whenever a bar's numbers are showing (styles.css)
    const say = el("p", { class: "cave__say", text: CAVEMAN.says });
    const cave = el("div", { class: "cave", "aria-hidden": "true" }, [caveBody, club, say]);
    let caveSite = CAVEMAN.start, caveBusy = false, caveSpots = {}, caveX = 0, caveH = 0, sayTop = -1e4; // caveSpots: where each row's bars end at the bottom
    const cavePos = (name) => caveSpots[name] || caveSpots[CAVEMAN.start] || 0;
    const caveAt = (y) => "translate3d(" + caveX.toFixed(1) + "px," + (y - caveH).toFixed(1) + "px,0)";
    const markCaveRow = () => rowsEls.forEach((g) => g.classList.toggle("has-cave", g.dataset.site === caveSite));
    const talk = (on) => cave.classList.toggle("is-talking", on);
    // the bubble sits above his head; on the top rows there is no room above him (the buttons are there), so it sits
    // beside his head instead
    const placeSay = (y) => cave.classList.toggle("says-beside", y - caveH - say.offsetHeight < sayTop);
    const bonk = () => {
      if (caveBusy) return;
      caveBusy = true;
      talk(false);
      hideTip();
      const others = SPEED.sites.map((s) => s.name).filter((n) => n !== caveSite);
      const next = others[Math.floor(Math.random() * others.length)];
      const y0 = cavePos(caveSite), y1 = cavePos(next);
      const land = () => {
        caveSite = next;
        cave.style.transform = caveAt(y1);
        placeSay(y1);
        markCaveRow();
      };
      const done = () => { cave.classList.remove("is-bonked"); caveBusy = false; talk(true); };
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
      // the lowest the bubble may reach up to: just under the buttons above the chart
      sayTop = toggleWrap && !toggleWrap.hidden ? toggleWrap.getBoundingClientRect().bottom - plot.getBoundingClientRect().top + 6 : -1e4;
      if (!caveBusy) { cave.style.transform = caveAt(cavePos(caveSite)); placeSay(cavePos(caveSite)); }
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

    // bars grow in the first time the chart comes into view, and then he has his say
    if ("IntersectionObserver" in window && !reduceMotion) {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((en) => en.isIntersecting)) return;
        io.disconnect();
        shown = true;
        draw(true);
        setTimeout(() => { if (!caveBusy) talk(true); }, 1100);
      }, { threshold: 0.35 });
      io.observe(chart);
    } else talk(true);
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

  /* ---------- decorative CSS loops rest while they are off screen ---------- */
  // An infinite CSS animation keeps the browser restyling (and, for some, laying out and repainting) every frame,
  // wherever on the page you are. These pause while their part of the page is out of view (.is-paused in styles.css).
  if ("IntersectionObserver" in window) {
    const rest = new IntersectionObserver((entries) => entries.forEach((en) => en.target.classList.toggle("is-paused", !en.isIntersecting)), { rootMargin: "100px 0px" });
    // (for the contact T-rex, the window it rises through: it hangs well above the button box below it)
    $$(".hero__cue, [data-mock], .cta__peek").forEach((n) => rest.observe(n));
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
    let travelW = window.innerWidth;
    window.addEventListener("resize", () => { if (window.innerWidth !== travelW) { travelW = window.innerWidth; setTravel(); } });
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
