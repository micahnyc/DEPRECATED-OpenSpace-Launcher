//profile.js
const {ipcRenderer} = require('electron')
const os = require('os')
const fs = require('fs');

var customizationsComment = "--customizations";
const NowLua = "local now = openspace.time.currentWallTime()";
const DefaultStartTimeLua = "openspace.time.setTime(openspace.time.advancedTime(now, '-1d'))";
const SetTimeLua = "openspace.time.setTime('";
const AnchorStartLua = 'Anchor = "';
const InterestingStartLua = 'openspace.markInterestingNodes({';

var profile = {
    selectedNodes: [],
    name: "",
    startTime: "",
    interestingNodes: [],
    anchorNode: "",
    customizations: ""
};

var tree = {};
var assetIdentifiers = {};
var assetList = [];
//recieve data
ipcRenderer.on('profileData', (event,profileData) => {
  profile.path = profileData.path;
  profile.deliminator = profileData.deliminator;
  assetList = profileData.assets;
  assetList.forEach(asset => {
    assetIdentifiers[asset.replace(/\\/g,"/")] = extractIdentifiers('scene' + profileData.deliminator + asset);
  });
  if (profileData.profile != "") {
    profile.name = profileData.profile;
    readProfile();
  }
  buildTree();
  populateTree();
});

//actions
const saveButton = document.getElementById('save-profile');
saveButton.addEventListener('click',(event) => {
    saveScene(false);
});

// const addButton = document.getElementById('add-featured-item-button');
// addButton.addEventListener('click',(event) => {
//     addInterestingNode();
// });

const anchorInput = document.getElementById("anchor-node-input");
anchorInput.addEventListener('keyup', (event) => {
  var input = event.target;
});

function extractIdentifiers(path) {
  const filepath = profile.path + path + ".asset";
  const assetText = fs.readFileSync(filepath, 'utf8');
  var lines = assetText.split('\n');
  var identifiers = [];
  var idString = 'Identifier = "';
  for (var i = 0; i < lines.length; ++i) {
    var line = lines[i];
    var idStartIndex = line.indexOf(idString);
    if (idStartIndex > -1) {
      idStartIndex += idString.length;
      var idEndIndex = line.indexOf('"', idStartIndex + 1);
      var id = line.substring(idStartIndex,idEndIndex);
      identifiers.push(id);
    }
  }
  return identifiers;
}

function readProfile() {
  const filepath = profile.path + profile.name  + '.scene';
  const profileText = fs.readFileSync(filepath, 'utf8');
  var lines = profileText.split('\n');
  var readingCustomizations = false;
  for (var i = 0; i < lines.length; ++i) {
    var line = lines[i];
    //read custom assets
    if (line.startsWith('asset.require(') && (!line.endsWith('base_profile\')'))) {
      var start = "asset.require('scene/";
      var end = "')";
      var asset = line.substring(start.length,line.indexOf(end));
      profile.selectedNodes.push(asset);
    }
    //read time
    if (line.indexOf(SetTimeLua) > -1) {
      var start = SetTimeLua + 1;
      var end = "')";
      var time = line.substring(start.length,line.lastIndexOf(end));
      if (time != DefaultStartTimeLua) {
        profile.startTime = time;
      }
    }

    //read customizations
    if (line.indexOf(customizationsComment + "end") == 0) {
      readingCustomizations = false;
    } else if (line.indexOf(customizationsComment) == 0)  {
      readingCustomizations = true;
    } else if (readingCustomizations) {
      profile.customizations += line + "\n";
    }

    //read interesting
    if (line.indexOf(InterestingStartLua) > -1) {
      var iStartIndex = line.indexOf(InterestingStartLua);
      iStartIndex += InterestingStartLua.length;
      var iEndIndex = line.indexOf('}',iStartIndex + 1);
      var nodes = line.substring(iStartIndex,iEndIndex).split(',');
      nodes.forEach(node => {
        node = node.replace(/['"]+/g, '').trim();
        profile.interestingNodes.push(node);
        addInterestingNode(node);
      });
    }
    //read anchorNode
    if (line.indexOf(AnchorStartLua) > -1) {
      var anchorStartIndex = line.indexOf(AnchorStartLua);
      anchorStartIndex += AnchorStartLua.length;
      var anchorEndIdnex = line.indexOf('"',anchorStartIndex + 1);
      profile.anchorNode = line.substring(anchorStartIndex,anchorEndIdnex);
    }
  }

  //fill html
  document.getElementById("profile-name").value = profile.name;
  document.getElementById("start-time").value = profile.startTime;
  document.getElementById("profile-custom-settings").value = profile.customizations;
  updateAnchorSelect();
}

function addInterestingNode(preselectValue) {
  var featuredInput = document.getElementById("featured-nodes-input");
  if (featuredInput.value == "") {
    featuredInput.value = preselectValue
  } else {
    featuredInput.value += ", " + preselectValue;
  }
}

// function addInterestingNode(preselectValue) {
//   const iSelect = document.createElement("SELECT");
//   fillSelectWithNodes(iSelect);
//   if (preselectValue != undefined) {
//     iSelect.value = preselectValue;
//   }
  
//   var divider = document.createElement('option');
//   divider.disabled = true;
//   divider.innerHTML = "---"
//   iSelect.appendChild(divider);

//   var remove = document.createElement('option');
//   remove.innerHTML = "REMOVE"
//   iSelect.appendChild(remove);
//   iSelect.addEventListener('change', (event) => {
//     if (event.currentTarget.value == "REMOVE") {
//       event.currentTarget.remove();
//     }
//   });
//   var container = document.getElementById('featured-nodes');
//   container.appendChild(iSelect);
// }

function fillSelectWithNodes(select) {
  var sortedNodes = [];
  profile.selectedNodes.forEach(node => {
    var nodeIdentifiers = assetIdentifiers[node];
    nodeIdentifiers.forEach(id => {
      sortedNodes.push(id);
    });
  });
  sortedNodes = sortedNodes.sort();
  sortedNodes.forEach(node => {
    var idOption = document.createElement('option');
    idOption.value = node;
    idOption.innerHTML = node;
    select.appendChild(idOption);
  });
}

function updateAnchorSelect() {
  // var anchorSelect = document.getElementById("anchor-select");
  // anchorSelect.innerHTML = "";
  // fillSelectWithNodes(anchorSelect);
  // anchorSelect.value = profile.anchorNode;
  var anchorInput = document.getElementById("anchor-node-input");
  anchorInput.value = profile.anchorNode;
}

function checkTreeBranch(branch, assetString, fullString) {
  var assetSplit = assetString.split("/"); 
  if (assetSplit.length == 1) {
    if (Object.prototype.toString.call(branch) === '[object Array]') {
      branch.push(fullString);
    } else {
      if (branch[assetSplit[0]] == undefined) {
        branch[assetSplit[0]] = fullString;
      }
    }
  } else if (assetSplit.length == 2) {
    if (branch[assetSplit[0]] == undefined) {
      branch[assetSplit[0]] = [];
    }
    checkTreeBranch(branch[assetSplit[0]], assetString.substring(assetString.indexOf("/") + 1), fullString);
  } else {
    if (branch[assetSplit[0]] == undefined) {
      branch[assetSplit[0]] = {};
    }
    checkTreeBranch(branch[assetSplit[0]], assetString.substring(assetString.indexOf("/") + 1), fullString);
  }
}

function buildTree(profileData) {
  assetList.forEach(asset => {
    checkTreeBranch(tree, asset.replace(/\\/g,"/"), asset.replace(/\\/g,"/"));
  });
}

function populateBranch(branch, list, parentBranch) {
  Object.keys(branch).forEach(function (leaf) {
    if (typeof(branch[leaf]) == "string") {
      var newLeaf = document.createElement('li');
      var leafParts = branch[leaf].split("/");
      var branchName = leafParts[leafParts.length-1];
      var branchText = document.createTextNode(branchName);
      var branchCheck = document.createElement("INPUT");
      branchCheck.setAttribute("type", "checkbox");
      branchCheck.setAttribute("id", branch[leaf]);
      branchCheck.checked = profile.selectedNodes.includes(branch[leaf]);
      branchCheck.addEventListener( 'change', function(event) {
        if(this.checked) {
          profile.selectedNodes.push(this.id);
        } else {
          profile.selectedNodes = profile.selectedNodes.filter(v => v !== this.id); 
        }
        var checkBox = list.parentNode.firstChild.lastChild;
        updateHeaderCheckBox(parentBranch, leafParts[leafParts.length-2], checkBox);
      });
      newLeaf.appendChild(branchText);
      newLeaf.appendChild(branchCheck);
      list.appendChild(newLeaf);
    } else {
      createBranch(leaf, branch, list);
    }    
  });
}

function updateHeaderCheckBox(branch, leaf, selectAll) {
  var stringChildren = 0;
  var selectedChildCount = 0;
  var children = Object.keys(branch[leaf]);
  children.forEach(function (branchleaf) {
    if (typeof(branch[leaf][branchleaf]) === "string") {
      ++stringChildren;
      if (profile.selectedNodes.includes(branch[leaf][branchleaf])) {
        ++selectedChildCount;
      }
    }
  });

  selectAll.indeterminate = false;
  selectAll.checked = false;
  if (selectedChildCount == children.length) {
    selectAll.checked = true;
  } else if (selectedChildCount > 0) {
    selectAll.indeterminate = true;
  }

  return stringChildren == children.length;
}


function createBranch(leaf, branch, list) {
  var newBranch = document.createElement('li');
  var branchHeader = document.createElement("div");
  var headerName = document.createTextNode(leaf);
  var expandButton = document.createElement("BUTTON");
  expandButton.innerHTML = "+";
  expandButton.addEventListener('click',(event)=>{
      if (newLeaf.childElementCount == 0) {
        populateBranch(branch[leaf], newLeaf, branch)  
        expandButton.innerHTML = "-";
      } else {
        newLeaf.innerHTML = "";
        expandButton.innerHTML = "+";
      }
  });
  branchHeader.appendChild(expandButton);
  branchHeader.appendChild(headerName);

  var selectAll = document.createElement("INPUT");
  selectAll.setAttribute("type", "checkbox");
  selectAll.setAttribute("id", branch[leaf]);
  var allStrings = updateHeaderCheckBox(branch, leaf, selectAll);

  if (allStrings) {
    selectAll.addEventListener('click',(event)=>{
      if (event.target.checked) {
        updateSelectedNodes(event.target.id, true);
      } else {
        updateSelectedNodes(event.target.id, false);
      }
      newLeaf.innerHTML = "";
      if(branchHeader.firstChild.innerHTML == "-") {
        populateBranch(branch[leaf], newLeaf, branch);        
      }
    });
    branchHeader.appendChild(selectAll);
  }

  var newLeaf = document.createElement('ul');
  newBranch.appendChild(branchHeader);
  newBranch.appendChild(newLeaf);
  list.appendChild(newBranch);
}

function updateSelectedNodes(nodeList, addToSelection) {
  var newNodes = nodeList.split(',');
  if (addEventListener) {
    for (var i = 0; i < newNodes.length; i++) {
      var foundIndex = profile.selectedNodes.indexOf(newNodes[i]);
      if (foundIndex > -1) {
        if (!addToSelection) {
          profile.selectedNodes.splice(foundIndex, 1);
        }
      } else {
        if (addToSelection) {
          profile.selectedNodes.push(newNodes[i]);
        }        
      }
    }
  }
}

function populateTree() {
  var list = document.getElementById("root");
  Object.keys(tree).forEach(function (leaf) {
    createBranch(leaf, tree, list);
  });
}

function validateForm() {

  // var anchorInput = document.getElementById("anchor-node-input");
  // var anchorFound = false;
  // var availableNodes = [];

  // profile.selectedNodes.forEach(node => {
  //   var nodeIdentifiers = assetIdentifiers[node];
  //   nodeIdentifiers.forEach(id => {
  //     availableNodes.push(id);
  //     if (id == anchorInput.value) {
  //       anchorFound = true;
  //     }
  //   });
  // });
  //todo try this out
  return true;
}

function saveScene(launchAfterSave) {

    if (!validateForm()) {
      return;
    }
    var fileText = "";
    if (profile.name == "") {
        profile.name = document.getElementById("profile-name").value;
    }
    //add boiler plate
    fileText += "--" + profile.name + ".scene\n";
    fileText += "asset.require('./base_profile')\n";
    //add selected assets
    for (var i = 0; i < profile.selectedNodes.length; ++i) {
        fileText += "asset.require('scene/" + profile.selectedNodes[i] + "')\n";
    }
    //initalize
    fileText += "asset.onInitialize(function ()\n";
    //add start time
    var startTime = document.getElementById("start-time").value;
    if (startTime != "") {
        fileText += "\t"+ SetTimeLua + startTime + "')\n";
    } else {
        fileText += "\t" + NowLua + "\n";
        fileText += "\t" + DefaultStartTimeLua + "\n";
    }
    //add interesting nodes
    fileText += "\t" + InterestingStartLua;
    // var nodes = document.getElementById('featured-nodes').children;
    // for (var i = 0; i < nodes.length; i++) {
    //   var select = nodes[i];
    //   if (i != 0) {
    //     fileText += ',';
    //   }
    //   fileText += '"' + select.value + '"';
    // }
    var featuredInput = document.getElementById("featured-nodes-input");
    featuredInput.value.split(",").forEach((node) => {
      fileText += "\""+node.trim()+"\","
    });
    //remove last ,
    fileText = fileText.substring(0, fileText.length - 1);
    fileText += "})" + "\n";
    //set start anchor
    var anchorInput = document.getElementById("anchor-node-input");
    if (anchorInput.value != "") {
      fileText += "\t" + "openspace.navigation.setNavigationState({" + "\n";
      fileText += "\t\t" + AnchorStartLua + anchorInput.value + '",' + "\n";
      fileText += "\t\t" + "Position = { 526781518487.171326, 257168309890.072144, -1381125204152.817383 }," + "\n";
      fileText += "\t" + "})" + "\n";
    }
    //custom settings
    fileText += "\n";
    fileText += customizationsComment + "\n";
    fileText += document.getElementById("profile-custom-settings").value;
    fileText += customizationsComment + "end\n";
    fileText += "end)\n\n";
    //deinit
    fileText += "asset.onDeinitialize(function ()\n";
    fileText += "\topenspace.removeInterestingNodes({";
    var featuredInput = document.getElementById("featured-nodes-input");
    featuredInput.value.split(",").forEach((node) => {
      fileText += "\""+node.trim()+"\","
    });
    //remove last ,
    fileText = fileText.substring(0, fileText.length - 1);
    fileText += "})" + "\n";
    fileText += "\t " + "\n";
    fileText += "end)\n\n";

    var path = profile.path + "/" + profile.name + ".scene";
    fs.writeFileSync(path, fileText);
    ipcRenderer.send("save", {profile: profile.name, launch: launchAfterSave});
} 
