(() => {
  'use strict';
  const E = window.BeidouEngine, S = window.BeidouScene;
  const $ = id => document.getElementById(id);
  const canvas = $('world'), context = canvas.getContext('2d'), tray = $('parts-grid');
  const storageKey = 'beidou-assembly-game-v2';
  let state = E.INITIAL(), selected = null, hovered = null, focus = 'all', group = 'all', hints = false;
  let assets = {}, earth = null, silhouettes = {}, ready = false, animations = {}, orbitTime = 0, faultAge = 0;
  let width = 1200, height = 750, lastFrame = 0, drag = null, suppressClickUntil = 0, initialResize = true;
  let sound = true, audio = null, lastPhase = 'assembly', lastPersist = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let motionEnabled = !reducedMotion, visualTime = 0, rotatingEarth = null, feedback = null, feedbackTimer = null;
  const createCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function updateMotionButton() {
    $('motion-button').textContent = motionEnabled ? '动画开' : '动画关';
    $('motion-button').setAttribute('aria-pressed', String(motionEnabled));
  }
  $('motion-button').addEventListener('click', () => { motionEnabled = !motionEnabled; updateMotionButton(); });
  updateMotionButton();
  function mapFeedback(kind, title, message, point) {
    clearTimeout(feedbackTimer);
    const panel = $('scene-feedback'); panel.hidden = false; panel.className = 'scene-feedback ' + kind;
    $('feedback-icon').textContent = kind === 'success' ? '✓' : '×';
    $('feedback-title').textContent = title; $('feedback-text').textContent = message;
    $('world-frame').classList.remove('drop-error', 'drop-success');
    $('world-frame').classList.add('drop-' + kind);
    feedback = {kind: kind, x: point.x, y: point.y, age: 0};
    feedbackTimer = setTimeout(() => {
      panel.hidden = true; $('world-frame').classList.remove('drop-error', 'drop-success');
    }, kind === 'success' ? 3000 : 4500);
  }
  function clearFeedback() {
    clearTimeout(feedbackTimer); feedback = null; $('scene-feedback').hidden = true;
    $('world-frame').classList.remove('drop-error', 'drop-success');
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const legacy = saved ? null : JSON.parse(localStorage.getItem('beidou-assembly-game-v1'));
    if (saved && saved.version === 2) state = E.restored(saved.state);
    else if (legacy && legacy.version === 1) { state = E.restored(legacy.state); state.fault = null; state.clockNs = 0; }
  } catch (_) {}
  // Old V2 saves may contain the retired ground fault experiment; resume them cleanly.
  if (state.fault === 'ground' || state.fault === 'clock' || state.challenge === 'ground' || state.challenge === 'clock') E.recover(state);
  state.observed = [];
  const imagePath = p => `assets/${(window.BEIDOU_ASSET_FILES || {})[p.file] || `${p.file}.svg`}`;
  function notify(title, message, kind = '') {
    $('message-title').textContent = title; $('message-text').textContent = message;
    $('message-box').className = `message-box ${kind}`;
  }
  function persist() { try { localStorage.setItem(storageKey, JSON.stringify({ version: 2, state })); } catch (_) {} }
  function tone(success = true) {
    if (!sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
      const now = audio.currentTime, notes = success ? [523, 784] : [220, 185];
      notes.forEach((hz, i) => { const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; osc.frequency.value = hz; gain.gain.setValueAtTime(0, now + i * .08); gain.gain.linearRampToValueAtTime(.14, now + i * .08 + .01); gain.gain.exponentialRampToValueAtTime(.002, now + i * .08 + .17); osc.connect(gain); gain.connect(audio.destination); osc.start(now + i * .08); osc.stop(now + i * .08 + .2); });
    } catch (_) { sound = false; $('sound-button').textContent = '音效不可用'; }
  }
  E.PARTS.forEach(p => {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'part-card'; card.dataset.part = p.id;
    card.setAttribute('aria-pressed', 'false'); card.setAttribute('aria-label', `${p.name}，${p.short}，选择或拖动安装`);
    const img = new Image(); img.src = imagePath(p); img.alt = ''; img.draggable = false;
    const name = document.createElement('span'); name.className = 'part-name'; name.textContent = p.name;
    const subtitle = document.createElement('span'); subtitle.className = 'part-subtitle'; subtitle.textContent = p.short;
    const check = document.createElement('span'); check.className = 'part-check'; check.textContent = '✓'; check.hidden = true;
    card.append(img, name, subtitle, check); tray.append(card);
    const target = document.createElement('button'); target.type = 'button'; target.dataset.target = p.id; target.textContent = `安装到 ${p.name} 接口`;
    $('install-targets').append(target);
  });
  function setView(id) {
    focus = ['all', 'space', 'ground', 'user'].includes(id) ? id : 'all';
    document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === focus); b.setAttribute('aria-pressed', String(b.dataset.view === focus)); });
  }
  function showPart(id) {
    const p = E.PARTS.find(p => p.id === id); if (!p) return;
    selected = p.id;
    $('detail-title').textContent = p.name; $('detail-text').textContent = p.description;
    if (width < 540) setView(p.group);
    if (state.placed.includes(id)) notify(p.name, p.description);
    else notify(`拿起了 ${p.name}`, `${p.description} 把它放到对应的轮廓接口。`);
    updateUI();
  }
  function updateUI() {
    $('installed-count').textContent = state.placed.length;
    $('progress-fill').style.width = `${state.placed.length / E.PARTS.length * 100}%`;
    document.querySelector('.progress-track').setAttribute('aria-valuenow', state.placed.length);
    $('tray-count').textContent = `${9 - state.placed.length} 件待装`;
    tray.querySelectorAll('[data-part]').forEach(card => {
      const p = E.PARTS.find(p => p.id === card.dataset.part), installed = state.placed.includes(p.id);
      card.hidden = group !== 'all' && p.group !== group;
      card.classList.toggle('selected', p.id === selected); card.classList.toggle('installed', installed);
      card.setAttribute('aria-pressed', String(p.id === selected));
      card.querySelector('.part-check').hidden = !installed;
      card.setAttribute('aria-label', `${p.name}，${installed ? '已安装，点击了解作用' : '选择或拖动安装'}`);
    });
    $('install-targets').querySelectorAll('[data-target]').forEach(b => b.disabled = state.placed.includes(b.dataset.target) || state.phase !== 'assembly');
    const active = state.phase !== 'assembly';
    $('start-button').disabled = !ready || state.placed.length !== 9 || state.phase === 'running';
    $('start-button').innerHTML = state.phase === 'complete' ? '<span aria-hidden="true">↻</span> 重播救援任务' : '<span aria-hidden="true">▶</span> 启动北斗导航';
    $('pause-button').disabled = !active;
    $('pause-button').textContent = state.fault ? '恢复系统' : state.paused ? '继续演示' : '暂停演示';
    $('hint-button').disabled = active;

    $('state-label').textContent = !active ? state.placed.length === 9 ? '系统装配完成' : '等待装配' : state.fault ? '故障实验观察中' : state.paused ? '运行已暂停' : state.phase === 'complete' ? '救援任务完成' : '北斗导航运行中';
    $('state-dot').className = state.fault ? 'fault' : active ? 'running' : '';
    document.querySelectorAll('[data-step]').forEach(s => { s.classList.toggle('active', s.dataset.step === (state.fault || state.challenge ? 'challenge' : active ? 'running' : 'assembly')); s.classList.toggle('done', s.dataset.step === 'assembly' && active); });
    $('world-hint').lastChild.textContent = state.fault ? '观察误差范围，再恢复系统继续任务' : active ? '点击场景中的组件，查看它的职责' : selected && !state.placed.includes(selected) ? `把 ${E.PARTS.find(p => p.id === selected).name} 拖到接口，或点击对应轮廓` : '拿起组件，拖到场景中的轮廓';
  }
  function install(id, target, source) {
    if (!ready) return;
    const result = E.install(state, id, target);
    if (!result.ok) {
      const destination = E.PARTS.find(p => p.id === target);
      mapFeedback('error', '摆放出错，再试一次', result.message, source || destination || {x:600,y:375});
      notify('接口还没对上，再试一次', result.message, 'error'); tone(false); return;
    }
    const p = E.PARTS.find(p => p.id === id);
    animations[id] = { x: source ? source.x : p.x, y: source ? source.y : p.y - 30, age: motionEnabled ? 0 : 1.2 };
    mapFeedback('success', p.name + ' · 安装正确', result.complete ? '九个组件已归位！点击地图下方的“启动北斗导航”。' : '组件已点亮。连接的组件就位后，信号会开始流动。', p);
    selected = null; hovered = null;
    notify(result.complete ? '北斗系统，拼装完成！' : `${p.name} 已就位`, result.complete ? '九个组件各就其位。现在启动导航，看看卫星、地面站和终端怎样协作。' : p.description, 'success');
    tone(true); updateUI(); persist();
  }
  function scenePoint(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * width / rect.width, y = (event.clientY - rect.top) * height / rect.height;
    return S.camera(width, height, focus).toWorld(x, y);
  }
  function startDrag(event, id, owner) {
    if (!ready || state.phase !== 'assembly' || state.placed.includes(id) || event.button !== 0) return;
    showPart(id);
    drag = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, owner };
    try { owner.setPointerCapture(event.pointerId); } catch (_) {}
  }
  const supportsPointer = !!window.PointerEvent;
  function onDragStart(event) {
    const card = event.target.closest('[data-part]'); if (card) startDrag(event, card.dataset.part, card);
  }
  tray.addEventListener(supportsPointer ? 'pointerdown' : 'mousedown', onDragStart);
  tray.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) return;
    const card = event.target.closest('[data-part]'); if (card) showPart(card.dataset.part);
  });
  function onDragMove(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 7) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    const ghost = $('drag-sprite'), part = E.PARTS.find(p => p.id === drag.id);
    ghost.hidden = false; ghost.querySelector('img').src = imagePath(part); ghost.querySelector('span').textContent = part.name;
    ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`;
    const rect = canvas.getBoundingClientRect(), inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    const hit = inside ? E.hitTest(scenePoint(event).x, scenePoint(event).y, state) : null;
    hovered = hit ? hit.id : null;
  }
  document.addEventListener(supportsPointer ? 'pointermove' : 'mousemove', onDragMove, { passive: false });
  function endDrag(event, cancel = false) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const finished = drag; drag = null; $('drag-sprite').hidden = true;
    try { finished.owner.releasePointerCapture(event.pointerId); } catch (_) {}
    if (finished.moved) {
      suppressClickUntil = Date.now() + 350;
      if (!cancel) {
        const rect = canvas.getBoundingClientRect(), inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        const point = scenePoint(event), target = inside ? E.hitTest(point.x, point.y, state) : null;
        if (target) install(finished.id, target.id, point);
        else if (inside) {
          mapFeedback('error', '这里不是安装位置', '请把组件移到对应的轮廓上，或开启“显示安装提示”。', point);
          notify('摆放出错，再试一次', '对准地图中的组件轮廓。也可以先点组件，再点安装位置。', 'error'); tone(false);
        } else notify('组件已回到工作台', '把组件拖进地图，放到对应的轮廓上。');
      }
    }
    hovered = null;
  }
  document.addEventListener(supportsPointer ? 'pointerup' : 'mouseup', event => endDrag(event));
  document.addEventListener('pointercancel', event => endDrag(event, true));
  canvas.addEventListener(supportsPointer ? 'pointermove' : 'mousemove', event => {
    if (drag || !ready) return;
    const point = scenePoint(event), pending = selected && !state.placed.includes(selected) && state.phase === 'assembly';
    const hit = E.hitTest(point.x, point.y, state, orbitTime, !pending); hovered = hit ? hit.id : null;
    canvas.style.cursor = hovered ? 'pointer' : 'default';
  });
  canvas.addEventListener(supportsPointer ? 'pointerleave' : 'mouseleave', () => { if (!drag) hovered = null; });
  // Older Safari / embedded WebViews may only expose mouse and touch events.
  if (!supportsPointer) {
    function touchEvent(event, ending) {
      const list = ending ? event.changedTouches : event.touches;
      let touch = null;
      for (let i = 0; i < list.length; i++) {
        if (!drag || drag.pointerId === list[i].identifier) { touch = list[i]; break; }
      }
      return touch ? { target: event.target, button: 0, pointerId: touch.identifier,
        clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => event.preventDefault() } : null;
    }
    tray.addEventListener('touchstart', event => {
      if (drag) return;
      const e = touchEvent(event, false); if (e) onDragStart(e);
    }, {passive: false});
    document.addEventListener('touchmove', event => {
      if (!drag) return; const e = touchEvent(event, false); if (e) onDragMove(e);
    }, {passive: false});
    document.addEventListener('touchend', event => {
      const e = touchEvent(event, true); if (e) endDrag(e);
    });
    document.addEventListener('touchcancel', event => {
      const e = touchEvent(event, true); if (e) endDrag(e, true);
    });
  }
  canvas.addEventListener('click', event => {
    if (!ready) return;
    const point = scenePoint(event), pending = selected && !state.placed.includes(selected) && state.phase === 'assembly';
    const target = E.hitTest(point.x, point.y, state, orbitTime, !pending);
    if (target && pending) install(selected, target.id, point);
    else if (target) showPart(target.id);
    else if (pending) { mapFeedback('error', '这里不是安装位置', '点击对应轮廓，或开启“显示安装提示”。', point); tone(false); }
  });
  $('install-targets').addEventListener('click', e => { const b = e.target.closest('[data-target]'); if (b) install(selected, b.dataset.target); });
  document.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => {
    group = b.dataset.group; document.querySelectorAll('[data-group]').forEach(t => { t.classList.toggle('active', t === b); t.setAttribute('aria-pressed', String(t === b)); });
    if (width < 540 && group !== 'all') setView(group); updateUI();
  }));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('hint-button').addEventListener('click', () => { hints = !hints; $('hint-button').setAttribute('aria-pressed', String(hints)); $('hint-button').textContent = hints ? '隐藏安装提示' : '显示安装提示'; });
  $('start-button').addEventListener('click', () => {
    if (!E.start(state)) return; orbitTime = 0; faultAge = 0;
    notify('导航上线，救援出发', '卫星播发导航信号，地面段持续监控维护，终端接收多颗卫星信号并计算位置。蓝色箭头指向终端；金色箭头表示监控和信息更新。');
    updateUI(); persist(); tone(true);
  });
  $('pause-button').addEventListener('click', () => {
    if (state.fault) { E.recover(state); faultAge = 0; notify('系统已恢复', '可靠导航需要系统协作，也需要掌握关键技术和持续维护能力。自主可控与开放合作、兼容其他导航系统可以同时实现。', 'success'); }
    else state.paused = !state.paused;
    updateUI(); persist();
  });
  function reset() {
    clearFeedback();
    state = E.INITIAL(); selected = null; hovered = null; animations = {}; orbitTime = 0; faultAge = 0;
    $('detail-title').textContent = '每个组件，都有自己的职责'; $('detail-text').textContent = '太空提供导航信号，地面负责监控维护，终端接收信号并计算位置。';
    notify('新的拼装任务已准备好', '从组件库拿起第一个组件，寻找它在系统中的位置。'); updateUI(); persist();
  }
  $('reset-button').addEventListener('click', reset);
  $('sound-button').addEventListener('click', () => { sound = !sound; $('sound-button').textContent = sound ? '音效开' : '音效关'; $('sound-button').setAttribute('aria-pressed', String(sound)); $('sound-button').setAttribute('aria-label', sound ? '关闭音效' : '开启音效'); if (sound) tone(); });
  $('fullscreen-button').addEventListener('click', async () => {
    try { if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen || document.webkitExitFullscreen).call(document); else await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); } catch (_) { notify('当前环境暂不支持全屏', '仍可直接体验拼装和运行演示。'); }
  });
  document.addEventListener('fullscreenchange', () => $('fullscreen-button').textContent = document.fullscreenElement ? '退出全屏' : '全屏');
  let fallbackDialog = null, dialogReturnFocus = null;
  const shade = document.createElement('div'); shade.className = 'dialog-shade'; shade.hidden = true; document.body.appendChild(shade);
  function openDialog(id) {
    const dialog = $(id); dialogReturnFocus = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { fallbackDialog = dialog; dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); shade.hidden = false; }
    dialog.querySelector('button').focus();
  }
  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    fallbackDialog = null; shade.hidden = true;
    if (dialogReturnFocus) dialogReturnFocus.focus();
  }
  document.querySelectorAll('dialog form').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); closeDialog(form.parentNode); }));
  document.addEventListener('keydown', event => {
    if (!fallbackDialog) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(fallbackDialog); }
    else if (event.key === 'Tab') {
      const items = fallbackDialog.querySelectorAll('button, a[href]'), first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  $('help-button').addEventListener('click', () => openDialog('help-dialog'));
  $('help-done').addEventListener('click', () => closeDialog($('help-dialog')));
  $('sources-button').addEventListener('click', () => openDialog('sources-dialog'));

  function resize() {
    const rect = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width; height = rect.height; canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (initialResize) { if (width < 540) setView('space'); initialResize = false; }
  }
  if (window.ResizeObserver) { const resizeObserver = new window.ResizeObserver(resize); resizeObserver.observe(canvas); }
  window.addEventListener('resize', resize);
  resize();
  function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`无法加载 ${src}`)); image.src = src; }); }
  async function load() {
    try {
      await Promise.all(E.PARTS.map(async p => {
        try { assets[p.file] = await loadImage(imagePath(p)); }
        catch (_) { assets[p.file] = await loadImage(`assets/${p.file}.svg`); tray.querySelector(`[data-part="${p.id}"] img`).src = `assets/${p.file}.svg`; }
      }));
      earth = await loadImage('assets/earth-sphere.png');
      try {
        const texture = await loadImage('assets/earth-texture.jpg');
        rotatingEarth = S.createRotatingEarth(texture, createCanvas); earth = rotatingEarth.canvas;
      } catch (_) { /* Keep the static Earth when pixel readback is unavailable. */ }
      silhouettes = S.masks(assets, (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
      ready = true; $('scene-loading').hidden = true; updateUI();
      if (state.placed.length) notify('上次的装配进度已恢复', state.phase === 'assembly' ? '可以继续安装剩余组件，也可以重新开始。' : '运行已暂停。点击“继续演示”恢复导航。');
    } catch (error) { $('scene-loading').textContent = '组件加载失败，请确认 assets 文件夹和网页放在一起。'; notify('素材尚未加载完整', error.message, 'error'); }
  }
  function frame(timestamp) {
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .1) : 0; lastFrame = timestamp;
    if (ready) {
      // Size polling also covers layout changes when ResizeObserver is unavailable.
      if (!window.ResizeObserver) { const rect = canvas.getBoundingClientRect(); if (rect.width !== width || rect.height !== height) resize(); }
      if (feedback) { feedback.age += dt; if (feedback.age > 2.5) feedback = null; }
      if (motionEnabled && !document.hidden && (state.phase === 'assembly' || !state.paused)) visualTime += dt;
      if (rotatingEarth && motionEnabled && !document.hidden) rotatingEarth.update(visualTime);
      if (motionEnabled && !state.paused && !state.challenge && !document.hidden) { if (state.phase !== 'assembly') orbitTime += dt; if (state.fault) faultAge += dt; }
      E.tick(state, document.hidden || !motionEnabled ? 0 : dt);
      Object.keys(animations).forEach(id => { animations[id].age += dt; if (animations[id].age > 1.3) delete animations[id]; });
      S.draw(context, { width, height, state, assets, earth, silhouettes, time: orbitTime, effectTime: visualTime, feedback: feedback, selected, hovered, hints, animations, focus, clockError:state.clockNs, faultAge });
      if (lastPhase !== state.phase) {
        if (state.phase === 'complete') { notify('救援船已抵达，任务完成', '三个组成部分协作，才能提供可靠的导航服务。', 'success'); tone(); persist(); }
        updateUI(); lastPhase = state.phase;
      }
      if (timestamp - lastPersist > 4000 && state.phase === 'running') { persist(); lastPersist = timestamp; }
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener('pagehide', persist);
  window.beidouGame = { getState: () => JSON.parse(JSON.stringify(state)), select: showPart, install, reset, start: () => $('start-button').click(), getView: () => focus };
  updateUI(); load(); requestAnimationFrame(frame);
})();
