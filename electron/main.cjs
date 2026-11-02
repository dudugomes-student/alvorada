// Programa do notebook (Windows): abre o Alvorada numa janela própria.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function abrir() {
  const janela = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    title: 'Alvorada',
    backgroundColor: '#F6ECEF',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icone.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // links externos (WhatsApp) abrem no navegador, não dentro do app
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(abrir);
app.on('window-all-closed', () => app.quit());
