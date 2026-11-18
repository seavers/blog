/* 大海 Online 站点脚本：明暗主题切换 + 首页分区切换 + 文章列表搜索与分类筛选 */
(function () {
  // ---------- 明暗主题切换 ----------
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    var getTheme = function () {
      var cur = document.documentElement.getAttribute('data-theme');
      if (cur === 'dark' || cur === 'light') return cur;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };
    var syncThemeTitle = function () {
      var isDark = getTheme() === 'dark';
      themeBtn.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
      themeBtn.setAttribute('title', isDark ? '切换到浅色模式' : '切换到深色模式');
    };
    themeBtn.addEventListener('click', function () {
      var next = getTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncThemeTitle();
    });
    syncThemeTitle();
  }

  // ---------- 首页分区切换（只有首页存在 [role=tabpanel]） ----------
  var panels = {};
  [].forEach.call(document.querySelectorAll('[role="tabpanel"]'), function (p) { panels[p.id] = p; });
  var names = Object.keys(panels);
  var currentPanel = '';
  var showPanel = null;
  if (names.length) {
    showPanel = function (name, sync) {
      if (!panels[name]) name = names[0];
      currentPanel = name;
      names.forEach(function (k) { panels[k].hidden = k !== name; });
      [].forEach.call(document.querySelectorAll('[data-go]'), function (t) {
        if (t.classList.contains('tab') || t.closest('.nav')) {
          t.setAttribute('aria-selected', String(t.dataset.go === name));
        }
      });
      if (sync && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    };
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-go]');
      if (!el) return;
      e.preventDefault();
      showPanel(el.dataset.go, true);
      if (!el.classList.contains('tab')) {
        var tabs = document.querySelector('.tabs');
        if (tabs) tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    window.addEventListener('hashchange', function () { showPanel(location.hash.slice(1)); });
    showPanel(location.hash.slice(1));
  }

  // ---------- 文章筛选 ----------
  var input = document.getElementById('q');
  var chipsBox = document.getElementById('chips');
  if (!input) return;
  var items = [].slice.call(document.querySelectorAll('.post'));
  var years = [].slice.call(document.querySelectorAll('.year'));
  var empty = document.getElementById('empty');
  var clearBtn = document.getElementById('q-clear');
  var statusBox = document.getElementById('filter-status');
  var activeCat = '';

  if (chipsBox) {
    var counts = {};
    items.forEach(function (li) {
      (li.dataset.cats || '').split('|').forEach(function (c) { if (c) counts[c] = (counts[c] || 0) + 1; });
    });
    var cats = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 14);
    var chip = function (label, value, n) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.cat = value;
      b.setAttribute('aria-pressed', String(value === activeCat));
      b.textContent = label;
      var s = document.createElement('span'); s.textContent = n; b.appendChild(s);
      return b;
    };
    chipsBox.appendChild(chip('全部', '', items.length));
    cats.forEach(function (c) { chipsBox.appendChild(chip(c, c, counts[c])); });
    chipsBox.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      activeCat = b.dataset.cat;
      [].forEach.call(chipsBox.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      filter();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      filter();
      input.focus();
    });
  }

  // "/" 快捷键快速聚焦文章搜索框
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) return;
    e.preventDefault();
    if (showPanel && currentPanel !== 'posts') {
      showPanel('posts', true);
      var tabs = document.querySelector('.tabs');
      if (tabs) tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    input.focus();
  });

  input.addEventListener('input', filter);

  function resetAll() {
    input.value = '';
    activeCat = '';
    if (chipsBox) {
      [].forEach.call(chipsBox.children, function (c) { c.setAttribute('aria-pressed', String(c.dataset.cat === '')); });
    }
    filter();
  }

  function filter() {
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    items.forEach(function (li) {
      var okCat = !activeCat || ('|' + li.dataset.cats + '|').indexOf('|' + activeCat + '|') > -1;
      var okQ = !q || li.dataset.text.toLowerCase().indexOf(q) > -1;
      li.hidden = !(okCat && okQ);
      if (!li.hidden) shown++;
    });
    years.forEach(function (y) { y.hidden = !y.querySelector('.post:not([hidden])'); });
    if (empty) empty.hidden = shown > 0;
    if (clearBtn) clearBtn.hidden = !input.value;
    if (statusBox) {
      var filtered = Boolean(q || activeCat);
      statusBox.hidden = !filtered;
      if (filtered) {
        statusBox.textContent = '共找到 ' + shown + ' 篇匹配文章 ';
        var resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.textContent = '重置筛选';
        resetBtn.addEventListener('click', resetAll);
        statusBox.appendChild(resetBtn);
      }
    }
  }

  filter();
})();
