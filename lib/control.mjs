import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadAgents, saveAgents } from './agents.mjs';
import { Socket } from 'node:net';

const LMS = join(homedir(), '.lmstudio', 'bin', 'lms.exe');

function getAgent(id) {
  const reg = loadAgents();
  const a = reg.agents.find(x => x.id === id);
  return { reg, a };
}

function tcpOpen(host, port, timeout = 1200) {
  return new Promise((resolve) => {
    const s = new Socket(); let done = false;
    const fin = (v) => { if (!done) { done = true; try { s.destroy(); } catch {} resolve(v); } };
    s.setTimeout(timeout);
    s.once('connect', () => fin(true)).once('timeout', () => fin(false)).once('error', () => fin(false));
    s.connect(port, host);
  });
}

// wait until the agent's port accepts connections (or timeout)
async function waitUp(port, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await tcpOpen('127.0.0.1', port)) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

export async function launch(id) {
  const { a } = getAgent(id);
  if (!a) return { ok: false, error: 'no such agent' };
  if (a.port && await tcpOpen('127.0.0.1', a.port)) return { ok: true, alreadyRunning: true };
  if (!a.launch?.cmd) return { ok: false, error: 'no launch command configured' };
  try {
    const child = spawn(a.launch.cmd, a.launch.args || [], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    const up = a.port ? await waitUp(a.port) : true;
    return { ok: up, started: true, portUp: up };
  } catch (e) { return { ok: false, error: String(e).slice(0, 200) }; }
}

// kill whatever owns the agent's port, then relaunch
export async function restart(id) {
  const { a } = getAgent(id);
  if (!a) return { ok: false, error: 'no such agent' };
  if (a.runtime === 'lmstudio') {
    try { spawnSync(LMS, ['server', 'stop'], { timeout: 10000 }); } catch {}
  } else if (a.port) {
    // find PID on the port and taskkill it (Windows)
    try {
      const ps = `(Get-NetTCPConnection -LocalPort ${a.port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`;
      const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 8000 });
      const pid = (r.stdout || '').trim();
      if (pid && /^\d+$/.test(pid)) spawnSync('taskkill', ['/PID', pid, '/F'], { timeout: 8000 });
    } catch {}
  }
  await new Promise(r => setTimeout(r, 1500));
  return launch(id);
}

// load a model into memory and set it active
export async function setModel(id, model) {
  const { reg, a } = getAgent(id);
  if (!a) return { ok: false, error: 'no such agent' };
  if (!a.models[model] && a.runtime !== 'claude-cli') return { ok: false, error: 'model not configured on this agent' };

  if (a.runtime === 'ollama') {
    if (!(await tcpOpen('127.0.0.1', a.port))) { const l = await launch(id); if (!l.ok) return { ok: false, error: 'ollama not running and launch failed' }; }
    // empty generate with keep_alive loads the model resident
    try {
      await fetch(a.endpoint + '/api/generate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, keep_alive: '30m', prompt: '' }), signal: AbortSignal.timeout(60000),
      });
    } catch (e) { return { ok: false, error: 'load failed: ' + String(e).slice(0, 120) }; }
  } else if (a.runtime === 'lmstudio') {
    try {
      const r = spawnSync(LMS, ['load', model, '-y'], { encoding: 'utf8', timeout: 120000 });
      if (r.status !== 0) return { ok: false, error: (r.stderr || 'lms load failed').slice(0, 200) };
    } catch (e) { return { ok: false, error: String(e).slice(0, 120) }; }
  }
  a.activeModel = model;
  saveAgents(reg);
  return { ok: true, activeModel: model };
}

export function rename(id, name) {
  const { reg, a } = getAgent(id);
  if (!a) return { ok: false, error: 'no such agent' };
  if (!name || typeof name !== 'string' || name.length > 60) return { ok: false, error: 'invalid name' };
  a.name = name.trim();
  saveAgents(reg);
  return { ok: true, name: a.name };
}

export function describe(id, description) {
  const { reg, a } = getAgent(id);
  if (!a) return { ok: false, error: 'no such agent' };
  a.description = String(description || '').slice(0, 400);
  saveAgents(reg);
  return { ok: true };
}
