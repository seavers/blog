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

/**
 * 文章摘要（用于 meta description 和列表）：取正文文字，跳过标题、代码块和表格；
 * 很多旧文第一行就是标题本身，开头与标题重复的部分去掉，避免 description 等于 title。
 */
function summarize(html, title) {
  let text = stripHtml(html
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<table[\s\S]*?<\/table>/gi, ' '));
  const t = stripHtml(title);
  while (t && text.startsWith(t)) text = text.slice(t.length).replace(/^[\s:：,，.。\-—]+/, '');
  return truncate(text, 120);
}

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
    const title = data.title || slug;
    const summary = (moreAt > -1 && summarize(renderMarkdown(md.slice(0, moreAt)), title)) || summarize(html, title);
    posts.push({
      file, slug, date,
      title,
      categories: asList(data.categories),
      tags: asList(data.tags),
      url: `${BASE}/${date.ymd}-${slug}.html`,
      html,
      summary,
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
  waves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 20h16"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16l13-8z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 9.5 17 19 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>',
  sun: '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></svg>',
  moon: '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z"/></svg>',
};

function layout({ title, description, canonical, body, active, home = false, head = '' }) {
  const fullTitle = title ? `${title} - ${site.title}` : site.title;
  const navItem = (key, label, href, cls = '') => {
    if (home && key === 'works') return `<a href="#works" data-scroll="works">${label}</a>`;
    if (home && key === 'posts') return `<a href="#articles" data-scroll="articles">${label}</a>`;
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
<script>(function(){var r=document.documentElement;r.classList.add('js');try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')r.setAttribute('data-theme',t);}catch(e){}})();</script>
<link rel="stylesheet" href="${BASE}/static/site.css?v=${ASSET_VER}">
${head}</head>
<body>
<header class="topbar">
  <div class="wrap">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">${ICON.waves}</span>${esc(site.brand)}</a>
    <nav class="nav" aria-label="站点导航">
      ${navItem('works', '作品', '/#works')}
      ${navItem('posts', '文章', `${BASE}/`)}
      ${navItem('about', '关于', `${BASE}/about.html`)}
      <a class="hide-sm" href="${BASE}/atom.xml">RSS</a>
      <span class="nav-sep" aria-hidden="true"></span>
      <a class="icon-btn" id="nav-search" href="${BASE}/#search" aria-label="搜索文章" title="搜索文章 (/)">${ICON.search}</a>
      <button type="button" class="icon-btn theme-toggle" id="theme-toggle" aria-label="切换明暗主题" title="切换明暗主题">${ICON.sun}${ICON.moon}</button>
    </nav>
  </div>
</header>
${body}
<button type="button" class="back-top" id="back-top" aria-label="回到顶部" title="回到顶部">${ICON.arrowUp}</button>
<footer>
  <div class="wrap">
    <span>&copy; ${SITE_YEAR} ${esc(site.brand)} · <a href="/">首页</a> · <a href="${BASE}/">文章</a> · <a href="${BASE}/archives.html">归档</a> · <a href="${BASE}/about.html">关于</a> · <a href="${BASE}/atom.xml">RSS</a></span>
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
    html += `<section class="year" data-year="${y}">\n<h2>${y}<small>${items.length} 篇</small></h2>\n<ul class="posts">\n`;
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
  <label class="search">${ICON.search}<input id="q" type="search" placeholder="搜索文章标题、分类或标签" autocomplete="off" aria-label="搜索文章"><kbd class="kbd search-kbd" aria-hidden="true">/</kbd><button type="button" class="search-clear" id="q-clear" aria-label="清除搜索" hidden>${ICON.close}</button></label>
  ${withChips ? '<div class="chips" id="chips" role="group" aria-label="按分类筛选"></div>' : ''}
  <p class="filter-status" id="filter-status" hidden></p>
</div>`;
const emptyHint = '<p class="empty" id="empty" hidden>没有找到匹配的文章，换个关键词试试。</p>';

// ---------------------------------------------------------------- 页面
/** 根据作品 tags 归类平台筛选键 */
function workPlatforms(tags) {
  const joined = tags.join(' ').toLowerCase();
  const res = [];
  if (joined.includes('macos')) res.push('macos');
  if (joined.includes('harmonyos')) res.push('harmony');
  if (joined.includes('android') || joined.includes('html5')) res.push('web');
  return res.join('|');
}

function renderWorks(works, postsBySlug) {
  return works.map((w) => {
    const post = postsBySlug.get(w.post);
    const flatColor = w.icon.gradient ? w.icon.gradient.split(',')[0] : '#006fee';
    const icon = w.icon.img
      ? `<div class="icon" aria-hidden="true"><img src="${esc(w.icon.img.replace('{base}', BASE))}" alt="" loading="lazy"></div>`
      : `<div class="icon" style="background:${esc(flatColor)}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${w.icon.svg}</svg></div>`;
    const actions = w.actions.map((a) => {
      const href = a.post ? post?.url : a.href.replace('{base}', BASE);
      if (!href) throw new Error(`作品 ${w.name} 的链接找不到对应文章：${w.post}`);
      const isExternal = /^https?:\/\//.test(href) || a.kind === 'external' || a.kind === 'play';
      const extra = isExternal ? ' target="_blank" rel="noopener"' : a.kind === 'download' ? ' download' : '';
      return `<a class="btn sm${a.primary ? ' primary' : ''}" href="${esc(href)}"${extra}>${a.kind ? ICON[a.kind] : ''}${esc(a.label)}</a>`;
    }).join('\n          ');
    const platforms = workPlatforms(w.tags);
    if (w.featured) {
      const featuredActions = w.actions.map((a) => {
        const href = a.post ? post?.url : a.href.replace('{base}', BASE);
        const isExternal = /^https?:\/\//.test(href) || a.kind === 'external' || a.kind === 'play';
        const extra = isExternal ? ' target="_blank" rel="noopener"' : a.kind === 'download' ? ' download' : '';
        return `<a class="btn${a.primary ? ' accent' : ''}" href="${esc(href)}"${extra}>${a.kind ? ICON[a.kind] : ''}${esc(a.label)}</a>`;
      }).join('\n            ');
      return `
      <article class="work featured reveal" data-platforms="${esc(platforms)}">
        <div class="featured-grid">
          <div>
            <p class="featured-kicker">${esc(w.tags.slice(0, 2).join(' × '))}</p>
            <h3>${esc(w.name)}</h3>
            <p class="featured-desc">${esc(w.desc)}</p>
            <div class="featured-chips">
              ${w.feats.map((f) => `<span class="featured-chip">${ICON.check}${esc(f)}</span>`).join('\n              ')}
            </div>
            <div class="actions">
              ${featuredActions}
            </div>
          </div>
          <div class="bridge-stage" aria-hidden="true">
            <div class="bridge-devices">
              <div class="dev-mac"><div class="dev-dots"><span></span><span></span><span></span></div><div class="dev-lines"><span></span><span></span></div></div>
              <div class="bridge-link"><span class="bridge-pulse"></span></div>
              <div class="dev-phone"><div class="dev-notch"></div><div class="dev-screen"><span></span></div></div>
            </div>
            <div class="bridge-caps">
              <span class="bridge-cap">⌘⌃V 剪贴板</span>
              <span class="bridge-cap">截屏直达</span>
              <span class="bridge-cap">双向文件</span>
            </div>
          </div>
        </div>
      </article>`;
    }
    const featsHtml = w.feats.map((f) => `<li>${ICON.check}<span>${esc(f)}</span></li>`).join('');
    return `
      <article class="work reveal" data-platforms="${esc(platforms)}">
        <div class="work-head">
          ${icon}
          <div><h3>${esc(w.name)}</h3><div class="tags">${w.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
        </div>
        <p>${esc(w.desc)}</p>
        <ul class="feats">${featsHtml}</ul>
        <div class="actions">
          ${actions}
        </div>
      </article>`;
  }).join('\n');
}

function buildHome(posts, works, categories) {
  const postsBySlug = new Map(posts.map((p) => [`${p.file.replace(/\.(markdown|md)$/, '')}`, p]));
  const firstYear = posts[posts.length - 1].date.y;
  const featuredWork = works.find((w) => w.featured) || works[0];
  const featuredPost = postsBySlug.get(featuredWork.post);
  const recentPosts = posts.slice(0, 5); // 1 篇通栏头条 + 4 篇 2×2 双列，视觉对齐零空缺
  const topCats = categories.slice(0, 14);

  const body = `
<section class="hero hero-home">
  <div class="wrap">
    <a class="hero-pill" href="${esc(featuredPost?.url || '#works')}">
      <span class="hero-pill-dot" aria-hidden="true"></span>
      <span class="hero-pill-tag">${esc(featuredWork.name)}</span>
      <span>Mac 与鸿蒙手机一对一互通</span>
      <span class="hero-pill-arrow" aria-hidden="true">→</span>
    </a>
    <h1>写点小工具，<span class="muted">也写点笔记。</span></h1>
    <p class="lead">我是大海。业余构建 macOS、鸿蒙与 Web 独立工具，并从 ${firstYear} 年至今持续记录技术思考。</p>
    <div class="hero-cta">
      <a class="btn lg primary" href="#works" data-scroll="works">探索独立作品</a>
      <a class="btn lg" href="#posts" data-scroll="articles" data-posts-mode="all">阅读博客文章</a>
    </div>
    <div class="hero-meta">
      <span>${works.length} 件独立作品</span><i>·</i>
      <span>${posts.length} 篇技术文章</span><i>·</i>
      <a href="${BASE}/archives.html">${firstYear} — ${SITE_YEAR}</a>
    </div>
  </div>
</section>
<main class="wrap">
  <section id="works" class="section" aria-labelledby="works-heading">
    <div class="section-head">
      <div>
        <p class="section-kicker">Selected Works</p>
        <h2 id="works-heading">独立作品</h2>
      </div>
      <div class="section-tools">
        <div class="seg" data-seg="works-filter" role="group" aria-label="按平台筛选作品">
          <span class="seg-thumb" aria-hidden="true"></span>
          <button type="button" data-val="all" aria-pressed="true">全部</button>
          <button type="button" data-val="macos" aria-pressed="false">macOS</button>
          <button type="button" data-val="harmony" aria-pressed="false">鸿蒙</button>
          <button type="button" data-val="web" aria-pressed="false">Web / Android</button>
        </div>
      </div>
    </div>
    <div class="works" id="works-grid">${renderWorks(works, postsBySlug)}
    </div>
  </section>

  <section id="articles" class="section" aria-labelledby="articles-heading">
    <div class="section-head">
      <div>
        <p class="section-kicker">Writing</p>
        <h2 id="articles-heading">写作与笔记</h2>
      </div>
      <div class="section-tools">
        <div class="seg" data-seg="posts-mode" role="group" aria-label="文章显示范围">
          <span class="seg-thumb" aria-hidden="true"></span>
          <button type="button" data-val="recent" aria-pressed="true">近期精选</button>
          <button type="button" data-val="all" aria-pressed="false">全部 ${posts.length} 篇</button>
        </div>
        <a class="section-more" href="${BASE}/">独立文章页 →</a>
      </div>
    </div>
    <div id="recent-posts-pane">
      <div class="editorial">
        ${recentPosts.map((p, i) => `<a class="post-card${i === 0 ? ' lead-post' : ''} reveal" href="${p.url}">
          <div>
            <div class="post-card-top"><span class="post-card-cat">${p.categories.map((c) => `#${esc(c)}`).join(' · ') || '文章'}</span><time datetime="${p.date.iso}">${p.date.ymd}</time></div>
            <h3>${esc(p.title)}</h3>
            ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
          </div>
          <div class="post-card-foot">阅读全文 <span>→</span></div>
        </a>`).join('\n        ')}
      </div>
      <div class="editorial-foot">
        <button type="button" class="btn" data-posts-mode="all">浏览全部 ${posts.length} 篇文章与搜索</button>
        <span class="kbd-hint">按 <kbd class="kbd">/</kbd> 键快速搜索</span>
      </div>
    </div>
    <div id="all-posts-pane" hidden>
      ${searchBox()}
      ${postList(posts)}
      ${emptyHint}
      <p class="more">也可以前往 <a href="${BASE}/archives.html">时间归档</a> 或 <a href="${BASE}/">文章列表页</a> 浏览。</p>
    </div>
  </section>

  <section id="topics" class="section" aria-labelledby="topics-heading">
    <div class="section-head">
      <div>
        <p class="section-kicker">Topics</p>
        <h2 id="topics-heading">按分类探索</h2>
      </div>
      <a class="section-more" href="${BASE}/archives.html">时间归档 →</a>
    </div>
    <div class="cat-cloud reveal">
      ${topCats.map((g) => `<a class="cat-pill" href="${catLink(g.name)}">${esc(g.name)}<span>${g.posts.length}</span></a>`).join('\n      ')}
    </div>
  </section>
</main>`;
  write('home/index.html', layout({
    title: '', home: true, body, canonical: `${site.url}/`,
    description: `${site.brand} 的个人主页：${works.map((w) => w.name).join('、')}等独立作品，以及 ${firstYear} 年至今的技术博客文章。`,
  }));
}

function listPage({ rel, title, eyebrow, lead, description, posts, canonicalPath, active = 'posts', chips = '', search = true, withSummary = false, pager = '' }) {
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
  write(rel, layout({ title, body, active, canonical: absUrl(canonicalPath), description: description || (lead ? stripHtml(lead) : undefined) }));
}

const sampleTitles = (list) => truncate(list.slice(0, 3).map((p) => `《${p.title}》`).join('、') + (list.length > 3 ? ' 等' : ''), 110);

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
    description: `${site.title}全部 ${posts.length} 篇文章按年份归档，${firstYear} 年至今，涵盖 ${categories.slice(0, 6).map((g) => g.name).join('、')} 等分类。`,
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
      description: `${site.title}文章列表第 ${n} 页，包括：${sampleTitles(posts.slice((n - 1) * per, n * per))}。`,
      pager: `<nav class="pager"><a class="btn" href="${prev}">← 较新</a>${next ? `<a class="btn" href="${next}">较早 →</a>` : '<span></span>'}</nav>`,
    });
  }

  for (const g of categories) {
    listPage({
      rel: `categories/${g.slug}/index.html`, title: g.name, eyebrow: `<a href="${BASE}/archives.html">分类</a> · ${g.posts.length} 篇`,
      posts: g.posts, canonicalPath: `${BASE}/categories/${encodeURI(g.slug)}/`, search: false, withSummary: true,
      chips: chipLinks(categories, `${BASE}/categories/`, g.slug),
      description: `「${g.name}」分类下的 ${g.posts.length} 篇文章，包括：${sampleTitles(g.posts)}。`,
    });
  }
  for (const g of tags) {
    listPage({
      rel: `tag/${g.slug}/index.html`, title: `#${g.name}`, eyebrow: `标签 · ${g.posts.length} 篇`,
      posts: g.posts, canonicalPath: `${BASE}/tag/${encodeURI(g.slug)}/`, search: false, withSummary: true,
      description: `标签「${g.name}」下的 ${g.posts.length} 篇文章，包括：${sampleTitles(g.posts)}。`,
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
      title: data.title, active: m[1], canonical: absUrl(url), description: data.description || summarize(html, data.title || ''),
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

  buildHome(posts, works, categories);
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
