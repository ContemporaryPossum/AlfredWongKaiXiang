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

  /* ---------- smooth scrolling, the Lenis way ---------- */
  // Works like the Lenis library: the mouse wheel sets a target and the page eases towards it (lerp 0.1),
  // and in-page links glide there with an exponential ease. Native scrolling stays in place underneath,
  // so touch, keyboard, the scrollbar and reduced-motion visitors simply get the browser's own scrolling.
  const smooth = { to: (y) => window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" }) };
  if (finePointer && !reduceMotion) {
    root.classList.add("lenis");
    let target = window.scrollY, current = target, lastSet = target, raf = 0, glide = null;
    const limit = () => root.scrollHeight - window.innerHeight;
    const step = (now) => {
      // someone else moved the page (keys, scrollbar, find in page): hand control back
      if (Math.abs(window.scrollY - lastSet) > 3) { target = current = lastSet = window.scrollY; glide = null; raf = 0; return; }
      if (glide) {
        const t = Math.min(1, (now - glide.start) / glide.dur);
        current = glide.from + (glide.to - glide.from) * Math.min(1, 1.001 - Math.pow(2, -10 * t));
        if (t >= 1) { current = target = glide.to; glide = null; }
      } else {
        current += (target - current) * 0.1;
        if (Math.abs(target - current) < 0.5) current = target;
      }
      window.scrollTo(0, current);
      lastSet = window.scrollY;
      raf = glide || current !== target ? requestAnimationFrame(step) : 0;
    };
    const run = () => { if (!raf) raf = requestAnimationFrame(step); };
    window.addEventListener("wheel", (e) => {
      if (e.ctrlKey || body.classList.contains("intro-active") || root.style.overflow === "hidden") return;
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
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
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

  /* ---------- intro: the site speaks to the visitor before the hero appears ---------- */
  const intro = $("[data-intro]");
  let introDone = false;
  const finishIntro = () => {
    if (introDone) return;
    introDone = true;
    try { sessionStorage.setItem("introSeen", "1"); } catch (_) { /* private mode */ }
    body.classList.remove("intro-active");
    body.classList.add("intro-done");
    if (intro) {
      intro.classList.add("is-leaving");
      setTimeout(() => intro.classList.add("is-hidden"), 1200);
    }
    document.dispatchEvent(new CustomEvent("intro:done"));
  };

  let introSeen = false;
  try { introSeen = sessionStorage.getItem("introSeen") === "1"; } catch (_) { /* ignore */ }
  const forceIntro = /[?&]intro\b/.test(location.search);

  if (!intro || reduceMotion || (introSeen && !forceIntro)) {
    if (intro) intro.classList.add("is-hidden");
    introDone = true;
    body.classList.add("intro-done");
    setTimeout(() => document.dispatchEvent(new CustomEvent("intro:done")), 50);
  } else {
    body.classList.add("intro-active");
    const lineEl = $("[data-intro-line]", intro);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const width = window.innerWidth;
    const device = coarse ? (width < 820 ? "a phone" : "a tablet") : "a computer";
    // Time is always shown as Kuala Lumpur time, wherever the visitor is.
    let time = "";
    try {
      time = new Date().toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" }).toLowerCase();
    } catch (_) {
      try { time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase(); } catch (__) { /* ignore */ }
    }
    const when = time ? ", at " + time + " Kuala Lumpur time" : "";
    const lines = [
      "Hello. Yes, you.",
      "You are on " + device + ", " + width + " pixels wide" + when + ".",
      "Your customers find businesses the same way, in seconds.",
      "So here is what I do with those seconds."
    ];
    let li = 0, ci = 0, timer = 0;
    const type = () => {
      const line = lines[li];
      if (ci <= line.length) {
        lineEl.textContent = line.slice(0, ci);
        ci += 1;
        timer = setTimeout(type, 13 + Math.random() * 14);
        return;
      }
      if (li === lines.length - 1) { timer = setTimeout(finishIntro, 800); return; }
      timer = setTimeout(() => {
        li += 1; ci = 0; lineEl.textContent = "";
        timer = setTimeout(type, 180);
      }, 620);
    };
    timer = setTimeout(type, 350);

    const skip = () => { clearTimeout(timer); finishIntro(); };
    intro.addEventListener("click", skip);
    document.addEventListener("keydown", (e) => {
      if (!introDone && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) skip();
    });
    setTimeout(skip, 11000); // never hold a visitor hostage
  }

  /* ---------- speech bubble: small asides that react to the visitor ---------- */
  const bubble = $("[data-bubble]");
  if (bubble) {
    const said = new Set();
    let hideTimer = 0;
    const heroInView = () => window.scrollY < window.innerHeight * 0.6;
    const say = (key, text, ms) => {
      if (said.has(key) || !heroInView()) return;
      said.add(key);
      bubble.textContent = text;
      bubble.classList.add("is-on");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => bubble.classList.remove("is-on"), ms || 6500);
    };
    document.addEventListener("intro:done", () => {
      setTimeout(() => say("hello", "Hello, I am Alfred. Take your time."), 1800);
      // phones: point out that the dots in the background respond to touch
      if (!finePointer && !reduceMotion && !saveData) {
        setTimeout(() => say("touch", "Tap the background, or drag a finger across it. The dots follow you."), 9000);
      }
      setTimeout(() => say("linger", "Still here? Thank you for taking a closer look."), 16000);
    });
    if (finePointer) {
      document.addEventListener("mouseout", (e) => {
        if (!e.relatedTarget && e.clientY <= 0) say("exit", "Leaving already? My WhatsApp is one click away.");
      });
    }
    const baseTitle = document.title;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        document.title = "Still here when you are | Alfred Wong";
      } else {
        document.title = baseTitle;
        say("back", "Welcome back. I kept your place.");
      }
    });
  }

  /* ---------- nav: scrolled state via sentinel, mobile menu ---------- */
  const nav = $("[data-nav]");
  const sentinel = $("[data-nav-sentinel]");
  if (nav && sentinel && "IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => nav.classList.toggle("is-scrolled", !entry.isIntersecting),
      { threshold: 0 }
    ).observe(sentinel);
  } else if (nav) {
    nav.classList.add("is-scrolled");
  }

  const toggle = $("[data-nav-toggle]");
  const mobile = $("[data-nav-mobile]");
  if (nav && toggle && mobile) {
    $$("a", mobile).forEach((a, i) => a.style.setProperty("--i", i));
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.documentElement.style.overflow = open ? "hidden" : "";
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    $$("a", mobile).forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
    window.matchMedia("(min-width: 900px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
  }

  /* ---------- headings: hero words rise out of a mask, section headings rise word by word ---------- */
  $$("[data-split]").forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    const accent = (h.dataset.accent || "").toLowerCase();
    h.setAttribute("aria-label", words.join(" "));
    h.textContent = "";
    words.forEach((word, i) => {
      const isAccent = accent && word.toLowerCase().replace(/[^a-z]/g, "") === accent;
      const outer = el("span", { class: "w" + (isAccent ? " w--accent" : ""), "aria-hidden": "true" }, [
        el("span", { class: "w__in", style: "--i: " + i, text: word })
      ]);
      h.appendChild(outer);
      if (i < words.length - 1) h.appendChild(document.createTextNode(" "));
    });
  });
  if (!reduceMotion) {
    $$("[data-words]").forEach((h) => {
      const words = h.textContent.trim().split(/\s+/);
      h.setAttribute("aria-label", words.join(" "));
      h.textContent = "";
      words.forEach((word, i) => {
        h.appendChild(el("span", { class: "w", style: "--i: " + i, "aria-hidden": "true", text: word + (i < words.length - 1 ? " " : "") }));
      });
    });
  }

  /* ---------- hero: light, frame and floating work follow the pointer ---------- */
  const hero = $(".hero");
  const aura = $("[data-hero-aura]");
  const heroFrame = $(".hero__frame");
  const floats = $$(".float");
  if (hero && finePointer && !reduceMotion) {
    let raf = 0, mx = 0, my = 0;
    const apply = () => {
      raf = 0;
      if (aura) { aura.style.setProperty("--mx", mx.toFixed(3)); aura.style.setProperty("--my", my.toFixed(3)); }
      if (heroFrame) { heroFrame.style.setProperty("--tx", (mx * 5).toFixed(2)); heroFrame.style.setProperty("--ty", (my * -4).toFixed(2)); }
      floats.forEach((f) => {
        const d = parseFloat(f.dataset.depth) || 1;
        f.style.setProperty("--px", (mx * -16 * d).toFixed(1));
        f.style.setProperty("--py", (my * -12 * d).toFixed(1));
      });
    };
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;   // -1 .. 1
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener("pointerleave", () => { mx = 0; my = 0; if (!raf) raf = requestAnimationFrame(apply); });
  }

  /* ---------- magnetic primary buttons ---------- */
  if (finePointer && !reduceMotion) {
    $$("[data-magnetic]").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18;
        const y = (e.clientY - r.top - r.height / 2) * 0.28;
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
    });
  }

  /* ---------- marquees: seamless loop that speeds up (and turns around) with your scrolling ---------- */
  const tracks = $$("[data-marquee] .marquee__track");
  tracks.forEach((track) => {
    track.innerHTML += track.innerHTML;
    $$("span", track).forEach((s, i, all) => { if (i >= all.length / 2) s.setAttribute("aria-hidden", "true"); });
  });
  if (!reduceMotion && tracks.length) {
    const state = tracks.map((t) => ({ t, x: 0, half: 0, speed: parseFloat(t.dataset.speed) || 1, visible: true }));
    const measure = () => state.forEach((s) => { s.half = s.t.scrollWidth / 2; });
    measure();
    window.addEventListener("resize", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    state.forEach((s) => s.t.classList.add("is-driven"));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        const s = state.find((x) => x.t.parentElement === en.target);
        if (s) s.visible = en.isIntersecting;
      }));
      state.forEach((s) => io.observe(s.t.parentElement));
    }
    let lastY = window.scrollY, vel = 0, prev = performance.now(), dir = 1;
    const loop = (now) => {
      const dt = Math.min(64, now - prev);
      prev = now;
      const y = window.scrollY;
      vel += ((y - lastY) - vel) * 0.12;
      lastY = y;
      if (vel > 0.6) dir = 1; else if (vel < -0.6) dir = -1;
      const boost = 1 + Math.min(5, Math.abs(vel) * 0.22);
      state.forEach((s) => {
        if (!s.visible || !s.half) return;
        s.x -= s.speed * 0.04 * dt * boost * dir;
        if (s.x <= -s.half) s.x += s.half;
        if (s.x > 0) s.x -= s.half;
        s.t.style.transform = "translate3d(" + s.x.toFixed(2) + "px,0,0)";
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- scroll reveal ---------- */
  const revealEls = $$(".reveal, [data-words]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
          // the stagger delay is only for the entrance; drop it so hover reacts instantly afterwards
          setTimeout(() => en.target.style.removeProperty("--d"), 1400);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((elm) => io.observe(elm));
  } else {
    revealEls.forEach((elm) => elm.classList.add("is-in"));
  }

  /* ---------- numbers count up once visible ---------- */
  $$("[data-count]").forEach((elm) => {
    const target = parseFloat(elm.dataset.count);
    const suffix = elm.dataset.suffix || ""; // "20" counts up and ends as "20+"
    if (isNaN(target) || reduceMotion || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now(), dur = 1300;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        elm.textContent = Math.round(target * eased) + (p === 1 ? suffix : "");
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(elm);
  });

  /* ---------- service tiles: cursor spotlight ---------- */
  if (finePointer) {
    $$(".bento .tile").forEach((tile) => {
      tile.addEventListener("pointermove", (e) => {
        const r = tile.getBoundingClientRect();
        tile.style.setProperty("--sx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
        tile.style.setProperty("--sy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      });
    });
  }

  /* ---------- work: a reel of live sites ---------- */
  // Computers (mouse or trackpad, 760 px and wider): the section pins and your vertical scrolling
  // slides the cards sideways. Phones, tablets and reduced motion: a sideways row you swipe, where the
  // cards turn like pages as they leave the middle and the middle card scrolls through its homepage.
  const reel = $("[data-reel]");
  if (reel) {
    const viewport = $("[data-reel-viewport]", reel);
    const track = $("[data-reel-track]", reel);
    const cards = $$(".card", track);
    const bar = $("[data-reel-bar]", reel);
    const indexEl = $("[data-reel-index]");
    const total = cards.filter((c) => !c.classList.contains("card--next")).length;
    const wide = window.matchMedia("(min-width: 760px) and (hover: hover) and (pointer: fine)");
    const touchPreviews = !finePointer && !reduceMotion && !saveData;
    let pinned = false, maxX = 0, raf = 0, inView = false, centred = -1, settleTimer = 0;

    // previews: the full-length screenshot (data-full on each card) scrolls from the top of the homepage to the bottom
    const previews = cards.map((card) => {
      const src = card.dataset.full;
      const screen = $(".card__screen", card);
      if (!src || !screen || reduceMotion) return null;
      let full = null, on = false, timer = 0;
      const run = () => {
        if (!on || !full || !full.naturalHeight) return;
        const travel = full.offsetHeight - screen.clientHeight;
        if (travel <= 0) return;
        full.classList.add("is-on");
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!on) return;
          const secs = Math.min(20, Math.max(6, travel / 150));
          full.classList.add("is-moving");
          full.style.transitionDuration = secs.toFixed(1) + "s, .5s";
          full.style.transform = "translateY(" + (-travel) + "px)";
        }, 450);
      };
      return {
        start() {
          on = true;
          if (!full) {
            full = el("img", { class: "card__full", alt: "", decoding: "async" });
            full.addEventListener("error", () => { if (full) full.remove(); full = null; }, { once: true });
            screen.appendChild(full);
            full.src = src;
          }
          if (full.complete && full.naturalHeight) run(); else full.addEventListener("load", run, { once: true });
        },
        stop() {
          on = false;
          clearTimeout(timer);
          if (!full) return;
          full.classList.remove("is-on", "is-moving");
          full.style.transitionDuration = "";
          full.style.transform = "";
        }
      };
    });

    const nearest = (centre) => {
      let best = 0, bestD = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    };
    const setIndex = (best) => {
      if (indexEl) indexEl.textContent = String(Math.min(best + 1, total)).padStart(2, "0");
    };
    // touch screens: once a card has settled in the middle, its homepage starts scrolling
    const settle = (best) => {
      if (!touchPreviews) return;
      if (!inView || pinned) best = -1;
      if (best === centred) return;
      if (centred >= 0 && previews[centred]) previews[centred].stop();
      centred = best;
      clearTimeout(settleTimer);
      if (best >= 0 && previews[best]) settleTimer = setTimeout(() => previews[best].start(), 700);
    };
    // cards away from the middle turn slightly, like pages in a book
    const shape = (centre) => {
      cards.forEach((c) => {
        const d = clamp((c.offsetLeft + c.offsetWidth / 2 - centre) / (window.innerWidth * 0.9), -1, 1);
        c.style.setProperty("--rot", (d * -9).toFixed(2));
        c.style.setProperty("--scale", (1 - Math.abs(d) * 0.05).toFixed(3));
      });
    };
    const update = () => {
      raf = 0;
      if (pinned) {
        const r = reel.getBoundingClientRect();
        const p = clamp(-r.top / Math.max(1, reel.offsetHeight - window.innerHeight), 0, 1);
        const x = p * maxX;
        track.style.setProperty("--x", x.toFixed(1));
        if (bar) bar.style.setProperty("--p", p.toFixed(4));
        setIndex(nearest(x + window.innerWidth / 2));
        shape(x + window.innerWidth / 2);
      } else {
        const max = viewport.scrollWidth - viewport.clientWidth;
        const centre = viewport.scrollLeft + viewport.clientWidth / 2;
        const best = nearest(centre);
        if (bar) bar.style.setProperty("--p", (max > 0 ? viewport.scrollLeft / max : 0).toFixed(4));
        setIndex(best);
        if (!reduceMotion) shape(centre);
        settle(best);
      }
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    const layout = () => {
      const want = wide.matches && !reduceMotion;
      if (want !== pinned) {
        pinned = want;
        reel.classList.toggle("is-pinned", pinned);
        if (!pinned) {
          reel.style.height = "";
          track.style.removeProperty("--x");
          cards.forEach((c) => { c.style.removeProperty("--rot"); c.style.removeProperty("--scale"); });
        }
      }
      if (pinned) {
        maxX = Math.max(0, track.scrollWidth - window.innerWidth);
        // 0.7: the cards travel a little faster than you scroll, so the reel never drags
        reel.style.height = (window.innerHeight + maxX * 0.7) + "px";
      }
      update();
    };
    // cards sit far to the side, so lazy loading would wait too long: load them all as the reel approaches
    if ("IntersectionObserver" in window) {
      const near = new IntersectionObserver((entries) => {
        if (!entries.some((en) => en.isIntersecting)) return;
        near.disconnect();
        $$("img[loading='lazy']", track).forEach((img) => { img.loading = "eager"; });
      }, { rootMargin: "800px 0px" });
      near.observe(reel);
      // touch previews only run while the row of cards is actually on screen
      if (touchPreviews) {
        new IntersectionObserver(([en]) => { inView = en.isIntersecting; request(); }, { threshold: 0.5 }).observe(viewport);
      }
    }
    window.addEventListener("scroll", () => { if (pinned) request(); }, { passive: true });
    viewport.addEventListener("scroll", () => { if (!pinned) request(); }, { passive: true });
    window.addEventListener("resize", layout);
    window.addEventListener("load", layout);
    wide.addEventListener("change", layout);
    layout();

    // keyboard: tabbing to a card scrolls the page so that card is in view
    track.addEventListener("focusin", (e) => {
      if (!pinned) return;
      const card = e.target.closest(".card");
      if (!card) return;
      viewport.scrollLeft = 0;
      const target = clamp(card.offsetLeft + card.offsetWidth / 2 - window.innerWidth / 2, 0, maxX);
      const reelTop = reel.getBoundingClientRect().top + window.scrollY;
      const y = reelTop + (maxX ? target / maxX : 0) * (reel.offsetHeight - window.innerHeight);
      smooth.to(y);
    });

    // mouse: rest the pointer on a preview to scroll through the whole homepage
    if (finePointer) {
      cards.forEach((card, i) => {
        const shot = $(".card__shot", card);
        if (!shot || !previews[i]) return;
        shot.addEventListener("pointerenter", () => previews[i].start());
        shot.addEventListener("pointerleave", () => previews[i].stop());
      });
    }
  }

  /* ---------- process: the line fills and each step lights up as you scroll ---------- */
  const steps = $("[data-steps]");
  if (steps) {
    const items = $$(".steps__item", steps);
    if (reduceMotion) {
      steps.style.setProperty("--p", 1);
      items.forEach((it) => it.classList.add("is-on"));
    } else {
      let raf = 0;
      const update = () => {
        raf = 0;
        const line = window.innerHeight * 0.62;
        const r = steps.getBoundingClientRect();
        steps.style.setProperty("--p", clamp((line - r.top) / r.height, 0, 1).toFixed(3));
        items.forEach((it) => {
          const ir = it.getBoundingClientRect();
          it.classList.toggle("is-on", ir.top + ir.height * 0.35 < line);
        });
      };
      window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
      window.addEventListener("resize", update);
      update();
    }
  }

  /* ---------- videos: play only while on screen; stills for reduced motion and data saver ---------- */
  const videos = $$("video[data-lazyvideo], video[data-autovideo]");
  if (reduceMotion || saveData) {
    videos.forEach((v) => {
      v.removeAttribute("autoplay");
      try { v.pause(); } catch (_) { /* ignore */ }
      if (v.hasAttribute("src")) { v.removeAttribute("src"); v.load(); }
    });
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      const v = en.target;
      if (en.isIntersecting) {
        if (v.dataset.src && !v.getAttribute("src")) v.src = v.dataset.src;
        const p = v.play();
        if (p && p.catch) p.catch(() => { /* autoplay blocked: the poster stays */ });
      } else if (!v.paused) {
        v.pause();
      }
    }), { rootMargin: "200px 0px" });
    videos.forEach((v) => io.observe(v));
  }

  /* ---------- footer: the name fills with colour as you reach the end ---------- */
  const mark = $("[data-footer-mark]");
  if (mark) {
    if (reduceMotion) {
      mark.style.setProperty("--fill", 1);
    } else {
      let raf = 0;
      // empty when the name first appears, full at the very bottom of the page
      const update = () => {
        raf = 0;
        const start = mark.getBoundingClientRect().top + window.scrollY - window.innerHeight;
        const end = document.documentElement.scrollHeight - window.innerHeight;
        mark.style.setProperty("--fill", clamp((window.scrollY - start) / Math.max(1, end - start), 0, 1).toFixed(3));
      };
      window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
      update();
    }
  }

  /* ---------- cursor follower: a soft ring that says "Visit" over live sites ---------- */
  const cursor = $("[data-cursor]");
  if (cursor && finePointer && !reduceMotion) {
    const label = $("[data-cursor-label]", cursor);
    let tx = -100, ty = -100, cx = -100, cy = -100, raf = 0, shown = false;
    const tick = () => {
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      cursor.style.setProperty("--cx", cx.toFixed(1) + "px");
      cursor.style.setProperty("--cy", cy.toFixed(1) + "px");
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; cx = tx; cy = ty; cursor.classList.add("is-on"); }
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => { shown = false; cursor.classList.remove("is-on"); });
    document.addEventListener("pointerover", (e) => {
      const big = e.target.closest("[data-cursor-text]");
      const hover = e.target.closest("a, button, label, input, select, textarea");
      cursor.classList.toggle("is-big", !!big);
      cursor.classList.toggle("is-hover", !big && !!hover);
      if (label) label.textContent = big ? big.dataset.cursorText : "";
    });
  }

  /* ---------- background field: an abstract clip, redrawn as tangerine dots ---------- */
  // field-sprite.webp holds 120 small frames of a slow flowing-wave clip (made with Higgsfield).
  // How far you have scrolled picks the frame, each frame is read as a coarse grid of brightness
  // values, and every grid cell becomes a dot sized by that brightness. Dots near the mouse swell
  // and move aside. On touch screens they gather under your finger, and a tap sends a ripple across
  // the screen. Reduced motion and data saver get one still frame.
  const fieldCanvas = $("[data-field]");
  if (fieldCanvas && fieldCanvas.getContext) {
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
    // how strong the field is behind each section: full where there is little text, faint behind reading
    const LEVELS = [["#top", 0.85], ["#proof", 1], ["#work", 0.55], ["#speed", 0.6], ["#yours", 0.35], ["#services", 0.5], ["#process", 0.35], ["#about", 0.2], ["#testimonials", 0.3], ["#contact", 0.22], [".footer", 0.9]];
    let level = 1, levelTarget = 1;
    if ("IntersectionObserver" in window) {
      const zones = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) levelTarget = parseFloat(en.target.dataset.fieldLevel); });
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
  // Measured by Alfred's own test run (see the note under the chart). Update these numbers and the
  // table in index.html together if you re-measure. lcp = seconds until the main content is visible,
  // kb = everything the homepage downloads.
  const SPEED = {
    sites: [
      { name: "EPS Sports Academy", lcp: 2.96, kb: 5247 },
      { name: "Yakiniku Ichiban", lcp: 1.27, kb: 1863 },
      { name: "Angel Club Beauty & Wellness", lcp: 0.89, kb: 631 },
      { name: "Selangor Welding & Racking", lcp: 0.74, kb: 924 },
      { name: "The Mimie's Catering", lcp: 0.99, kb: 1016 },
      { name: "K&W World Engineering", lcp: 1.14, kb: 387 },
      { name: "Safiyya Pet Shop", lcp: 1.26, kb: 1222 },
      { name: "Sunshine Tots", lcp: 1.17, kb: 4545 },
      { name: "H2 Fix", lcp: 1.79, kb: 505 }
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
      const s = svg("svg", { viewBox: "0 0 " + width + " " + height, width: width, height: height, role: "img", "aria-label": "Bar chart of " + m.caption + " for the nine example sites" });

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
        const g = svg("g", { class: "chart__row", tabindex: "0", role: "listitem", "aria-label": site.name + ": " + SPEED.metrics.lcp.fmt(site.lcp) + " until the main content is visible, " + SPEED.metrics.kb.fmt(site.kb) + " page weight" });
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
        g.addEventListener("click", () => showTip(g, site));
        rowsEls.push(g);
        s.appendChild(g);
      });
      s.setAttribute("role", "list");
      s.addEventListener("pointerleave", hideTip);

      plot.textContent = "";
      plot.appendChild(s);
      plot.appendChild(tip);
      big.textContent = m.fmt(med);
      caption.textContent = m.caption + ", across the nine example sites";
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

  /* ---------- contact form: compose a WhatsApp message, preview it live, accept prefills ---------- */
  const form = $("[data-contact-form]");
  let prefillForm = () => {}; // used by the services helper and the phone sketch
  if (form) {
    const field = (name) => form.elements[name];
    const v = (name) => (field(name) && field(name).value.trim()) || "";
    const compose = () => [
      "Hi Alfred, I would like to talk about a project.",
      "",
      v("name") ? "Name: " + v("name") : null,
      v("business") ? "Business: " + v("business") : null,
      v("phone") ? "WhatsApp: " + v("phone") : null,
      "Need: " + v("need"),
      v("text") ? "" : null,
      v("text") ? "About the business:" : null,
      v("text") || null
    ].filter((l) => l !== null).join("\n");

    // the preview shows exactly what will be sent
    const preview = $("[data-wa-preview]", form);
    const previewText = $("[data-wa-preview-text]", form);
    const update = () => { if (previewText) previewText.textContent = compose(); };
    if (preview && previewText) {
      preview.hidden = false;
      form.addEventListener("input", update);
      form.addEventListener("change", update);
      update();
    }

    // fill in what the visitor already told us elsewhere on the page, without overwriting their own words
    ["business", "text"].forEach((name) => {
      const f = field(name);
      if (f) f.addEventListener("input", () => { delete f.dataset.auto; });
    });
    prefillForm = ({ business, need, note } = {}) => {
      const b = field("business"), n = field("need"), t = field("text");
      if (business && b && (!b.value.trim() || b.dataset.auto)) { b.value = business; b.dataset.auto = "1"; }
      if (need && n) n.value = need;
      if (note && t && (!t.value.trim() || t.dataset.auto)) { t.value = note; t.dataset.auto = "1"; }
      update();
      const first = ["name", "phone", "text"].map(field).find((f) => f && !f.value.trim());
      if (first) setTimeout(() => first.focus({ preventScroll: true }), reduceMotion ? 0 : 700);
    };

    form.addEventListener("submit", (e) => {
      if (!form.checkValidity()) return; // let the browser show its validation messages
      e.preventDefault();
      const number = form.dataset.whatsapp || "60105072222";
      const url = "https://wa.me/" + number + "?text=" + encodeURIComponent(compose());
      const win = window.open(url, "_blank", "noopener");
      if (!win) location.href = url; // popup blocked: navigate instead
      const btn = form.querySelector('[type="submit"]');
      if (btn) { btn.textContent = "Opening WhatsApp"; setTimeout(() => { btn.textContent = "Send enquiry"; }, 4000); }
    });
  }

  /* ---------- services helper: three questions, one suggestion ---------- */
  // Edit the wording here. Each answer has a value (used in the logic below) and a label (shown on the button).
  const HELPER = {
    questions: [
      { id: "site", q: "Does your business have a website today?",
        options: [["none", "No, not yet"], ["weak", "Yes, but it needs work"], ["good", "Yes, and it works well"]] },
      { id: "find", q: "How do most new customers find you?",
        options: [["search", "Searching on Google"], ["social", "Facebook, Instagram or TikTok"], ["word", "Word of mouth"]] },
      { id: "post", q: "How often do you post on social media?",
        options: [["often", "Most weeks"], ["sometimes", "Now and then"], ["rarely", "Rarely or never"]] }
    ],
    // [title shown to the visitor, option chosen in the contact form]
    outcomes: {
      "new+social": ["A website, then social media", "Website and social media"],
      "redesign+social": ["A refreshed website, then social media", "Website and social media"],
      "new": ["A new website", "A new website"],
      "redesign": ["A redesign of your website", "Redesign of my current website"],
      "+social": ["Social media marketing", "Social media marketing"],
      "": ["A short chat first", "Something else"]
    },
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
      }
    },
    // written into the contact form so Alfred sees the answers
    note: {
      site: { none: "I do not have a website yet", weak: "I have a website that needs work", good: "I have a website that works well" },
      find: { search: "most customers find me on Google", social: "most customers find me on social media", word: "most customers find me through word of mouth" },
      post: { often: "I post on social media most weeks", sometimes: "I post on social media now and then", rarely: "I rarely post on social media" }
    }
  };

  const helper = $("[data-helper]");
  const helperPanel = $("[data-helper-panel]");
  if (helper && helperPanel) {
    const Q = HELPER.questions;
    let answers = {};
    let step = 0;

    const suggest = (a) => {
      const web = a.site === "none" ? "new" : a.site === "weak" ? "redesign" : "";
      const social = a.post !== "often";
      const [title, need] = HELPER.outcomes[web + (social ? "+social" : "")];
      const postWhy = social ? HELPER.why.post.more : web ? HELPER.why.post.keep : HELPER.why.post.fine;
      return {
        title, need,
        why: [HELPER.why.site[a.site], HELPER.why.find[a.find], postWhy].join(" "),
        note: HELPER.note.site[a.site] + ", " + HELPER.note.find[a.find] + ", and " + HELPER.note.post[a.post] + "."
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
            el("a", { class: "btn btn--primary", href: "#contact", text: "Start a project", onclick: () => prefillForm({ need: r.need, note: r.note }) }),
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
    const paint = () => {
      const s = state();
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
    };

    // the phone's clock shows Kuala Lumpur time, like the intro
    const clock = $("[data-mock-time]", mock);
    const tick = () => {
      try {
        clock.textContent = new Date().toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kuala_Lumpur" }).replace(/\s*[ap]\.?\s?m\.?$/i, "");
      } catch (_) { /* keep the placeholder */ }
    };
    if (clock) { tick(); setInterval(tick, 30000); }

    const go = $("[data-builder-go]", builder);
    if (go) go.addEventListener("click", () => {
      const s = state(), t = TYPES[s.type];
      prefillForm({
        business: s.typed,
        need: "A new website",
        note: "I tried the website sketch on your site. " + (s.typed
          ? "My business is " + s.typed + ", a " + t.label + " in " + s.area + "."
          : "I run a " + t.label + " in " + s.area + ".")
      });
    });

    builder.addEventListener("input", paint);
    builder.addEventListener("change", paint);
    builder.hidden = false;
    paint();
  }
})();
