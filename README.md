# Alfred Wong Kai Xiang, portfolio website

Plain HTML, CSS and JavaScript. No framework, no build step, and no sub-folders: every file sits in one folder so it can be dragged straight into a GitHub repository. Double-click `index.html` to preview it locally.

## Files (all in the root folder)

```
index.html                       the whole site (one page)
styles.css                       all styling, design tokens at the top in :root
main.js                          menu, scroll reveals, work preview stage, contact form, small motion
netlify.toml                     optional, only used if you host on Netlify (cache and security headers)
robots.txt
alfred-hero.webp                 hero portrait (1200 px, transparent soft edges)
alfred-hero-sm.webp              hero portrait for phones (780 px)
alfred-about.webp                About section portrait
og-image.jpg                     1200 x 630 link preview for WhatsApp, Facebook, LinkedIn
favicon-32.png, favicon-512.png, apple-touch-icon.png
bricolage-grotesque-latin.woff2  display font (SIL Open Font License)
geist-latin.woff2                body font (SIL Open Font License)
*-desktop.webp / *-mobile.webp   screenshots of the seven client sites
```

## Deploy on Cloudflare Pages

1. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git.
2. If it says "Missing Git connection", click Connect GitHub (or Add account) and authorise the Cloudflare GitHub app. Give it access to this repository (or all repositories). If the app is already installed but the repo is not listed, go to GitHub > Settings > Applications > Installed GitHub Apps > Cloudflare > Configure > Repository access, add the repository, save, then refresh Cloudflare.
3. Select the repository. Framework preset: None. Build command: leave empty. Build output directory: leave empty (or `/`).
4. Save and Deploy. You get a `project-name.pages.dev` address; add your own domain under Custom domains.

## Deploy on Netlify (alternative)

Add new site > Import an existing project > pick the repository. Build command empty, publish directory `.`. Deploy.

Either way, every later push to GitHub redeploys the site automatically.

## Contact form

The form works on any host with no backend. Pressing Send opens WhatsApp with the visitor's details pre-filled as a message to +60 10-507 2222. If your number ever changes, update it in three places in `index.html`: the WhatsApp button (`wa.me/...`), the form's `action`, and its `data-whatsapp` attribute.

## Things to update once the site is live

- **Your domain.** Search `index.html` for `alfredwong.netlify.app` and replace it with your real address, for example `alfredwongkaixiang.pages.dev` (canonical link, Open Graph and Twitter tags, JSON-LD). These need absolute URLs.
- **Testimonials.** The section is in `index.html` with a `hidden` attribute and two draft quotes. Send the wording to Michael Gan (Selangor Welding & Racking) and K&W World Engineering for their approval, edit the text to whatever they agree with, then delete `hidden` from `<section class="quotes" ... hidden>` to show it.

## Editing content

- **Copy.** All text lives in `index.html`. The tone is deliberately calm and professional, with no exclamation marks.
- **Services.** The pills and checklist in the Services section are plain `<li>` items. Add or remove as your offer changes.
- **Adding a project.** In the Selected work section, copy one `<li class="project" ...>` block and change:
  - `data-desktop` / `data-mobile`: screenshot filenames (desktop 1600 x 900, mobile 360 x 800, WebP or JPG), placed in the same folder
  - `data-url` and `data-host`: the live address
  - `data-name` and `data-tone`: the name and a brand colour used for the glow behind the preview
  - the `<img>`, `<h3>` and `<p class="project__meta">` inside it
- **Marquee.** The client names in `.marquee__track` are plain `<span>` elements. The script duplicates them for the loop, so list each client once.
- **Colours and fonts.** Change the values in `:root` at the top of `styles.css`. `--accent` is the orange used everywhere.
