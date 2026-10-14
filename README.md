# Alfred Wong Kai Xiang, portfolio website

Live at https://portfolio.alfredwkxuk.workers.dev

Plain HTML, CSS and JavaScript. No framework, no build step, and no sub-folders: every file sits in one folder so it can be dragged straight into a GitHub repository. Double-click `index.html` to preview it locally.

## Files (all in the root folder)

```
index.html                       the whole site (one page)
styles.css                       all styling, design tokens at the top in :root
main.js                          all motion and interaction (listed below)
_headers                         Cloudflare caching and security headers (read by Cloudflare, not served)
robots.txt
alfred-about.webp                portrait (960 x 1280), also the first frame of the hero video
alfred-loop.mp4                  hero video: the portrait, gently moving, loops seamlessly (834 x 1112, 5 s)
alfred-desk.mp4, alfred-desk.webp   About section video and its still (1280 x 720, 6 s)
alfred-reel.mp4, alfred-reel.webp   social media tile video and its still (720 x 1280, 5 s)
og-image.jpg                     1200 x 630 link preview for WhatsApp, Facebook, LinkedIn
favicon-32.png, favicon-512.png, apple-touch-icon.png
bricolage-grotesque-latin.woff2  display font (SIL Open Font License)
geist-latin.woff2                body font (SIL Open Font License)
*-desktop.webp / *-mobile.webp   screenshots of the nine client sites (1600 x 900 and 360 x 800)
*-full.webp                      full-length homepage screenshots for the hover-to-scroll previews (1200 px wide)
field-sprite.webp                120 frames (160 x 90 each) of the abstract wave clip behind the page
```

The three videos of Alfred were made with Higgsfield from his own photo. The hero video animates the real portrait. The desk and café scenes are AI-generated pictures of Alfred, not real footage. The wave clip behind the page is also a Higgsfield generation.

## Page, top to bottom

Behind everything sits the **dot field**: an abstract wave clip redrawn as tangerine dots on a canvas. How far you have scrolled chooses the frame, so the waves roll forward and back with the page; the dots swell and move aside around the mouse; and the field is strong where there is little text and faint behind reading sections (levels in `main.js`, search for `LEVELS`). On phones the dots gather brightly under your finger, a quick tap sends a ripple across the screen, and the speech bubble in the hero points this out once. Reduced motion and data saver get one still frame. The canvas has the class `dotfield`; do not rename it to `field`, which is the class the form boxes use.

On desktop the mouse wheel is smoothed the way the Lenis library does it (the page eases towards where you scrolled, and menu links glide to their section). It is written into `main.js` rather than loaded as a separate library, so the site still has no outside code. Touch, keyboard and reduced-motion visitors keep normal scrolling.

1. **Intro.** The site types four lines to the visitor, then splits open. Plays once per visit, skippable, skipped for reduced motion. Add `?intro` to the address to watch it again. There is no loading line.
2. **Hero.** Headline words rise out of a mask, "customers." is underlined in tangerine. The portrait video sits in a frame with a line of light travelling around it, with real client work floating beside it. The frame and floating pieces follow the mouse, and the whole hero eases up and back as you scroll away. The speech bubble asides are in `main.js` (search for `say(`).
3. **Proof.** Two marquees (client names, then kinds of business) that speed up while you scroll and turn around when you scroll up. Three numbers that count up: 20+ websites built, 3 languages, 1 person. The nine projects shown are examples from the 20+.
4. **Selected work.** On computers with a mouse or trackpad (760 px wide and up) the section pins and scrolling moves the nine project cards sideways, with the orange progress line staying on screen underneath them. Cards shrink a little on short screens so the line always fits. Resting the mouse on a card's preview scrolls through that client's whole homepage. On phones and tablets the cards are a swipeable row: cards turn slightly as they leave the middle, and once a card settles in the middle its homepage scrolls by on its own (skipped with data saver). The last card invites the visitor to start a project.
5. **Speed.** An interactive bar chart (in the style of Bklit charts, drawn in plain SVG) of how quickly the nine example sites load on a phone. Bars grow in when the chart arrives, hovering or tapping a bar shows its numbers, and a toggle switches between load time and page weight. A dashed line marks the median, which is also the big number above the chart. The numbers are real measurements, described in the note under the chart; they are stored in `main.js` (search for `SPEED`) and in the table in `index.html`, which is what screen readers and visitors without JavaScript get. Update both if you re-measure.
6. **Now picture yours.** The visitor types a business name and area, picks a type and colour, and a phone shows a sketch of a homepage. "Start a project" copies the details into the contact form. Wording per business type is in `main.js` (search for `TYPES`).
7. **Services.** Website tile (the browser mockup scrolls its page as you scroll), social media tile (the Reel phone tilts as it passes, plus an example caption in English, Malay and Mandarin), and "Also handled". Below it, a three-question helper that suggests where to start (wording in `main.js`, search for `HELPER`). The phone sketch in "Now picture yours" tips up into place as it arrives.
8. **Process.** Four steps; a line fills and each step lights up as you scroll.
9. **About.** The desk video opens up as it comes into view and slowly pulls back as it crosses the screen, with the About text and facts.
10. **Testimonials.** Hidden until the clients approve the draft wording (see below).
11. **Contact.** The heading slides in as you arrive. WhatsApp button, contact details and the form. The form shows a live preview of the WhatsApp message and opens WhatsApp when sent. Nothing is stored.
12. **Footer.** The name fills with tangerine as you reach the bottom.

The scroll-linked effects use CSS scroll-driven animations (current Chrome, Edge and Safari). Browsers without them simply show each section in its final state.

On desktop a small ring follows the mouse and says "Visit" over the live sites. Everything respects the visitor's reduced-motion setting (videos are replaced by their stills, the reel becomes a normal row), and the page stays fully readable with JavaScript off.

## Hosting on Cloudflare

The site is hosted on Cloudflare (Workers & Pages) and connected to the GitHub repository https://github.com/ContemporaryPossum/AlfredWongKaiXiang. There is no build command: Cloudflare serves the files in the root exactly as they are.

- **Updating the site.** Upload or edit files in the GitHub repository. Every push redeploys the site automatically, usually within a minute or two.
- **Headers.** `_headers` tells Cloudflare how long browsers may cache fonts, images and videos, and adds basic security headers. HTML, CSS and JS are always checked for a newer version, so text and layout changes show up straight away. Images and videos are cached for a week, so if you replace one, give the new file a new filename and update `index.html`.
- **Custom domain.** Cloudflare dashboard > Workers & Pages > select the project > Settings > Domains & Routes > Add > Custom domain. Once it works, replace every `https://portfolio.alfredwkxuk.workers.dev` in `index.html` (canonical link, Open Graph and Twitter tags, JSON-LD) with the new address, and update the address at the top of this file.

## Contact form

The form needs no backend. Pressing Send opens WhatsApp with the visitor's details pre-filled as a message to +60 10-507 2222. If your number ever changes, update it in three places in `index.html`: the WhatsApp button (`wa.me/...`), the form's `action`, and its `data-whatsapp` attribute.

## Still to do

- **Testimonials.** The section is in `index.html` with a `hidden` attribute and two draft quotes. Send the wording to Michael Gan (Selangor Welding & Racking) and K&W World Engineering for their approval, edit the text to whatever they agree with, then delete `hidden` from `<section class="quotes" ... hidden>` to show it.
- **Example captions.** Check the Malay and Mandarin wording in the social media tile (search `index.html` for `Example post caption`).
- **EPS Sports Academy page weight.** Its homepage downloads about 5 MB when it opens, the heaviest of the nine, which is why it is the slowest bar in the speed chart. Compressing its videos and images would shorten that bar.

## Editing content

- **Copy.** All page text lives in `index.html`, except the intro lines, speech bubble asides, helper questions and phone sketch wording, which are in `main.js`. The tone is deliberately calm and professional, with no exclamation marks.
- **Adding a project.** In Selected work, copy one `<li class="card" ...>` block and change:
  - `style="--tone: ..."`: the client's brand colour, used for the glow and the dot by the name
  - `data-full`: the full-length screenshot (1200 px wide WebP, as tall as the homepage). Leave it out if you do not have one yet.
  - the two links, the address in `card__url`, both images (`*-desktop.webp` 1600 x 900 and `*-mobile.webp` 360 x 800), the name and the meta line
  - then update: the counter `09` in `work__count`, the heading "Nine of my 20+ websites" and the marquee names. If your total passes another milestone, change "20+" in the hero line, the floating chip, the first Proof number (`data-count="20"`) and the About fact.
- **Colours and fonts.** Change the values in `:root` at the top of `styles.css`. `--accent` is the orange used everywhere.
