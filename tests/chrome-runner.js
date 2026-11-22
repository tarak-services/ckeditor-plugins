import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH || 'google-chrome';

function waitForDevtools(chrome) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome DevTools did not start')), 15000);
    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString();
      const match = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        chrome.stderr.off('data', onData);
        resolve(match[1]);
      }
    };
    chrome.stderr.on('data', onData);
    chrome.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function classNameAfterLoad(html) {
  const dir = await mkdtemp(join(tmpdir(), 'math-xss-page-'));
  const userData = await mkdtemp(join(tmpdir(), 'math-xss-chrome-'));
  const file = join(dir, 'page.html');
  await writeFile(file, `<!doctype html><meta charset="utf-8"><title>t</title>${html}`);

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${userData}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let browserWs;
  try {
    const devtoolsUrl = await waitForDevtools(chrome);
    browserWs = new WebSocket(devtoolsUrl);
    let nextId = 1;
    const pending = new Map();
    const waiters = [];

    browserWs.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
        return;
      }
      for (const waiter of waiters) waiter(message);
    });

    await new Promise((resolve, reject) => {
      browserWs.addEventListener('open', resolve);
      browserWs.addEventListener('error', () => reject(new Error('DevTools socket failed')));
    });

    const send = (method, params = {}, sessionId) => {
      const id = nextId++;
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        browserWs.send(JSON.stringify(payload));
      });
    };

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    const loaded = new Promise((resolve) => {
      const onMessage = (message) => {
        if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') {
          const index = waiters.indexOf(onMessage);
          if (index !== -1) waiters.splice(index, 1);
          resolve();
        }
      };
      waiters.push(onMessage);
    });
    await send('Page.navigate', { url: `file://${file}` }, sessionId);
    await loaded;
    await new Promise((resolve) => setTimeout(resolve, 300));
    const evaluated = await send('Runtime.evaluate', {
      expression: 'document.documentElement.className',
      returnByValue: true,
    }, sessionId);
    await send('Target.closeTarget', { targetId });
    return evaluated.result.value ?? '';
  } finally {
    if (browserWs && browserWs.readyState === WebSocket.OPEN) browserWs.close();
    await new Promise((resolve) => {
      if (chrome.exitCode !== null || chrome.signalCode !== null) {
        resolve();
        return;
      }
      chrome.once('exit', resolve);
      chrome.kill('SIGKILL');
    });
    await rm(dir, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
    await rm(userData, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const html = Buffer.concat(chunks).toString('utf8');
const className = await classNameAfterLoad(html);
process.stdout.write(className);
