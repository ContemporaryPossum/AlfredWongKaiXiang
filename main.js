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
    const meter = $("[data-intro-meter]", intro);
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
    const total = lines.reduce((n, l) => n + l.length, 0);
    let typed = 0;

    let li = 0, ci = 0, timer = 0;
    const type = () => {
      const line = lines[li];
      if (ci <= line.length) {
        lineEl.textContent = line.slice(0, ci);
        if (ci > 0) typed += 1;
        if (meter) meter.style.transform = "scaleX(" + (typed / total).toFixed(3) + ")";
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
    if (isNaN(target) || reduceMotion || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now(), dur = 1300;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        elm.textContent = Math.round(target * eased);
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
  // Desktop: the section pins and your vertical scrolling slides the cards sideways.
  // Phones, tablets and reduced motion: a normal sideways scroller you can swipe.
  const reel = $("[data-reel]");
  if (reel) {
    const viewport = $("[data-reel-viewport]", reel);
    const track = $("[data-reel-track]", reel);
    const cards = $$(".card", track);
    const bar = $("[data-reel-bar]", reel);
    const indexEl = $("[data-reel-index]");
    const total = cards.filter((c) => !c.classList.contains("card--next")).length;
    const wide = window.matchMedia("(min-width: 1000px)");
    let pinned = false, maxX = 0, raf = 0;

    const setIndex = (centre) => {
      let best = 0, bestD = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (indexEl) indexEl.textContent = String(Math.min(best + 1, total)).padStart(2, "0");
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
        setIndex(x + window.innerWidth / 2);
        shape(x + window.innerWidth / 2);
      } else {
        const max = viewport.scrollWidth - viewport.clientWidth;
        if (bar) bar.style.setProperty("--p", (max > 0 ? viewport.scrollLeft / max : 0).toFixed(4));
        setIndex(viewport.scrollLeft + viewport.clientWidth / 2);
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
      window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
    });

    // rest the pointer on a preview to scroll through the whole homepage (data-full on each card)
    if (finePointer && !reduceMotion) {
      cards.forEach((card) => {
        const src = card.dataset.full;
        const shot = $(".card__shot", card);
        const screen = $(".card__screen", card);
        if (!src || !shot || !screen) return;
        let full = null, hovering = false, timer = 0;
        const reset = () => {
          clearTimeout(timer);
          if (!full) return;
          full.classList.remove("is-on", "is-moving");
          full.style.transitionDuration = "";
          full.style.transform = "";
        };
        const run = () => {
          if (!hovering || !full || !full.naturalHeight) return;
          const travel = full.offsetHeight - screen.clientHeight;
          if (travel <= 0) return;
          full.classList.add("is-on");
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (!hovering) return;
            const secs = Math.min(20, Math.max(6, travel / 150));
            full.classList.add("is-moving");
            full.style.transitionDuration = secs.toFixed(1) + "s, .5s";
            full.style.transform = "translateY(" + (-travel) + "px)";
          }, 450);
        };
        shot.addEventListener("pointerenter", () => {
          hovering = true;
          if (!full) {
            full = el("img", { class: "card__full", alt: "", decoding: "async" });
            full.addEventListener("error", () => { if (full) full.remove(); full = null; }, { once: true });
            screen.appendChild(full);
            full.src = src;
          }
          if (full.complete && full.naturalHeight) run(); else full.addEventListener("load", run, { once: true });
        });
        shot.addEventListener("pointerleave", () => { hovering = false; reset(); });
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
