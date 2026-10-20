import { parse } from "node-html-parser";

const BASE = "https://otakudesu.blog";
function respond(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type, Accept",
    "cache-control": "public, max-age=60, s-maxage=300"
  }});
}
const ok = data => ({ statusCode: 200, message: "OK", data });
async function getDocument(path) {
  const res = await fetch(new URL(path, BASE), { headers: {
    "user-agent": "Mozilla/5.0 (compatible; AniFlixAPI/1.0)",
    "referer": BASE + "/", "accept": "text/html,application/xhtml+xml"
  }, cf: { cacheTtl: 300, cacheEverything: true }});
  if (!res.ok) throw new Error(`Sumber anime merespons HTTP ${res.status}`);
  return parse(await res.text(), { parseNoneClosedTags: true });
}
function absolute(value) { try { return value ? new URL(value, BASE).href : ""; } catch { return ""; } }
function txt(node) { return (node?.textContent || "").replace(/\s+/g, " ").trim(); }
function card(node) {
  const a = node.querySelector("a"), img = node.querySelector("img"), href = a?.getAttribute("href") || "";
  return { title: txt(node.querySelector(".jdlflm") || node.querySelector("h2") || a),
    animeId: href ? (new URL(href, BASE).pathname.split("/").filter(Boolean).pop() || "") : "",
    poster: absolute(img?.getAttribute("src") || img?.getAttribute("data-src") || ""),
    url: absolute(href), episode: txt(node.querySelector(".epz") || node.querySelector(".epztipe")),
    releasedOn: txt(node.querySelector(".newnime")) };
}
function animeCards(doc) {
  for (const selector of [
    ".venz .detpost", ".detpost", ".venser .detpost",
    ".chivsrc .detpost", ".search-list .detpost", ".searchlist .detpost",
    ".isi .detpost", ".anime-list .detpost"
  ]) {
    const nodes = doc.querySelectorAll(selector);
    if (nodes.length) {
      const result = nodes.map(card).filter(item => item.title && item.animeId);
      if (result.length) return uniqueAnime(result);
    }
  }
  // Fallback for search pages whose result cards do not use .detpost.
  const found = [];
  for (const a of doc.querySelectorAll('a[href*="/anime/"]')) {
    const href = a.getAttribute("href") || "";
    const title = txt(a);
    if (!title || !href) continue;
    let parent = a.parentNode;
    let chosen = null;
    for (let depth = 0; parent && depth < 5; depth++, parent = parent.parentNode) {
      if (parent.querySelector && parent.querySelector("img")) { chosen = parent; break; }
    }
    const item = chosen ? card(chosen) : {
      title, animeId: (new URL(href, BASE).pathname.split("/").filter(Boolean).pop() || ""),
      poster: "", url: absolute(href), episode: "", releasedOn: ""
    };
    if (!item.title) item.title = title;
    if (!item.animeId) item.animeId = new URL(href, BASE).pathname.split("/").filter(Boolean).pop() || "";
    if (!item.url) item.url = absolute(href);
    if (item.animeId) found.push(item);
  }
  return uniqueAnime(found);
}
function uniqueAnime(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.animeId || item.url || item.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function scheduleItems(doc) {
  // Otakudesu has used more than one wrapper for its weekday schedule.
  const selectors = [
    ".kglist321 .kglist", ".kglist321", ".kglist", ".schedule .jadwal",
    ".schedule .kotakjadwal", ".schedule li", ".jadwal-rilis .jadwal",
    ".rapi .kglist", ".rapi", ".schedule", ".jadwal"
  ];
  for (const selector of selectors) {
    const nodes = doc.querySelectorAll(selector);
    if (!nodes.length) continue;
    const list = nodes.map(node => {
      const heading = node.querySelector("h2") || node.querySelector("h3") || node.querySelector("strong") || node.querySelector("b");
      const animeList = node.querySelectorAll('a[href*="/anime/"]').map(a => {
        const href = a.getAttribute("href") || "";
        return { title: txt(a), url: absolute(href), animeId: href ? (new URL(href, BASE).pathname.split("/").filter(Boolean).pop() || "") : "" };
      }).filter(x => x.title && x.animeId);
      return { day: txt(heading), animeList: uniqueAnime(animeList).map(x => ({ title: x.title, url: x.url, animeId: x.animeId })) };
    }).filter(x => x.animeList.length);
    if (list.length) {
      const seen = new Set();
      return list.filter(x => { const k = x.day + "|" + x.animeList.map(a => a.animeId).join(","); if (seen.has(k)) return false; seen.add(k); return true; });
    }
  }
  return [];
}
async function handle(path, url) {
  if (path === "/otakudesu") return ok({ routes: ["/otakudesu/home", "/otakudesu/schedule", "/otakudesu/ongoing?page=1", "/otakudesu/completed?page=1", "/otakudesu/search?q=naruto", "/otakudesu/anime/{animeId}", "/otakudesu/episode/{episodeId}"] });
  if (path === "/otakudesu/home") {
    const doc = await getDocument("/");
    const animeList = doc.querySelectorAll(".venz .detpost").map(card).filter(item => item.title);
    return ok({ ongoing: { animeList }, completed: { animeList: [] } });
  }
  if (path === "/otakudesu/ongoing" || path === "/otakudesu/completed") {
    const page = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
    const completed = path.endsWith("/completed");
    const sourcePath = completed ? (page > 1 ? `/complete-anime/page/${page}/` : "/complete-anime/") : (page > 1 ? `/ongoing-anime/page/${page}/` : "/ongoing-anime/");
    return ok({ animeList: animeCards(await getDocument(sourcePath)) });
  }
  if (path === "/otakudesu/search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return { statusCode: 400, message: "Parameter q wajib diisi", data: null, _status: 400 };
    return ok({ animeList: animeCards(await getDocument(`/?s=${encodeURIComponent(q)}&post_type=anime`)) });
  }
  const am = path.match(/^\/otakudesu\/anime\/([a-zA-Z0-9_-]+)$/);
  if (am) {
    const id = am[1], doc = await getDocument(`/anime/${encodeURIComponent(id)}/`);
    const title = txt(doc.querySelector("h1.entry-title") || doc.querySelector("h1"));
    const poster = absolute(doc.querySelector(".fotoanime img")?.getAttribute("src") || "");
    const synopsis = txt(doc.querySelector(".sinopc") || doc.querySelector(".entry-content"));
    const genreList = doc.querySelectorAll(".infozingle a").map(a => ({ title: txt(a), genreId: (a.getAttribute("href") || "").split("/").filter(Boolean).pop() || "" })).filter(x => x.title);
    const episodeList = doc.querySelectorAll(".episodelist ul li").map(li => { const a = li.querySelector("a"), href = a?.getAttribute("href") || ""; return { title: txt(a), episodeId: href ? (new URL(href, BASE).pathname.split("/").filter(Boolean).pop() || "") : "", url: absolute(href) }; }).filter(x => x.title);
    return ok({ details: { title: title || id, animeId: id, poster, synopsis, genreList, episodeList } });
  }
  const em = path.match(/^\/otakudesu\/episode\/([a-zA-Z0-9_-]+)$/);
  if (em) {
    const id = em[1], doc = await getDocument(`/episode/${encodeURIComponent(id)}/`);
    const title = txt(doc.querySelector("h1.posttl") || doc.querySelector("h1"));
    const downloads = doc.querySelectorAll(".download ul li").map(li => ({ quality: txt(li.querySelector("strong")), links: li.querySelectorAll("a").map(a => ({ title: txt(a), url: a.getAttribute("href") || "" })) }));
    return ok({ details: { title, episodeId: id, downloads } });
  }
  if (path === "/otakudesu/schedule") {
    const doc = await getDocument("/jadwal-rilis/");
    const scheduleList = scheduleItems(doc);
    return ok({ scheduleList });
  }
  return null;
}
export default { async fetch(request) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "Content-Type, Accept", "access-control-max-age": "86400" }});
  if (request.method !== "GET") return respond({ statusCode: 405, message: "Method not allowed", data: null }, 405);
  try {
    const path = url.pathname.replace(/\/+$/, "") || "/", result = await handle(path, url);
    if (!result) return respond({ statusCode: 404, message: "Endpoint tidak ditemukan", data: null }, 404);
    const status = result._status || 200; delete result._status;
    return respond(result, status);
  } catch (error) {
    return respond({ statusCode: 502, message: error instanceof Error ? error.message : "Gagal mengambil data sumber anime", data: null }, 502);
  }
}};
