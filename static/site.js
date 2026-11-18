/* 大海 Online 站点脚本：主题切换、分段滑块、快捷搜索、滚动入场与文章筛选 */
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
      themeBtn.classList.remove('is-spinning');
      void themeBtn.offsetWidth;
      themeBtn.classList.add('is-spinning');
      syncThemeTitle();
    });
    syncThemeTitle();
  }

  // ---------- 回到顶部 ----------
  var backTop = document.getElementById('back-top');
  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---------- 滑动分段控制器通用助手 ----------
  var segUpdaters = [];
  function setupSeg(segEl, onSelect) {
    if (!segEl) return null;
    var thumb = segEl.querySelector('.seg-thumb');
    var btns = [].slice.call(segEl.querySelectorAll('button[data-val]'));
    var moveThumb = function (btn) {
      if (!thumb || !btn) return;
      segEl.style.setProperty('--seg-x', btn.offsetLeft + 'px');
      segEl.style.setProperty('--seg-w', btn.offsetWidth + 'px');
    };
    var activate = function (val, trigger) {
      var activeBtn = btns.find(function (b) { return b.dataset.val === val; }) || btns[0];
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b === activeBtn)); });
      moveThumb(activeBtn);
      if (trigger && onSelect) onSelect(activeBtn.dataset.val);
    };
    segEl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-val]');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      activate(b.dataset.val, true);
    });
    var syncCurrent = function () {
      var cur = btns.find(function (b) { return b.getAttribute('aria-pressed') === 'true'; }) || btns[0];
      moveThumb(cur);
    };
    segUpdaters.push(syncCurrent);
    syncCurrent();
    return activate;
  }
  window.addEventListener('resize', function () { segUpdaters.forEach(function (fn) { fn(); }); });

  // ---------- 首页作品筛选与文章视图切换 ----------
  var worksGrid = document.getElementById('works-grid');
  if (worksGrid) {
    var workCards = [].slice.call(worksGrid.querySelectorAll('.work'));
    setupSeg(document.querySelector('.seg[data-seg="works-filter"]'), function (platform) {
      var idx = 0;
      workCards.forEach(function (card) {
        var list = (card.dataset.platforms || '').split('|');
        var show = platform === 'all' || list.indexOf(platform) > -1;
        card.hidden = !show;
        card.classList.remove('is-entering', 'reveal');
        if (show) {
          void card.offsetWidth;
          card.style.animationDelay = Math.min(idx * 50, 180) + 'ms';
          card.classList.add('is-entering');
          idx++;
        }
      });
    });
  }

  var recentPane = document.getElementById('recent-posts-pane');
  var allPane = document.getElementById('all-posts-pane');
  var setPostsMode = null;
  if (recentPane && allPane) {
    var segPosts = setupSeg(document.querySelector('.seg[data-seg="posts-mode"]'), function (mode) {
      var isAll = mode === 'all';
      recentPane.hidden = isAll;
      allPane.hidden = !isAll;
      if (isAll) {
        allPane.classList.remove('is-entering');
        void allPane.offsetWidth;
        allPane.classList.add('is-entering');
        if (location.hash !== '#posts') history.replaceState(null, '', '#posts');
      } else if (location.hash === '#posts') {
        history.replaceState(null, '', '#articles');
      }
    });
    setPostsMode = function (mode) { if (segPosts) segPosts(mode, true); };
  }

  // ---------- 首页锚点平滑滚动 & 模式联动 ----------
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-scroll], [data-posts-mode]');
    if (!trigger) return;
    if (trigger.dataset.postsMode && setPostsMode) {
      setPostsMode(trigger.dataset.postsMode);
    }
    var targetId = trigger.dataset.scroll;
    if (targetId) {
      var target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  if (location.hash === '#posts' && setPostsMode) {
    setPostsMode('all');
    var articlesEl = document.getElementById('articles');
    if (articlesEl) setTimeout(function () { articlesEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }

  // ---------- 滚动渐显（Reveal）与顶栏 ScrollSpy ----------
  var reveals = [].slice.call(document.querySelectorAll('.reveal'));
  if (reveals.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      var batch = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.transitionDelay = Math.min(batch * 50, 180) + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
        batch++;
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  var navWorks = document.querySelector('.nav [data-scroll="works"]');
  var navArticles = document.querySelector('.nav [data-scroll="articles"]');
  var secWorks = document.getElementById('works');
  var secArticles = document.getElementById('articles');
  var onScroll = function () {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (backTop) backTop.classList.toggle('is-show', y > 420);
    if (navWorks && navArticles && secWorks && secArticles) {
      var artTop = secArticles.getBoundingClientRect().top;
      var workTop = secWorks.getBoundingClientRect().top;
      var inArticles = artTop <= 180;
      var inWorks = !inArticles && workTop <= 220;
      navWorks.classList.toggle('is-active', inWorks);
      navArticles.classList.toggle('is-active', inArticles);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- 文章搜索与分类筛选 ----------
  var input = document.getElementById('q');
  var navSearch = document.getElementById('nav-search');
  var focusSearch = function () {
    if (!input) return;
    if (setPostsMode && allPane && allPane.hidden) {
      setPostsMode('all');
      var articlesEl = document.getElementById('articles');
      if (articlesEl) articlesEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (input.closest('main')) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(function () { input.focus(); }, 80);
  };
  if (navSearch && input) {
    navSearch.addEventListener('click', function (e) {
      e.preventDefault();
      focusSearch();
    });
  }
  if (input && location.hash === '#search') {
    setTimeout(focusSearch, 60);
  }

  if (!input) return;
  var chipsBox = document.getElementById('chips');
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

  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) return;
    e.preventDefault();
    focusSearch();
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
