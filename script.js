(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const fmt = n => n.toLocaleString('en-US');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  /* Run cb once, the first time el scrolls into view */
  function onView(el, cb, threshold = 0.25) {
    if (!('IntersectionObserver' in window)) { cb(el); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        cb(entry.target);
      });
    }, { threshold });
    io.observe(el);
  }

  /* ── Scroll reveal ── */
  $$('.reveal').forEach(el => onView(el, t => t.classList.add('in'), 0.12));

  /* ── Count-up numbers ── */
  function countTo(el, to, from = 0, duration = 1500) {
    if (reduceMotion) { el.textContent = fmt(to); return; }
    const start = performance.now();
    const step = now => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  $$('[data-count]').forEach(el => {
    const to = Number(el.dataset.count);
    const from = Number(el.dataset.from || 0);
    if (!reduceMotion) el.textContent = fmt(from);
    onView(el, () => countTo(el, to, from), 0.6);
  });

  /* ── Project visuals ── */
  const visuals = {
    // Each vulnerability class starts red and flips to fixed, one at a time
    safebuyr(el) {
      $$('.vulns li', el).forEach((li, i) => {
        setTimeout(() => li.classList.add('fixed'), 900 + i * 260);
      });
    },
    // Controls light up in scan order
    cspm(el) {
      $$('.controls i', el).forEach((cell, i) => {
        setTimeout(() => cell.classList.add('on'), 150 + i * 55);
      });
    },
    honeypot() {}
  };

  $$('[data-visual]').forEach(el => {
    if (!reduceMotion) {
      $$('.vulns li', el).forEach(li => li.classList.remove('fixed'));
      $$('.controls i', el).forEach(cell => cell.classList.remove('on'));
    }
    onView(el, () => {
      el.classList.add('in');
      if (!reduceMotion) visuals[el.dataset.visual](el);
    }, 0.35);
  });

  /* ── Project cards: copy a clone command ── */
  $$('.btn-clone').forEach(btn => {
    if (!navigator.clipboard) return;
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(`git clone ${btn.dataset.clone}`);
        btn.textContent = '✓ copied';
      } catch (err) {
        btn.textContent = 'copy failed';
      }
      setTimeout(() => { btn.textContent = '$ git clone'; }, 1800);
    });
  });

  function makeDots(container, count, label, onPick) {
    container.textContent = '';
    return Array.from({ length: count }, (_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'car-dot';
      dot.setAttribute('aria-label', `${label} ${i + 1} of ${count}`);
      dot.addEventListener('click', () => onPick(i));
      container.appendChild(dot);
      return dot;
    });
  }

  /* ── Projects: swipeable carousel on small screens (CSS turns the grid into a scroller) ── */
  (function initProjectCarousel() {
    const grid = $('#proj-grid');
    const dotsEl = $('#proj-dots');
    if (!grid || !dotsEl) return;
    const cards = $$('.proj-card', grid);
    const [prev, next] = $$('.proj-controls .car-nav');
    const goTo = i => {
      const card = cards[Math.max(0, Math.min(cards.length - 1, i))];
      const pad = parseFloat(getComputedStyle(grid).paddingLeft) || 0;
      const left = grid.scrollLeft + card.getBoundingClientRect().left - grid.getBoundingClientRect().left - pad;
      grid.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    const dots = makeDots(dotsEl, cards.length, 'Project', goTo);
    let current = 0;

    function update() {
      const left = grid.getBoundingClientRect().left + (parseFloat(getComputedStyle(grid).paddingLeft) || 0);
      let best = 0, bestDist = Infinity;
      cards.forEach((card, i) => {
        const dist = Math.abs(card.getBoundingClientRect().left - left);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      // At the far end the last card may never reach the left edge
      if (grid.scrollWidth > grid.clientWidth && grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 4) best = cards.length - 1;
      current = best;
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === current)));
      prev.disabled = current === 0;
      next.disabled = current === cards.length - 1;
    }

    prev.addEventListener('click', () => goTo(current - 1));
    next.addEventListener('click', () => goTo(current + 1));
    let queued = false;
    grid.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; update(); });
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ── Experience: coverflow carousel ── */
  (function initExperienceCarousel() {
    const xp = $('#xp');
    if (!xp) return;
    const track = $('.xp-track', xp);
    const cards = $$('.xp-card', xp);
    const arrows = $$('.xp-arrow', xp);
    if (cards.length < 2) return; // a single role just renders as a plain card
    let current = 0;

    const dots = makeDots($('#xp-dots', xp), cards.length, 'Role', i => go(i));

    function measure() {
      const tallest = Math.max(...cards.map(c => c.offsetHeight));
      track.style.setProperty('--xp-h', `${tallest}px`);
    }

    function render() {
      const n = cards.length;
      cards.forEach((card, i) => {
        // Position relative to the active card, wrapping around the ends
        let offset = (i - current + n) % n;
        if (offset > n / 2) offset -= n;
        if (n === 2 && offset !== 0) offset = 1;
        card.classList.remove('is-active', 'is-prev', 'is-next', 'is-far-left', 'is-far-right');
        card.classList.add(
          offset === 0 ? 'is-active' : offset === -1 ? 'is-prev' : offset === 1 ? 'is-next' : offset < 0 ? 'is-far-left' : 'is-far-right'
        );
        const active = offset === 0;
        card.setAttribute('aria-hidden', String(!active));
      });
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === current)));
    }

    function go(i) {
      current = (i + cards.length) % cards.length;
      render();
    }

    xp.classList.add('ready');
    arrows.forEach(btn => {
      btn.hidden = false;
      btn.addEventListener('click', () => go(current + Number(btn.dataset.dir)));
    });

    // Clicking a side card brings it to the front
    track.addEventListener('click', e => {
      const card = e.target.closest('.xp-card');
      if (card && !card.classList.contains('is-active')) go(cards.indexOf(card));
    });

    // Arrow keys while focus is inside the carousel (not globally: the Konami code needs them)
    xp.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
    });

    // Swipe
    let startX = null;
    track.addEventListener('pointerdown', e => { startX = e.clientX; });
    track.addEventListener('pointerup', e => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
    });

    render();
    measure();
    window.addEventListener('resize', measure);
    if (document.fonts) document.fonts.ready.then(measure);
  })();

  /* ── Nav: mobile toggle, scrollspy, progress bar ── */
  const navToggle = $('.nav-toggle');
  const navLinks = $('#nav-links');

  function setMenu(open) {
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('open')));
    navLinks.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  }

  if ('IntersectionObserver' in window && $('main section[id]')) {
    const linkFor = id => $(`#nav-links a[href="#${id}"]`);
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        $$('#nav-links a').forEach(a => a.removeAttribute('aria-current'));
        const link = linkFor(entry.target.id);
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(section => spy.observe(section));
  }

  const progress = $('.scroll-progress');
  let scrollQueued = false;
  function updateProgress() {
    scrollQueued = false;
    const max = root.scrollHeight - window.innerHeight;
    if (!progress) return;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  }
  window.addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(updateProgress);
  }, { passive: true });
  updateProgress();

  /* ── Cursor light: page spotlight + per-card edge glow ── */
  if (finePointer) {
    let px = 0, py = 0, moveQueued = false;
    window.addEventListener('pointermove', e => {
      px = e.clientX; py = e.clientY;
      if (moveQueued) return;
      moveQueued = true;
      requestAnimationFrame(() => {
        moveQueued = false;
        root.style.setProperty('--mx', `${px}px`);
        root.style.setProperty('--my', `${py}px`);
      });
    }, { passive: true });

    $$('.glow').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--gx', `${e.clientX - r.left}px`);
        card.style.setProperty('--gy', `${e.clientY - r.top}px`);
      }, { passive: true });
    });
  }

  /* ── Hero role typer ── */
  (async function typeRoles() {
    const el = $('#typed-role');
    if (!el || reduceMotion) return;
    const roles = [
      'Application Security Engineer',
      'DevSecOps Engineer',
      'Python Security Automation'
    ];
    let i = 0;
    for (;;) {
      await sleep(2600);
      for (let n = el.textContent.length; n >= 0; n--) {
        el.textContent = el.textContent.slice(0, n);
        await sleep(22);
      }
      i = (i + 1) % roles.length;
      for (let n = 1; n <= roles[i].length; n++) {
        el.textContent = roles[i].slice(0, n);
        await sleep(48);
      }
    }
  })();

  /* ── Copy email ── */
  $$('.copy-btn').forEach(btn => {
    if (!navigator.clipboard) return;
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'copied';
        btn.classList.add('done');
      } catch (err) {
        btn.textContent = 'failed';
      }
      setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('done'); }, 1800);
    });
  });

  /* ── Backdrop: packets travelling along the grid ── */
  (function initPackets() {
    const canvas = $('#bg-canvas');
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext('2d');
    const GRID = 48; // must match --grid in styles.css
    const COLORS = ['0,255,135', '0,212,255'];
    let w = 0, h = 0, packets = [], frame = 0;

    function spawn() {
      const horizontal = Math.random() < 0.5;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const lane = n => Math.round((Math.random() * n) / GRID) * GRID + 0.5;
      return {
        x: horizontal ? (dir > 0 ? -8 : w + 8) : lane(w),
        y: horizontal ? lane(h) : (dir > 0 ? -8 : h + 8),
        dx: horizontal ? dir : 0,
        dy: horizontal ? 0 : dir,
        speed: 0.9 + Math.random() * 1.5,
        color: Math.random() < 0.1 ? '255,69,96' : COLORS[Math.floor(Math.random() * COLORS.length)]
      };
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(6, Math.min(22, Math.floor((w * h) / 60000)));
      packets = Array.from({ length: count }, spawn);
    }

    function tick() {
      // Fade what's already drawn so each packet leaves a short trail
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      packets.forEach((p, i) => {
        const before = Math.floor((p.dx ? p.x : p.y) / GRID);
        p.x += p.dx * p.speed;
        p.y += p.dy * p.speed;
        const after = Math.floor((p.dx ? p.x : p.y) / GRID);

        // Occasionally turn a corner when crossing an intersection
        if (before !== after && Math.random() < 0.14) {
          const turn = Math.random() < 0.5 ? 1 : -1;
          const node = Math.max(before, after) * GRID + 0.5;
          if (p.dx) { p.x = node; p.dx = 0; p.dy = turn; }
          else { p.y = node; p.dy = 0; p.dx = turn; }
        }

        ctx.fillStyle = `rgba(${p.color},0.9)`;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);

        if (p.x < -12 || p.x > w + 12 || p.y < -12 || p.y > h + 12) packets[i] = spawn();
      });

      frame = requestAnimationFrame(tick);
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(tick);
    });

    resize();
    frame = requestAnimationFrame(tick);
  })();

  /* ── Writeups: read the post index Jekyll generates at /blog/posts.json ── */
  const postsReady = fetch('/blog/posts.json')
    .then(res => (res.ok ? res.json() : []))
    .then(list => (Array.isArray(list) ? list : []).filter(p => p && typeof p.url === 'string' && p.url.startsWith('/')))
    .catch(() => []);

  postsReady.then(posts => {
    if (!posts.length) return;
    $$('[data-needs-posts]').forEach(el => { el.hidden = false; });
    const list = $('#writeups-list');
    if (!list) return;
    posts.slice(0, 3).forEach(post => {
      const card = document.createElement('a');
      card.className = 'post-card';
      card.href = post.url;
      const meta = document.createElement('div');
      meta.className = 'post-meta';
      const cat = document.createElement('span');
      cat.className = post.category === 'ctf' ? 'post-cat ctf' : 'post-cat';
      cat.textContent = post.category === 'ctf' ? 'CTF' : 'Project';
      const date = document.createElement('span');
      date.textContent = post.date || '';
      meta.append(cat, date);
      const title = document.createElement('h3');
      title.className = 'post-title';
      title.textContent = post.title || '';
      const summary = document.createElement('p');
      summary.className = 'post-summary';
      summary.textContent = post.summary || '';
      const more = document.createElement('span');
      more.className = 'post-more';
      more.textContent = 'Read writeup →';
      card.append(meta, title, summary, more);
      list.appendChild(card);
    });
  });

  /* Blog index: category filter */
  (function initPostFilters() {
    const bar = $('.post-filters');
    if (!bar) return;
    const cards = $$('.post-card[data-category]');
    const empty = $('[data-empty]');
    bar.hidden = false;
    bar.addEventListener('click', e => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      $$('button', bar).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      let shown = 0;
      cards.forEach(card => {
        const match = btn.dataset.filter === 'all' || card.dataset.category === btn.dataset.filter;
        card.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });
  })();

  /* ── Off the clock: "hello, world" in a few human languages ── */
  (async function cycleHello() {
    const el = $('#hello-world');
    if (!el || reduceMotion) return;
    const greetings = [
      'hello, world', 'hola, mundo', 'bonjour, le monde', 'olá, mundo', 'ciao, mondo',
      'hallo, Welt', 'こんにちは、世界', '안녕, 세상', 'habari, dunia', 'merhaba, dünya'
    ];
    for (let i = 1; ; i = (i + 1) % greetings.length) {
      await sleep(2400);
      el.classList.add('swap');
      await sleep(350);
      el.textContent = greetings[i];
      el.classList.remove('swap');
    }
  })();

  /* ── Site CTF: five flags hidden around the site ── */
  const ctf = (() => {
    const KEY = 'ctf-captured';
    // Yes, the flags are all right here. Reading client-side source is the first thing I'd do too.
    const FLAGS = [
      { id: 'source', name: 'View source', flag: 'flag{v1ew_s0urce_1s_r3con}', hint: 'recon starts with reading everything the server sends you' },
      { id: 'rot', name: 'Not encryption', flag: 'flag{r0t13_is_n0t_encrypti0n}', hint: 'something in the home directory is only lightly scrambled (ls, cat)' },
      { id: 'robots', name: 'Treasure map', flag: 'flag{r0b0ts_txt_is_a_tr3asure_map}', hint: 'sites tell crawlers where not to look, and curl works on this origin' },
      { id: 'root', name: 'Privilege escalation', flag: 'flag{gtf0bins_4_the_w1n}', hint: 'sudo -l, then look up what that binary can do' },
      { id: 'konami', name: 'Old school', flag: 'flag{up_up_d0wn_d0wn}', hint: 'the most famous cheat code in gaming, typed anywhere outside the terminal' }
    ];
    let captured = [];
    try { captured = JSON.parse(localStorage.getItem(KEY)) || []; } catch (err) { /* storage unavailable */ }
    if (!Array.isArray(captured)) captured = [];

    const save = () => {
      try { localStorage.setItem(KEY, JSON.stringify(captured)); } catch (err) { /* progress just won't persist */ }
      render();
    };
    const count = () => FLAGS.filter(f => captured.includes(f.id)).length;
    function render() {
      const el = $('#ctf-progress');
      if (!el) return;
      el.hidden = count() === 0;
      el.textContent = `${count()}/${FLAGS.length} captured`;
    }
    render();

    return {
      FLAGS,
      count,
      has: id => captured.includes(id),
      flag: id => FLAGS.find(f => f.id === id).flag,
      submit(text) {
        const hit = FLAGS.find(f => f.flag === text);
        if (!hit) return null;
        const repeat = captured.includes(hit.id);
        if (!repeat) { captured.push(hit.id); save(); }
        return { hit, repeat };
      },
      reset() { captured = []; save(); }
    };
  })();

  function toast(label, value) {
    $$('.toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    const strong = document.createElement('b');
    strong.textContent = value;
    el.append(label + ' ', strong);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 10000);
  }

  /* Konami code */
  (function initKonami() {
    const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let at = 0;
    document.addEventListener('keydown', e => {
      if (e.target instanceof Element && e.target.closest('input, textarea')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      at = key === CODE[at] ? at + 1 : (key === CODE[0] ? 1 : 0);
      if (at < CODE.length) return;
      at = 0;
      toast('cheat code accepted:', ctf.flag('konami'));
      root.classList.add('konami');
      setTimeout(() => root.classList.remove('konami'), 1700);
    });
  })();

  /* ── Interactive terminal ── */
  let runInTerminal = null;

  (function initTerminal() {
    const out = $('#term-out');
    const body = $('#term-body');
    const input = $('#term-input');
    const inputRow = $('.terminal-input-row');
    const chips = $('.terminal-chips');
    if (!out || !input) return;

    const promptLabel = $('label', inputRow);
    const LINKS = {
      github: 'https://github.com/ChrisCortesSanchez',
      linkedin: 'https://www.linkedin.com/in/christopher-cortes-sanchez/',
      email: 'mailto:cc7825@nyu.edu',
      sens: 'https://github.com/ninal1811/project-sens',
      safebuyr: 'https://github.com/ChrisCortesSanchez/SafeBuyr',
      cspm: 'https://github.com/ChrisCortesSanchez/AWS-CSPM',
      honeypot: 'https://github.com/ChrisCortesSanchez/Tpot'
    };
    const SECTIONS = ['projects', 'experience', 'skills', 'background', 'interests', 'contact'];
    const SELF_HOSTS = ['localhost', '127.0.0.1', 'sec', window.location.hostname, window.location.host, 'chriscortessanchez.github.io', 'chriscortessanchez.com', 'www.chriscortessanchez.com'];

    let user = 'chris';
    const promptText = () => (user === 'root' ? 'root@sec:~#' : 'chris@sec:~$');
    const promptClass = () => (user === 'root' ? 't-prompt t-root' : 't-prompt');
    function setUser(next) {
      user = next;
      promptLabel.textContent = promptText();
      promptLabel.className = promptClass();
    }

    // A line is a list of parts: 'text', ['text', 'css-class'], or { text, href }.
    // Everything is written with textContent, so typed input is never parsed as HTML.
    function print(...parts) {
      const row = document.createElement('div');
      parts.forEach(part => {
        let node;
        if (typeof part === 'string') {
          node = document.createTextNode(part);
        } else if (Array.isArray(part)) {
          node = document.createElement('span');
          node.className = part[1];
          node.textContent = part[0];
        } else {
          node = document.createElement('a');
          node.href = part.href;
          node.textContent = part.text;
          if (part.href.startsWith('http')) {
            node.target = '_blank';
            node.rel = 'noopener noreferrer';
          }
        }
        row.appendChild(node);
      });
      out.appendChild(row);
      return row;
    }

    const say = text => print([text, 't-out']);
    const dim = text => print([text, 't-dim']);
    const err = text => print([text, 't-err']);
    const ok = text => print([text, 't-ok']);
    const kv = (key, value, cls = 't-hl') => print([key.padEnd(10) + ': ', 't-out'], [value, cls]);
    const blank = () => print('');
    function scrollToEnd() { body.scrollTop = body.scrollHeight; }

    function project(no, name, stack, lines, key) {
      print([`[${no}] `, 't-dim'], [name, 't-ok']);
      print(['     ' + stack, 't-hl']);
      lines.forEach(l => say('     - ' + l));
      print(['     ', 't-out'], { text: LINKS[key].replace('https://', ''), href: LINKS[key] });
    }

    const projectCmds = {
      sens: () => project('02', 'Project SENS (team capstone, security owner)', 'Python, Flask, MongoDB, React', [
        'owned auth: 6 endpoints, salted scrypt hashing, 8-char minimum',
        'Secure, HttpOnly session cookies; CORS limited to 2 origins',
        'developer-only log viewer behind RBAC, path-traversal filtering, 1,000-line cap',
        'Jan - May 2026; class has ended, so it is no longer deployed'
      ], 'sens'),
      safebuyr: () => {
        project('01', 'SafeBuyr E-commerce Security Platform', 'Python, Flask, SQLAlchemy, Docker, GitHub Actions', [
          'vulnerable + hardened apps side by side, 6 OWASP Top 10 classes',
          'SQLi, stored XSS, IDOR, MD5 hashing, missing CSRF, missing headers',
          '1,200+ line 8-phase scanner: risk score 32/100 -> 0/100',
          '7 exploit scripts; 3 regression suites in GitHub Actions'
        ], 'safebuyr');
        print(['     now: ', 't-dim'], ['Phase 1, Semgrep SAST', 't-hl'], [' (DevSecOps expansion in progress)', 't-dim']);
        dim('     next: Gitleaks + Trivy, container hardening, ZAP, SBOM + cosign, kind, Kyverno');
      },
      cspm: () => project('03', 'AWS CSPM Tool', 'Python, AWS, boto3, GitHub Actions', [
        '26 CIS Benchmark v1.5.0 controls: IAM, S3, CloudTrail, EC2, password policy',
        'caught 4 real gaps in a live AWS account',
        '36 moto-mocked tests in CI, no credentials in the pipeline'
      ], 'cspm'),
      honeypot: () => project('04', 'Honeypot Threat Intelligence Pipeline', 'Python, Elasticsearch, DigitalOcean', [
        '193,139 real attack events from 6,713 unique IPs',
        'sensors: Cowrie (SSH), Dionaea (malware), Honeytrap (service emulation)',
        'flagged a Solana credential harvesting op and a Mirai-variant botnet',
        '62,201 malware samples, 8 attacker clusters, 37% from Netherlands VPS'
      ], 'honeypot')
    };

    /* Fake filesystem. Home files are world-readable; /root and /etc/shadow need root. */
    const files = {
      'about.txt': () => commands.about(),
      'skills.txt': () => commands.skills(),
      'interests.txt': () => commands.interests(),
      'notes.txt': () => {
        say('todo');
        say(' - rotate the staging creds');
        say(' - stop leaving things in robots.txt');
        say(' - "encrypt" this before anyone reads it:');
        say('   synt{e0g13_vf_a0g_rapelcgv0a}');
      },
      '.bash_history': () => {
        ['sudo -l', 'curl -s localhost/robots.txt', 'rot13 uryyb', 'vim notes.txt', 'cat /root/flag.txt', 'exit'].forEach(say);
      },
      '.ssh/id_rsa': () => {
        say('-----BEGIN OPENSSH PRIVATE KEY-----');
        say('bmljZSB0cnkuIGtleXMgbGl2ZSBpbiBhIHNlY3JldHMgbWFuYWdlci4=');
        say('-----END OPENSSH PRIVATE KEY-----');
      },
      '/etc/passwd': () => {
        say('root:x:0:0:root:/root:/bin/bash');
        say('www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin');
        say('cowrie:x:998:998:definitely a real user:/home/cowrie:/bin/bash');
        say('chris:x:1000:1000:Christopher Cortes-Sanchez:/home/chris:/bin/zsh');
      },
      '/etc/shadow': () => {
        say('root:$6$[redacted]:19999:0:99999:7:::');
        dim('even as root, you get no hashes. hashcat can have the day off.');
      },
      '/root/flag.txt': () => {
        ok(ctf.flag('root'));
        dim('bank it: submit <flag>');
      }
    };

    function resolve(arg) {
      let path = arg.replace(/^~\/?/, '').replace(/^\/home\/chris\/?/, '');
      const traversal = path.includes('..');
      // ../../etc/passwd climbs out of home and lands at /etc/passwd
      if (traversal) path = '/' + path.replace(/^(\.{1,2}\/)+/, '').replace(/^\/+/, '');
      else path = path.replace(/^\.\//, '');
      path = path.replace(/\/+$/, '');
      if (user === 'root' && path === 'flag.txt') path = '/root/flag.txt';
      return { path, traversal };
    }

    function becomeRoot() {
      setUser('root');
      ok('uid=0(root) gid=0(root) groups=0(root)');
      say('vim ran as root and handed you its shell. GTFOBins is a good read.');
      dim('look around: ls, cat flag.txt. exit drops privileges.');
    }

    const commands = {
      help() {
        const rows = [
          ['whoami', 'who is this'],
          ['projects', 'security projects (or: safebuyr, sens, cspm, honeypot)'],
          ['skills', 'tools, languages, platforms'],
          ['experience', 'work history'],
          ['education', 'degree and coursework'],
          ['certs', 'certifications'],
          ['community', 'CTF competitions and organizations'],
          ['blog', 'project writeups and CTF walkthroughs'],
          ['interests', 'off the clock'],
          ['contact', 'how to reach me'],
          ['open <name>', 'github | linkedin | email | sens | safebuyr | cspm | honeypot'],
          ['cd <section>', SECTIONS.join(' | ')],
          ['ls, cat', 'look around'],
          ['clear', 'clear the screen']
        ];
        rows.forEach(([cmd, desc]) => print([cmd.padEnd(14), 't-ok'], [desc, 't-out']));
        print(['ctf'.padEnd(14), 't-err'], ['five flags are hidden on this site. this shell is one way in.', 't-out']);
        dim('tab completes, ↑/↓ walks history');
      },
      whoami() {
        if (user === 'root') { say('root'); return; }
        say('christopher-cortes-sanchez');
        kv('Role', 'Application Security / DevSecOps');
        kv('School', 'NYU Tandon, BS Computer Science');
        kv('Cert', 'CompTIA Security+ (SY0-701)');
        kv('Status', 'Open to opportunities', 't-ok');
      },
      about() {
        say('NYU CS graduate (Security+) who builds Python security automation');
        say('for apps, cloud, and CI/CD, tested against live systems, and owned');
        say('authentication on a team web app. Seeking Application Security and');
        say('DevSecOps Engineer roles.');
      },
      projects() {
        projectCmds.safebuyr(); blank();
        projectCmds.sens(); blank();
        projectCmds.cspm(); blank();
        projectCmds.honeypot();
      },
      ...projectCmds,
      skills() {
        kv('appsec', 'OWASP Top 10, SQL Injection, XSS, CSRF, Fuzzing (libFuzzer, AFL++)');
        kv('tools', 'Burp Suite, Wireshark, Splunk, Elasticsearch, Nmap');
        kv('languages', 'Python, C/C++, JavaScript, Bash, SQL, Flask, Django');
        kv('devops', 'Git, GitHub Actions, Docker, AWS, Linux');
      },
      experience() {
        print(['Peer Tutor', 't-ok'], [' @ NYU Opportunity Programs', 't-hl']);
        dim('Jul 2023 - May 2026 · Brooklyn, NY');
        say('- 100% course pass rate across 20+ students (Python, Precalc, Calculus)');
        say('- turned programming defects into structured root-cause analyses');
        say('- designed 50+ practice exercises for debugging and problem-solving');
      },
      education() {
        print(['NYU Tandon School of Engineering', 't-ok'], [' · May 2026', 't-dim']);
        say('B.S. Computer Science; Minor in Cybersecurity and Mathematics');
        say('Coursework: Application Security, Offensive Security, Computer Security,');
        say('            Network Security, Computer Networks, Operating Systems, Databases');
      },
      certs() {
        print(['CompTIA Security+ (SY0-701)', 't-ok'], [' · issued June 2026', 't-dim']);
        print(['CompTIA Network+ (N10-009)', 't-hl'], [' · in progress', 't-dim']);
      },
      community() {
        say('- SHPE 2025 National Convention Cybersecurity Challenge (8th place)');
        say('- Buckeye CTF');
        say('- NYU Offensive Security Weekly Challenges');
        blank();
        print(['organizations', 't-hl']);
        say('- NYU Higher Education Opportunity Program (HEOP)');
        say('- Society of Hispanic Professional Engineers (SHPE), NYU Tandon chapter');
        say('- Cyversity');
        dim('next up: Raíces Cyber, DEF CON NYC');
      },
      interests() {
        say('puzzles · soccer · basketball · video games');
        say('learning about new cultures and languages');
        dim('there is a puzzle in this shell, too: ctf');
      },
      blog() {
        postsReady.then(posts => {
          if (!posts.length) say('no writeups published yet. check back soon.');
          else {
            posts.slice(0, 8).forEach(p => print([String(p.date || '').padEnd(14), 't-dim'], { text: p.title || p.url, href: p.url }));
            print(['all: ', 't-out'], { text: '/blog/', href: '/blog/' });
          }
          blank();
          scrollToEnd();
        });
        return true;
      },
      contact() {
        print(['email     : ', 't-out'], { text: 'cc7825@nyu.edu', href: LINKS.email });
        print(['linkedin  : ', 't-out'], { text: 'linkedin.com/in/christopher-cortes-sanchez', href: LINKS.linkedin });
        print(['github    : ', 't-out'], { text: 'github.com/ChrisCortesSanchez', href: LINKS.github });
      },
      open(arg) {
        if (!arg || !Object.hasOwn(LINKS, arg)) {
          err('usage: open <' + Object.keys(LINKS).join('|') + '>');
          return;
        }
        say('opening ' + arg + ' ...');
        if (arg === 'email') window.location.href = LINKS.email;
        else window.open(LINKS[arg], '_blank', 'noopener,noreferrer');
      },
      cd(arg) {
        const id = (arg || '').replace(/^[#~./]+|\/+$/g, '');
        if (id === 'root' || id === 'etc') { err(`cd: /${id}: ${user === 'root' ? 'nothing to see, try ls /' + id : 'Permission denied'}`); return; }
        if (!SECTIONS.includes(id)) {
          err('cd: no such section: ' + (arg || ''));
          say('sections: ' + SECTIONS.join('  '));
          return;
        }
        say('-> #' + id);
        document.getElementById(id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      },
      ls(arg, args) {
        const flags = args.filter(a => a.startsWith('-')).join('');
        const target = resolve(args.find(a => !a.startsWith('-')) || '').path;
        if (target === '/root' || (user === 'root' && target === '')) {
          if (user !== 'root') err("ls: cannot open directory '/root': Permission denied");
          else say('flag.txt');
          return;
        }
        if (target === '/etc') { say('passwd  shadow'); return; }
        if (target === '.ssh') { say('id_rsa'); return; }
        if (target !== '') { err(`ls: cannot access '${target}': No such file or directory`); return; }

        const hidden = flags.includes('a') ? ['.bash_history', '.ssh/'] : [];
        const plain = ['about.txt', 'interests.txt', 'notes.txt', 'skills.txt'];
        if (flags.includes('l')) {
          hidden.forEach(f => say(`${f.endsWith('/') ? 'drwx------' : '-rw-------'}  chris  ${f}`));
          plain.forEach(f => say(`-rw-r--r--  chris  ${f}`));
          SECTIONS.forEach(s => print(['drwxr-xr-x  chris  ', 't-out'], [s + '/', 't-hl']));
        } else {
          print([hidden.concat(plain).join('  '), 't-out']);
          print([SECTIONS.map(s => s + '/').join('  '), 't-hl']);
        }
      },
      cat(arg) {
        if (!arg) { say('usage: cat <file>'); return; }
        const { path, traversal } = resolve(arg);
        if (SECTIONS.includes(path)) { err(`cat: ${path}: Is a directory`); dim('try: cd ' + path); return; }
        if ((path === '/etc/shadow' || path.startsWith('/root')) && user !== 'root') {
          err(`cat: ${path}: Permission denied`);
          return;
        }
        if (!Object.hasOwn(files, path)) { err(`cat: ${arg}: No such file or directory`); return; }
        if (traversal) dim('path traversal. a classic.');
        files[path]();
      },
      pwd() { say(user === 'root' ? '/root' : '/home/chris'); },
      id() { say(user === 'root' ? 'uid=0(root) gid=0(root) groups=0(root)' : 'uid=1000(chris) gid=1000(chris) groups=1000(chris),27(sudo)'); },
      hostname() { say('sec'); },
      uname() { say('Linux sec 6.8.0-portfolio #1 SMP x86_64 GNU/Linux'); },
      date() { say(new Date().toString()); },
      echo(arg, args, rest, rawRest) { say(rawRest); },
      history() {
        history.forEach((h, i) => say(String(i + 1).padStart(3) + '  ' + h));
      },
      clear() {
        out.textContent = '';
      },
      exit() {
        if (user === 'root') { setUser('chris'); say('privileges dropped.'); }
        else say('nowhere to go from here. the nav bar is up top.');
      },

      /* ── CTF ── */
      ctf(arg) {
        if (arg === 'reset') { ctf.reset(); say('progress cleared.'); return; }
        print(['five flags are hidden around this site.', 't-ok']);
        say('some are in this shell, some are not. format: flag{...}');
        blank();
        ctf.FLAGS.forEach(f => {
          const done = ctf.has(f.id);
          print([done ? '[x] ' : '[ ] ', done ? 't-ok' : 't-dim'], [f.name.padEnd(22), done ? 't-ok' : 't-out'], [done ? 'captured' : f.hint, 't-dim']);
        });
        blank();
        print([`${ctf.count()}/${ctf.FLAGS.length} captured. `, 't-hl'], ['bank one with: submit <flag>', 't-out']);
        dim('rot13 and base64 -d work here if you need them.');
      },
      submit(arg, args, rest, rawRest) {
        const text = rawRest.trim();
        if (!text) { say('usage: submit flag{...}'); return; }
        const result = ctf.submit(text);
        if (!result) { err('✗ not a flag.'); return; }
        if (result.repeat) { say(`already captured: ${result.hit.name}`); return; }
        ok(`✓ ${result.hit.name} captured (${ctf.count()}/${ctf.FLAGS.length})`);
        if (ctf.count() === ctf.FLAGS.length) {
          blank();
          ok('all five. you clearly do this for a living.');
          print(['I\'d like to hear how you found them: ', 't-out'], { text: 'cc7825@nyu.edu', href: LINKS.email });
        }
      },
      rot13(arg, args, rest, rawRest) {
        if (!rawRest) { say('usage: rot13 <text>'); return; }
        say(rawRest.replace(/[a-z]/gi, c => {
          const base = c <= 'Z' ? 65 : 97;
          return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
        }));
      },
      base64(arg, args, rest, rawRest) {
        const decode = /^(-d|--decode)\b/.test(rawRest);
        const text = rawRest.replace(/^(-d|--decode)\s*/, '');
        if (!text) { say('usage: base64 [-d] <text>'); return; }
        try { say(decode ? atob(text) : btoa(text)); } catch (e) { err('base64: invalid input'); }
      },

      /* ── Things people try ── */
      sudo(arg, args, rest) {
        if (user === 'root') { say("you're already root."); return; }
        if (!arg) { say('usage: sudo -l | sudo <command>'); return; }
        if (arg === '-l') {
          say('User chris may run the following commands on sec:');
          print(['    (root) NOPASSWD: ', 't-out'], ['/usr/bin/vim', 't-hl']);
          return;
        }
        if (/^(\/usr\/bin\/)?vim?$/.test(arg)) {
          if (/!\s*(\/bin\/)?(ba|z|da)?sh\b|:sh(ell)?\b|:term(inal)?\b|pty\.spawn/.test(rest)) becomeRoot();
          else {
            say('VIM - Vi IMproved, running as root.');
            dim('no interactive editor in here, so pass it a command with -c.');
            dim('vim can run shell commands. what would it run as?');
          }
          return;
        }
        err(`Sorry, user chris is not allowed to execute '${arg}' as root on sec.`);
        dim('sudo -l shows what is allowed.');
      },
      su() { err('su: Authentication failure'); dim('no password to guess. sudo -l'); },
      sh() { say("you're already in a shell. the question is whose."); dim('sudo -l'); },
      vim() { say('vim: you would never get out.'); dim('although vim with the right privileges is interesting. sudo -l'); },
      nano() { say('nano: read-only filesystem. your notes are safe from you.'); },
      emacs() { err('emacs: command not found (on purpose)'); },
      man() { say('RTFM, but nicely: help'); },
      rm(arg, args, rest) {
        if (/-\w*r/.test(rest)) { err("rm: cannot remove '/': Read-only file system"); dim('bold, though. I keep backups either way.'); }
        else err('rm: Read-only file system');
      },
      nmap() {
        say('Starting Nmap 7.95 ( https://nmap.org )');
        say('Nmap scan report for sec (127.0.0.1)');
        say('PORT     STATE    SERVICE');
        print(['22/tcp   open     ssh      ', 't-out'], ['Cowrie. yes, it is a honeypot', 't-dim']);
        print(['80/tcp   open     http     ', 't-out'], ['redirects to 443', 't-dim']);
        print(['443/tcp  open     https    ', 't-out'], ['static files, strict CSP', 't-dim']);
        print(['3306/tcp filtered mysql    ', 't-out'], ['there is no database', 't-dim']);
        say('Nmap done: 1 IP address (1 host up) scanned in 0.42 seconds');
      },
      ssh() {
        say("root@sec's password: ********");
        err('Permission denied, please try again.');
        dim('that was the Cowrie honeypot. you are attack event #193,140.');
      },
      nc() { say('listening on 0.0.0.0 4444 ...'); dim('nobody is calling back. egress is default-deny.'); },
      ping() { say('64 bytes from sec (127.0.0.1): icmp_seq=1 ttl=64 time=0.042 ms'); },
      python(arg, args, rest) {
        if (/pty/.test(rest)) say('TTY upgraded. (it already was one.)');
        else { say('Python 3.12: where most of my tooling lives.'); dim('see: projects'); }
      },
      sqlmap() { say('sqlmap: 0 injectable parameters. static site, no database.'); dim('the real thing, found and fixed: safebuyr'); },
      hydra() { say('hydra: no login form to brute force.'); dim('8 clusters of bots tried this on my honeypot: honeypot'); },
      hashcat() { say('hashcat: no hashes loaded.'); dim('cat /etc/shadow will not help, either.'); },
      msfconsole() { say('msf6 > no exploit needed. a misconfiguration is enough. sudo -l'); },
      gobuster() { say('no wordlist needed. sites often list their own hidden paths.'); dim('where do crawlers get told to stay out?'); },
      whois() { commands.whoami(); },
      curl(arg, args) {
        const target = args.filter(a => !a.startsWith('-')).pop();
        if (!target) { say('usage: curl <path>'); return false; }
        const host = target.match(/^(?:https?:\/\/)?([^/]+)(\/.*)?$/);
        let path = null;
        if (target.startsWith('/')) path = target;
        else if (host && SELF_HOSTS.includes(host[1])) path = host[2] || '/';
        else if (/^[\w.-]+\.(txt|json|html|css|js|xml)$/.test(target)) path = '/' + target;
        if (path === null) {
          err("curl: blocked by Content-Security-Policy (connect-src 'self')");
          dim('this page can only talk to its own origin. try a path, like /robots.txt');
          return false;
        }
        fetch(path)
          .then(res => { if (!res.ok) throw res.status; return res.text(); })
          .then(text => {
            const lines = text.replace(/\r/g, '').trimEnd().split('\n');
            lines.slice(0, 24).forEach(l => say(l.slice(0, 160)));
            if (lines.length > 24) dim(`... ${lines.length - 24} more lines`);
          })
          .catch(code => err(typeof code === 'number' ? `curl: (22) The requested URL returned error: ${code}` : 'curl: (7) Failed to connect'))
          .finally(() => { blank(); scrollToEnd(); });
        return true;
      }
    };

    const aliases = {
      '?': 'help', resume: 'about', summary: 'about', work: 'experience', cert: 'certs', tpot: 'honeypot',
      hobbies: 'interests', orgs: 'community', organizations: 'community', writeups: 'blog', posts: 'blog', flags: 'ctf', hint: 'ctf', hints: 'ctf', flag: 'submit',
      logout: 'exit', bash: 'sh', zsh: 'sh', '/bin/sh': 'sh', '/bin/bash': 'sh', vi: 'vim', python3: 'python',
      ncat: 'nc', netcat: 'nc', wget: 'curl', john: 'hashcat', metasploit: 'msfconsole', msf: 'msfconsole',
      dirb: 'gobuster', ffuf: 'gobuster', dirbuster: 'gobuster', nikto: 'gobuster', dir: 'ls', ll: 'ls', type: 'cat'
    };

    // Payloads people paste into anything with an input box. Checked before normal dispatch.
    const probes = [
      [/\/dev\/tcp|mkfifo|\bnc(at)?\b.*\s-e\b/i, () => {
        err('reverse shell blocked: egress is default-deny.');
        dim('there is a way to root that needs no callback. sudo -l');
      }],
      [/pty\.spawn/i, () => say('TTY upgraded. (it already was one.)')],
      [/<\s*\/?\s*(script|img|svg|iframe|body)|onerror\s*=|onload\s*=|javascript:/i, () => {
        err('XSS: no sink.');
        dim('output is written with textContent and the CSP has no unsafe-inline. view source and check.');
      }],
      [/\$\{jndi:/i, () => say('log4shell: there is no Java within a mile of this site.')],
      [/\{\{.*\}\}|<%=|\$\{\d/, () => say('SSTI: no template engine on this side. it stays a string.')],
      [/'\s*(or|and)\s+['"\d]|union\s+(all\s+)?select|drop\s+table|'\s*(--|#)|\bsleep\(\d/i, () => {
        say('SQL injection: there is no database back here.');
        dim('where there is one, I parameterize. the long version: safebuyr');
      }],
      [/\$\(|`|&&|\|\||;|\|/, () => {
        say('one command at a time: no chaining, pipes or substitution in this shell.');
        dim('good instinct, though.');
      }]
    ];

    const history = [];
    let historyAt = 0;
    let busy = false;

    function run(raw) {
      const line = raw.trim();
      print([promptText() + ' ', promptClass()], [line, 't-cmd']);
      if (line) {
        history.push(line);
        const lower = line.toLowerCase();
        const [name, ...args] = lower.split(/\s+/);
        const cmd = Object.hasOwn(aliases, name) ? aliases[name] : name;
        const rest = lower.slice(name.length).trim();
        const rawRest = line.slice(name.length).trim();
        // sudo, echo and the decoders get their arguments untouched; everything else is screened first
        const probe = ['sudo', 'echo', 'submit', 'rot13', 'base64'].includes(cmd) ? null : probes.find(([re]) => re.test(line));
        let async = false;
        if (probe) probe[1]();
        else if (Object.hasOwn(commands, cmd)) async = commands[cmd](args[0], args, rest, rawRest) === true;
        else {
          err('command not found: ' + name);
          print(['type ', 't-out'], ['help', 't-ok'], [' to see what works here', 't-out']);
        }
        if (cmd !== 'clear' && !async) blank();
      }
      historyAt = history.length;
      scrollToEnd();
    }

    // Type a command out character by character, then run it
    async function typeAndRun(cmd) {
      if (busy) return;
      busy = true;
      if (!reduceMotion) {
        const row = print([promptText() + ' ', promptClass()], ['', 't-cmd']);
        const span = row.lastChild;
        scrollToEnd();
        for (const ch of cmd) {
          span.textContent += ch;
          await sleep(45);
        }
        await sleep(180);
        row.remove();
      }
      run(cmd);
      history.pop(); // scripted commands stay out of the visitor's history
      historyAt = history.length;
      busy = false;
    }
    runInTerminal = typeAndRun;

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (busy) return;
        run(input.value);
        input.value = '';
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!history.length) return;
        e.preventDefault();
        historyAt = Math.max(0, Math.min(history.length, historyAt + (e.key === 'ArrowUp' ? -1 : 1)));
        input.value = history[historyAt] || '';
      } else if (e.key === 'Tab' && input.value.trim()) {
        const typed = input.value.trim().toLowerCase();
        const matches = Object.keys(commands).filter(c => c.startsWith(typed));
        if (matches.length === 1) {
          e.preventDefault();
          input.value = matches[0] + ' ';
        } else if (matches.length > 1) {
          e.preventDefault();
          dim(matches.join('  '));
          scrollToEnd();
        }
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        commands.clear();
      } else if (e.key === 'c' && e.ctrlKey && !String(window.getSelection())) {
        e.preventDefault();
        print([promptText() + ' ', promptClass()], [input.value + '^C', 't-cmd']);
        input.value = '';
        scrollToEnd();
      }
    });

    // Click anywhere in the window to focus the prompt, unless selecting text or following a link
    body.addEventListener('click', e => {
      if (e.target.closest('a') || String(window.getSelection())) return;
      input.focus({ preventScroll: true });
    });

    chips.addEventListener('click', e => {
      const btn = e.target.closest('button[data-cmd]');
      if (btn) typeAndRun(btn.dataset.cmd);
    });

    // Boot: swap the static fallback for a live session
    out.textContent = '';
    inputRow.hidden = false;
    chips.hidden = false;
    (async () => {
      await sleep(reduceMotion ? 0 : 700);
      await typeAndRun('whoami');
      print(['type ', 't-out'], ['help', 't-ok'], [' or tap a command below', 't-out']);
      scrollToEnd();
    })();
  })();

  /* Buttons elsewhere on the page that run a terminal command */
  $$('[data-run]').forEach(btn => {
    btn.addEventListener('click', () => {
      const terminal = $('#terminal');
      if (!terminal || !runInTerminal) return;
      terminal.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => runInTerminal(btn.dataset.run), reduceMotion ? 0 : 600);
    });
  });
})();
