# AniFlix API — Cloudflare Workers

Fondasi awal API scraper Otakudesu untuk Cloudflare Workers; memakai handler native Workers, bukan Express.

## Endpoint
- `GET /otakudesu`
- `GET /otakudesu/home`
- `GET /otakudesu/schedule`
- `GET /otakudesu/ongoing?page=1`
- `GET /otakudesu/completed?page=1`
- `GET /otakudesu/search?q=naruto`
- `GET /otakudesu/anime/{animeId}`
- `GET /otakudesu/episode/{episodeId}`

## Deploy
1. `npm install`
2. `npx wrangler login`
3. `npm run deploy`

Uji endpoint Worker setelah deploy, lalu atur `API_BASE` frontend ke URL Worker.

## Catatan
Ini port awal, belum mencakup seluruh Wajik API atau endpoint pemilihan server/nonce. Selector HTML dapat perlu penyesuaian jika situs sumber berubah. Endpoint home saat ini belum mengambil daftar completed secara terpisah. Uji respons setelah deploy sebelum menghubungkan frontend.
