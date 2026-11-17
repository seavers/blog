#!/usr/bin/env node
/**
 * 大海Online 博客静态站点构建脚本（替代 Jekyll）
 *
 * 输入：_posts/*.markdown、pages/*、home/works.json、site.json、static/、uploads/
 * 输出：_deploy/（增量更新，内容未变的文件保留修改时间；nginx 以 /blog 别名指向该目录；home/index.html 由 deploy.sh 复制到站点根目录）
 *
 * 保持与旧 Jekyll 站点一致的 URL：
 *   /blog/YYYY-MM-DD-slug.html（日期取 front matter 的 date）
 *   /blog/categories/<slug>/  /blog/tag/<slug>/  /blog/page/N/  /blog/archives.html
 *   /blog/atom.xml  /blog/sitemap.xml  /blog/llms.txt  /blog/about.html  /blog/link.html
 *
 * 用法：node tools/build.mjs [输出目录，默认 _deploy]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Marked } from 'marked';
import hljs from 'highlight.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || '_deploy');
if (OUT === ROOT || ROOT.startsWith(OUT + path.sep) || OUT === path.parse(OUT).root) throw new Error(`输出目录不安全：${OUT}`);
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
const BASE = site.baseurl;

// 输出必须是确定性的：同样的输入每次生成完全相同的字节，未变化的文件才能保持原修改时间。
// 因此不使用“构建时间”，改用静态资源内容哈希和最新文章日期。
const ASSET_VER = crypto.createHash('sha1')
  .update(fs.readFileSync(path.join(ROOT, 'static', 'site.css')))
  .update(fs.readFileSync(path.join(ROOT, 'static', 'site.js')))
  .digest('hex').slice(0, 10);
let SITE_UPDATED = ''; // 最新文章的 ISO 时间，main() 中赋值
let SITE_YEAR = '';

// ---------------------------------------------------------------- 工具函数
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cdata = (s) => String(s).replace(/]]>/g, ']]]]><![CDATA[>');
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
const stripHtml = (s) => String(s).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const truncate = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);
const absUrl = (p) => site.url + p;

// ---------------------------------------------------------------- 增量输出
// 直接在 _deploy 中原地更新：内容相同的文件不碰（保留修改时间），有变化的先写临时文件再 rename（原子替换，
// nginx 不会读到半个文件），本次没有生成的旧文件在最后删除。
const outputs = new Set();
const stats = { changed: 0, unchanged: 0, removed: 0 };

function replaceAtomically(file, writeTmp) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeTmp(tmp);
  fs.renameSync(tmp, file);
  stats.changed++;
}

function write(rel, content) {
  const file = path.join(OUT, rel);
  outputs.add(file);
  const buf = Buffer.from(content);
  try {
    if (fs.readFileSync(file).equals(buf)) { stats.unchanged++; return; }
  } catch { /* 文件不存在 */ }
  replaceAtomically(file, (tmp) => fs.writeFileSync(tmp, buf));
}

/** 复制静态文件：大小和修改时间都与源一致即视为未变；否则比对内容，确实不同才复制（保留源文件的修改时间） */
function copyFile(src, rel) {
  const file = path.join(OUT, rel);
  outputs.add(file);
  const s = fs.statSync(src);
  try {
    const d = fs.statSync(file);
    if (d.size === s.size && (Math.trunc(d.mtimeMs) === Math.trunc(s.mtimeMs) || fs.readFileSync(file).equals(fs.readFileSync(src)))) {
      stats.unchanged++;
      return;
    }
  } catch { /* 文件不存在 */ }
  replaceAtomically(file, (tmp) => { fs.copyFileSync(src, tmp); fs.utimesSync(tmp, s.atime, s.mtime); });
}

function copyDir(src, relDir) {
  if (!fs.existsSync(src)) return;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const from = path.join(src, ent.name);
    const rel = path.join(relDir, ent.name);
    if (ent.isDirectory()) copyDir(from, rel);
    else if (ent.isFile()) copyFile(from, rel);
  }
}

/** 删除本次构建没有产出的文件（文章删除/改名、分类变化等），并清掉空目录 */
function removeStale(dir = OUT) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      removeStale(p);
      if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
    } else if (!outputs.has(p)) {
      fs.rmSync(p, { force: true });
      stats.removed++;
    }
  }
}

/** 解析 front matter（只支持本站用到的 YAML 子集：标量、"- 项" 列表、[a, b] 行内列表） */
function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  let listKey = null;
  const unquote = (v) => {
    v = v.trim();
    if (/^".*"$/.test(v)) return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
    return v;
  };
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && listKey) { const v = unquote(item[1]); if (v) data[listKey].push(v); continue; }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    const value = raw.trim();
    if (value === '') { data[key] = []; listKey = key; continue; }
    listKey = null;
    if (/^\[.*\]$/.test(value)) data[key] = value.slice(1, -1).split(',').map(unquote).filter(Boolean);
    else data[key] = unquote(value);
  }
  return { data, body: src.slice(m[0].length) };
}

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => String(x).trim()).filter(Boolean);

/** "2013-11-28 16:50:01 +0800" → { ymd, iso, date } */
function parseDate(raw, fallbackYmd) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(?:([+-])(\d{2}):?(\d{2}))?/);
  const [y, mo, d] = m ? [m[1], m[2], m[3]] : fallbackYmd.split('-');
  const hh = (m?.[4] || '0').padStart(2, '0'), mi = m?.[5] || '00', ss = m?.[6] || '00';
  const tz = m?.[7] ? `${m[7]}${m[8]}:${m[9]}` : '+08:00';
  const iso = `${y}-${mo}-${d}T${hh}:${mi}:${ss}${tz}`;
  return { ymd: `${y}-${mo}-${d}`, y, mo, d, iso, date: new Date(iso) };
}

// ---------------------------------------------------------------- Markdown
const marked = new Marked({
  gfm: true,
  breaks: true, // 与旧 kramdown GFM 的 hard_wrap 行为一致：段落内换行即 <br>
  renderer: {
    code({ text, lang }) {
      const language = (lang || '').trim().split(/\s+/)[0].toLowerCase();
      const known = language && hljs.getLanguage(language);
      const html = known ? hljs.highlight(text, { language, ignoreIllegals: true }).value : esc(text);
      return `<pre><code class="hljs${known ? ' language-' + esc(language) : ''}">${html}\n</code></pre>\n`;
    },
    heading({ tokens, depth, text }) {
      const inner = this.parser.parseInline(tokens);
      const id = slugify(stripHtml(text)) || 'section';
      return `<h${depth} id="${esc(id)}">${inner}</h${depth}>\n`;
    },
  },
});

const renderMarkdown = (src) => marked.parse(src);

/**
 * 旧文（iteye / CSDN 粘贴）内联样式里的硬编码颜色改写为 CSS 变量，原色作为回退值：
 *   style="color: #0000ff"  →  style="color: var(--lg-c-0000ff, #0000ff)"
 * 亮色模式下显示不变，暗色模式由 site.css 把这些变量映射到站点配色，避免黑字落在深色背景上。
 */
function themeInlineColors(html) {
  return html.replace(/\sstyle="([^"]*)"/gi, (attr, style) => {
    const themed = style.replace(/(^|;)(\s*)(background-color|background|color)(\s*:\s*)#([0-9a-f]{6}|[0-9a-f]{3})\b/gi,
      (m, sep, sp, prop, colon, hex) => {
        hex = hex.toLowerCase();
        if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
        const kind = prop.toLowerCase() === 'color' ? 'c' : 'bg';
        return `${sep}${sp}${prop}${colon}var(--lg-${kind}-${hex}, #${hex})`;
      });
    return ` style="${themed}"`;
  });
}
const applyVars = (src) => src.replace(/\{\{\s*site\.baseurl\s*\}\}/g, BASE).replace(/\{\{\s*site\.url\s*\}\}/g, site.url);

// ---------------------------------------------------------------- 读取文章
function loadPosts() {
  const dir = path.join(ROOT, '_posts');
  const posts = [];
  for (const file of fs.readdirSync(dir)) {
    const fm = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.(markdown|md)$/);
    if (!fm) continue;
    const { data, body } = parseFrontMatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (data.published === 'false') continue;
    const date = parseDate(data.date, fm[1]);
    const slug = fm[2];
    const md = applyVars(body);
    const html = themeInlineColors(renderMarkdown(md));
    const moreAt = md.indexOf('<!--more-->');
    const excerptMd = moreAt > -1 ? md.slice(0, moreAt) : md.split(/\r?\n\s*\r?\n/).find((p) => p.trim()) || '';
    posts.push({
      file, slug, date,
      title: data.title || slug,
      categories: asList(data.categories),
      tags: asList(data.tags),
      url: `${BASE}/${date.ymd}-${slug}.html`,
      html,
      summary: truncate(stripHtml(renderMarkdown(excerptMd)), 120),
    });
  }
  posts.sort((a, b) => b.date.date - a.date.date || b.file.localeCompare(a.file));
  posts.forEach((p, i) => { p.newer = posts[i - 1]; p.older = posts[i + 1]; });
  return posts;
}

/** 按 slug 聚合分类 / 标签；显示名取出现次数最多的写法 */
function groupBy(posts, field) {
  const map = new Map();
  for (const p of posts) {
    for (const name of new Set(p[field])) {
      const slug = slugify(name);
      if (!slug) continue;
      if (!map.has(slug)) map.set(slug, { slug, names: {}, posts: [] });
      const g = map.get(slug);
      g.names[name] = (g.names[name] || 0) + 1;
      g.posts.push(p);
    }
  }
  for (const g of map.values()) g.name = Object.entries(g.names).sort((a, b) => b[1] - a[1])[0][0];
  return [...map.values()].sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- 模板
const ICON = {
  waves: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 20h16"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16l13-8z"/></svg>',
};

function layout({ title, description, canonical, body, active, home = false, head = '' }) {
  const fullTitle = title ? `${title} - ${site.title}` : site.title;
  const navItem = (key, label, href, cls = '') => {
    if (home && (key === 'works' || key === 'posts')) return `<button type="button" data-go="${key}">${label}</button>`;
    return `<a${cls ? ` class="${cls}"` : ''} href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  };
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || site.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(title || site.title)}">
<meta property="og:url" content="${esc(canonical)}">
<link rel="icon" href="/favicon.ico">
<link rel="alternate" type="application/atom+xml" title="${esc(site.title)}" href="${BASE}/atom.xml">
<link rel="stylesheet" href="${BASE}/static/site.css?v=${ASSET_VER}">
${head}</head>
<body>
<header class="topbar">
  <div class="wrap">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">${ICON.waves}</span>${esc(site.brand)}</a>
    <nav class="nav" aria-label="站点导航">
      ${navItem('works', '作品', '/#works')}
      ${navItem('posts', '文章', `${BASE}/`)}
      ${navItem('about', '关于', `${BASE}/about.html`, 'hide-sm')}
      <a class="hide-sm" href="${BASE}/atom.xml">RSS</a>
    </nav>
  </div>
</header>
${body}
<footer>
  <div class="wrap">
    <span>&copy; ${SITE_YEAR} ${esc(site.brand)} · <a href="${BASE}/">文章</a> · <a href="${BASE}/archives.html">归档</a> · <a href="${BASE}/atom.xml">RSS</a></span>
    <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">${esc(site.icp)}</a>
  </div>
</footer>
<script src="${BASE}/static/site.js?v=${ASSET_VER}" defer></script>
<script async src="https://hm.baidu.com/hm.js?${site.baiduTongji}"></script>
</body>
</html>
`;
}

const catLink = (name) => `${BASE}/categories/${slugify(name)}/`;
const tagLink = (name) => `${BASE}/tag/${slugify(name)}/`;
const fmtDay = (d) => `${d.y} 年 ${Number(d.mo)} 月 ${Number(d.d)} 日`;

/** 按年份分组的文章列表；withSummary 时附摘要 */
function postList(posts, { withSummary = false } = {}) {
  const years = new Map();
  for (const p of posts) {
    if (!years.has(p.date.y)) years.set(p.date.y, []);
    years.get(p.date.y).push(p);
  }
  let html = '<div id="post-list">\n';
  for (const [y, items] of years) {
    html += `<section class="year" data-year="${y}">\n<h2>${y}</h2>\n<ul class="posts">\n`;
    for (const p of items) {
      const text = [p.title, ...p.categories, ...p.tags].join(' ');
      html += `<li class="post" data-cats="${esc(p.categories.join('|'))}" data-text="${esc(text)}"><a href="${p.url}">`
        + `<span class="t">${esc(p.title)}</span>`
        + `<time class="d" datetime="${p.date.iso}">${p.date.mo}-${p.date.d}</time>`
        + (withSummary && p.summary ? `<span class="x">${esc(p.summary)}</span>` : '')
        + (p.categories.length ? `<span class="m">${p.categories.map((c) => `<i>#${esc(c)}</i>`).join('')}</span>` : '')
        + '</a></li>\n';
    }
    html += '</ul>\n</section>\n';
  }
  return html + '</div>\n';
}

const searchBox = (withChips = true) => `<div class="toolbar">
  <label class="search">${ICON.search}<input id="q" type="search" placeholder="搜索文章标题、分类或标签" autocomplete="off" aria-label="搜索文章"></label>
  ${withChips ? '<div class="chips" id="chips" role="group" aria-label="按分类筛选"></div>' : ''}
</div>`;
const emptyHint = '<p class="empty" id="empty" hidden>没有找到匹配的文章，换个关键词试试。</p>';

// ---------------------------------------------------------------- 页面
function renderWorks(works, postsBySlug) {
  return works.map((w) => {
    const post = postsBySlug.get(w.post);
    const icon = w.icon.img
      ? `<div class="icon" aria-hidden="true"><img src="${esc(w.icon.img.replace('{base}', BASE))}" alt="" loading="lazy"></div>`
      : `<div class="icon" style="background:linear-gradient(135deg,${esc(w.icon.gradient)})" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${w.icon.svg}</svg></div>`;
    const actions = w.actions.map((a) => {
      const href = a.post ? post?.url : a.href.replace('{base}', BASE);
      if (!href) throw new Error(`作品 ${w.name} 的链接找不到对应文章：${w.post}`);
      return `<a class="btn${a.primary ? ' primary' : ''}" href="${esc(href)}">${a.kind ? ICON[a.kind] : ''}${esc(a.label)}</a>`;
    }).join('\n          ');
    return `
      <article class="work${w.featured ? ' featured' : ''}">
        <div class="work-head">
          ${icon}
          <div><h3>${esc(w.name)}</h3><div class="tags">${w.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
        </div>
        <p>${esc(w.desc)}</p>
        <ul class="feats">${w.feats.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <div class="actions">
          ${actions}
        </div>
      </article>`;
  }).join('\n');
}

function buildHome(posts, works) {
  const postsBySlug = new Map(posts.map((p) => [`${p.file.replace(/\.(markdown|md)$/, '')}`, p]));
  const firstYear = posts[posts.length - 1].date.y;
  const body = `
<section class="hero">
  <div class="wrap">
    <p class="eyebrow">${esc(site.subtitle)}</p>
    <h1>写点小工具，也写点笔记。</h1>
    <p class="lead">我是大海。这里放着我业余做的独立作品，覆盖 Mac、鸿蒙、Android 和网页；还有从 ${firstYear} 年写到现在的技术博客。</p>
    <div class="stats">
      <div><b>${works.length}</b>件独立作品</div>
      <div><b>${posts.length}</b>篇文章</div>
      <div><b>${firstYear}</b>开始写博客</div>
    </div>
  </div>
</section>
<main class="wrap">
  <div class="tabs" role="tablist" aria-label="内容分区">
    <button class="tab" role="tab" id="tab-works" aria-controls="works" data-go="works">作品展示<small>${works.length}</small></button>
    <button class="tab" role="tab" id="tab-posts" aria-controls="posts" data-go="posts">文章列表<small>${posts.length}</small></button>
  </div>
  <section id="works" role="tabpanel" aria-labelledby="tab-works">
    <div class="works">${renderWorks(works, postsBySlug)}
    </div>
    <p class="note">每件作品都有一篇文章，讲它为什么做、怎么做。更多内容见 <a href="#posts" data-go="posts">文章列表</a>。</p>
  </section>
  <section id="posts" role="tabpanel" aria-labelledby="tab-posts" hidden>
    ${searchBox()}
    ${postList(posts)}
    ${emptyHint}
    <p class="more">也可以按 <a href="${BASE}/archives.html">归档</a> 或 <a href="${BASE}/">文章页</a> 浏览。</p>
  </section>
</main>`;
  write('home/index.html', layout({
    title: '', home: true, body, canonical: `${site.url}/`,
    description: `${site.brand} 的个人主页：${works.map((w) => w.name).join('、')}等独立作品，以及 ${firstYear} 年至今的技术博客文章。`,
  }));
}

function listPage({ rel, title, eyebrow, lead, posts, canonicalPath, active = 'posts', chips = '', search = true, withSummary = false, pager = '' }) {
  const body = `
<section class="hero compact">
  <div class="wrap">
    <p class="eyebrow">${eyebrow}</p>
    <h1>${esc(title)}</h1>
    ${lead ? `<p class="lead">${lead}</p>` : ''}
  </div>
</section>
<main class="wrap">
  ${search ? searchBox(!chips) : ''}
  ${chips}
  ${postList(posts, { withSummary })}
  ${search ? emptyHint : ''}
  ${pager}
</main>`;
  write(rel, layout({ title, body, active, canonical: absUrl(canonicalPath), description: lead ? stripHtml(lead) : undefined }));
}

function chipLinks(groups, base, currentSlug) {
  return `<div class="chips" style="margin-bottom:28px">${groups.map((g) =>
    `<a class="chip" href="${base}${encodeURI(g.slug)}/"${g.slug === currentSlug ? ' aria-current="page"' : ''}>${esc(g.name)}<span>${g.posts.length}</span></a>`).join('')}</div>`;
}

function buildLists(posts, categories, tags) {
  const firstYear = posts[posts.length - 1].date.y;
  listPage({
    rel: 'index.html', title: '文章', eyebrow: `${posts.length} 篇 · ${firstYear} 至今`, posts, canonicalPath: `${BASE}/`,
    lead: '从 iteye 时代的 Java 笔记，到 macOS 和鸿蒙上的独立开发。可以搜索，也可以按分类筛选。',
  });
  // 归档与 /blog/ 是同一批文章的两种列表，canonical 统一指向 /blog/，sitemap 只收录 /blog/
  listPage({
    rel: 'archives.html', title: '归档', eyebrow: `${posts.length} 篇文章`, posts, canonicalPath: `${BASE}/`,
    search: false, chips: chipLinks(categories, `${BASE}/categories/`),
  });

  // 分页：/blog/page/2/ ...（第 1 页即 /blog/）
  const per = site.paginate;
  const pages = Math.ceil(posts.length / per);
  for (let n = 2; n <= pages; n++) {
    const prev = n === 2 ? `${BASE}/` : `${BASE}/page/${n - 1}/`;
    const next = n < pages ? `${BASE}/page/${n + 1}/` : '';
    listPage({
      rel: `page/${n}/index.html`, title: `文章 · 第 ${n} 页`, eyebrow: `第 ${n} / ${pages} 页`,
      posts: posts.slice((n - 1) * per, n * per), canonicalPath: `${BASE}/page/${n}/`, search: false, withSummary: true,
      pager: `<nav class="pager"><a class="btn" href="${prev}">← 较新</a>${next ? `<a class="btn" href="${next}">较早 →</a>` : '<span></span>'}</nav>`,
    });
  }

  for (const g of categories) {
    listPage({
      rel: `categories/${g.slug}/index.html`, title: g.name, eyebrow: `<a href="${BASE}/archives.html">分类</a> · ${g.posts.length} 篇`,
      posts: g.posts, canonicalPath: `${BASE}/categories/${encodeURI(g.slug)}/`, search: false, withSummary: true,
      chips: chipLinks(categories, `${BASE}/categories/`, g.slug),
    });
  }
  for (const g of tags) {
    listPage({
      rel: `tag/${g.slug}/index.html`, title: `#${g.name}`, eyebrow: `标签 · ${g.posts.length} 篇`,
      posts: g.posts, canonicalPath: `${BASE}/tag/${encodeURI(g.slug)}/`, search: false, withSummary: true,
    });
  }
}

function buildPost(p) {
  const neighbor = (q, cls, label) => (q ? `<a class="${cls}" href="${q.url}"><small>${label}</small><span>${esc(q.title)}</span></a>` : '');
  const tagsHtml = p.tags.length
    ? `<div class="tags">${p.tags.map((t) => `<a class="tag" href="${tagLink(t)}">#${esc(t)}</a>`).join('')}</div>` : '';
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.date.iso,
    author: { '@type': 'Person', name: site.author }, mainEntityOfPage: absUrl(p.url), keywords: [...p.categories, ...p.tags].join(','),
  };
  const body = `
<main class="wrap narrow">
  <header class="post-head">
    <p class="eyebrow">${p.categories.map((c) => `<a href="${catLink(c)}">${esc(c)}</a>`).join(' · ') || '文章'}</p>
    <h1>${esc(p.title)}</h1>
    <div class="meta"><time datetime="${p.date.iso}">${fmtDay(p.date)}</time>${tagsHtml}</div>
  </header>
  <article class="prose">
${p.html}
  </article>
  <footer class="post-foot">
    <nav class="neighbors" aria-label="相邻文章">
      ${neighbor(p.older, 'prev', '← 上一篇')}
      ${neighbor(p.newer, 'next', '下一篇 →')}
    </nav>
    <p class="more"><a href="${BASE}/">← 返回文章列表</a></p>
  </footer>
</main>`;
  write(p.url.slice(BASE.length + 1), layout({
    title: p.title, body, active: 'posts', canonical: absUrl(p.url), description: p.summary,
    head: `<meta property="og:type" content="article">\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n`,
  }));
}

function buildPages() {
  const dir = path.join(ROOT, 'pages');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const m = file.match(/^(.+)\.(md|markdown|html)$/);
    if (!m) continue;
    const { data, body } = parseFrontMatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    const src = applyVars(body);
    const html = m[2] === 'html' ? src : renderMarkdown(src);
    const url = `${BASE}/${m[1]}.html`;
    write(`${m[1]}.html`, layout({
      title: data.title, active: m[1], canonical: absUrl(url), description: data.description,
      body: `
<main class="wrap narrow">
  <header class="post-head"><h1>${esc(data.title)}</h1></header>
  <article class="prose">
${html}
  </article>
</main>`,
    }));
  }
}

// ---------------------------------------------------------------- 订阅与索引
function buildFeeds(posts, works) {
  const expand = (html) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${site.url}/`);
  write('atom.xml', `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title><![CDATA[${cdata(site.title)}]]></title>
  <link href="${site.url}${BASE}/atom.xml" rel="self"/>
  <link href="${site.url}/"/>
  <updated>${SITE_UPDATED}</updated>
  <id>${site.url}/</id>
  <author>
    <name><![CDATA[${cdata(site.author)}]]></name>
  </author>
${posts.slice(0, 200).map((p) => `  <entry>
    <title type="html"><![CDATA[${cdata(p.title)}]]></title>
    <link href="${absUrl(p.url)}"/>
    <updated>${p.date.iso}</updated>
    <id>${site.url}/${esc(p.slug)}</id>
    <content type="html"><![CDATA[${cdata(expand(p.html))}]]></content>
  </entry>`).join('\n')}
</feed>
`);

  const urlEntry = (loc, lastmod, freq, prio) => `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`;
  const now = SITE_UPDATED;
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[
    urlEntry(`${site.url}/`, now, 'daily', '1.0'),
    urlEntry(`${site.url}${BASE}/`, now, 'daily', '0.9'),
    ...posts.map((p) => urlEntry(absUrl(p.url), p.date.iso, 'monthly', '0.8')),
  ].join('\n')}
</urlset>
`);

  const postsBySlug = new Map(posts.map((p) => [p.file.replace(/\.(markdown|md)$/, ''), p]));
  write('llms.txt', `# ${site.title}

> ${site.subtitle}

${site.description}

## 独立作品

${works.map((w) => `- [${w.name}](${absUrl(postsBySlug.get(w.post)?.url || '/')}): ${w.desc}`).join('\n')}

## 博文目录

${posts.map((p) => `- [${p.title}](${absUrl(p.url)}): ${p.date.ymd}`).join('\n')}

## 站点地图与资源
- [首页](${site.url}/): 作品展示与文章列表
- [Sitemap](${site.url}/sitemap.xml): 全站 XML 站点地图
- [文章](${site.url}${BASE}/): 全部博文列表，可按分类筛选
- [RSS](${site.url}${BASE}/atom.xml): Atom 订阅
`);
}

// ---------------------------------------------------------------- 主流程
function main() {
  const started = Date.now();
  fs.mkdirSync(OUT, { recursive: true });

  const posts = loadPosts();
  SITE_UPDATED = posts[0].date.iso;
  SITE_YEAR = posts[0].date.y;
  const works = JSON.parse(fs.readFileSync(path.join(ROOT, 'home', 'works.json'), 'utf8'));
  const categories = groupBy(posts, 'categories');
  const tags = groupBy(posts, 'tags');

  buildHome(posts, works);
  buildLists(posts, categories, tags);
  posts.forEach(buildPost);
  buildPages();
  buildFeeds(posts, works);

  copyDir(path.join(ROOT, 'static'), 'static');
  copyDir(path.join(ROOT, 'uploads'), 'uploads');
  copyFile(path.join(ROOT, 'robots.txt'), 'robots.txt');

  removeStale();

  console.log(`[build] ${posts.length} 篇文章，${categories.length} 个分类，${tags.length} 个标签 → ${path.relative(ROOT, OUT) || OUT}`
    + `：更新 ${stats.changed}，未变 ${stats.unchanged}，删除 ${stats.removed}（${Date.now() - started}ms）`);
}

main();
