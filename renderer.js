const {ipcRenderer} = require('electron')
const os = require('os')
const fs = require('fs');

const child = require('child_process').exec;
const windowsExecutablePath = "bin\\OpenSpace.exe";
const macExecutablePath = "bin/OpenSpace.app/Contents/MacOS/OpenSpace";
const linuxExecutablePath = "bin/OpenSpace";

var sgctMap = {
  window_default: {title: "A regular 1280x720 window", command: "sgct.config.single{}"},
  window_1080: {title: "A regular 1920x1080 window", command: "sgct.config.single{1920, 1080}"},
  window_fullscreen: {title: "A windowed 1920x1080 fullscreen", command: "sgct.config.single{1920, 1080, border=false, windowPos={0,0}}"},
  window_fisheye: {title: "A 1k fisheye rendering", command: "sgct.config.fisheye{1024, 1024}"},
  window_fisheye4k: {title: "A 4k fisheye rendering in a 1024x1024 window", command: "sgct.config.fisheye{1024, 1024, res={4096, 4096}, quality='2k', tilt=27}"},
  window_spoutobs: {title: "Streaming OpenSpace via Spout to OBS", command: "sgct.config.single{2560, 1440, shared=true, name='WV_OBS_SPOUT1'}"},
  window_divider: {title: "--files from config/     ", command: ""},
  // window_choosefile: {title: "Choose File", command: ""},
}

var sceneMap = {
  default: "Default",
  default_full: "Default (Full)",
  apollo8: " Apollo 8",
  apollo_sites: "Apollo Sites",
  gaia: "Gaia",
  insight: "Insight",
  juno: "Juno",
  messenger: "Messenger",
  newhorizons: "New Horizons",
  osirisrex: "Osiris Rex",
  rosetta: "Rosetta",
  voyager: "Voyager"
}

ipcRenderer.on('log', (event,log) => {
  console.log("MAIN:",log);
});

ipcRenderer.on('save', (event, save) => {
  var sceneSelect = document.getElementById("select-scene");
  var sceneOption = document.createElement('option');
  sceneOption.value = save.profile;
  sceneOption.innerHTML = save.profile;
  sceneSelect.appendChild(sceneOption);
  sceneSelect.value = save.profile;
});

ipcRenderer.on('osdata', (event,osdata) => {

  console.log("on os data", osdata);

  var path = osdata.path;
  var scenes = osdata.scenes;
  var config = osdata.configs;
  osdata.sgct = osdata.sgct.replace(/"/g,"'");
  //combine loaded .scene files
  scenes.forEach(scene => {
    if ( (!sceneMap[scene]) && (scene != "base") ) {
      sceneMap[scene] = scene;
    }
  });

  config.forEach(config => {
    var filename = config.split('.')[0];
    sgctMap[filename] = {title: config, command:"'${CONFIG}/" + config + "'"};
  });

  //add scene options, then preselect value
  var sceneSelect = document.getElementById("select-scene");
  Object.keys(sceneMap).forEach(scene => {
    var sceneOption = document.createElement('option');
    sceneOption.value = scene;
    sceneOption.innerHTML = sceneMap[scene];
    sceneSelect.appendChild(sceneOption);
  });
  sceneSelect.value = osdata.asset;

  var existingOption = false;
  var preselectOption;
  var windowSelect = document.getElementById("select-window");

  Object.keys(sgctMap).forEach(sgctconfig => {
    var sgctOption = sgctMap[sgctconfig];


    if (sgctOption.command.replace(/\s+/g, '') == osdata.sgct) {
      existingOption = true;
      osdata.sgctconfig = sgctconfig;
      preselectOption = sgctconfig;
    }
  });

  if (!existingOption) {
    sgctMap['window_divider_custom'] = {title:"--custom entry", command: ""};
    sgctMap['window_custom'] = {title:osdata.sgct, command: osdata.sgct};
    osdata.sgct = 'window_custom';
    preselectOption = 'window_custom';
  }

  Object.keys(sgctMap).forEach(windowConfig => {
    var windowOption = document.createElement('option');
    windowOption.value = windowConfig;
    if (sgctMap[windowConfig].command == "") {
      windowOption.disabled = true;
    }
    windowOption.innerHTML = sgctMap[windowConfig].title;
    windowSelect.appendChild(windowOption);
  });
  if (preselectOption) {
    windowSelect.value = preselectOption;
  } else {
    console.log("preselect sgct not found", osdata.sgct);
  }

  const editButton = document.getElementById('edit-profile');
  const newButton = document.getElementById('new-profile');

  editButton.addEventListener('click',(event)=>{
    var payload = {};
    var ss = document.getElementById("select-scene");
    payload.profile = ss.options[ss.selectedIndex].value;
    ipcRenderer.send("profile", payload);
  });

  newButton.addEventListener('click',(event)=>{
    var payload = {profile: ""};
    ipcRenderer.send("profile", payload);
  });

  const osButton = document.getElementById('start-openspace');
  osButton.addEventListener('click',(event)=>{
    var ss = document.getElementById("select-scene");
    var asset = ss.options[ss.selectedIndex].value;
    var sw = document.getElementById("select-window");
    var sgctSelect = sw.options[sw.selectedIndex].value;
    if (sgctSelect == 'window-choose') {
      //pop chooser
    }
    var sgct = sgctMap[sgctSelect];
    if (sgct == undefined) {
      sgct = "'${CONFIG}/" + sgct + "'";
    } else {
      sgct = sgct.command;
    }
    launchOpenSpace(path, asset, sgct, osdata.directoryTree);
  });

  try{
     fs.accessSync(osdata.path + osdata.directoryTree + "StartCluster.bat", fs.R_OK | fs.W_OK)
  }catch(e){
      document.getElementById("cluster-start").style.display = "none";
  }

  try{
     fs.accessSync(osdata.path + osdata.directoryTree + "SyncCluster.bat", fs.R_OK | fs.W_OK)
  }catch(e){
      document.getElementById("cluster-sync").style.display = "none";
  }

})

var launchOpenSpace = (path, asset, sgct, directoryTree, winDirectoryTree) => {
  console.log("launch", path, asset, sgct);
  var assetParam = "Asset='" + asset + "'";
  var windowParam = "SGCTConfig=" + sgct;
  var parameters = [" --config \"" + assetParam + ";" + windowParam + "\""];

  var executablePath = path + directoryTree;
  var platform = os.platform();
  switch (platform) {
    case 'darwin':
      executablePath += macExecutablePath;
      break;        
    case 'linux':
      executablePath += linuxExecutablePath;
      break;        
    case 'win32':
    case 'win64':
      executablePath += windowsExecutablePath;
      break;
    default:
      executablePath += linuxExecutablePath;
      break;
  }

  if (document.getElementById("check-cluster-sync").checked) {
    child(path + directoryTree + "SyncCluster.bat", function(err, data) {
      console.log(err)
      console.log(data.toString());
      child(executablePath + parameters, function(err, data) {
        console.log(err)
        console.log(data.toString());
      });
      if (document.getElementById("check-cluster-start").checked) {
          child(path + directoryTree + "StartCluster.bat", function(err, data) {
          console.log(err)
          console.log(data.toString());
      });
      } else {
        ipcRenderer.send("launched");
      }
    });
  } else if (document.getElementById("check-cluster-start").checked) {
    child(executablePath + parameters, function(err, data) {
      console.log(err)
      console.log(data.toString());
    });
    child(path + directoryTree + "StartCluster.bat", function(err, data) {
      console.log(err)
      console.log(data.toString());
      ipcRenderer.send("launched");
    });
  } else {
    child(executablePath + parameters, function(err, data) {
      console.log(err)
      console.log(data.toString());
    });
    ipcRenderer.send("launched");
  }

};
