# B&B Towing website

A static website for B&B Towing, ready to host on GitHub Pages. No build step and no server.

- **Home** (`index.html`): services, how it works, call/WhatsApp/book buttons.
- **Our Work** (`gallery.html`): photo gallery with a tap-to-enlarge viewer.
- **Book a Tow** (`book.html`): booking form with a map for pickup and drop-off. On submit it opens
  WhatsApp with the full request filled in, addressed to the business number.

## Publish on GitHub Pages

1. In the repository on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick the branch and the `/ (root)` folder, then **Save**.
3. After a minute the site is live at `https://<github-username>.github.io/bandbtowing/`.

(Pages on a private repository needs a paid GitHub plan. Otherwise make the repository public.)

## Common changes

| What | Where |
| --- | --- |
| WhatsApp number that receives bookings, phone number, map start position | `assets/js/config.js` |
| Logo | Replace `assets/img/logo.svg` (keep the name, or update the `<img>` and favicon tags in the three pages) |
| Gallery photos | Put photos in `assets/img/gallery/` and list them in `GALLERY_PHOTOS` at the top of `assets/js/gallery.js` |
| Colours and fonts | Variables at the top of `assets/css/styles.css` |
| Automatic price estimates | Set `pricing.enabled: true` and the rates in `assets/js/config.js` |

Tip: resize gallery photos to about 1600 px wide before adding them so the page stays fast.

## What the owner receives on WhatsApp

Customer name and numbers, vehicle make/model/type, what happened, keys yes/no, owner yes/no
(plus owner details if not), whether the wheels roll, pickup and drop-off addresses with Google Maps
links, a Google Maps route link, driving distance and time, when it's needed, and notes. Each request
has a reference like `BB-1410-4821`.

## How the booking works (and its limits)

The site has no server, so it can't send WhatsApp messages by itself. Instead it opens WhatsApp on the
customer's phone with the message ready, and **the customer taps send**. The confirmation screen
reminds them and offers "open WhatsApp again", "copy request" and "call" as fallbacks.

Map, search and distance use free OpenStreetMap services (Leaflet tiles, Nominatim address search,
the OSRM demo routing server). They need no API key, which suits a proof of concept, but have
fair-use limits. For real traffic, move to a paid provider such as Google Maps Platform.

## Ideas for later

- **Automatic quotes:** the distance is already calculated; turn on `pricing` in `config.js` for a simple
  call-out fee + per-km estimate, or add rules per vehicle type / after-hours.
- **Send without the customer's WhatsApp:** use the WhatsApp Business Cloud API (or a form service plus
  a notification) through a small serverless function, so requests arrive even if the customer forgets
  to tap send, and get logged in a spreadsheet or CRM.
- Customer reviews / Google rating on the home page, service area map, own domain name.
