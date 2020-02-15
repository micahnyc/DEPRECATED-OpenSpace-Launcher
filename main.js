const { app, BrowserWindow, ipcMain } = require('electron')
const child = require('child_process').exec;
const fs = require('fs');
const path = require('path');
const os = require('os')

let win;
let profileWin;

var config = {};
var platform = os.platform();
//prod paths
var nixDirectoryTree = "/../../../../";
var winDirectoryTree = "\\..\\..\\..\\";
//dev paths
//var nixDirectoryTree = "/../OpenSpace/";
//var winDirectoryTree = "\\..\\OpenSpace\\";

switch (platform) {
  case 'win32':
  case 'win64':
    config.directoryTree = winDirectoryTree;
    config.deliminator = '\\';
    break;
  default:
    config.directoryTree = nixDirectoryTree;
    config.deliminator = '/';
    break;
}

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach( f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
};

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
  const sceneFolder = config.path + config.directoryTree + 'data' + config.deliminator + 'assets' + config.deliminator;
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
  // win.webContents.openDevTools()

  win.webContents.on('did-finish-load', () => {
    config.path = app.getAppPath();
    readDefaults();
    readScenes();
    readConfigs();

    var baseString = 'data' + config.deliminator + 'assets' + config.deliminator;
    var paths = ['scene','global','customization', 'examples'];
    var assets = [];
    var assetString = ".asset";

    for (var i = 0; i < paths.length; ++i) {
      var path = paths[i];
      var dirPath = config.path + config.directoryTree + baseString + path + config.deliminator;
      walkDir(dirPath, function(filePath) {
        if (filePath.endsWith(assetString)) {
          filePath = filePath.substr(filePath.indexOf(path));
          filePath = filePath.slice(0, -assetString.length); // -6 for .asset
          assets.push(filePath);
        }
      });
    }

    config.assets = assets;
    win.webContents.send('osdata', config);
  })

  win.on('closed', () => {
    win = null
  })

  ipcMain.on('launched',() => {
    setTimeout(function() {
      app.quit();
    }, 8000);
  });

  ipcMain.on('profile', createProfileWindow);

  ipcMain.on('save',(event, payload) => {
    profileWin && profileWin.close();
    win && win.webContents.send('save', payload);
  });

}

function createProfileWindow(event, data) {
  profileWin = new BrowserWindow({
    width: 800,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    }
  })
  profileWin.setMenu(null);
  profileWin.loadFile('profile.html')
  // profileWin.webContents.openDevTools()

  profileWin.webContents.on('did-finish-load', () => {
    var payload = {};
    payload.assets = config.assets;
    payload.profile = data.profile;
    payload.deliminator = config.deliminator;
    payload.path = config.path + config.directoryTree + "data";
    payload.path += config.deliminator + "assets" + config.deliminator;
    profileWin.webContents.send('profileData', payload);
  })

  profileWin.on('closed', () => {
    profileWin = null
  })

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
