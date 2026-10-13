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

  /* ── Nav: mobile toggle, scrollspy, progress bar ── */
  const navToggle = $('.nav-toggle');
  const navLinks = $('#nav-links');

  function setMenu(open) {
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  }

  navToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('open')));
  navLinks.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  if ('IntersectionObserver' in window) {
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

  /* ── Interactive terminal ── */
  (function initTerminal() {
    const out = $('#term-out');
    const body = $('#term-body');
    const input = $('#term-input');
    const inputRow = $('.terminal-input-row');
    const chips = $('.terminal-chips');
    if (!out || !input) return;

    const PROMPT = 'chris@sec:~$';
    const LINKS = {
      github: 'https://github.com/ChrisCortesSanchez',
      linkedin: 'https://www.linkedin.com/in/christopher-cortes-sanchez/',
      email: 'mailto:cc7825@nyu.edu',
      safebuyr: 'https://github.com/ChrisCortesSanchez/SafeBuyr',
      cspm: 'https://github.com/ChrisCortesSanchez/AWS-CSPM',
      honeypot: 'https://github.com/ChrisCortesSanchez/Tpot'
    };
    const SECTIONS = ['projects', 'experience', 'skills', 'background', 'contact'];

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
          if (!part.href.startsWith('mailto:')) {
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
    const kv = (key, value, cls = 't-hl') => print([key.padEnd(10) + ': ', 't-out'], [value, cls]);
    const blank = () => print('');

    function project(no, name, stack, lines, key) {
      print([`[${no}] `, 't-dim'], [name, 't-ok']);
      print(['     ' + stack, 't-hl']);
      lines.forEach(l => say('     - ' + l));
      print(['     ', 't-out'], { text: LINKS[key].replace('https://', ''), href: LINKS[key] });
    }

    const projectCmds = {
      safebuyr: () => project('01', 'SafeBuyr E-commerce Security Platform', 'Python, Flask, Docker, GitHub Actions', [
        '8-phase automated scanner against a live Flask/Docker app',
        'found and fixed 6 OWASP Top 10 classes; risk score 37/100 -> 2/100',
        'every vuln proven exploitable, every fix re-verified',
        'all 6 checks gate deployment in GitHub Actions'
      ], 'safebuyr'),
      cspm: () => project('02', 'AWS CSPM Tool', 'Python, AWS, boto3, GitHub Actions', [
        '26 CIS Benchmark v1.5.0 controls: IAM, S3, CloudTrail, EC2, password policy',
        'caught 4 real gaps in a live AWS account',
        '36 moto-mocked tests in CI, no credentials in the pipeline'
      ], 'cspm'),
      honeypot: () => project('03', 'Honeypot Threat Intelligence Pipeline', 'Python, Elasticsearch, DigitalOcean', [
        '193,139 real attack events from 6,713 unique IPs',
        'sensors: Cowrie (SSH), Dionaea (malware), Honeytrap (service emulation)',
        'flagged a Solana credential harvesting op and a Mirai-variant botnet',
        '62,201 malware samples, 8 attacker clusters, 37% from Netherlands VPS'
      ], 'honeypot')
    };

    const commands = {
      help() {
        const rows = [
          ['whoami', 'who is this'],
          ['projects', 'security projects (or: safebuyr, cspm, honeypot)'],
          ['skills', 'tools, languages, platforms'],
          ['experience', 'work history'],
          ['education', 'degree and coursework'],
          ['certs', 'certifications'],
          ['ctf', 'competitions and community'],
          ['contact', 'how to reach me'],
          ['open <name>', 'github | linkedin | email | safebuyr | cspm | honeypot'],
          ['cd <section>', SECTIONS.join(' | ')],
          ['clear', 'clear the screen']
        ];
        rows.forEach(([cmd, desc]) => print([cmd.padEnd(14), 't-ok'], [desc, 't-out']));
        print(['tab completes, ↑/↓ walks history', 't-dim']);
      },
      whoami() {
        say('christopher-cortes-sanchez');
        kv('Role', 'Application Security / DevSecOps');
        kv('School', 'NYU Tandon, BS Computer Science');
        kv('Cert', 'CompTIA Security+ (SY0-701)');
        kv('Status', 'Open to opportunities', 't-ok');
      },
      about() {
        say('NYU CS graduate (Security+) who builds Python security automation');
        say('for apps, cloud, and CI/CD, tested against live systems and real');
        say('attack data. Seeking Application Security and DevSecOps roles.');
      },
      projects() {
        projectCmds.safebuyr(); blank();
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
        print(['Jul 2023 - May 2026 · Brooklyn, NY', 't-dim']);
        say('- 100% course pass rate across 20+ students (Python, Precalc, Calculus)');
        say('- turned programming defects into structured root-cause analyses');
        say('- designed 50+ practice exercises for debugging and problem-solving');
      },
      education() {
        print(['NYU Tandon School of Engineering', 't-ok'], [' · May 2026', 't-dim']);
        say('B.S. Computer Science; Minor in Cybersecurity and Mathematics');
        say('Coursework: Application Security, Offensive Security,');
        say('            Network Security, Operating Systems');
      },
      certs() {
        print(['CompTIA Security+ (SY0-701)', 't-ok'], [' · issued June 2026', 't-dim']);
      },
      ctf() {
        say('- SHPE 2025 National Convention Cybersecurity Challenge (8th place)');
        say('- Buckeye CTF');
        say('- NYU Offensive Security Weekly Challenges');
        blank();
        print(['SHPE NYU Tandon, External Relations Committee', 't-hl'], [' · Jan - May 2026', 't-dim']);
        say('built the chapter\'s first external relations function');
      },
      contact() {
        print(['email     : ', 't-out'], { text: 'cc7825@nyu.edu', href: LINKS.email });
        print(['linkedin  : ', 't-out'], { text: 'linkedin.com/in/christopher-cortes-sanchez', href: LINKS.linkedin });
        print(['github    : ', 't-out'], { text: 'github.com/ChrisCortesSanchez', href: LINKS.github });
      },
      open(arg) {
        if (!Object.hasOwn(LINKS, arg)) {
          print(['usage: open <' + Object.keys(LINKS).join('|') + '>', 't-err']);
          return;
        }
        say('opening ' + arg + ' ...');
        if (arg === 'email') window.location.href = LINKS.email;
        else window.open(LINKS[arg], '_blank', 'noopener,noreferrer');
      },
      cd(arg) {
        const id = (arg || '').replace(/^[#~./]+|\/+$/g, '');
        if (!SECTIONS.includes(id)) {
          print(['cd: no such section: ' + (arg || ''), 't-err']);
          say('sections: ' + SECTIONS.join('  '));
          return;
        }
        say('-> #' + id);
        document.getElementById(id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      },
      ls() {
        print([SECTIONS.map(s => s + '/').join('  '), 't-hl']);
      },
      history() {
        history.forEach((h, i) => say(String(i + 1).padStart(3) + '  ' + h));
      },
      sudo() {
        print(['chris is not in the sudoers file. This incident will be reported.', 't-err']);
      },
      clear() {
        out.textContent = '';
      }
    };

    const aliases = { '?': 'help', resume: 'about', summary: 'about', work: 'experience', cert: 'certs', tpot: 'honeypot' };
    const history = [];
    let historyAt = 0;
    let busy = false;

    function scrollToEnd() { body.scrollTop = body.scrollHeight; }

    function run(raw) {
      const line = raw.trim();
      print([PROMPT + ' ', 't-prompt'], [line, 't-cmd']);
      if (line) {
        history.push(line);
        const [name, ...args] = line.toLowerCase().split(/\s+/);
        const cmd = aliases[name] || name;
        if (Object.hasOwn(commands, cmd)) commands[cmd](args[0]);
        else {
          print(['command not found: ' + name, 't-err']);
          print(['type ', 't-out'], ['help', 't-ok'], [' to see what works here', 't-out']);
        }
        if (cmd !== 'clear') blank();
      }
      historyAt = history.length;
      scrollToEnd();
    }

    // Type a command out character by character, then run it
    async function typeAndRun(cmd) {
      if (busy) return;
      busy = true;
      if (!reduceMotion) {
        const row = print([PROMPT + ' ', 't-prompt'], ['', 't-cmd']);
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
          print([matches.join('  '), 't-dim']);
          scrollToEnd();
        }
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        commands.clear();
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
})();
