import { spawn } from 'node:child_process';
import { join } from 'node:path';

/**
 * Load `html` in headless Chrome, outside the jsdom test realm, and return
 * documentElement.className after image error handlers have had a chance to run.
 */
export function classNameAfterLoad(html) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(process.cwd(), 'tests/chrome-runner.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error(stderr || `chrome runner exited ${code}`));
      else resolve(stdout);
    });
    child.stdin.write(html);
    child.stdin.end();
  });
}
