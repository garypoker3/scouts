# Scouts — real-time team geolocation

Scouts tracks a team on a live map. Members see each other move in real time, commanders set
destinations that members confirm, and messaging is scoped to a unit. It suits anything where
a group needs to see where its people are and coordinate them — scouting, search parties,
outdoor events, field crews.

Django on the back end, Leaflet on the front, Server-Sent Events between them. Built in 2024,
originally as my final project for HarvardX's CS50W.

## How it works

- **Server-Sent Events over ASGI.** Position updates, messages and destination changes are
  pushed from server to browser through a long-lived `EventSource` connection served by
  **Daphne** — no client-side polling. The endpoint is an **async Django view** doing async
  model queries, which is why Django **≥ 4.2** is a hard requirement: earlier versions raise
  `TypeError: async_generator object is not iterable`.
- **Leaflet** renders the map with dynamic GeoJSON layers, auto-zoom that follows a moving
  scout, zoom-to-all, and touch handling for mobile browsers.
- **The data model.** `Scout` extends `AbstractUser`; `Unit` holds a commander through a
  `OneToOneField`; `Position` records waypoints; `Destination` subclasses `Marker` through a
  **primary-key one-to-one**, which is what enforces "one destination per scout" at the
  database rather than in application code. `TextChoices` enums cover colour and alert type.
- **A geolocation simulator** (`simulator.js`, `geolocation-simulator.js`) drives synthetic
  movement, so the real-time tracking can be demonstrated and tested without physically
  walking around with a phone.
- **Capability detection** for device and browser geolocation, with the accuracy the device
  actually reports surfaced to the user rather than hidden.

### A known design limitation, stated up front

`Position.latlng` and `Marker.latlng` store a stringified `lat/lng` in a `CharField`. That is
a consequence of building on SQLite: real spatial types need PostgreSQL with PostGIS, and the
model carries a comment saying so. Storing coordinates as text rules out spatial indexing and
any query more interesting than "give me the last point" — it is the first thing to change if
this were ever built for real.

## Features

- **Users and units** — users register, then are allocated to a unit through the Django admin.
  Units have a commander and a colour.
- **Live map** — scouts appear as named icons; clicking one shows their unit and commander.
- **Real-time tracking** — scouts see their own position and their unit members' positions as
  they move. Accuracy depends on the device's GPS and browser permissions.
- **Messaging** — within a unit. Messages appear both on the map and in a list, with read
  receipts back to the sender.
- **Destinations** — commanders set a destination by clicking the map; the scout gets a marker
  and a notification, and confirms receipt. Unconfirmed destinations stay visible.
- **Simulation mode** — drive a scout along a synthetic path to verify visibility to others.
- **Mobile-friendly** — the map is usable on a phone, which is where the geolocation is real.

## Quick start

```bash
python -m venv .venv && . .venv/Scripts/activate   # Linux/macOS: . .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

`db.sqlite3` ships with throwaway demo data (`a1`, `a2`, `admin`) so the map has something on
it on first load. Create your own superuser as above to reach `/admin/`.

Browser geolocation needs a secure context, so testing on a real phone means tunnelling the
dev server. `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` take extra hosts from the environment:

```bash
DJANGO_EXTRA_HOSTS=<subdomain>.ngrok-free.app python manage.py runserver
```

`DJANGO_SECRET_KEY` and `DJANGO_DEBUG` are read from the environment too. The checked-in
fallbacks are development-only and are not production values.

## Using it

**Setup** — in the Django admin:

- Assign scouts to units at `/admin/scouts/scout/`
- Allocate commanders to units at `/admin/scouts/unit/`

A registered user becomes a scout once allocated to a unit. Only commanders can set
destinations.

**On the map**

- Your own position is a blinking orange circle; click it for coordinates. Reported accuracy
  in metres and a red/green status sit in the toolbar.
- Other scouts are named icons. Click one to see their unit and commander.
- `Auto Zoom` follows position changes; `Zoom to All` fits everything into view. Scroll to
  zoom, drag to pan, or hold Shift and use the arrow keys after clicking the map.

**Messaging** — click a scout's icon, press `Message`, type, then `Send` or Enter. Messages
pop up on the recipient's map and land in their message list. Unread messages resurface on
login and can be marked read from either the map pop-up or the list.

**Destinations (commanders)** — click a scout's icon, press `Set Destination`, then click the
map. The scout receives a pop-up and a marker, and confirms; the commander gets the
confirmation back.

**Simulation** — press `Start Simulator`, and turn on `Auto Zoom` to follow the movement.

## Key files

| File | What it does |
|---|---|
| `scouts/models.py` | `Scout`, `Unit`, `Position`, `Marker`, `Destination`, `Message`, plus the `Color` and `Alert` enums |
| `scouts/views.py` | Request handlers and the async SSE endpoint |
| `scouts/templates/scouts/index.html` | The map UI — Leaflet control, toolbox, message list |
| `scouts/static/scouts/script.js` | Map interaction, SSE subscription and event handling, fetch calls to the API |
| `scouts/static/scouts/simulator.js`, `geolocation-simulator.js` | Synthetic movement for testing SSE and map updates without moving |
| `scouts/static/scouts/styles.css` | Blinking position indicator, message status, map tooltips |
| `scouts/static/scouts/*.svg` | Colour-coded map icons |

## Credits

- [Leaflet](https://leafletjs.com/) 1.9.4 for the interactive map
- [geolocation-simulator](https://github.com/russellsamora/geolocation-simulator) by Russell Samora
- SSE over Daphne, following the
  [Django ASGI deployment docs](https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/daphne/)
  and [this write-up by Photon Designer](https://www.photondesigner.com/articles/server-sent-events-daphne)
