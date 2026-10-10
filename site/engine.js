(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BeidouEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PARTS = [
    { id: 'geo', name: 'GEO 卫星', group: 'space', file: 'satellite-geo', short: '地球静止轨道', x: 1007, y: 174, w: 172, h: 135, orbit: 0, phase: -.6, description: '地球静止轨道卫星，从地面看大致保持在同一方向。场景用相对地球的固定位置表达这一特点，与其他导航卫星协作提供信号。' },
    { id: 'igso', name: 'IGSO 卫星', group: 'space', file: 'satellite-igso', short: '倾斜地球同步轨道', x: 611, y: 151, w: 155, h: 122, orbit: 1, phase: 2.88, description: '倾斜地球同步轨道卫星，轨道相对赤道倾斜。与 GEO、MEO 卫星共同组成北斗的混合星座。' },
    { id: 'meo', name: 'MEO 卫星', group: 'space', file: 'satellite-meo', short: '中圆地球轨道', x: 826, y: 433, w: 162, h: 127, orbit: 2, phase: 1.12, description: '中圆地球轨道卫星，绕地球运行，与其他卫星共同支撑全球定位、导航和授时服务。' },
    { id: 'control', name: '主控站', group: 'ground', file: 'station-control', short: '运行管理', x: 168, y: 568, w: 172, h: 135, description: '主控站管理系统运行，处理监测数据，支撑卫星轨道与钟差等信息的更新。地面段为整个系统提供持续管理。' },
    { id: 'monitor', name: '监测站', group: 'ground', file: 'station-monitor', short: '监测信号', x: 320, y: 597, w: 158, h: 124, description: '监测站接收和观测卫星信号，把监测数据送给地面系统，帮助了解卫星与信号的状态。' },
    { id: 'inject', name: '注入站', group: 'ground', file: 'station-inject', short: '上注信息', x: 461, y: 548, w: 164, h: 129, description: '时间同步／注入站参与时间同步，将更新的导航电文等信息上注到卫星。地面站与卫星之间具有相应的上下行链路。' },
    { id: 'ship', name: '船载终端', group: 'user', file: 'terminal-ship', short: '海上救援', x: 982, y: 608, w: 184, h: 145, description: '船上的北斗接收机接收多颗卫星的信号，计算位置，为海上航行与救援提供帮助。基本定位不需要把船的位置发回导航卫星。' },
    { id: 'car', name: '车载终端', group: 'user', file: 'terminal-car', short: '道路导航', x: 760, y: 574, w: 161, h: 127, description: '车载终端内的接收机接收卫星信号、计算位置。导航软件结合地图与路线规划，向驾驶员提供出行引导。' },
    { id: 'phone', name: '手机终端', group: 'user', file: 'terminal-phone', short: '日常定位', x: 1085, y: 501, w: 120, h: 125, description: '支持北斗的手机通过芯片、天线与接收模块接收导航信号，计算位置。手机属于用户段，普通手机也不能因此被视为自动具备卫星短报文功能。' },
  ];
  const GROUPS = { space: '空间段', ground: '地面段', user: '用户段' };
  const ORBITS = [
    { rx: 257, ry: 102, angle: -.18, speed: 0 },
    { rx: 253, ry: 112, angle: .67, speed: .037 },
    { rx: 181, ry: 96, angle: .77, speed: .076 },
  ];
  PARTS.filter(p => p.group === 'space').forEach(p => {
    const orbit = ORBITS[p.orbit], dx = Math.cos(p.phase) * orbit.rx, dy = Math.sin(p.phase) * orbit.ry;
    p.x = 813 + dx * Math.cos(orbit.angle) - dy * Math.sin(orbit.angle);
    p.y = 276 + dx * Math.sin(orbit.angle) + dy * Math.cos(orbit.angle);
  });
  const INITIAL = () => ({ placed: [], phase: 'assembly', fault: null, paused: false, missionTime: 0, challenge: null, challengeAnswered: false, observed: [], mistakes: 0, clockNs: 0 });
  function restored(raw) {
    const state = INITIAL();
    if (!raw || typeof raw !== 'object') return state;
    state.placed = Array.isArray(raw.placed) ? [...new Set(raw.placed.filter(id => PARTS.some(p => p.id === id)))] : [];
    state.phase = state.placed.length === PARTS.length && ['running', 'complete'].includes(raw.phase) ? raw.phase : 'assembly';
    state.fault = state.phase !== 'assembly' && ['clock', 'ground'].includes(raw.fault) ? raw.fault : null;
    state.missionTime = Number.isFinite(raw.missionTime) ? Math.max(0, Math.min(36, raw.missionTime)) : 0;
    state.observed = Array.isArray(raw.observed) ? [...new Set(raw.observed.filter(id => ['clock', 'ground'].includes(id)))] : [];
    state.mistakes = Number.isInteger(raw.mistakes) && raw.mistakes >= 0 ? raw.mistakes : 0;
    state.paused = true;
    state.clockNs = Number.isFinite(raw.clockNs) ? Math.max(0, Math.min(600, raw.clockNs)) : 0;
    return state;
  }
  function install(state, id, target) {
    const part = PARTS.find(p => p.id === id), destination = PARTS.find(p => p.id === target);
    if (state.phase !== 'assembly' || !part || !destination) return { ok: false, message: '先选择一个待安装组件。' };
    if (state.placed.includes(id)) return { ok: false, message: '这个组件已经安装好了。' };
    if (id !== target) {
      state.mistakes++;
      const same = part.group === destination.group;
      return { ok: false, message: same ? `同属${GROUPS[part.group]}，但这个接口属于${destination.name}。留意组件的轮廓和功能。` : `${part.name}属于${GROUPS[part.group]}。${part.description}` };
    }
    state.placed.push(id);
    return { ok: true, complete: state.placed.length === PARTS.length, message: `${part.name}安装完成。${part.description}` };
  }
  function start(state) {
    if (state.placed.length !== PARTS.length) return false;
    state.phase = 'running'; state.paused = false; state.fault = null; state.missionTime = 0;
    state.challenge = null; state.challengeAnswered = false;
    state.clockNs = 0;
    return true;
  }
  function tick(state, dt) {
    if (state.phase !== 'running' || state.paused || state.fault || state.challenge || !Number.isFinite(dt)) return;
    state.missionTime = Math.min(36, state.missionTime + Math.max(0, Math.min(dt, .1)));
    if (state.missionTime >= 36) state.phase = 'complete';
  }
  function setFault(state, id) {
    if (state.phase === 'assembly' || !['clock', 'ground'].includes(id)) return false;
    state.fault = id;
    if (!state.observed.includes(id)) state.observed.push(id);
    return true;
  }
  function recover(state) { state.fault = null; state.challenge = null; state.challengeAnswered = false; state.clockNs = 0; }
  function position(part, time, running = false, missionTime = 0) {
    if (part.id === 'ship' && running) {
      const progress = Math.max(0, Math.min(1, missionTime / 36));
      return { x: part.x + progress * 121, y: part.y + progress * 36, depth: 1 };
    }
    if (part.group !== 'space' || !running) return { x: part.x, y: part.y, depth: 1 };
    const orbit = ORBITS[part.orbit], a = part.phase + time * orbit.speed;
    const dx = Math.cos(a) * orbit.rx, dy = Math.sin(a) * orbit.ry;
    return { x: 813 + dx * Math.cos(orbit.angle) - dy * Math.sin(orbit.angle), y: 276 + dx * Math.sin(orbit.angle) + dy * Math.cos(orbit.angle), depth: Math.sin(a) };
  }
  function hitTest(x, y, state, time = 0, installed = false) {
    const candidates = PARTS.filter(p => installed ? state.placed.includes(p.id) : !state.placed.includes(p.id));
    const matches = candidates.map(p => {
      const pos = position(p, time, installed && state.phase !== 'assembly', state.missionTime);
      return { part: p, distance: Math.hypot((x - pos.x) / (p.w * .56), (y - pos.y) / (p.h * .56)) };
    }).filter(p => p.distance <= 1.18).sort((a, b) => a.distance - b.distance);
    return matches.length ? matches[0].part : null;
  }
  return { PARTS, GROUPS, ORBITS, INITIAL, restored, install, start, tick, setFault, recover, position, hitTest };
});
