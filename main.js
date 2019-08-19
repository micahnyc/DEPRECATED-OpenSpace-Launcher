const { app, BrowserWindow, ipcMain } = require('electron')
const child = require('child_process').exec;
const fs = require('fs');
const path = require('path');
const os = require('os')

let win;

var config = {};
var platform = os.platform();
var nixDirectoryTree = "/../../../../";
var winDirectoryTree = "\\..\\..\\..\\";
//var winDirectoryTree = "\\..\\OpenSpace\\";

switch (platform) {
  case 'win32':
  case 'win64':
    config.directoryTree = winDirectoryTree;
    break;
  default:
    config.directoryTree = nixDirectoryTree;
    break;
}

function fileList(dir) {
  return fs.readdirSync(dir).reduce(function(list, file) {
    var name = path.join(dir, file);
    var isDir = fs.statSync(name).isDirectory();
    return list.concat(isDir ? fileList(name) : [name]);
  }, []);
}


function readDefaults() {

  const filepath = config.path + config.directoryTree + 'openspace.cfg';
  const oscfg = fs.readFileSync(filepath, 'utf8');
  var lines = oscfg.split('\n');
  lines.forEach(line => {
    var noWhite = line.replace(/\s+/g, '');
    var sgctSearch = 'SGCTConfig=';
    if (noWhite.startsWith(sgctSearch)) {
      win.webContents.send('sgctlog', noWhite);
      config.sgct = noWhite.substr(sgctSearch.length);
    }
    var assetSearch = 'Asset=';
    if (noWhite.startsWith(assetSearch)) {
      win.webContents.send('assetlog', noWhite);
      config.asset = noWhite.substr(assetSearch.length+1).slice(0,-1);
    }
  });
}

function readScenes() {
  config.scenes = [];
  const sceneFolder = config.path + config.directoryTree + 'data/assets/';
  fs.readdirSync(sceneFolder).forEach(file => {
    if (file.endsWith(".scene")) {
      var sceneName = file.split('.scene')[0];
      config.scenes.push(sceneName);
    }
  });
}

function readConfigs() {
  config.configs = [];
  const configFolder = config.path + config.directoryTree + 'config/';
  fs.readdirSync(configFolder).forEach(file => {
    if (file.endsWith(".xml")) {
      config.configs.push(file);
    }
  });
}

function createWindow () {
  win = new BrowserWindow({
    width: 640,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })
  win.setMenu(null);
  win.loadFile('index.html')
  //win.webContents.openDevTools()

  win.webContents.on('did-finish-load', () => {
    config.path = app.getAppPath();
    readDefaults();
    readScenes();
    readConfigs();
    win.webContents.send('osdata', config);
  })

  win.on('closed', () => {
    win = null
  })

  ipcMain.on('launched',() => {
    setTimeout(function() {
      app.quit();
    }, 1000);
  });
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
})
