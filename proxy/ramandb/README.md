# Raman database proxy

The phonon page shows the Raman spectrum of Materials Project entries from the
[Computational Raman Database](https://ramandb.oulu.fi/) (M. Bagheri and
H.-P. Komsa, Sci. Data 10, 80 (2023), CC BY 4.0). Its server does not send CORS
headers, so the browser fetches the tensors through this Cloudflare Worker.

It only forwards `GET /mp-<id>` to
`https://ramandb.oulu.fi/figs/tensors_yaml/mp-<id>.yaml`, adds
`Access-Control-Allow-Origin: *`, and caches each file for a week.

## Deploy

    cd proxy/ramandb
    npx wrangler login
    npx wrangler deploy

Then set `RAMANDB_PROXY_URL` in `src/ramandb.js` to the printed
`https://ramandb-proxy.<subdomain>.workers.dev` URL and rebuild. While it is
empty no request is made and the page behaves as before.

If ramandb.oulu.fi starts sending CORS headers, point `RAMANDB_PROXY_URL` at a
URL that maps `/mp-<id>` to the tensor file directly and drop the worker.
