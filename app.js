(function () {
  const { CONFIG, APTITUDES, PLACEMENTS, newRating, drift } = Rating;
  const KEY = 'uma-tt-tracker-v1';
  const UMAS = window.UMAS, byId = new Map(UMAS.map(u => [u.id, u]));
  const COLORS = ['#6aa9ff','#ff8f6b','#4cc38a','#e5c84d','#c58bff','#ff6bb5','#5ad1d1','#b5e04d','#ff6b6b','#8b9bff','#ffb36b','#6bd19a','#d98bd9','#9fb0c8','#e0a070'];

  const $ = id => document.getElementById(id);
  const blank = () => ({ round: 0, slots: Object.fromEntries(APTITUDES.map(a => [a, [null, null, null]])) });
  let state = load(), undo = [], hidden = new Set();
  // round loop: replace (end of round) -> top 3 -> bottom 3 -> replace
  let phase = 'replace', top = {}, bot = {};
  let editing = null; // {apt, i} while the picker is open for a slot

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.slots) return prune(s); } catch (e) {}
    return blank();
  }
  // empty any slot whose uma is no longer in the roster list (e.g. removed unplayable umas)
  function prune(s) {
    for (const a of APTITUDES) s.slots[a] = s.slots[a].map(x => (x && byId.has(x.id) ? x : null));
    return s;
  }
  function setStatus(ok, msg) {
    const el = $('save-status'); if (!el) return;
    el.textContent = msg || (ok ? 'Saved' : 'Save failed');
    el.classList.toggle('err', !ok);
  }
  // Progress lives entirely in this browser's localStorage — there is no server.
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); setStatus(true); }
    catch (e) { setStatus(false, 'Save failed — your browser may be blocking storage'); }
  }
  const allSlots = () => APTITUDES.flatMap(a => state.slots[a].map((s, i) => ({ apt: a, i, s, key: a + i })));
  const filled = () => allSlots().filter(x => x.s);
  const rosterFull = () => filled().length === 15;
  const onTeam = () => new Set(filled().map(x => x.s.id));

  // ---- picker ----
  function openPicker(apt, i) {
    editing = { apt, i };
    const cur = state.slots[apt][i];
    $('picker-title').textContent = (cur ? 'Replace ' + byId.get(cur.id).name : 'Choose uma') + ' — ' + apt;
    $('search').value = '';
    renderGrid();
    $('picker').showModal();
    $('search').focus();
  }
  function renderGrid() {
    const q = $('search').value.trim().toLowerCase();
    const cur = state.slots[editing.apt][editing.i];
    const taken = onTeam();
    if (cur) taken.delete(cur.id); // the uma being replaced stays selectable
    // one tile per outfit; all outfits of a uma on the team are locked together
    const tiles = UMAS.filter(u => u.name.toLowerCase().includes(q))
      .flatMap(u => u.outfits.map((f, n) => ({ u, f, label: u.outfits.length > 1 ? `Outfit ${n + 1}` : '' })));
    // previous uma first, since a reset is usually a rebuild of the same uma
    if (cur) tiles.sort((a, b) => (b.u.id === cur.id) - (a.u.id === cur.id));
    $('grid').innerHTML = '';
    for (const { u, f, label } of tiles) {
      const d = document.createElement('div');
      d.className = 'opt' + (taken.has(u.id) ? ' taken' : '') + (cur && cur.id === u.id && outfitOf(cur) === f.o ? ' prev' : '');
      d.innerHTML = avatar(u, f.o) + '<div>' + u.name + '</div>' + (label ? `<small>${label}</small>` : '');
      if (!taken.has(u.id)) d.onclick = () => choose(u.id, f.o);
      $('grid').appendChild(d);
    }
  }
  function choose(id, outfit) {
    const { apt, i } = editing, cur = state.slots[apt][i];
    // Any reset, same uma or not, starts again at the base rating with a fresh adjusting period.
    state.slots[apt][i] = { id, outfit, rating: CONFIG.baseRating, rounds: 0,
      history: [...(cur ? cur.history : []), { round: state.round, rating: CONFIG.baseRating, id, swap: !!cur }] };
    save();
    $('picker').close();
  }
  $('search').oninput = () => editing && renderGrid();
  $('picker').addEventListener('close', () => { editing = null; render(); });

  // ---- round ----
  function applyRound() {
    undo.push(JSON.stringify({ state, top, bot }));
    const byKey = {};
    for (const [k, n] of Object.entries(top)) byKey[k] = PLACEMENTS['top' + n];
    for (const [k, n] of Object.entries(bot)) byKey[k] = PLACEMENTS['bot' + n];
    state.round++;
    const rated = allSlots().filter(x => x.s).map(x => ({ s: x.s, key: x.key }));
    for (const { s, key } of rated) {
      if (key in byKey) s.rating = newRating(s.rating, byKey[key], s.rounds);
      s.rating = drift(s.rating);
      s.rounds++; // the adjusting period ticks down every round, placed or not
    }
    // Keep the mean of all rated umas at the base rating (1000) by shifting everyone equally.
    const centered = Rating.recenter(rated.map(x => x.s.rating));
    rated.forEach(({ s }, i) => {
      s.rating = centered[i];
      s.history.push({ round: state.round, rating: s.rating, id: s.id });
    });
    top = {}; bot = {}; phase = 'replace'; save(); render();
  }
  // click a card to cycle it through the free numbers 1 -> 2 -> 3 -> none
  function cycle(picks, key) {
    const taken = new Set(Object.entries(picks).filter(([k]) => k !== key).map(([, n]) => n));
    let n = picks[key] || 0;
    do n++; while (n <= 3 && taken.has(n));
    if (n > 3) delete picks[key]; else picks[key] = n;
  }
  $('next').onclick = () => {
    if (phase === 'replace') phase = 'top';
    else if (phase === 'top') phase = 'bottom';
    else return applyRound();
    render();
  };
  // Space / Enter advances the round (start round -> top 3 -> bottom 3 -> finish)
  document.addEventListener('keydown', e => {
    if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('picker').open || $('about').open || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    e.preventDefault(); // also stops a focused button from firing a second click
    if (!$('round').hidden && !$('next').disabled) $('next').click();
  });
  $('back').onclick = () => {
    if (phase === 'bottom') phase = 'top';
    else if (phase === 'top') phase = 'replace';
    else if (undo.length) { // step back into the previous round's bottom-3 state
      const u = JSON.parse(undo.pop()); state = u.state; top = u.top; bot = u.bot; phase = 'bottom'; save();
    }
    render();
  };
  $('clear-picks').onclick = () => { if (phase === 'top') top = {}; else bot = {}; render(); };
  // About dialog: renders info.md (headings, bullets, `code`) on first open
  $('about-btn').onclick = async () => {
    $('about').showModal();
    if ($('about').dataset.loaded) return;
    try {
      const r = await fetch('info.md'); if (!r.ok) throw 0;
      const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/`([^`]+)`/g, '<code>$1</code>');
      let html = '', list = false;
      for (const l of (await r.text()).split(/\r?\n/)) {
        const li = l.match(/^- (.*)/);
        if (list && !li) { html += '</ul>'; list = false; }
        if (li) { if (!list) { html += '<ul>'; list = true; } html += '<li>' + esc(li[1]) + '</li>'; }
        else if (/^#+ /.test(l)) { const n = l.match(/^#+/)[0].length; html += '<h' + n + '>' + esc(l.replace(/^#+ /, '')) + '</h' + n + '>'; }
        else if (l.trim()) html += '<p>' + esc(l) + '</p>';
      }
      $('about-body').innerHTML = html + (list ? '</ul>' : '');
      $('about').dataset.loaded = 1;
    } catch { $('about-body').textContent = 'Could not load info.md.'; }
  };
  $('reset-all').onclick = () => { if (confirm('Clear the roster and all history?')) { state = blank(); undo = []; top = {}; bot = {}; phase = 'replace'; save(); render(); } };
  $('export').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' }));
    a.download = 'uma-tt-tracker.json'; a.click();
  };
  $('import').onclick = () => $('import-file').click();
  $('import-file').onchange = async e => {
    try { const s = JSON.parse(await e.target.files[0].text()); if (!s.slots) throw 0; state = prune(s); undo = []; top = {}; bot = {}; phase = 'replace'; save(); render(); }
    catch (err) { alert('Not a valid tracker file.'); }
    e.target.value = '';
  };

  // ---- render ----
  const outfitOf = s => s.outfit || byId.get(s.id).outfits[0].o; // saves from before outfits default to the first
  function avatar(u, outfit) {
    const f = u.outfits.find(f => f.o === outfit) || u.outfits[0];
    return f ? `<img class="avatar" src="${f.img}" alt="">` : `<div class="avatar">${u.name.split(' ').map(w => w[0]).join('').slice(0, 3)}</div>`;
  }
  function delta(s) {
    const h = s.history; if (h.length < 2 || h[h.length - 1].swap) return ''; // a reset isn't a rating change
    const d = h[h.length - 1].rating - h[h.length - 2].rating;
    if (Math.abs(d) < 0.05) return '';
    return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d).toFixed(1)}</span>`;
  }
  const PHASE_INFO = {
    replace: ['End of round', 'Reset any uma that was rebuilt or replaced, then start the next round.', 'Start round: pick top 3'],
    top: ['Top 3 placers', 'Click a uma to cycle it through 1st, 2nd, 3rd (Top 1 = +3 … Top 3 = +1).', 'Next: pick bottom 3'],
    bottom: ['Bottom 3 placers', 'Click a uma to cycle it through Bottom 1 (worst, −3), 2, 3 (−1). Top 3 umas are locked.', 'Finish round'],
  };
  // FLIP: run fn (which re-renders), then slide each card from its old position to its new one
  function flip(fn) {
    const first = new Map([...document.querySelectorAll('.card[data-id]')].map(el => [el.dataset.id, el.getBoundingClientRect()]));
    fn();
    for (const el of document.querySelectorAll('.card[data-id]')) {
      const a = first.get(el.dataset.id), b = el.getBoundingClientRect();
      if (!a || (a.left === b.left && a.top === b.top)) continue;
      el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }],
        { duration: 250, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
  function render() {
    const full = rosterFull();
    $('phase').textContent = !full ? `1 · Filling the roster (${filled().length}/15)`
      : editing && state.slots[editing.apt][editing.i] ? '3 · Replacing an uma'
      : phase === 'replace' ? `3 · Replace uma / end of round ${state.round}`
      : `2 · Round ${state.round + 1}: ${phase === 'top' ? 'top 3' : 'bottom 3'}`;
    $('round').hidden = !full;
    const [title, hint, nextLabel] = PHASE_INFO[phase];
    $('round-title').textContent = title; $('round-hint').textContent = hint; $('next').textContent = nextLabel + '  [Space]';
    const picks = phase === 'top' ? top : bot;
    $('next').disabled = phase !== 'replace' && Object.keys(picks).length !== 3;
    $('back').disabled = phase === 'replace' && !undo.length;
    $('back').textContent = phase === 'replace' ? 'Undo last round' : 'Back';
    $('clear-picks').hidden = phase === 'replace';

    const roster = $('roster'); roster.innerHTML = '';
    for (const apt of APTITUDES) {
      const col = document.createElement('div'); col.className = 'col';
      col.innerHTML = `<h3>${apt}</h3>`;
      state.slots[apt].forEach((s, i) => {
        const c = document.createElement('div');
        if (!s) { c.className = 'card empty'; c.textContent = '+ Add uma'; c.onclick = () => { openPicker(apt, i); render(); }; }
        else {
          const u = byId.get(s.id), key = apt + i;
          c.className = 'card'; c.dataset.id = s.id;
          c.innerHTML = `${avatar(u, outfitOf(s))}<div><div class="name" title="${u.name}">${u.name}</div>
            <div class="rating">${s.rating.toFixed(1)} ${delta(s)}</div></div>`;
          const badge = (cls, txt) => c.insertAdjacentHTML('beforeend', `<span class="badge ${cls}">${txt}</span>`);
          if (full && phase !== 'replace') {
            if (top[key]) badge('top', 'T' + top[key]);
            if (phase === 'bottom' && bot[key]) badge('bot', 'B' + bot[key]);
            const locked = phase === 'bottom' && top[key];
            c.classList.add(locked ? 'disabled' : 'clickable');
            if (!locked) c.onclick = () => { cycle(picks, key); render(); };
          } else if (full) {
            c.insertAdjacentHTML('beforeend', '<div class="row"><button class="swap" title="Replace this uma (pre-filled with the current one)">Reset</button></div>');
            c.querySelector('.swap').onclick = () => { openPicker(apt, i); render(); };
          } else {
            c.insertAdjacentHTML('beforeend', '<div class="row"><button class="swap">Reset</button></div>');
            c.querySelector('.swap').onclick = () => { openPicker(apt, i); render(); };
          }
        }
        // drag to reorder within a distance; not while top/bottom picks are keyed to slot positions
        // The dragged card's spot looks empty; hovering another card swaps it into that spot live.
        // The DOM is swapped in place (no re-render) because removing the dragged node would cancel the drag.
        if (!(full && phase !== 'replace')) {
          // Pointer-based rather than native drag and drop, so the card under the cursor is a fully opaque clone.
          if (s) c.onpointerdown = e => {
            if (e.button !== 0 || e.pointerType === 'touch' || e.target.closest('button')) return;
            e.preventDefault(); // no text selection or native image drag
            const r = c.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
            let ghost = null;
            const move = ev => {
              if (!ghost) {
                if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
                ghost = c.cloneNode(true); ghost.className = 'card ghost'; delete ghost.dataset.id;
                ghost.style.cssText = `width:${r.width}px;height:${r.height}px;left:${r.left}px;top:${r.top}px`;
                document.body.appendChild(ghost);
                c.classList.add('dragging'); document.body.classList.add('dragging-card');
              }
              ghost.style.transform = `translate(${ev.clientX - sx}px, ${ev.clientY - sy}px)`;
              const t = document.elementFromPoint(ev.clientX, ev.clientY), over = t && t.closest('.card');
              if (!over || over === c || over.parentNode !== col || over.getAnimations().length) return; // not while still sliding
              const cards = [...col.querySelectorAll('.card')], a = cards.indexOf(c), b = cards.indexOf(over), arr = state.slots[apt];
              [arr[a], arr[b]] = [arr[b], arr[a]];
              flip(() => {
                const [x, y] = a < b ? [c, over] : [over, c], nx = x.nextSibling;
                if (nx === y) col.insertBefore(y, x); else { col.insertBefore(x, y); col.insertBefore(y, nx); }
              });
            };
            const up = () => {
              document.removeEventListener('pointermove', move);
              document.removeEventListener('pointerup', up);
              document.removeEventListener('pointercancel', up);
              if (!ghost) return;
              ghost.remove(); document.body.classList.remove('dragging-card');
              save(); render(); // re-render rebinds handlers to the new slot indexes
            };
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
            document.addEventListener('pointercancel', up);
          };
        }
        col.appendChild(c);
      });
      roster.appendChild(col);
    }

    const ranked = filled().sort((a, b) => b.s.rating - a.s.rating);
    $('board').innerHTML = ranked.map(x => `<li>${byId.get(x.s.id).name} <small>(${x.apt})</small><span class="r">${x.s.rating.toFixed(1)}</span></li>`).join('');
    drawChart();
  }

  // ---- chart (plain SVG, no dependencies) ----
  function drawChart() {
    const svg = $('chart'), W = svg.clientWidth || 800, H = 380, m = { l: 48, r: 12, t: 12, b: 28 };
    // only the current uma's run counts: a slot's line starts where its current uma joined
    const series = allSlots().filter(x => x.s).map(x => {
      const h = x.s.history, at = Math.max(0, h.map(p => !!p.swap).lastIndexOf(true));
      return { ...x, run: h.slice(at), color: COLORS[APTITUDES.indexOf(x.apt) * 3 + x.i] };
    });
    // window start: last N rounds, the longest-serving uma's join round, or round 0
    const range = $('range').value;
    const r0 = range === 'all' ? 0
      : range === 'oldest' ? Math.min(state.round, ...series.map(x => x.run[0].round))
      : Math.max(0, state.round - +range);
    for (const x of series) x.run = x.run.filter(p => p.round >= r0);
    $('legend').innerHTML = series.map(x => `<span data-k="${x.key}" class="${hidden.has(x.key) ? 'off' : ''}"><i style="background:${x.color}"></i>${byId.get(x.s.id).name}</span>`).join('');
    $('legend').querySelectorAll('span').forEach(el => el.onclick = () => { hidden.has(el.dataset.k) ? hidden.delete(el.dataset.k) : hidden.add(el.dataset.k); drawChart(); });
    const vis = series.filter(x => !hidden.has(x.key));
    const pts = vis.flatMap(x => x.run);
    let lo = Math.min(CONFIG.baseRating - 50, ...pts.map(p => p.rating)), hi = Math.max(CONFIG.baseRating + 50, ...pts.map(p => p.rating));
    lo = Math.floor(lo / 10) * 10 - 10; hi = Math.ceil(hi / 10) * 10 + 10;
    const span = Math.max(1, state.round - r0);
    const X = r => m.l + ((r - r0) / span) * (W - m.l - m.r), Y = v => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    let out = '';
    for (let k = 0; k <= 5; k++) {
      const v = lo + (hi - lo) * k / 5;
      out += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#333a48"/><text x="${m.l - 6}" y="${Y(v) + 4}" fill="#8b93a5" font-size="11" text-anchor="end">${Math.round(v)}</text>`;
    }
    const step = Math.ceil(span / 10);
    for (let r = r0; r <= r0 + span; r += step) out += `<text x="${X(r)}" y="${H - 8}" fill="#8b93a5" font-size="11" text-anchor="middle">${r}</text>`;
    out += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(CONFIG.baseRating)}" y2="${Y(CONFIG.baseRating)}" stroke="#8b93a5" stroke-dasharray="4 4"/>`;
    for (const x of vis) {
      out += `<polyline fill="none" stroke="${x.color}" stroke-width="2" points="${x.run.map(p => X(p.round) + ',' + Y(p.rating)).join(' ')}"/>`;
      for (const p of x.run) {
        out += `<circle cx="${X(p.round)}" cy="${Y(p.rating)}" r="${p.swap ? 5 : 3}" fill="${p.swap ? '#14161c' : x.color}" stroke="${x.color}" stroke-width="2"
          data-t="${byId.get(p.id).name} · round ${p.round} · ${p.rating.toFixed(1)}${p.swap ? ' (new uma)' : ''}"/>`;
      }
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = out;
  }
  const tip = $('tip');
  $('chart').addEventListener('mousemove', e => {
    const t = e.target.dataset && e.target.dataset.t;
    if (!t) { tip.hidden = true; return; }
    const r = $('chart-wrap').getBoundingClientRect();
    tip.textContent = t; tip.hidden = false;
    let x = e.clientX - r.left + 12;
    if (x + tip.offsetWidth > r.width) x = e.clientX - r.left - 12 - tip.offsetWidth;
    tip.style.left = Math.max(0, x) + 'px'; tip.style.top = (e.clientY - r.top - 28) + 'px';
  });
  $('chart').addEventListener('mouseleave', () => { tip.hidden = true; });
  window.addEventListener('resize', drawChart);
  $('range').onchange = drawChart;

  render();
})();
