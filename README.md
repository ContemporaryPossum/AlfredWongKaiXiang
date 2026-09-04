# Alfred Wong Kai Xiang, portfolio website

Plain HTML, CSS and JavaScript. No framework, no build step, and no sub-folders: every file sits in one folder so it can be dragged straight into a GitHub repository. Double-click `index.html` to preview it locally.

## Files (all in the root folder)

```
index.html                       the whole site (one page)
thanks.html                      shown after the contact form is sent
styles.css                       all styling, design tokens at the top in :root
main.js                          menu, scroll reveals, work preview stage, small motion
netlify.toml                     optional Netlify settings (cache and security headers)
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

## Deploy on Netlify

1. Create a new GitHub repository, choose "uploading an existing file", and drag all the files in this folder into the drop zone. Commit.
2. In Netlify: Add new site > Import an existing project > pick the repository.
3. Build command: leave empty. Publish directory: leave as the root (`.`).
4. Deploy. Netlify gives you a `something.netlify.app` address; attach your own domain under Domain settings if you have one.

Every later push to GitHub redeploys the site automatically.

## Things to update once the site is live

- **Your domain.** Search `index.html` for `alfredwong.netlify.app` and replace it with your real address (canonical link, Open Graph and Twitter tags, JSON-LD). These need absolute URLs.
- **Contact form.** Uses Netlify Forms, so it only works on the live Netlify site, not when opened as a local file. Submissions appear in Netlify under Site > Forms. Turn on email notifications there so enquiries reach `Alfredwkxuk@gmail.com`.
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
