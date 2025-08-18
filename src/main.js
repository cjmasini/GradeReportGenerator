const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let win;
const tempFiles = new Set();

app.whenReady().then(() => {
  seedDefaultSettings();
  createWindow();
  
  // Check for updates (only in production)
  if (app.isPackaged) {
    checkForUpdates();
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('before-quit', (event) => {
  for (const f of tempFiles) safeUnlink(f);
  
  if (autoUpdater.quitAndInstall) {
    console.log('[updater] Installing update on quit...');
    autoUpdater.quitAndInstall(false, true);
  }
});

process.on('exit', () => { for (const f of tempFiles) safeUnlink(f); });
process.on('SIGINT', () => { for (const f of tempFiles) safeUnlink(f); process.exit(0); });
process.on('uncaughtException', (err) => { 
  console.error('Uncaught exception:', err);
  for (const f of tempFiles) safeUnlink(f); 
  process.exit(1);
});

function createWindow() {
  console.log('[main] createWindow');
  let iconPath;
  if (app.isPackaged) {
    iconPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'app-icon.ico');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, 'assets', 'app-icon.ico');
    }
  } else {
    iconPath = path.join(__dirname, 'assets', 'app-icon.ico');
  }
  
  win = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.maximize();
  win.show();

  win.loadFile('index.html');
}

function getAppResourcesPath() {
  if (app.isPackaged) {
    return process.resourcesPath;
  } else {
    return app.getAppPath();
  }
}

function getPythonModulePath() {
  const resourcesPath = getAppResourcesPath();
  
  if (app.isPackaged) {
    return path.join(resourcesPath, 'app.asar.unpacked');
  } else {
    return resourcesPath;
  }
}

function tryVirtualEnv() {
  const modulePath = getPythonModulePath();
  const candidates = [
    path.join(modulePath, '.venv', 'Scripts', 'python.exe'),
    path.join(modulePath, '.venv', 'bin', 'python3'),
    path.join(modulePath, '.venv', 'bin', 'python'),
    
    ...(app.isPackaged ? [
      path.join(process.resourcesPath, '.venv', 'Scripts', 'python.exe'),
      path.join(process.resourcesPath, '.venv', 'bin', 'python3'),
      path.join(process.resourcesPath, '.venv', 'bin', 'python')
    ] : [])
  ];
  
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        console.log('[main] Found venv Python at:', candidate);
        return candidate;
      }
    } catch (error) {
      console.warn('[main] Error checking venv path:', candidate, error.message);
    }
  }
  return null;
}

function seedDefaultSettings() {
  try {
    const userFile = path.join(app.getPath('userData'), 'user.settings.json');
    if (fs.existsSync(userFile)) return;

    const candidates = [
      path.join(process.resourcesPath, 'user.settings'),
      path.join(app.getAppPath(), 'user.settings'),
    ];

    for (const src of candidates) {
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(userFile), { recursive: true });
        fs.copyFileSync(src, userFile);
        console.log('[main] seeded user.settings.json from', src);
        return;
      }
    }
    fs.mkdirSync(path.dirname(userFile), { recursive: true });
    fs.writeFileSync(userFile, '{}', 'utf-8');
    console.log('[main] created empty user.settings.json');
  } catch (e) {
    console.warn('[main] could not seed settings:', e);
  }
}

function resolveBackendExecutable() {
  const candidates = [
    path.join(path.dirname(app.getPath('exe')), 'backend', 'report-backend.exe'),
    path.join(process.resourcesPath, 'backend', 'report-backend.exe'),
    path.join(app.getAppPath(), 'pydist', 'report-backend.exe'),
  ];
  
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

function runBackend(args, onJsonLine, onEnd, onError) {
  const exe = resolveBackendExecutable();
  
  if (app.isPackaged && exe) {    
    const child = spawn(exe, args, { 
      cwd: path.dirname(exe),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let buf = '';
    
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      console.log('[backend stdout]', text);
      buf += text;
      let lines = buf.split(/\r?\n/); 
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try { 
          onJsonLine(JSON.parse(line)); 
        } catch (parseErr) {
          console.warn('[main] Non-JSON output from backend:', line);
        }
      }
    });
    
    child.stderr.on('data', d => {
      const errorText = d.toString();
      console.error('[backend stderr]', errorText);
    });
    
    child.on('close', (code) => {
      onEnd(code);
    });
    
    child.on('error', (err) => {
      console.error('[main] Backend process error:', err);
      onError(err);
    });
    
    return child;
  }
  
  return runPythonCli(args, onJsonLine, onEnd, onError);
}

function resolvePythonCmd() {
  if (process.env.PYTHON) {
    let p = process.env.PYTHON.trim();
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        const exe = process.platform === 'win32' ? 'python.exe' : 'python3';
        const candidate = path.join(p, exe);
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch (_) {}
  }
  
   const venvPython = tryVirtualEnv();
  if (venvPython) return venvPython;

  const candidates = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      const r = spawnSync(cmd, ['-c', 'print(123)'], { timeout: 3000 });
      if (r.status === 0) return cmd;
    } catch (_) {}
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function runPythonCli(args, onJsonLine, onEnd, onError) {
  const pythonCmd = resolvePythonCmd();
  const modulePath = getPythonModulePath();
  const spawnArgs = ['-m', 'backend.cli', ...args];
  
  const env = {
    ...process.env,
    PYTHONPATH: [
      modulePath,
      process.env.PYTHONPATH || ''
    ].filter(Boolean).join(path.delimiter),
  };

  if (app.isPackaged) {
    env.PYTHONDONTWRITEBYTECODE = '1';
  }

  console.log('[main] runPythonCli');
  console.log('  pythonCmd =', pythonCmd);
  console.log('  module    = backend.cli');
  console.log('  cwd       =', modulePath);
  console.log('  args      =', spawnArgs);
  console.log('  PYTHONPATH=', env.PYTHONPATH);

  const child = spawn(pythonCmd, spawnArgs, { 
    cwd: modulePath,
    env, 
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let buf = '';
  let isFinished = false;

  const cleanup = () => {
    if (!isFinished) {
      isFinished = true;
      if (timeout) clearTimeout(timeout);
      
      if (!child.killed) {
        console.log('[main] Forcing Python process termination');
        child.kill('SIGKILL');
      }
    }
  };

  const timeout = setTimeout(() => {
    if (!isFinished) {
      console.warn('[main] Python CLI timeout, killing process');
      cleanup();
      onError(new Error('Process timeout after 60 seconds'));
    }
  }, 60000);

  child.stdout.on('data', (chunk) => {
    if (isFinished) return;
    
    const text = chunk.toString();
    process.stdout.write('[cli stdout] ' + text);
    buf += text;
    
    let lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onJsonLine(JSON.parse(line));
      } catch (parseError) {
        console.warn('[main] non-JSON line from CLI:', line);
      }
    }
  });

  child.stderr.on('data', (data) => {
    if (!isFinished) {
      process.stderr.write('[cli stderr] ' + data.toString());
    }
  });

  child.on('close', (code, signal) => {
    if (isFinished) return;
    
    console.log('[main] python closed with code', code, 'signal', signal);
    cleanup();
    onEnd(code);
  });

  child.on('error', (err) => {
    if (isFinished) return;
    
    console.error('[main] python spawn error', err);
    cleanup();
    onError(err);
  });

  const appQuitHandler = () => cleanup();
  app.once('before-quit', appQuitHandler);
  
  const originalOnEnd = onEnd;
  const originalOnError = onError;
  
  onEnd = (code) => {
    app.off('before-quit', appQuitHandler);
    originalOnEnd(code);
  };
  
  onError = (err) => {
    app.off('before-quit', appQuitHandler);
    originalOnError(err);
  };

  return child;
}

function writeTempJson(obj, prefix = 'tmp') {
  const f = path.join(
    app.getPath('temp'),
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  );
  fs.writeFileSync(f, JSON.stringify(obj, null, 2), 'utf-8');
  tempFiles.add(f);
  return f;
}

function safeUnlink(p) { 
  try { fs.rmSync(p, { force: true }); } catch {} 
  tempFiles.delete(p);
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'user.settings.json');
}

ipcMain.handle('select-file', async () => {
  console.log('[main] ipc: select-file');
  const res = await dialog.showOpenDialog(win, {
    title: 'Select scoresheet',
    filters: [{ name: 'Spreadsheets', extensions: ['xlsx', 'csv'] }],
    properties: ['openFile'],
  });
  console.log('[main] dialog result:', res);
  if (res.canceled || !res.filePaths?.[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle('list-students', async (_evt, { inputPath, settingsObj }) => {
  return new Promise((resolve, reject) => {
    const settingsFile = writeTempJson(settingsObj, 'settings');

    const done = (ok, payloadOrErr) => {
      safeUnlink(settingsFile);
      ok ? resolve(payloadOrErr) : reject(payloadOrErr);
    };

    const rows = [];
    runBackend(
      ['--settings', settingsFile, 'list-students', '--input', inputPath],
      (msg) => {
        if (msg.type === 'students' && Array.isArray(msg.items)) rows.push(...msg.items);
        if (msg.type === 'error') done(false, new Error(msg.error || 'CLI error'));
      },
      (code) => done(code === 0, rows),
      (err)  => done(false, err)
    );
  });
});

ipcMain.handle('load-settings', async () => {
  try {
    const p = settingsPath();
    if (fs.existsSync(p)) return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf-8')) };
    return { ok: true, data: {} };
  } catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('save-settings', async (_evt, obj) => {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(obj, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('generate-selected', async (_evt, { inputPath, selectionObj, settingsObj }) => {
  console.log('[main] ipc: generate-selected', inputPath);
  const tmpPath = path.join(app.getPath('temp'), `selection_${Date.now()}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(selectionObj, null, 2), 'utf-8');
  tempFiles.add(tmpPath);

  return new Promise((resolve, reject) => {
    let progress = 0;
    const settingsFile = writeTempJson(settingsObj, 'settings');
    runBackend(
     ['--settings', settingsFile, 'generate-selected', '--input', inputPath, '--selection', tmpPath, '--output-dir', app.getPath('userData')],
      (msg) => {
        console.log('[main] cli msg:', msg);
        if (msg.type === 'progress') {
          progress = Number(msg.value) || progress;
          win.webContents.send('progress', { value: progress });
        }
        if (msg.type === 'done') {
          progress = 100;
          win.webContents.send('progress', { value: progress });
        }
        if (msg.type === 'error') {
          reject(new Error(msg.error));
        }
      },
      (code) => (code === 0 ? resolve({ ok: true }) : reject(new Error('CLI exited with code ' + code))),
      (err) => reject(err)
    );
  });
});

ipcMain.handle('reveal-path', async (_evt, absPath) => {
  console.log('[main] ipc: reveal-path', absPath);
  shell.showItemInFolder(absPath);
});

ipcMain.handle('pick-logo', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose a logo',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] },
    ],
  });
  if (canceled || !filePaths?.length) return { ok: false };

  const filePath = filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === '.png'  ? 'image/png'  :
    ext === '.jpg'  || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.webp' ? 'image/webp' :
    ext === '.svg'  ? 'image/svg+xml' : 'application/octet-stream';

  const buf = fs.readFileSync(filePath);
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  return { ok: true, path: filePath, mime, dataUrl };
});

function checkForUpdates() {
  console.log('[updater] Checking for updates...');
  autoUpdater.checkForUpdatesAndNotify();
}

autoUpdater.on('checking-for-update', () => {
  console.log('[updater] Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[updater] Update available:', info.version);
  // TODO: Add update available toast message
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[updater] Update not available.');
});

autoUpdater.on('error', (err) => {
  console.log('[updater] Error in auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log('[updater]', log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[updater] Update downloaded:', info.version);
  console.log('[updater] Update will be installed when app is closed');
});


ipcMain.on('log', (_evt, msg) => console.log('[renderer]', msg));