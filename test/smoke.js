// Simple smoke test: fetch the APOD JSON and assert basic shape
const https = require('https');
const url = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';

function fetchJson(u){
  return new Promise((resolve, reject) => {
    https.get(u, (res) => {
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { const json = JSON.parse(raw); resolve(json); } catch(e){ reject(e); }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    const data = await fetchJson(url);
    if (!Array.isArray(data)) { console.error('Feed did not return an array'); process.exitCode = 2; return; }
    if (data.length === 0) { console.error('Feed returned empty array'); process.exitCode = 3; return; }
    // check first item has a date
    const item = data[0];
    if (!item.date || typeof item.date !== 'string') { console.error('First item is missing date'); process.exitCode = 4; return; }
    console.log('Smoke test passed — feed looks healthy. Entries:', data.length);
  } catch (err) {
    console.error('Smoke test failed:', err.message || err);
    process.exitCode = 1;
  }
})();
