/* 大海 Online 站点脚本：首页分区切换 + 文章列表搜索与分类筛选 */
(function () {
  // ---------- 首页分区切换（只有首页存在 [role=tabpanel]） ----------
  var panels = {};
  [].forEach.call(document.querySelectorAll('[role="tabpanel"]'), function (p) { panels[p.id] = p; });
  var names = Object.keys(panels);
  if (names.length) {
    var show = function (name, sync) {
      if (!panels[name]) name = names[0];
      names.forEach(function (k) { panels[k].hidden = k !== name; });
      [].forEach.call(document.querySelectorAll('[data-go]'), function (t) {
        if (t.tagName === 'BUTTON') t.setAttribute('aria-selected', String(t.dataset.go === name));
      });
      if (sync && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    };
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-go]');
      if (!el) return;
      e.preventDefault();
      show(el.dataset.go, true);
      if (!el.classList.contains('tab')) {
        document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
    show(location.hash.slice(1));
  }

  // ---------- 文章筛选 ----------
  var input = document.getElementById('q');
  var chipsBox = document.getElementById('chips');
  if (!input) return;
  var items = [].slice.call(document.querySelectorAll('.post'));
  var years = [].slice.call(document.querySelectorAll('.year'));
  var empty = document.getElementById('empty');
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
  input.addEventListener('input', filter);

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
  }
})();
