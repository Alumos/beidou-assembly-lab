(function (root, factory) {
  const engine = typeof module === 'object' && module.exports ? require('./engine.js') : root.BeidouEngine;
  const api = factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BeidouScene = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  const W = 1200, H = 750, FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
  let textScale = 1;
  const random = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const stars = Array.from({ length: 90 }, (_, i) => ({ x: random(i + 4) * W, y: random(i + 404) * 520, r: .35 + random(i + 704) * 1.1, a: .15 + random(i + 304) * .65 }));
  function camera(width, height, focus = 'all') {
    const narrow = width < 540;
    const centers = { all: { x: 600, y: 375, z: narrow ? 1 : 1 }, space: { x: 813, y: 268, z: narrow ? 1.68 : 1.4 }, ground: { x: 306, y: 574, z: narrow ? 2.15 : 1.78 }, user: { x: 947, y: 584, z: narrow ? 2.04 : 1.75 } };
    const c = centers[focus] || centers.all, scale = Math.min(width / W, height / H) * c.z;
    return { scale, x: width / 2 - c.x * scale, y: height / 2 - c.y * scale, toWorld(px, py) { return { x: (px - this.x) / scale, y: (py - this.y) / scale }; } };
  }
  function makeEarth(texture, createCanvas, size = 420) {
    const source = createCanvas(texture.width, texture.height), sc = source.getContext('2d');
    sc.drawImage(texture, 0, 0);
    const input = sc.getImageData(0, 0, texture.width, texture.height).data;
    const sphere = createCanvas(size, size), out = sphere.getContext('2d'), pixels = out.createImageData(size, size);
    const r = size * .485, center = size / 2, rot = 1.46;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (x - center) / r, ny = (y - center) / r, d = nx * nx + ny * ny;
      if (d >= 1) continue;
      const nz = Math.sqrt(1 - d), longitude = Math.atan2(nx, nz) + rot, latitude = Math.asin(-ny);
      const u = ((longitude / (Math.PI * 2) + .5) % 1 + 1) % 1, v = .5 - latitude / Math.PI;
      const sx = Math.floor(u * (texture.width - 1)), sy = Math.floor(v * (texture.height - 1));
      const i = (sy * texture.width + sx) * 4, j = (y * size + x) * 4;
      const light = Math.max(.12, -.5 * nx - .38 * ny + .68 * nz), rim = Math.pow(1 - nz, 3) * .45;
      pixels.data[j] = input[i] * light + 14 * rim;
      pixels.data[j + 1] = input[i + 1] * light + 82 * rim;
      pixels.data[j + 2] = input[i + 2] * light + 139 * rim;
      pixels.data[j + 3] = Math.min(255, (1 - Math.sqrt(d)) * r * 255);
    }
    out.putImageData(pixels, 0, 0);
    return sphere;
  }
  function masks(assets, createCanvas) {
    const result = {};
    E.PARTS.forEach(p => {
      const c = createCanvas(360, 283), ctx = c.getContext('2d');
      ctx.drawImage(assets[p.file], 0, 0, 360, 283);
      ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#4b799b'; ctx.fillRect(0, 0, 360, 283);
      result[p.id] = c;
    });
    return result;
  }
  function text(c, value, x, y, size = 15, color = '#3a5d78', align = 'left', weight = 400) {
    size = Math.max(size, 14 / textScale);
    c.fillStyle = color; c.font = `${weight} ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(value, x, y);
  }
  function textRuns(c, runs, x, y, size = 15) {
    size = Math.max(size, 14 / textScale); c.textAlign = 'left'; c.textBaseline = 'middle';
    runs.forEach(run => {
      c.fillStyle = run.color; c.font = `${run.weight || 700} ${size}px ${FONT}`;
      c.fillText(run.value, x, y); x += c.measureText(run.value).width;
    });
  }
  function line(c, x1, y1, x2, y2, color, width = 1) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
  function path(c, pts, fill, stroke) {
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }
  // Canvas roundRect only arrived in Chromium 99; use the long-supported path API.
  function roundedPath(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  // A small software-rendered sphere: no WebGL, CSS filters or GPU-specific effects.
  // Projection and lighting are cached; only texture longitude changes at 12 fps.
  function createRotatingEarth(texture, createCanvas) {
    const size = 280, tw = 1024, th = 512;
    const source = createCanvas(tw, th), sourceContext = source.getContext('2d');
    sourceContext.drawImage(texture, 0, 0, tw, th);
    const input = sourceContext.getImageData(0, 0, tw, th).data;
    const canvas = createCanvas(size, size), context = canvas.getContext('2d');
    const pixels = context.createImageData(size, size), lookup = [];
    const r = size * .48, center = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (x - center) / r, ny = (y - center) / r, d = nx * nx + ny * ny;
      if (d >= 1) continue;
      const nz = Math.sqrt(1 - d);
      const u = Math.floor(((Math.atan2(nx, nz) + 1.46) / (Math.PI * 2) + .5) * tw);
      const row = Math.min(th - 1, Math.floor((.5 - Math.asin(-ny) / Math.PI) * th));
      const light = .42 + .58 * Math.max(0, -.42 * nx - .28 * ny + .8 * nz);
      lookup.push({ j: (y * size + x) * 4, u: u, row: row * tw, light: light });
      pixels.data[(y * size + x) * 4 + 3] = Math.min(255, (1 - Math.sqrt(d)) * r * 255);
    }
    let last = -1;
    function update(time) {
      const frame = Math.floor(time * 12);
      if (frame === last) return;
      last = frame;
      const shift = Math.floor(frame / 12 * tw / 55);
      for (let k = 0; k < lookup.length; k++) {
        const v = lookup[k], i = (v.row + (v.u + shift) % tw) * 4;
        pixels.data[v.j] = input[i] * v.light;
        pixels.data[v.j + 1] = input[i + 1] * v.light;
        pixels.data[v.j + 2] = input[i + 2] * v.light;
      }
      context.putImageData(pixels, 0, 0);
    }
    update(0);
    return { canvas: canvas, update: update };
  }
  function rounded(c, x, y, w, h, radius, fill, stroke) {
    roundedPath(c, x, y, w, h, radius);
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }
  function orbitalPath(c, orbit, front, active) {
    c.save(); c.translate(813, 276); c.rotate(orbit.angle); c.beginPath();
    c.ellipse(0, 0, orbit.rx, orbit.ry, 0, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI);
    c.strokeStyle = active ? (front ? 'rgba(42,112,136,0.455)' : 'rgba(75,122,155,0.310)') : 'rgba(75,120,155,0.286)'; c.lineWidth = front ? 1.5 : 1;
    c.stroke(); c.restore();
  }
  function sprite(c, image, x, y, w, h, opacity = 1) {
    if (!image) return;
    c.save(); c.globalAlpha *= opacity; c.drawImage(image, x - w / 2, y - h / 2, w, h); c.restore();
  }
  function terrain(c, time) {
    const sea = c.createLinearGradient(0, 465, 0, 750); sea.addColorStop(0, '#eff5fa'); sea.addColorStop(1, '#eff5fa');
    path(c, [[0, 532], [575, 469], [1200, 522], [1200, 750], [0, 750]], sea);
    c.save(); c.lineWidth = 1;
    for (let i = 0; i < 25; i++) {
      const y = 510 + i * 10, x = 510 + random(i) * 135;
      c.strokeStyle = `rgba(103,166,185,${.07 + random(i + 12) * .06})`; c.beginPath(); c.moveTo(x, y);
      c.bezierCurveTo(x + 110, y - 7, x + 200, y + 6, x + 280, y - 2); c.stroke();
      c.beginPath(); c.moveTo(x + 360, y + 2); c.bezierCurveTo(x + 430, y - 5, 1190, y + 6, 1260, y); c.stroke();
    } c.restore();
    path(c, [[33, 560], [420, 472], [591, 581], [482, 682], [118, 707], [25, 622]], '#cedce8', '#4b7c9b');
    path(c, [[33, 560], [420, 472], [591, 581], [482, 657], [118, 678], [25, 622]], '#d0dde6', '#4b809b');
    for (let i = 0; i < 8; i++) line(c, 68 + i * 48, 563 - i * 10.5, 198 + i * 37, 672 - i * 3, 'rgba(75,129,155,0.400)');
    for (let i = 0; i < 4; i++) line(c, 70 + i * 7, 571 + i * 25, 447 + i * 22, 492 + i * 39, 'rgba(75,129,155,0.400)');
    // Three distinct station foundations and embedded light strips.
    [[168, 604], [320, 633], [461, 586]].forEach(([x, y]) => {
      path(c, [[x - 65, y], [x, y - 22], [x + 65, y], [x, y + 22]], '#d0dce7', '#4b809b');
      line(c, x - 47, y + 6, x - 5, y + 20, 'rgba(69,149,161,0.455)', 2);
    });
    path(c, [[576, 511], [664, 491], [872, 595], [774, 627]], '#4b779b', '#4b7a9b');
    line(c, 608, 511, 804, 611, 'rgba(58,113,120,0.361)', 2);
    c.save(); c.setLineDash([13, 12]); line(c, 638, 503, 838, 605, 'rgba(58,120,62,0.533)', 2); c.restore();
    path(c, [[956, 475], [1110, 437], [1198, 485], [1088, 533]], '#cddee9', '#4b7a9b');
    // Bridge supports and coastal lights.
    [660, 700, 740, 780].forEach((x, i) => line(c, x, 528 + i * 19, x, 563 + i * 19, '#cedde8', 8));
    [[48, 580], [149, 672], [410, 495], [554, 585], [1047, 503]].forEach(([x, y]) => {
      c.fillStyle = '#2d8585'; c.shadowColor = '#1c8696'; c.shadowBlur = 8; c.fillRect(x - 1, y - 5, 2, 5); c.shadowBlur = 0;
    });
  }
  function packet(c, from, to, color, time, index, bidirectional = false, degraded = false) {
    const opacity = c.globalAlpha;
    c.save(); c.strokeStyle = color; c.lineWidth = degraded ? 1.5 : 2;
    c.globalAlpha = opacity * (degraded ? .35 : .40);
    c.setLineDash([6, 7]); c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(to.x, to.y); c.stroke();
    c.setLineDash([]); c.globalAlpha = opacity;
    const dir = bidirectional && index % 2 ? -1 : 1;
    const angle = Math.atan2(to.y - from.y, to.x - from.x) + (dir < 0 ? Math.PI : 0);
    // Three large, solid arrowheads visibly travel along each link on every Canvas frame.
    for (let k = 0; k < 3; k++) {
      let t = ((time * .28 + index * .19 + k / 3) % 1 + 1) % 1;
      if (dir < 0) t = 1 - t;
      const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
      c.save(); c.translate(x, y); c.rotate(angle);
      c.globalAlpha = opacity * (degraded ? .45 : 1);
      path(c, [[10, 0], [-6, -6], [-3, 0], [-6, 6]], color);
      c.restore();
    }
    c.restore();
  }
  function draw(ctx, opts) {
    const { width, height, state, assets, earth, silhouettes, time = 0, selected, hovered, hints = false, animations = {}, focus = 'all', clockError = 10, faultAge = 0, effectTime = time, feedback = null } = opts;
    const view = camera(width, height, focus), running = state.phase !== 'assembly', narrow = width < 540;
    textScale = view.scale;
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width, height); bg.addColorStop(0, '#eff4fa'); bg.addColorStop(.55, '#eff5fa'); bg.addColorStop(1, '#eff6fa'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.scale, view.scale);
    const nebula = ctx.createRadialGradient(860, 250, 20, 860, 250, 470); nebula.addColorStop(0, 'rgba(201,225,238,0.220)'); nebula.addColorStop(1, 'rgba(240,245,250,0.000)'); ctx.fillStyle = nebula; ctx.fillRect(0, 0, W, H);
    stars.forEach(s => { ctx.globalAlpha = s.a * .35; ctx.fillStyle = '#196d9a'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
    E.ORBITS.forEach(o => orbitalPath(ctx, o, false, running));
    const glow = ctx.createRadialGradient(813, 276, 130, 813, 276, 191); glow.addColorStop(0, 'rgba(25,100,154,0.000)'); glow.addColorStop(.5, 'rgba(25,99,154,0.157)'); glow.addColorStop(1, 'rgba(25,100,154,0.000)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(813, 276, 191, 0, Math.PI * 2); ctx.fill();
    if (earth) ctx.drawImage(earth, 651, 114, 324, 324);
    ctx.strokeStyle = 'rgba(25,110,154,0.353)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(813, 276, 157, 0, Math.PI * 2); ctx.stroke();
    E.ORBITS.forEach(o => orbitalPath(ctx, o, true, running));
    terrain(ctx, time);
    // Contextual labels are part of the scene, not substitutes for the objects.
    const labelSize = Math.max(28, 20 / view.scale);
    if (focus === 'all' || focus === 'space') { text(ctx, '空间段', 542, 73, labelSize, '#075985', 'left', 800); if (!narrow) text(ctx, '三类轨道，协同提供导航信号', 542, 101, 18, '#0c4a6e', 'left', 700); }
    if (focus === 'all' || focus === 'ground') { text(ctx, '地面段', 64, 467, labelSize, '#166534', 'left', 800); if (!narrow) text(ctx, '监控 · 管理 · 信息更新', 64, 493, 18, '#14532d', 'left', 700); }
    if (focus === 'all' || focus === 'user') { text(ctx, '用户段', 903, 731, labelSize, '#9a3412', 'left', 800); }
    if (!narrow && focus === 'all') {
      text(ctx, running ? '海上救援进行中' : '一起，点亮北斗', 52, 118, 36, '#1e4d6b', 'left', 800);
      text(ctx, running ? '观察信号怎样抵达用户终端' : '拖动组件，找到对应轮廓', 52, 157, 23, '#3f6780', 'left', 700);
      textRuns(ctx, [
        { value: '① 空间段', color: '#075985' },
        { value: '   ② 地面段', color: '#166534' },
        { value: '   ③ 用户段', color: '#9a3412' }
      ], 52, 198, 21);
    }
    const positions = {};
    E.PARTS.forEach(p => { positions[p.id] = E.position(p, time, running, state.missionTime); });
    // The rescue destination and route are illustrative, not a geographic map.
    ctx.save(); ctx.setLineDash([7, 9]); line(ctx, 963, 642, 1120, 681, 'rgba(43,124,136,0.337)', 1.6); ctx.restore();
    ctx.strokeStyle = 'rgba(44,127,134,0.592)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(1120, 681, 12, 0, Math.PI * 2); ctx.stroke();
    line(ctx, 1101, 681, 1139, 681, 'rgba(44,127,134,0.400)'); line(ctx, 1120, 662, 1120, 700, 'rgba(44,127,134,0.400)');
    if (!narrow) text(ctx, '救援点', 1120, 711, 12, '#3a6178', 'center');
    // Links become live as soon as both components are placed, so assembly has feedback.
    const links = [
      ['monitor', 'control', '#557589'], ['control', 'inject', '#557589'],
      ['geo', 'monitor', '#b17617'], ['inject', 'igso', '#b17617'],
      ['geo', 'ship', '#087fb4'], ['igso', 'car', '#087fb4'],
      ['meo', 'phone', '#087fb4'], ['meo', 'ship', '#087fb4']
    ];
    links.forEach((link, i) => {
      if (state.placed.indexOf(link[0]) !== -1 && state.placed.indexOf(link[1]) !== -1)
        packet(ctx, positions[link[0]], positions[link[1]], link[2], effectTime, i, false, !!state.fault);
    });
    // Slots are silhouettes of the actual components and occupy the same visual footprint.
    E.PARTS.forEach(p => {
      if (state.placed.includes(p.id)) return;
      const highlight = p.id === hovered || (hints && selected === p.id);
      ctx.save();
      const wrongHover = p.id === hovered && selected && selected !== p.id;
      const color = wrongHover ? '#c65338' : highlight ? '#19879a' : '#4b7a9b';
      ctx.globalAlpha = highlight ? .65 : .27;
      ctx.shadowColor = color; ctx.shadowBlur = highlight ? 18 : 0;
      sprite(ctx, silhouettes[p.id], p.x, p.y, p.w, p.h);
      ctx.restore();
      ctx.save(); ctx.strokeStyle = wrongHover ? '#c65338' : highlight ? '#19879a' : 'rgba(75,121,155,0.604)'; ctx.lineWidth = highlight ? 1.6 : 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.ellipse(p.x, p.y + p.h * .31, p.w * .38, p.h * .17, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      if (!narrow || focus !== 'all') {
        const size = Math.max(21, 16 / view.scale);
        const groupColor = p.group === 'space' ? '#075985' : p.group === 'ground' ? '#166534' : '#9a3412';
        text(ctx, hints || highlight ? p.name : p.group === 'space' ? `${p.id.toUpperCase()} 接口` : '待安装', p.x, p.y + p.h * .52, size, highlight ? '#19889a' : groupColor, 'center', 700);
      }
    });
    E.PARTS.filter(p => state.placed.includes(p.id)).sort((a, b) => positions[a.id].y - positions[b.id].y).forEach(p => {
      let pos = positions[p.id], scale = 1;
      const anim = animations[p.id];
      if (anim && anim.age < 1.2) {
        const u = Math.min(1, anim.age / .55), easing = 1 - Math.pow(1 - u, 3);
        pos = { x: anim.x + (pos.x - anim.x) * easing, y: anim.y + (pos.y - anim.y) * easing };
        scale = .92 + .08 * easing + Math.sin(u * Math.PI) * .055;
        if (u > .4) {
          ctx.save(); ctx.strokeStyle = `rgba(131,227,243,${(1 - u) * .8})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(p.x, p.y + 20, 20 + u * 65, 8 + u * 25, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }
      if (p.id === hovered || p.id === selected) { ctx.save(); ctx.globalAlpha = .65; ctx.shadowBlur = 25; ctx.shadowColor = '#1d8296'; sprite(ctx, silhouettes[p.id], pos.x, pos.y, p.w * 1.02, p.h * 1.02); ctx.restore(); }
      sprite(ctx, assets[p.file], pos.x, pos.y, p.w * scale, p.h * scale);
      // Each installed component emits a visible local pulse before the full system starts.
      const pulse = (effectTime * .65 + E.PARTS.indexOf(p) * .17) % 1;
      ctx.save(); ctx.globalAlpha = .65 * (1 - pulse); ctx.strokeStyle = '#148469'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(pos.x, pos.y + p.h * .30, p.w * (.25 + pulse * .22), p.h * (.10 + pulse * .08), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      if (running && p.group === 'user') {
        ctx.save(); ctx.strokeStyle = state.fault ? 'rgba(144,84,35,0.467)' : 'rgba(33,130,145,0.467)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(pos.x, pos.y + p.h * .34, p.w * .35, p.h * .13, 0, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
      }
      const groupColor = p.group === 'space' ? '#075985' : p.group === 'ground' ? '#166534' : '#9a3412';
      if ((!narrow || focus !== 'all') && p.group !== 'space') text(ctx, p.name, pos.x, pos.y + p.h * .49, Math.max(21, 16 / view.scale), groupColor, 'center', 700);
      if ((!narrow || focus !== 'all') && p.group === 'space') text(ctx, p.id.toUpperCase(), pos.x, pos.y + p.h * .43, Math.max(21, 16 / view.scale), groupColor, 'center', 700);
    });
    if (state.fault) {
      const ship = positions.ship;
      const radius = state.fault === 'clock' ? 13 + clockError * .62 : 12 + Math.min(faultAge, 8) * 6;
      ctx.save(); ctx.strokeStyle = 'rgba(149,88,29,0.667)'; ctx.fillStyle = 'rgba(149,88,29,0.075)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.ellipse(ship.x + 10, ship.y + 43, radius, radius * .48, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      if (!narrow) text(ctx, state.fault === 'clock' ? '时间偏差 → 测距误差' : '维护中断 → 可靠性逐步受影响', 688, 695, 15, '#94561f');
    }
    if (state.placed.length > 0 && !narrow) {
      rounded(ctx, 46, 265, 350, 82, 9, 'rgba(239,246,250,0.733)', '#cddfea');
      line(ctx, 63, 287, 94, 287, '#25788d', 2); text(ctx, '卫星 → 终端：导航信号', 107, 287, 16, '#316a81');
      line(ctx, 63, 324, 94, 324, '#8c6626', 2); text(ctx, '地面 ↔ 卫星：监控与更新', 107, 324, 16, '#78763a');
    }
    if (state.phase === 'complete' && !state.fault) {
      ctx.save(); ctx.strokeStyle = '#1e948d'; ctx.shadowColor = '#19879a'; ctx.shadowBlur = 16; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(1120, 681, 19, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
    }
    if (feedback && feedback.age < 2.5) {
      const good = feedback.kind === 'success', alpha = Math.min(1, (2.5 - feedback.age) * 2);
      const radius = 35 + Math.min(feedback.age, 1) * 28;
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = good ? '#12835e' : '#c24d32'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(feedback.x, feedback.y, radius, 0, Math.PI * 2); ctx.stroke();
      if (!good) {
        line(ctx, feedback.x - 12, feedback.y - 12, feedback.x + 12, feedback.y + 12, '#c24d32', 5);
        line(ctx, feedback.x + 12, feedback.y - 12, feedback.x - 12, feedback.y + 12, '#c24d32', 5);
      }
      ctx.restore();
    }
    ctx.restore(); return view;
  }
  return { draw, drawPacket: packet, camera, makeEarth, createRotatingEarth, roundedPath, masks, W, H };
});
