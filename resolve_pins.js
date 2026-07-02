const https = require('https');
const http = require('http');

const urls = [
'https://pin.it/4fTV8qAS1', 'https://pin.it/5FabHB8oq', 'https://pin.it/5F68JqFs1', 'https://pin.it/7IuWvYtkc', 'https://pin.it/78fnst4il', 'https://pin.it/1zjwaDN1b', 'https://pin.it/4mCYVSIQr', 'https://pin.it/4eV8jqQYm', 'https://pin.it/3dXMSWlTP', 'https://pin.it/2nN6HYgNW', 'https://pin.it/5NLYPyR8U', 'https://pin.it/2NkHljHch', 'https://pin.it/id61Bpu1M', 'https://pin.it/1LfeR54B5'
];

async function resolveUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        resolve(url);
      }
    }).on('error', reject);
  });
}

async function run() {
  for (const url of urls) {
    try {
      const loc = await resolveUrl(url);
      console.log(url, " -> ", loc);
    } catch (e) {
      console.error(url, e.message);
    }
  }
}
run();
