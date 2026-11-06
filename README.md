# Alfred Wong Kai Xiang, portfolio website

Live at https://portfolio.alfredwkxuk.workers.dev

Plain HTML, CSS and JavaScript. No framework, no build step, no outside scripts and no sub-folders: every file sits in one folder so it can be dragged straight into a GitHub repository. Double-click `index.html` to preview it locally (the showreel and a few effects work best from a real web address).

The page follows the structure of the Ollivere reference (https://ollivere.webflow.io/), restyled in Alfred's own dark look: near-black `#0d0e11`, one tangerine accent `#ff6a3d`, Bricolage Grotesque headings, Geist text, light engraved ink drawings and a fine film grain.

## Files (all in the root folder)

```
index.html                       the whole site (one page)
styles.css                       all styling; colours and fonts are tokens at the top in :root
main.js                          all motion and interaction (listed below)
_headers                         Cloudflare caching and security headers (read by Cloudflare, not served)
robots.txt
og-image.jpg                     1200 x 630 link preview for WhatsApp, Facebook, LinkedIn (the bite)
favicon-32.png, favicon-512.png, apple-touch-icon.png
bricolage-grotesque-latin.woff2  the heading font (SIL Open Font License)
geist-latin.woff2                the text font (SIL Open Font License)
rex-open-5.webp, rex-half-5.webp, the intro T-rex: jaws open and half closed (the inside of the open mouth is
  rex-bite.webp                  see-through, so the words behind show between the jaws), and biting; plus -s versions
                                 (800 wide) for phones
rex-half-3-m.webp, rex-bite-m.webp
                                 masks made from the half-open and biting drawings: they let the bitten piece of the word
                                 show inside the mouth, with the teeth in front of it
rex-peek-2.webp, rex-tongue-2.webp
                                 the T-rex holding a phone at "Let's work together", and its grey tongue (a separate layer so it can wag)
hut-1.webp to hut-7.webp         the seven Stone Age homes of the village, one for each service
anim-trike.webp, anim-chase.webp, anim-ptero.webp, anim-brachio.webp
                                 the moving creatures of the village: each is a grid of animation frames, made from a
                                 Higgsfield clip (MiniMax video) with its green background taken out
meteor.webp, ground.webp         the meteorite, and the strip of earth that breaks up when it lands
land-caveman.webp, land-dino.webp
                                 the caveman and baby triceratops that land on two of the service cards
caveman-stand.webp, caveman-bonk.webp, caveman-club.webp
                                 the caveman in the speed chart: standing, just bonked (spiral eyes, stars and birds),
                                 and the wooden club, drawn handle-up so it swings from its handle
evolution.mp4                    the "through the ages" film (1024 x 448, 16 seconds, no sound), made with Higgsfield; its
                                 colour is added in code (main.js), not in the file
icon-*.webp                      the seven ink icons in "Things I do" (icon-chat is the WhatsApp chatbot)
field-sprite.webp                120 frames of the abstract wave clip behind the dot field (not downloaded while the field is off)
alfred-showreel-v4.mp4           the 25-second showreel (1280 x 720), poster frame alfred-showreel.webp
*-desktop.webp / *-full.webp     screenshots of the ten client sites (1600 x 900, and full length 1200 wide)
```

All drawings were made with Higgsfield (GPT Image 2.5) in one engraving style and turned into light lines on black, so they glow against the dark page. The showreel was cut with Higgsfield Katana; its music was made with ElevenLabs Music on Higgsfield.

## Page, top to bottom

On computers the mouse wheel is smoothed the way the Lenis library does it, and menu links glide to their section (written into `main.js`, no outside code). The top bar tucks away while you scroll down and comes back, with a solid background, when you scroll up.

**Keeping it smooth.** One loop in `main.js` moves every scroll scene, and it follows two rules. Where each section sits on the page is measured once, and again only when the page changes size (`measures`); every frame after that only reads how far you have scrolled and writes styles. Measuring in between writes makes the browser lay the page out again several times a frame, which is what made the earlier version stutter. And the scenes move in the same frame as the page, so nothing trails a frame behind. On phones the address bar sliding in and out no longer counts as a resize, so the scenes are not rebuilt halfway through a scroll. If you add a scroll effect, put its measuring in `measures` and its movement in `scenes`.

1. **Intro: the bite.** "Good websites. No excuses." As you scroll, the ink T-rex rises behind the words with its jaws open and lunges at the last word. "excuses." stays in front of the T-rex the whole time, while "Good websites." stays behind it and shows through its open mouth (the inside of the mouth is see-through). The order is the `z-index` of `.hero__prey` and `.rex` in `styles.css`. The jaws snap shut and bite a chunk out of the word: what is left keeps a scalloped tooth mark on each side, darkening to blood red towards the bite, with blood spraying and dripping from the torn edges. The bitten piece stays in its mouth, between the teeth, while it shakes its head, and is chewed away as it leaves. What is left of the word tumbles to the ground with its tooth marks: the letters in front of the jaws first, the ones behind once the head lifts away. Everything follows the scroll, so scrolling back plays it in reverse. Where the mouth is in each drawing is in `main.js` (search for `BITE`); when each part happens is `ACT` just below it (`fall` is when the letters start to drop).
2. **Introduction, with the showreel behind it.** "Hello, I'm Alfred. I've built 50+ websites..." The two short paragraphs scroll over the 25-second showreel of the ten websites, with the ten client names drifting past at different speeds. The film is fixed to the screen and the introduction is a window onto it (`clip-path` on `.intro`), so it stays perfectly still while the words scroll over it, with a short fade where the window meets the page. Nothing has to be repainted as you scroll, and the film is not drawn at all while the introduction is far from the screen. The film is dimmed so the words stay easy to read: darker behind the column of text (dark enough that the light text passes AA contrast even over a white frame) and lighter at the sides (`.intro__shade` in `styles.css`). It starts by itself, muted, while the introduction covers the middle of the screen, and pauses when you scroll away. "Showreel", Play and Sound sit in the bottom corner while the introduction covers it (tabbing to them brings the introduction into view). The music is one hype instrumental track with only three soft whooshes. The Showreel link in the menu and the footer lands here.
3. **The village.** "My goal is to turn a boring outdated website into something that customers will actually stop and scroll..." A Stone Age street slides sideways as you scroll: seven caves, tree houses and huts planted in the ground, each with its service on the roof and each showing that service done the Stone Age way (a caveman carving a web page into a stone tablet, a pterodactyl delivering messages for the chatbots, a cave person tending the fire for hosting and care). Every home sits down in the soil: each picture ends at a different height, so each has its own `--sink` in the `style` of its `<li class="hut">` (a fraction of the home's size). All the movement follows the scroll, frame by frame: a triceratops with a rider gallops along, a raptor chases a caveman, a pterodactyl flies overhead, and a brachiosaurus, facing right, walks from the right side of "Reels and video" to the middle of "WhatsApp chatbots" (the two homes stand side by side). It walks while that stretch of street crosses the screen and stands still before and after; `data-walk="4,5"` on it names the two homes, counted from the left. The others walk, run and flap while you scroll, stand still when you stop and go backwards when you scroll up. Their animation frames come from short Higgsfield clips; `data-fps` on each one sets its pace (frames for every 800 pixels scrolled). Where each roof sign sits is also in the `style` of its `<li class="hut">` (`--sx`, `--sy`, `--sr`). At the end a meteorite streaks in, the screen flashes, and the ground, the homes, the creatures and the sentence all crumble and fall out of the bottom of the screen. Timing is in `main.js` (search for `VILLAGE`).
4. **Things I do.** As the cards arrive, a dazed caveman lands and sits on the top edge of "Websites" with his legs over the front, and a baby triceratops lands on "AI WhatsApp chatbots". Seven services, the example caption in English, Malay and Mandarin, and the four-question helper ("Not sure where to start?", wording in `main.js`, search for `HELPER`). The helper's suggestion can be sent straight to Alfred on WhatsApp.
5. **Through the ages** (behind the next four sections). One continuous ink film follows the scroll from "How I work" to "Now picture yours": the same man walks on the spot while he and his world transform, from a caveman beside a cave with dinosaurs, to a young professional in Kuala Lumpur under the Petronas Twin Towers, to an extraterrestrial being in an interstellar city. No fades: it is one film, played forwards as you scroll down and backwards as you scroll up. From Kuala Lumpur onwards the colour comes in as you scroll: it spreads out from the walking man and grows stronger, first green palms and warm towers against a sunset, then the interstellar city turns to Alfred's tangerine: the whole picture graded from near-black through ember to tangerine and peach, with a tangerine glow over it, the strongest colour on the page. The film and its colour are drawn together by one small WebGL program in `main.js` (search for `COLOUR`, which also says when the colour starts, spreads and changes). It is redrawn only when the film moves on a frame, so the film file stays the same, nothing extra is downloaded and scrolling stays smooth. The words of "Fast on a real phone" and "Now picture yours" get a soft dark backdrop so they stay readable over the tangerine. Without WebGL, or when `index.html` is opened straight from a folder (the browser will not let WebGL read the film then), the plain ink film shows instead and turns tangerine for the interstellar city. A small label says which age you are in (`ERAS` in `main.js`). The film (like the showreel) is downloaded whole and played from memory, so it can jump to any frame on any host: Cloudflare Workers always sends the whole file, even when the browser asks for part of it (`loadFilm` in `main.js`).
6. **How I work.** Four short steps in one row; the line through their numbers fills in as you scroll past. On phones the steps stack, each number sits in its own column and the line runs down through the numbers beside the words, filling in as you scroll.
7. **What people say.** Hidden until the clients approve the draft wording (see below).
8. **Work.** Ten of the 50+ websites, in Alfred's order: V2 Development, Starwill Chemicals, Hebron Lifts, Best Sister Florist, EPS Sports Academy, Baby Boss Lash Studio, MasterPiece Tailor, Safiyya Pet Shop, Yakiniku Ichiban, Sunshine Tots. Resting the mouse on a picture scrolls through that client's whole homepage; on phones the picture plays once it reaches the middle of the screen.
9. **Speed.** An interactive bar chart of how quickly the ten sites load on a phone, with a load time / page weight toggle. A caveman stands at the right-hand end of the top row (Baby Boss Lash Studio). Click or tap that row, or him, and a wooden club swings down onto his head: his eyes spin, his tongue flops out, stars and birds circle, he wobbles, then he hops off to another row picked at random, where the next click finds him. He stays with that website when you switch to page weight. Search `main.js` for `CAVEMAN` to change which row he starts on. The numbers live in `main.js` (search for `SPEED`) and in the table in `index.html`, which screen readers and visitors without JavaScript get. Update both if you re-measure.
10. **Now picture yours.** The visitor types a business name and area, picks a type and colour, and the phone plays a little demo website: the page scrolls by itself, the picture for their type of business moves, photos slide past, the map pin drops and a WhatsApp chat pops up. "Send it to me on WhatsApp" sends their details to Alfred. Wording per business type is in `main.js` (search for `TYPES`).
11. **Let's work together.** Only the big button. The T-rex's eyes show above it, its grey tongue out and wagging; point at the button (or tab to it) and it rises with a phone in its hands and a "Hi Alfred" message pops up. On phones it rises when the button reaches the middle of the screen. The button opens WhatsApp.
12. **Footer.** WhatsApp number, email and Instagram.

### The backgrounds

- **Ember fog** (`.fog`, in `main.js` search for `ember fog`): a moving WebGL background in the style of Vanta.js FOG, written into `main.js` instead of loading three.js from a CDN. It glows behind the intro, the contact section and the footer (levels in `FOG`) and flushes red for a moment at the bite.
- **Dot field** (`.dotfield`): tangerine halftone dots. It is switched off everywhere for now, so the page skips it completely (nothing is downloaded or drawn). To bring it back behind the introduction, set `#about` to `0.85` in `LEVELS` in `main.js`.
- **Through the ages** (`.eras`, `.evo-wrap`): see section 5, including the colour.

### Reduced motion, slow connections, no JavaScript

With the visitor's reduced-motion setting on, the intro shows one still picture (the T-rex holding the bitten piece in its teeth), the village becomes a row of homes you can swipe, the showreel behind the introduction shows its first frame and waits for the Play button, the caveman in the speed chart just shows his dazed face for a moment before moving to another row, and nothing moves by itself. Data saver also stops the showreel from playing by itself. Without JavaScript the page is fully readable: the intro shows the headline, the village shows the homes, the showreel behind the introduction has the browser's own controls, and the menu still opens.

## Hosting on Cloudflare

The site is hosted on Cloudflare (Workers and Pages) and connected to the GitHub repository https://github.com/ContemporaryPossum/AlfredWongKaiXiang. There is no build command: Cloudflare serves the files in the root exactly as they are.

- **Updating the site.** Upload or edit files in the GitHub repository. Every push redeploys the site automatically, usually within a minute or two.
- **Headers.** `_headers` tells Cloudflare how long browsers may cache fonts, images and videos, and adds basic security headers. HTML, CSS and JS are always checked for a newer version. Images and videos are cached for a week, so if you replace one, give the new file a new filename and update `index.html` (that is why the new showreel is `alfred-showreel-v4.mp4` and the new contact T-rex is `rex-peek-2.webp`).
- **Custom domain.** Cloudflare dashboard > Workers & Pages > select the project > Settings > Domains & Routes > Add > Custom domain. Then replace every `https://portfolio.alfredwkxuk.workers.dev` in `index.html` (canonical link, Open Graph and Twitter tags, JSON-LD) and the address at the top of this file.

## WhatsApp and email

There is no enquiry form any more. Every button opens WhatsApp to +60 17-353 4960, and the email address is alfredsworkemail22@gmail.com. If either changes, update `index.html` (every `wa.me/60173534960` link, the footer, the menu and the JSON-LD near the top) and the number in `main.js` (search for `WHATSAPP`).

## Still to do

- **Speed.** EPS Sports Academy (5.1 MB, 3.2 s), V2 Development (2.5 MB, 2.8 s) and Starwill Chemicals (2.3 s) are the slowest of the ten. Baby Boss Lash Studio is the quickest to show its content (0.9 s) but weighs 3.2 MB.
- **Testimonials.** The section is in `index.html` with a `hidden` attribute and two draft quotes from earlier clients. Send the wording for approval, edit it to whatever they agree to, then delete `hidden` from `<section class="quotes" ... hidden>`.
- **Example captions.** Check the Malay and Mandarin wording in "Things I do" (search `index.html` for `Example post caption`).
- **Showreel order.** The film still shows the ten sites in the earlier order (Yakiniku Ichiban sixth, Baby Boss Lash Studio ninth). Re-cutting it to match the new work order costs no generation credits, only a re-render.

## Editing content

- **Copy.** All page text is in `index.html`, except the helper questions, the era labels and the phone-sketch wording, which are in `main.js`. The tone is calm and plain, with no exclamation marks.
- **The headline.** If you change "excuses." in the intro, keep it a single word in the `data-prey` span; the bite and the falling letters work on whatever word is there.
- **Adding a project.** In the work section, copy one `<li class="proj" ...>` block and change both links, `data-full`, the two screenshots, the tags line, the name and the description. Alternate `proj` and `proj proj--low` so the two columns stay staggered. If the total passes another milestone, change "50+" in the description meta tag, the introduction and the work heading.
- **Colours and fonts.** Change the values in `:root` at the top of `styles.css`. `--accent` is the tangerine, `--blood` the red.
