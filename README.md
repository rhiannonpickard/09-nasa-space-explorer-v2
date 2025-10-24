# Project: NASA Space Explorer App (JSON Edition)

NASA publishes an [**Astronomy Picture of the Day (APOD)**](https://apod.nasa.gov/apod/archivepixFull.html)—images and videos with short explanations about our universe.

In this project, you’ll build a gallery that fetches APOD-style entries from a **provided JSON feed** (same field names as the real APOD API). Render a grid of items and a modal with details.

---

## Data Source (CDN)

Use this URL in your `fetch` request:

```js
https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json
```

- The file returns an **array** of APOD-like objects.  
- Keys mirror NASA’s APOD API: `date`, `title`, `explanation`, `media_type`, `url`, `hdurl` (images only), optional `thumbnail_url` (videos), and `service_version`.

### Example object (image)

```json
{
  "date": "2025-10-01",
  "title": "NGC 6960: The Witch's Broom Nebula",
  "explanation": "…",
  "media_type": "image",
  "url": "https://apod.nasa.gov/apod/image/2510/WitchBroom_Meyers_1080.jpg",
  "hdurl": "https://apod.nasa.gov/apod/image/2510/WitchBroom_Meyers_6043.jpg",
  "service_version": "v1",
  "copyright": "Brian Meyers"
}
```

### Example object (with video)
Not all APOD entries are images. Some are YouTube videos. Detect video entries and handle them appropriately by either embedding the video, displaying the thumbnail image, or providing a clear, clickable link to the video. 

The goal is to ensure users can easily access or clearly view content regardless of its media type.

```json
{
  "date": "2024-06-30",
  "title": "Earthrise: A Video Reconstruction",
  "explanation": "…",
  "media_type": "video",
  "url": "https://www.youtube.com/embed/1R5QqhPq1Ik",
  "thumbnail_url": "https://img.youtube.com/vi/1R5QqhPq1Ik/hqdefault.jpg",
  "service_version": "v1"
}
```

### Your Task
* **Fetch the JSON:** Request the CDN URL above and parse the returned array.
* **Display the Gallery:** For each item, show the image (or video thumbnail/player), title, and date.

---

## Features added in this workspace

- Initial load of the latest items (paginated, 12 per page).
- Date range filtering using the Start / End date pickers.
- Click a card to open a details modal with explanation and media (images embedded, YouTube embedded when possible).
- Lazy-loading images for better performance (`loading="lazy"`, `decoding="async"`).
- Hover and focus styles for cards (visual lift + accessible focus outlines).
- Credit/copyright shown when present in item metadata.
- "Load more" button to paginate older/newer items.

## Run locally

Serve the folder with a small static server and open the page in your browser:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Test (smoke)

This repo includes a tiny smoke test that verifies the CDN feed returns an array. Run:

```bash
npm install # optional, package.json exists but has no deps
npm test
```

The test uses Node's built-in https to fetch the JSON and will exit non-zero on failures.

## Notes

- The app expects APOD-like objects (date in YYYY-MM-DD). If the feed changes shape, you may need to adapt the parsing logic.
- If you want infinite scroll instead of "Load more", I can add that next.


