// Your web app's Firebase configuration
var firebaseConfig = {
  apiKey: "AIzaSyAmWKE4REuEBrjLWcyl0qtzO4podKVoLIc",
  authDomain: "campbells-app.firebaseapp.com",
  databaseURL: "https://campbells-app.firebaseio.com",
  projectId: "campbells-app",
  storageBucket: "campbells-app.appspot.com",
  messagingSenderId: "275682034627",
  appId: "1:275682034627:web:3cb41f04dd69a6efc5f376"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(firebase.auth());

ui.start('#firebase-auth', {
  signInOptions: [
    // List of OAuth providers supported.
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
  ],
  callbacks: {
    signInSuccessWithAuthResult: onSignIn,
  },
});

var interval = setInterval(function() {
  if (selectDevice) updateDeviceStatus();
}, 10000);

var deviceCover = document.getElementById('deviceCover');
var deviceList = document.getElementById('deviceList');
var statusBox = document.getElementById('statusBox');
var statusText = document.getElementById('statusText');
var nameText = document.getElementById('nameText');

var selectedDevice = null;
var deviceCache = [];
var currentInfo = null;

function handleClick(action) {
  switch(action) {
    case 'toggleState':
      if (currentInfo) {
        sendRequest(
            'request-state', {state: !currentInfo.currentState},
            updateDeviceStatus());
      }
      break;
    case 'pressReset':
      sendRequest('press-button', {button: 'reset'}, updateDeviceStatus());
      break;
    case 'pressPower':
      sendRequest('press-button', {button: 'power'}, updateDeviceStatus());
      break;
    case 'holdPower':
      sendRequest('hold-button', {button: 'power'}, updateDeviceStatus());
      break;
    default:
      return;
  }
}

function updateDeviceStatus() {
  var startId = selectedDevice;
  if (!selectedDevice) {
    currentInfo = null;
    refreshUI();
  }
  sendRequest('get-info', undefined, function() {
    currentInfo = null;

    if (startId !== selectedDevice) return;
    if (this.status == 504) {
      console.log('get-info', this.status, 'Device offline');
    } else if (this.status != 200) {
      console.warn('get-info', this.status, this.response);
    } else {
      console.log('get-info', this.status, this.response);

      currentInfo = this.response.data;
    }

    refreshUI();
  });
}

function refreshUI() {
  var meta = getDeviceMeta(selectedDevice);
  name = meta && meta.dName || selectedDevice || 'No Device Selected';
  var state = currentInfo && currentInfo.currentState;
  // var summary = currentInfo.summary; // Graph data.

  deviceCover.style.display = (meta === null) ? 'block' : 'none';

  nameText.textContent = name;

  switch (state) {
    case 1:
      statusBox.style.backgroundColor = 'lime';
      statusText.textContent = 'On';
      break;
    case 0:
      statusBox.style.backgroundColor = 'red';
      statusText.textContent = 'Off';
      break;
    default:
      statusBox.style.backgroundColor = '#DDD';
      statusText.textContent = 'Unknown';
      break;
  }
}

function refreshDeviceList() {
  console.log(deviceCache);
  while (deviceList.firstChild) deviceList.removeChild(deviceList.firstChild);

  if (deviceCache.length > 0) {
    deviceCache.forEach(function(el) {
      deviceList.appendChild(createDeviceButton(el, true));
    });
  } else {
    deviceList.appendChild(
        createDeviceButton({dId: 'placeholder', dName: 'No Devices'}, false));
  }
}

function createDeviceButton(meta, isClickable) {
  var el = document.createElement('li');
  el.setAttribute('name', meta.dId);
  el.textContent = meta.dName;
  if (meta.dId === selectedDevice) el.classList.add('selected');

  if (isClickable) {
    el.href = '#';
    el.onclick = function() {
      selectDevice(el.getAttribute('name'));
    };
    el.style.cursor = 'pointer';
  }

  return el;
}

function getDeviceMeta(did) {
  return deviceCache.find((el) => el.dId === did);
}

function selectDevice(did) {
  var meta = getDeviceMeta(did);
  if (!meta) {
    selectedDevice = null;
  } else {
    selectedDevice = did;
  }
  updateDeviceStatus();
}

function sendRequest(action, data, onload, onfail) {
  getIdToken(function(err, token) {
    if (err) {
      console.error(err);
      onfail();
      return;
    } else if (!token) {
      console.log('NoToken');
      onfail();
      return;
    }
    var req = new XMLHttpRequest();
    req.open(
        'GET',
        'https://dev.campbellcrowley.com/pc2/api/' + action +
            (selectedDevice ? '/' + encodeURIComponent(selectedDevice) : ''));
    req.setRequestHeader("Authorization", token);
    req.responseType = 'json';
    req.onload = onload;
    req.onerror = onfail;
    req.send(data || undefined);
  });
}

function onSignIn(authResult, redirectUrl) {
  console.log('Sign In:', authResult, redirectUrl);
  fetchUserInfo();
  // Return type determines whether we continue the redirect automatically.
  return false;
}

function getIdToken(cb) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    cb(null, null);
    return;
  }
  currentUser.getIdToken(/* forceRefresh */ true)
      .then(function(token) {
        cb(null, token);
      })
      .catch(function(error) {
        cb(error);
      });
}

function fetchUserInfo() {
  sendRequest('get-devices', null, function() {
    if (this.status != 200) {
      console.warn('get-devices', this.status, this.response);
      return;
    }
    console.log('get-devices', this.status, this.response);
    deviceCache = this.response.data || [];
    refreshDeviceList();
  }, function() {
    refreshDeviceList();
  });
}
fetchUserInfo();
