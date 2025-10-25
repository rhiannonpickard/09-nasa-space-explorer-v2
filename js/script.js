/**
 * Main script for the NASA Space Explorer app.
 * Wrapped in an IIFE to avoid leaking globals and to make testing easier.
 */
(function () {
	'use strict';

		// Basic runtime diagnostics to help debug why the loading overlay may not appear.
		try {
			console.log('script.js IIFE start');
		} catch (e) { /* ignore */ }

		window.addEventListener('error', (ev) => {
			console.error('Uncaught error:', ev && ev.error ? ev.error : ev.message || ev);
		});
		window.addEventListener('unhandledrejection', (ev) => {
			console.error('Unhandled promise rejection:', ev && ev.reason ? ev.reason : ev);
		});

	// Use this URL to fetch NASA APOD JSON data.
	const apodData = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';

	// DOM elements
	const galleryEl = document.getElementById('gallery');
	const btn = document.getElementById('getImageBtn');
	const startInput = document.getElementById('startInput');
	const endInput = document.getElementById('endInput');
	const modal = document.getElementById('modal');
	const modalMedia = document.getElementById('modalMedia');
	const modalTitle = document.getElementById('modalTitle');
	const modalDate = document.getElementById('modalDate');
	const modalExplanation = document.getElementById('modalExplanation');
	const modalClose = document.getElementById('modalClose');
	const loadMoreBtn = document.getElementById('loadMoreBtn');

	// App state for pagination/view
	let fullDataSorted = [];
	let currentViewData = [];
	let currentPos = 0;
	const PAGE_SIZE = 12;
	let isRendering = false;

	// IntersectionObserver for lazy-loading images
	let lazyObserver = null;
	function createLazyObserver() {
		if ('IntersectionObserver' in window) {
			lazyObserver = new IntersectionObserver((entries) => {
				entries.forEach(entry => {
					if (entry.isIntersecting) {
						const img = entry.target;
						loadLazyImage(img);
						if (lazyObserver) lazyObserver.unobserve(img);
					}
				});
			}, { rootMargin: '200px 0px', threshold: 0.01 });
		}
	}

	function loadLazyImage(img) {
		if (!img) return;
		const src = img.dataset && img.dataset.src ? img.dataset.src : img.getAttribute('data-src');
		if (!src) { img.classList.remove('lazy'); return; }
		// set src to start loading
		img.src = src;
		img.loading = 'lazy';
		img.decoding = 'async';
		img.addEventListener('load', () => {
			img.classList.remove('lazy');
			// remove placeholder background if present
			try { if (img._thumbWrap) { img._thumbWrap.style.backgroundImage = ''; img._thumbWrap.classList.remove('has-thumb-bg'); } } catch (e) { /* ignore */ }
		});
		img.addEventListener('error', () => { img.classList.remove('lazy'); img.alt = img.alt || 'Failed to load image'; });
	}

	// create observer early
	createLazyObserver();

	/* Starfield canvas: programmatic starfield with twinkling stars. */
	function initStarfield(){
		const canvas = document.getElementById('starfield');
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		let stars = [];
		let animId = null;
		let width = 0; let height = 0;
		const DPR = Math.max(1, window.devicePixelRatio || 1);
		const DENSITY = 0.00015; // stars per pixel

		function makeStars(){
			stars = [];
			const count = Math.max(80, Math.floor((width * height) * DENSITY));
			for (let i=0;i<count;i++){
				const x = Math.random() * width;
				const y = Math.random() * height;
				const r = Math.random() * 1.6 + 0.3; // radius
				const base = 0.25 + Math.random() * 0.75; // base alpha
				const speed = 0.0005 + Math.random() * 0.006; // twinkle speed
				const phase = Math.random() * Math.PI * 2;
				// slight warm tint for larger stars
				const warm = Math.random() < 0.08 ? (200 + Math.floor(Math.random()*55)) : 255;
				stars.push({x,y,r,base,speed,phase,warm});
			}
		}

		function resize(){
			width = Math.max(1, Math.floor(window.innerWidth));
			height = Math.max(1, Math.floor(window.innerHeight));
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';
			canvas.width = width * DPR;
			canvas.height = height * DPR;
			ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
			makeStars();
		}

		let last = performance.now();
		function render(now){
			const t = now / 1000;
			ctx.clearRect(0,0,width,height);
			for (let i=0;i<stars.length;i++){
				const s = stars[i];
				const a = s.base * (0.6 + 0.4 * Math.sin(s.phase + t * (s.speed*2000)));
				ctx.beginPath();
				ctx.fillStyle = `rgba(${s.warm},${s.warm},${255},${Math.max(0,Math.min(1,a))})`;
				ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
				ctx.fill();
			}
			animId = requestAnimationFrame(render);
		}

		function start(){
			if (animId) return;
			animId = requestAnimationFrame(render);
		}
		function stop(){ if (animId) { cancelAnimationFrame(animId); animId = null; } }

		// Pause when page hidden to save CPU
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) stop(); else start();
		});

		window.addEventListener('resize', () => { resize(); });
		// initial
		resize();
		start();
	}

	// initialize starfield
	initStarfield();

	// Wire date trigger buttons to reliably open native date pickers
	function wireDateTriggers() {
		const triggers = document.querySelectorAll('.date-trigger');
		triggers.forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				const targetId = btn.dataset && btn.dataset.target;
				if (!targetId) return;
				const input = document.getElementById(targetId);
				if (!input) return;
				// Prefer the showPicker API when available (Chromium browsers)
				if (typeof input.showPicker === 'function') {
					try { input.showPicker(); } catch (e) { input.focus(); }
				} else {
					// fallback: focus and dispatch a click to open native picker in some browsers
					input.focus();
					const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
					input.dispatchEvent(evt);
				}
			});
		});
	}

	// Make the whole .date-control clickable: clicking anywhere in the control opens the picker
	function wireDateControlClicks() {
		const controls = document.querySelectorAll('.date-control');
		controls.forEach(ctrl => {
			ctrl.addEventListener('click', (e) => {
				// Prevent when clicking the actual input (let browser handle typing) or other buttons
				if (e.target && (e.target.tagName === 'INPUT' || e.target.closest('button') )) return;
				const trigger = ctrl.querySelector('.date-trigger');
				if (trigger) trigger.click();
			});
		});
	}

	wireDateTriggers();
	wireDateControlClicks();


	function toDate(dateStr) {
		if (!dateStr) return null;
		// Accept already-ISO or YYYY-MM-DD
		const tryStr = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
		const d = new Date(tryStr);
		if (Number.isNaN(d.getTime())) return null;
		// zero out time
		d.setHours(0, 0, 0, 0);
		return d;
	}

	// Helper: format Date -> YYYY-MM-DD (for inputs)
	function toYYYYMMDD(d) {
		if (!d || !(d instanceof Date)) return '';
		return d.toISOString().slice(0, 10);
	}

	// Note: no transient notice function — date tracker is infinite and unclamped.

// Loading overlay that cycles short "Did you know?" NASA facts while network calls happen.
const LOADING_FACTS = [
	'Did you know? The Hubble Space Telescope has observed objects more than 13 billion light-years away.',
	'Did you know? Voyager 1 is the farthest human-made object from Earth and is still sending back data.',
	"Did you know? The Sun makes up 99.86% of the mass in our solar system.",
	'Did you know? NASA’s Perseverance rover collects rock samples to help search for signs of ancient life on Mars.',
	'Did you know? The International Space Station travels around Earth at about 17,150 miles per hour (27,600 km/h).',
	'Did you know? Black holes can warp space and time so severely that not even light can escape from them.'
];

let _factsOverlay = null;
let _factIdx = 0;
let _factTimer = null;

function _createFactsOverlay() {
	if (_factsOverlay) return _factsOverlay;
	const ov = document.createElement('div');
	ov.className = 'facts-overlay';
	ov.setAttribute('aria-hidden', 'true');
	ov.innerHTML = `
		<div class="facts-card" role="status" aria-live="polite">
			<div class="facts-header">Did you know?</div>
			<div class="fact-body">
				<div class="fact-text">${LOADING_FACTS[_factIdx]}</div>
				<div class="fact-sub">Loading images…</div>
			</div>
			<div class="fact-spinner" aria-hidden="true"></div>
		</div>
	`;
	// Append to body if available; otherwise fall back to documentElement to avoid null errors
	const host = document.body || document.documentElement;
	host.appendChild(ov);
	_factsOverlay = ov;
	return _factsOverlay;
}

function _showFactsLoading() {
	const ov = _createFactsOverlay();
	console.log('Showing facts loading overlay');
	ov.style.display = 'flex';
	ov.setAttribute('aria-hidden', 'false');
	const txt = ov.querySelector('.fact-text');
	if (txt) { txt.style.opacity = '0'; setTimeout(() => { txt.textContent = LOADING_FACTS[_factIdx]; txt.style.opacity = '1'; }, 20); }
	if (_factTimer) clearInterval(_factTimer);
	_factTimer = setInterval(() => {
		_factIdx = (_factIdx + 1) % LOADING_FACTS.length;
		const t = ov.querySelector('.fact-text');
		if (!t) return;
		t.style.opacity = '0';
		setTimeout(() => { t.textContent = LOADING_FACTS[_factIdx]; t.style.opacity = '1'; }, 350);
	}, 4000);
}

function _hideFactsLoading() {
	if (!_factsOverlay) return;
	console.log('Hiding facts loading overlay');
	_factsOverlay.style.display = 'none';
	_factsOverlay.setAttribute('aria-hidden', 'true');
	if (_factTimer) { clearInterval(_factTimer); _factTimer = null; }
}

// Show a single random "Did you know?" banner after initial load so users see a fun fact
function showRandomFactOnLoad(durationMs = 6000) {
	try {
		const idx = Math.floor(Math.random() * LOADING_FACTS.length);
		const text = LOADING_FACTS[idx];
		const banner = document.createElement('div');
		banner.className = 'didyouknow-banner';
		banner.setAttribute('role', 'status');
		banner.innerHTML = `<div class="didyouknow-inner"><strong>Did you know?</strong><div class="didyouknow-text">${text}</div><button class="didyouknow-close" aria-label="Dismiss">×</button></div>`;
		const host = document.body || document.documentElement;
		host.appendChild(banner);
		// show animation
		requestAnimationFrame(() => { banner.classList.add('visible'); });
		// close handler
		banner.querySelector('.didyouknow-close').addEventListener('click', () => { banner.classList.remove('visible'); setTimeout(() => banner.remove(), 300); });
		// auto-dismiss
		setTimeout(() => { if (banner.parentNode) { banner.classList.remove('visible'); setTimeout(() => { try { banner.remove(); } catch (e) {} }, 300); } }, durationMs);
	} catch (e) { console.error('showRandomFactOnLoad error', e); }
}

function setLoading(isLoading) {
	try {
		console.log('setLoading ->', isLoading);
	} catch (e) {}
	if (isLoading) {
		btn.disabled = true;
		// show rotating facts overlay while network is active
		_showFactsLoading();
	} else {
		btn.disabled = false;
		_hideFactsLoading();
	}
}

	function clearGallery() {
		galleryEl.innerHTML = '';
	}

	async function fetchAPOD() {
		try {
			const resp = await fetch(apodData, { cache: 'no-store' });
			if (!resp.ok) throw new Error('Network response was not ok: ' + resp.status);
			const data = await resp.json();
			if (!Array.isArray(data)) throw new Error('Feed did not return an array');
			return data;
		} catch (err) {
			console.error('Fetch APOD error:', err);
			throw err;
		}
	}


	function createCard(item) {
		const card = document.createElement('article');
		card.className = 'card'; card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-pressed', 'false');

		const thumbWrap = document.createElement('div'); thumbWrap.className = 'thumb-wrap';

		if (item.media_type === 'image') {
			const img = document.createElement('img');
			img.setAttribute('data-src', item.url || '');
			img.alt = item.title || 'NASA image';
			img.classList.add('lazy');
			// if a low-res thumbnail exists, place it as the container background for a progressive reveal
			if (item.thumbnail_url) {
				thumbWrap.classList.add('has-thumb-bg');
				thumbWrap.style.backgroundImage = `url(${item.thumbnail_url})`;
			}
			thumbWrap.appendChild(img);
			// keep a reference so load handler can remove placeholder background
			img._thumbWrap = thumbWrap;
			if (lazyObserver) lazyObserver.observe(img); else loadLazyImage(img);
		} else if (item.media_type === 'video') {
			// if thumbnail exists, show it lazily (and use it as low-res background)
			if (item.thumbnail_url) {
				thumbWrap.classList.add('has-thumb-bg');
				thumbWrap.style.backgroundImage = `url(${item.thumbnail_url})`;
				const img = document.createElement('img');
				img.setAttribute('data-src', item.thumbnail_url || '');
				img.alt = item.title || 'Video thumbnail';
				img.classList.add('lazy');
				img._thumbWrap = thumbWrap;
				thumbWrap.appendChild(img);
				if (lazyObserver) lazyObserver.observe(img); else loadLazyImage(img);
			} else {
				const thumb = document.createElement('div'); thumb.className = 'thumb'; thumb.style.height = '160px'; thumb.style.display = 'flex'; thumb.style.alignItems = 'center'; thumb.style.justifyContent = 'center'; thumb.style.fontWeight = '600'; thumb.textContent = 'Video — Click to play'; thumbWrap.appendChild(thumb);
			}
		} else {
			const unsupported = document.createElement('div'); unsupported.className = 'thumb'; unsupported.textContent = 'Unsupported media'; thumbWrap.appendChild(unsupported);
		}

		const meta = document.createElement('div'); meta.className = 'meta';
		const title = document.createElement('p'); title.className = 'title'; title.textContent = item.title || 'Untitled';
		const date = document.createElement('p'); date.className = 'date'; date.textContent = formatDateISO(item.date || '');
		meta.appendChild(title); meta.appendChild(date);

		// optional credit/copyright
		if (item.copyright) {
			const credit = document.createElement('p'); credit.className = 'credit'; credit.textContent = `© ${item.copyright}`;
			meta.appendChild(credit);
		}

		card.appendChild(thumbWrap); card.appendChild(meta);

		function openHandler() { openModal(item); }
		card.addEventListener('click', openHandler);
		card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHandler(); } });

		return card;
	}


	function formatDateISO(dateStr) { if (!dateStr) return ''; try { const d = new Date(dateStr + 'T00:00:00'); return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return dateStr; } }


	function openModal(item) {
		modalMedia.innerHTML = '';
		modalTitle.textContent = item.title || '';
		modalDate.textContent = formatDateISO(item.date || '');
		modalExplanation.textContent = item.explanation || '';

		if (item.media_type === 'image') {
			const img = document.createElement('img'); img.src = item.url; img.alt = item.title || 'NASA image'; img.style.maxWidth = '100%'; img.style.display = 'block'; modalMedia.appendChild(img);
		} else if (item.media_type === 'video') {
			const lower = (item.url || '').toLowerCase();
			if (lower.includes('youtube') || lower.includes('youtu.be')) {
				let embedUrl = item.url;
				if (embedUrl.includes('watch?v=')) embedUrl = embedUrl.replace('watch?v=', 'embed/');
				if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
				const iframe = document.createElement('iframe'); iframe.src = embedUrl; iframe.width = '100%'; iframe.height = '480'; iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'; iframe.allowFullscreen = true; iframe.title = item.title || 'NASA video'; modalMedia.appendChild(iframe);
			} else {
				const link = document.createElement('a'); link.href = item.url; link.textContent = 'Open video in new tab'; link.target = '_blank'; link.rel = 'noopener noreferrer'; modalMedia.appendChild(link);
			}
		} else {
			const p = document.createElement('p'); p.textContent = 'Media type not supported in the modal.'; modalMedia.appendChild(p);
		}

		modal.setAttribute('aria-hidden', 'false'); modal.style.display = 'flex'; modalClose.focus(); document.body.style.overflow = 'hidden';
	}


	function closeModal() { modal.setAttribute('aria-hidden', 'true'); modal.style.display = 'none'; document.body.style.overflow = ''; }


	modalClose.addEventListener('click', closeModal);
	// Close modal when clicking the backdrop (modal element itself)
	modal.addEventListener('click', (e) => {
		// If the click target is the modal backdrop (not the inner dialog), close it
		if (e.target === modal) {
			closeModal();
		}
		// legacy: support elements with data-dismiss attribute
		if (e.target && e.target.dataset && e.target.dataset.dismiss) {
			closeModal();
		}
	});
	document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') { closeModal(); } });


	btn.addEventListener('click', async () => {
		// Robust date handling:
		// - If start/end are empty, treat them as full-range (dataset bounds)
		// - If one is empty, clamp it to dataset min/max
		// - If start > end, swap them
		setLoading(true);
		try {
			// Ensure we have the full dataset cached
			if (!Array.isArray(fullDataSorted) || fullDataSorted.length === 0) {
				const dataFetch = await fetchAPOD();
				fullDataSorted = dataFetch.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
			}

			// derive dataset bounds (newest first in fullDataSorted)
			const datasetLatest = fullDataSorted.length ? toDate(fullDataSorted[0].date) : new Date();
			const datasetEarliest = fullDataSorted.length ? toDate(fullDataSorted[fullDataSorted.length - 1].date) : new Date('1900-01-01T00:00:00');

			// parse user inputs (may be empty)
			let start = toDate(startInput.value);
			let end = toDate(endInput.value);

			// If both empty, default to full dataset range
			if (!start && !end) {
				start = datasetEarliest;
				end = datasetLatest;
			} else if (!start) {
				// no start: clamp to earliest available
				start = datasetEarliest;
			} else if (!end) {
				// no end: clamp to latest available
				end = datasetLatest;
			}

			// If user accidentally set start after end, swap them
			if (start > end) {
				const tmp = start; start = end; end = tmp;
			}

			// No clamping: allow start/end outside dataset bounds (infinite timeline).

			// perform filtering using the normalized start/end
			const filtered = fullDataSorted.filter(item => {
				if (!item || !item.date) return false;
				const d = toDate(item.date);
				if (!d) return false;
				return d >= start && d <= end;
			});

			if (!filtered || filtered.length === 0) {
				galleryEl.innerHTML = '<p>No items found for that date range.</p>';
				loadMoreBtn.style.display = 'none';
				return;
			}

			// show in chronological order (oldest -> newest)
			filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
			setViewData(filtered);
		} catch (err) {
			galleryEl.innerHTML = `<p style="color:#900">There was an error loading data. Check console for details.</p>`;
			console.error(err);
		} finally {
			setLoading(false);
		}
	});


	// Render items into the gallery
	function renderItems(items, append = false) {
		if (!append) {
			clearGallery();
		}
		for (const item of items) {
			const card = createCard(item);
			galleryEl.appendChild(card);
		}
	}

	function setViewData(arr) {
		currentViewData = Array.isArray(arr) ? arr.slice() : [];
		currentPos = 0;
		renderNextPage();
	}

	function renderNextPage() {
		if (!currentViewData || currentViewData.length === 0) {
			clearGallery();
			if (loadMoreBtn) loadMoreBtn.style.display = 'none';
			return;
		}
		if (currentPos >= currentViewData.length) return;
		// prevent concurrent renders
		if (isRendering) return;
		isRendering = true;
		try {
			const next = currentViewData.slice(currentPos, currentPos + PAGE_SIZE);
			renderItems(next, currentPos > 0);
			currentPos += next.length;
			updateLoadMoreVisibility();
		} finally {
			isRendering = false;
		}
	}

	function updateLoadMoreVisibility() {
		if (!currentViewData || currentViewData.length === 0) {
			loadMoreBtn.style.display = 'none';
			return;
		}
		loadMoreBtn.style.display = (currentPos < currentViewData.length) ? 'inline-block' : 'none';
	}

	// wire load more
	if (loadMoreBtn) {
		loadMoreBtn.addEventListener('click', () => { renderNextPage(); });
	}

	// Infinite scroll sentinel observer
	const sentinelEl = document.getElementById('scrollSentinel');
	if (sentinelEl && 'IntersectionObserver' in window) {
		const sentinelObserver = new IntersectionObserver((entries) => {
			entries.forEach(en => {
				if (en.isIntersecting) {
					// don't re-enter while rendering
					if (!isRendering && currentPos < currentViewData.length) {
						renderNextPage();
					}
				}
			});
		}, { rootMargin: '600px 0px' });
		sentinelObserver.observe(sentinelEl);
	}


	// Prefill date inputs using dataset bounds and sensible defaults
	function prefillDates(data) {
		if (!Array.isArray(data) || data.length === 0) return;
		// extract valid dates
		const dates = data.map(i => i.date).filter(Boolean).map(d => new Date(d + 'T00:00:00')).filter(d => !Number.isNaN(d.getTime()));
		if (dates.length === 0) return;
		dates.sort((a, b) => a - b);
		const min = dates[0];
		const max = dates[dates.length - 1];

		// Do not set hard min/max on the native date inputs so users can select
		// dates farther back than the dataset if they wish. Keep sensible default
		// values but remove any restrictive attributes.
		try {
			startInput.removeAttribute('min');
			startInput.removeAttribute('max');
			endInput.removeAttribute('min');
			endInput.removeAttribute('max');
		} catch (e) {
			// ignore if inputs aren't present or browser doesn't support
		}

		// sensible defaults: show last 7 days or entire range if shorter
		const sevenDaysBefore = new Date(max);
		sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 6); // include max
		const defaultStart = sevenDaysBefore < min ? min : sevenDaysBefore;
		startInput.value = toYYYYMMDD(defaultStart);
		endInput.value = toYYYYMMDD(max);

		// Do not show dataset bounds — date tracker is intentionally infinite.
	}


	// Initialize: prefill inputs and show recent items
	async function init() {
		setLoading(true);
		try {
			const data = await fetchAPOD();
			// store full data sorted newest first
			fullDataSorted = data.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
			// set the initial view to the full sorted dataset (shows newest first)
			setViewData(fullDataSorted);
			prefillDates(data);
		} catch (err) {
			galleryEl.innerHTML = '<p style="color:#900">Unable to load initial data. Check console.</p>';
			console.error(err);
		} finally {
			setLoading(false);
			// show a single random fact banner after initial load completes
			try { showRandomFactOnLoad(); } catch (e) { /* ignore */ }
		}
	}

	// Run init when script loads
	init();

})();
