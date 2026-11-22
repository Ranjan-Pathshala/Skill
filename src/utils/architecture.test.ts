import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

test('index.html is lean, has zero inline style/script monoliths, and no capture artifacts', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const lineCount = html.split(/\r?\n/).length;
  assert.ok(lineCount < 80, `Expected lean index.html (<80 lines), got ${lineCount}`);
  assert.ok(!html.includes('<style'), 'index.html must not contain inline <style> blocks');
  assert.ok(!html.includes('_aistudio-iframe.js'), 'index.html must not contain capture artifacts');
  assert.ok(html.includes('/src/main.ts'), 'index.html must load modular /src/main.ts');
});

test('all 7 modular CSS stylesheets exist and are imported by src/styles/index.css', () => {
  const expected = [
    'tokens.css',
    'layout.css',
    'components.css',
    'views.css',
    'exams.css',
    'admin.css',
    'theme-polish.css',
  ];
  const barrel = fs.readFileSync(path.join(ROOT, 'src/styles/index.css'), 'utf8');
  for (const file of expected) {
    const full = path.join(ROOT, 'src/styles', file);
    assert.ok(fs.existsSync(full), `Missing stylesheet ${file}`);
    assert.ok(fs.statSync(full).size > 200, `Stylesheet ${file} is unexpectedly empty`);
    assert.ok(barrel.includes(`./${file}`), `src/styles/index.css missing @import "./${file}"`);
  }
});

test('all 18 HTML views and both modal suites are extracted into src/templates/', () => {
  const viewFiles = fs.readdirSync(path.join(ROOT, 'src/templates/views')).filter((f) => f.endsWith('.html'));
  assert.equal(viewFiles.length, 18, `Expected 18 modular HTML views, found ${viewFiles.length}`);
  assert.ok(fs.existsSync(path.join(ROOT, 'src/templates/shell.html')));
  assert.ok(fs.existsSync(path.join(ROOT, 'src/templates/modals/core-modals.html')));
  assert.ok(fs.existsSync(path.join(ROOT, 'src/templates/modals/enterprise-modals.html')));
});

test('all 11 ES feature modules have zero duplicate exports and zero monkey-patch chains', () => {
  const featureDir = path.join(ROOT, 'src/features');
  const files = fs
    .readdirSync(featureDir)
    .filter((f) => f.endsWith('.js') && f !== 'registerHooks.js');
  assert.equal(files.length, 11, `Expected 11 domain feature modules, found ${files.length}`);

  const exportedFnOwners = new Map<string, string>();
  const duplicates: string[] = [];
  const monkeyPatches: string[] = [];

  for (const f of files) {
    const code = fs.readFileSync(path.join(featureDir, f), 'utf8');
    // Check exported function declarations
    const fnRe = /^export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm;
    let m: RegExpExecArray | null;
    while ((m = fnRe.exec(code)) !== null) {
      const name = m[1];
      if (exportedFnOwners.has(name)) {
        duplicates.push(`${name} (${exportedFnOwners.get(name)} & ${f})`);
      } else {
        exportedFnOwners.set(name, f);
      }
    }
    // Check no legacy `const origX = window.X` or `if (typeof origX === 'function')` monkey-patching remains
    const origRe = /\b(?:const\s+(?:orig|_orig)[A-Z][A-Za-z0-9_$]*\s*=\s*window\.[A-Za-z0-9_$]+|if\s*\(\s*typeof\s+orig[A-Z][A-Za-z0-9_$]*\s*===\s*['"]function['"])/g;
    while ((m = origRe.exec(code)) !== null) {
      monkeyPatches.push(`${f}: ${m[0]}`);
    }
  }

  assert.ok(exportedFnOwners.has('showToast'), 'apiAndCore.js must export authoritative showToast');
  assert.deepEqual(duplicates, [], `Duplicate exported functions found: ${duplicates.join(', ')}`);
  assert.deepEqual(monkeyPatches, [], `Legacy monkey-patch overrides remain: ${monkeyPatches.join(', ')}`);
});

test('every inline HTML event handler in templates resolves to an exported or window-bound function', () => {
  const availableFns = new Set<string>([
    'resolveStandaloneBackendUrl',
    'escapeHtml',
    'rpSanitizeUrl',
    'getLocalDateString',
    'formatLocalDate',
  ]);

  const featureDir = path.join(ROOT, 'src/features');
  for (const f of fs.readdirSync(featureDir).filter((x) => x.endsWith('.js'))) {
    const code = fs.readFileSync(path.join(featureDir, f), 'utf8');
    for (const m of code.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm)) {
      availableFns.add(m[1]);
    }
    for (const m of code.matchAll(/\bwindow\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g)) {
      availableFns.add(m[1]);
    }
  }

  const templateFiles = [
    path.join(ROOT, 'src/templates/shell.html'),
    path.join(ROOT, 'src/templates/modals/core-modals.html'),
    path.join(ROOT, 'src/templates/modals/enterprise-modals.html'),
    ...fs
      .readdirSync(path.join(ROOT, 'src/templates/views'))
      .filter((x) => x.endsWith('.html'))
      .map((x) => path.join(ROOT, 'src/templates/views', x)),
  ];

  const builtins = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'new', 'this', 'event',
    'document', 'window', 'console', 'Math', 'Date', 'JSON', 'Array', 'Object', 'String',
    'Number', 'Boolean', 'parseInt', 'parseFloat', 'setTimeout', 'clearTimeout',
    'encodeURIComponent', 'decodeURIComponent', 'stopPropagation', 'preventDefault',
    'getElementById', 'querySelector', 'querySelectorAll', 'closest', 'classList',
    'remove', 'add', 'toggle', 'focus', 'blur', 'click', 'reset', 'scrollIntoView',
    'replace', 'trim', 'toLowerCase', 'toUpperCase', 'split', 'join', 'slice', 'includes',
    'test', 'match', 'exec', 'push', 'pop', 'filter', 'map', 'forEach', 'find', 'some',
    'every', 'toString', 'valueOf', 'setAttribute', 'getAttribute', 'removeAttribute',
    'open', 'close', 'print', 'reload', 'back', 'forward', 'scrollTo', 'scrollBy', 'play', 'pause',
  ]);

  const missing = new Set<string>();
  const attrRe = /\bon(?:click|change|input|submit|keydown|keyup|focus|blur|mousedown|mouseup|dblclick)\s*=\s*"([^"]+)"/gi;

  for (const tf of templateFiles) {
    const html = fs.readFileSync(tf, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(html)) !== null) {
      const expr = m[1];
      // Match top-level calls (not preceded by a dot unless preceded by window.)
      const fnRe = /(?:window\.)?(?<!\.)\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
      let fm: RegExpExecArray | null;
      while ((fm = fnRe.exec(expr)) !== null) {
        const name = fm[1];
        if (!builtins.has(name) && !availableFns.has(name)) {
          missing.add(name);
        }
      }
    }
  }

  assert.deepEqual(
    [...missing].sort(),
    [],
    `Unbound inline HTML handler functions: ${[...missing].sort().join(', ')}`,
  );
});

test('Turn 2 invariants: Help Desk has no search input, Dark Mode button lives in menu (not header), and zero default CBT rules exist', () => {
  const feedbackHtml = fs.readFileSync(path.join(ROOT, 'src/templates/views/feedback.html'), 'utf8');
  assert.ok(!feedbackHtml.includes('help-contacts-search-input'), 'Help Desk & Contact must not include a search input');

  const shellHtml = fs.readFileSync(path.join(ROOT, 'src/templates/shell.html'), 'utf8');
  const [headerPart, navPart = ''] = shellHtml.split('id="main-nav-tabs"');
  assert.ok(!headerPart.includes('header-public-theme-btn'), 'Header must not contain the standalone public theme toggle');
  assert.ok(navPart.includes('menu-theme-toggle-btn'), 'Workspace menu (#main-nav-tabs) must contain the Dark Mode toggle');

  const cbtHtml = fs.readFileSync(path.join(ROOT, 'src/templates/views/cbttest.html'), 'utf8');
  assert.ok(!cbtHtml.includes('+1.00 Marks'), 'CBT view must not display hardcoded +1.00 Marks default rule');
  assert.ok(!cbtHtml.includes('-0.25 Negative'), 'CBT view must not display hardcoded -0.25 Negative default rule');

  const cbtJs = fs.readFileSync(path.join(ROOT, 'src/features/cbtArena.js'), 'utf8');
  assert.ok(!cbtJs.includes(': 1.0;'), 'cbtArena.js must not fall back to default +1.0 positiveMarks');
  assert.ok(!cbtJs.includes(': 0.25;'), 'cbtArena.js must not fall back to default -0.25 negativeMarks');
  assert.ok(!cbtJs.includes('parseFloat(maxMarks) * 0.4'), 'cbtArena.js must not fall back to 40% passing marks');

  const dashJs = fs.readFileSync(path.join(ROOT, 'src/features/dashboardAndProfile.js'), 'utf8');
  assert.ok(!dashJs.includes("typingtest: 'view-typingtest'"), 'typingtest stream footer must never mount on top-level view-typingtest section');
  assert.ok(!dashJs.includes("learningtyping: 'view-learningtyping'"), 'learningtyping stream footer must never mount on top-level view-learningtyping section');

  const backendCode = fs.readFileSync(path.join(ROOT, 'backend/Code.gs'), 'utf8');
  assert.ok(!backendCode.includes('UserSettingsJSON'), 'backend/Code.gs must not reference nonexistent UserSettingsJSON column');
  assert.ok(backendCode.includes('readUserSettingsFromRow(usersList[ui], false)'), 'backend/Code.gs must use readUserSettingsFromRow in handleSendBatchDigestEmail');
});

