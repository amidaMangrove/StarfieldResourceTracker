const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tray = null;

const ICON_PATH = path.join(__dirname, '..', 'build', 'tray.png');   // トレイ用（小）
const APP_ICON = path.join(__dirname, '..', 'build', 'icon.ico');    // ウィンドウ/タスクバー用
const DATA_FILE = () => path.join(app.getPath('userData'), 'tracker.json');

function createWindow() {
  win = new BrowserWindow({
    width: 320,
    height: 480,
    minWidth: 220,
    minHeight: 160,
    icon: APP_ICON,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // フルスクリーン気味の前面（ボーダーレスウィンドウ）にも残るようにする
  win.setAlwaysOnTop(true, 'screen-saver');

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// 表示/非表示
function showWindow() {
  if (!win) return;
  win.show();
  win.setAlwaysOnTop(true, 'screen-saver');
}

function hideWindow() {
  if (win) win.hide();
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) hideWindow();
  else showWindow();
}

// ----- システムトレイ（非表示中の復帰口） -----
function createTray() {
  const img = nativeImage.createFromPath(ICON_PATH);
  tray = new Tray(img);
  tray.setToolTip('Starfield Resource Tracker');

  const menu = Menu.buildFromTemplate([
    { label: '表示 / 非表示', click: () => toggleWindow() },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);

  // 左クリック / ダブルクリックで表示トグル
  tray.on('click', () => toggleWindow());
  tray.on('double-click', () => showWindow());
}

// ----- 永続化 IPC -----
ipcMain.handle('load-data', () => {
  try {
    const raw = fs.readFileSync(DATA_FILE(), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null; // 初回起動などファイルが無い場合
  }
});

ipcMain.handle('save-data', (_event, data) => {
  try {
    fs.writeFileSync(DATA_FILE(), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
});

// ----- 窓操作 IPC -----
ipcMain.handle('hide-window', () => {
  hideWindow();
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

// ----- グローバルショートカット -----
function registerShortcuts() {
  // 表示 / 非表示トグル
  globalShortcut.register('Control+Shift+S', () => {
    toggleWindow();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
