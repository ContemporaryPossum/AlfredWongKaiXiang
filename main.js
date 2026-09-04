/* =========================================================
   Alfred Wong Kai Xiang, portfolio
   Vanilla JS, no dependencies. Everything degrades gracefully:
   if this file fails to load the page is still fully usable.
   ========================================================= */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

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

  /* ---------- hero: word-by-word reveal ---------- */
  $$("[data-split]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", words.join(" "));
    el.textContent = "";
    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.className = "w";
      span.style.setProperty("--i", i);
      span.textContent = word + (i < words.length - 1 ? " " : "");
      span.setAttribute("aria-hidden", "true");
      el.appendChild(span);
    });
  });

  /* ---------- hero: pointer-following glow + gentle portrait parallax ---------- */
  const hero = $(".hero");
  const glow = $("[data-hero-glow]");
  const portrait = $("[data-parallax] img");
  if (hero && finePointer && !reduceMotion) {
    let raf = 0;
    let mx = 0, my = 0;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;   // -1 .. 1
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener("pointerleave", () => { mx = 0; my = 0; if (!raf) raf = requestAnimationFrame(apply); });
    function apply() {
      raf = 0;
      if (glow) { glow.style.setProperty("--mx", mx.toFixed(3)); glow.style.setProperty("--my", my.toFixed(3)); }
      if (portrait) { portrait.style.setProperty("--px", (mx * -10).toFixed(2)); portrait.style.setProperty("--py", (my * -6).toFixed(2)); }
    }
  }

  /* ---------- magnetic primary CTA ---------- */
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

  /* ---------- marquee: duplicate track for a seamless loop ---------- */
  $$("[data-marquee] .marquee__track").forEach((track) => {
    track.innerHTML += track.innerHTML;
    $$("span", track).forEach((s, i, all) => { if (i >= all.length / 2) s.setAttribute("aria-hidden", "true"); });
  });

  /* ---------- scroll reveal ---------- */
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- process timeline: draw the line once in view ---------- */
  const timeline = $("[data-timeline]");
  if (timeline) {
    $$(".timeline__step", timeline).forEach((s, i) => s.style.setProperty("--i", i));
    if ("IntersectionObserver" in window && !reduceMotion) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { timeline.classList.add("is-in"); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(timeline);
    } else {
      timeline.classList.add("is-in");
    }
  }

  /* ---------- work: sticky preview stage driven by the project list ---------- */
  const stage = $("[data-stage]");
  const projects = $$("[data-projects] .project");
  if (stage && projects.length) {
    const layers = $$("[data-layer]", stage);
    const phoneLayers = $$("[data-phone-layer]", stage);
    const urlEl = $("[data-stage-url]", stage);
    const linkEl = $("[data-stage-link]", stage);
    const nameEl = $("[data-stage-name]", stage);
    let active = projects.findIndex((p) => p.classList.contains("is-active"));
    if (active < 0) active = 0;
    let front = 0; // which layer is currently visible
    const preloaded = new Set();

    const preload = (src) => {
      if (!src || preloaded.has(src)) return;
      const img = new Image(); img.src = src; preloaded.add(img.src);
    };
    projects.forEach((p) => { preload(p.dataset.desktop); preload(p.dataset.mobile); });

    const show = (index) => {
      if (index === active && stage.dataset.ready) return;
      stage.dataset.ready = "1";
      const p = projects[index];
      if (!p) return;
      active = index;
      projects.forEach((el, i) => el.classList.toggle("is-active", i === index));

      const back = 1 - front;
      const swap = (arr, src) => {
        if (!arr[back] || !arr[front]) return;
        if (arr[front].getAttribute("src") === src) return;
        arr[back].src = src;
        const go = () => { arr[back].classList.add("is-active"); arr[front].classList.remove("is-active"); };
        if (arr[back].complete) go(); else arr[back].addEventListener("load", go, { once: true });
      };
      swap(layers, p.dataset.desktop);
      swap(phoneLayers, p.dataset.mobile);
      front = back;

      stage.style.setProperty("--tone", p.dataset.tone || "");
      if (urlEl) urlEl.textContent = p.dataset.host || "";
      if (linkEl) linkEl.href = p.dataset.url || "#";
      if (nameEl) nameEl.textContent = p.dataset.name || "";
    };

    // Desktop: hover and keyboard focus drive the stage
    projects.forEach((p, i) => {
      p.addEventListener("pointerenter", () => { if (finePointer) show(i); });
      p.addEventListener("focusin", () => show(i));
    });

    // Touch or keyboard scroll: the row nearest the middle of the viewport becomes active
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) show(projects.indexOf(en.target));
        });
      }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
      projects.forEach((p) => io.observe(p));
    }

    // Subtle 3D tilt on the frame, pointer-driven, desktop only
    const frame = $("[data-tilt]", stage);
    if (frame && finePointer && !reduceMotion) {
      let raf = 0, rx = 0, ry = 0;
      stage.addEventListener("pointermove", (e) => {
        const r = frame.getBoundingClientRect();
        rx = ((e.clientX - r.left) / r.width - 0.5) * 6;   // rotateY
        ry = ((e.clientY - r.top) / r.height - 0.5) * -6;  // rotateX
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; frame.style.setProperty("--rx", rx.toFixed(2)); frame.style.setProperty("--ry", ry.toFixed(2)); });
      });
      stage.addEventListener("pointerleave", () => { frame.style.setProperty("--rx", 0); frame.style.setProperty("--ry", 0); });
    }

    show(active);
  }

  /* ---------- footer year ---------- */
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- contact form: compose a WhatsApp message from the fields ---------- */
  const form = $("[data-contact-form]");
  if (form) {
    form.addEventListener("submit", (e) => {
      if (!form.checkValidity()) return; // let the browser show its validation messages
      e.preventDefault();
      const v = (name) => (form.elements[name] && form.elements[name].value.trim()) || "";
      const lines = [
        "Hi Alfred, I would like to talk about a project.",
        "",
        "Name: " + v("name"),
        v("business") ? "Business: " + v("business") : null,
        "WhatsApp: " + v("phone"),
        "Need: " + v("need"),
        "",
        "About the business:",
        v("text")
      ].filter((l) => l !== null).join("\n");
      const number = form.dataset.whatsapp || "60105072222";
      const url = "https://wa.me/" + number + "?text=" + encodeURIComponent(lines);
      const win = window.open(url, "_blank", "noopener");
      if (!win) location.href = url; // popup blocked: navigate instead
      const btn = form.querySelector('[type="submit"]');
      if (btn) { btn.textContent = "Opening WhatsApp"; setTimeout(() => { btn.textContent = "Send enquiry"; }, 4000); }
    });
  }
})();
