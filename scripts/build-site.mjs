import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "https://afriscopemedia.github.io/asm").replace(/\/$/, "");
const parsedSiteUrl = new URL(PUBLIC_SITE_URL);
if (parsedSiteUrl.hostname === "afriscopemedia.github.io" && parsedSiteUrl.pathname !== "/asm") {
  throw new Error(`PUBLIC_SITE_URL doit être https://afriscopemedia.github.io/asm pour ce dépôt (valeur reçue: ${PUBLIC_SITE_URL})`);
}
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY sont requis pour générer les pages SEO.");

const index = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
const config = `window.AFRISCOPE_CONFIG=${JSON.stringify({
  supabaseUrl: SUPABASE_URL,
  supabaseProjectRef: SUPABASE_URL.split(".")[0].split("//")[1] || "",
  supabasePublishableKey: SUPABASE_KEY,
  publicSiteUrl: PUBLIC_SITE_URL
})};`;

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(DIST, { recursive: true });
await fs.cp(path.join(ROOT, "index.html"), path.join(DIST, "index.html"));
await fs.writeFile(path.join(DIST, "config.js"), config + "\n");
await fs.copyFile(path.join(ROOT, "robots.txt"), path.join(DIST, "robots.txt"));

const api = `${SUPABASE_URL}/rest/v1/site_data?id=eq.main&select=data`;
const response = await fetch(api, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${await response.text()}`);
const rows = await response.json();
const db = rows?.[0]?.data;
if (!db) throw new Error("site_data/main introuvable.");

const articles = (db.articles || []).filter(a => !a.deletedAt && a.status === "published");
const categories = db.categories || [];
const authors = db.authors || [];
const authorName = id => authors.find(a => a.id === id)?.name || "AfriScope Media";
const catName = id => categories.find(c => c.id === id)?.name || id;
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const strip = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const htmlShell = (a) => {
  const title = `${a.title} | AfriScope Media`;
  const description = strip(a.excerpt || a.content).slice(0, 160);
  const url = `${PUBLIC_SITE_URL}/article/${encodeURIComponent(a.slug)}/`;
  const image = a.image || "";
  let html = index;
  html = html.replace(/<script src="\.\/config\.js"><\/script>/, `<script src="${esc(PUBLIC_SITE_URL)}/config.js"></script>`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`);
  html = html.replace(/<link rel="canonical" id="canonicalLink" href="">/, `<link rel="canonical" id="canonicalLink" href="${esc(url)}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`);
  html = html.replace(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="article">`);
  html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(image)}">`);
  html = html.replace(/<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${esc(a.title)}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(title)}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(description)}">`);
  html = html.replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(image)}">`);
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    "@context":"https://schema.org","@type":"NewsArticle","headline":a.title,"description":description,
    "image":image ? [image] : [],"datePublished":a.publishAt,"dateModified":a.publishAt,
    "author":{"@type":"Person","name":authorName(a.author)},
    "publisher":{"@type":"Organization","name":"AfriScope Media","url":PUBLIC_SITE_URL},
    "mainEntityOfPage":{"@type":"WebPage","@id":url}
  }).replace(/</g,"\\u003c")}</script>`;
  return html.replace("</head>", `${jsonld}</head>`);
};

for (const a of articles) {
  const dir = path.join(DIST, "article", a.slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), htmlShell(a));
}

const urls = [PUBLIC_SITE_URL + "/"];
for (const a of articles) urls.push(`${PUBLIC_SITE_URL}/article/${encodeURIComponent(a.slug)}/`);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
await fs.writeFile(path.join(DIST, "sitemap.xml"), sitemap);
await fs.copyFile(path.join(ROOT, "404.html"), path.join(DIST, "404.html"));
console.log(`Build SEO terminée: ${articles.length} article(s), sitemap généré.`);
