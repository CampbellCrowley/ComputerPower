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

var deviceList = document.getElementById('deviceList');
var statusBox = document.getElementById('statusBox');
var statusText = document.getElementById('statusText');
var nameText = document.getElementById('nameText');

var selectedDevice = '';
var deviceCache = [];
var currentInfo = null;

function handleClick(action) {
  switch(action) {
    case 'toggleState':
      break;
    case 'pressReset':
      break;
    case 'pressPower':
      break;
    case 'holdPower':
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
    if (this.statusCode != 200) {
      console.warn('get-info', this.statusCode, this.response);
    } else {
      console.log('get-info', this.statusCode, this.response);

      currentInfo = this.response.data;
    }

    refreshUI();
  });
}

function refreshUI() {
  var meta = getDeviceMeta(selectedDevice);
  name = meta && meta.name || selectedDevice || 'No Device Selected';
  state = currentInfo.currentState
  summary = currentInfo.summary; // Graph data.

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
  deviceList.innerHTML = '';

  if (deviceCache.lenth > 0) {
    deviceCache.forEach(function(el) {
      deviceList.appendChild(createDeviceButton(el, true));
    });
  } else {
    deviceList.appendChild(
        createDeviceButton({id: 'placeholder', name: 'No Devices'}, false));
  }
}

function createDeviceButton(meta, isClickable) {
  var el = document.createElement('li');
  el.name = meta.id;
  el.textContent = meta.name;
  if (meta.id === selectDevice) el.classList.add('selected');

  if (isClickable) {
    el.href = '#';
    el.onclick = function() {
      selectDevice(el.name);
    };
  }

  return el;
}

function getDeviceMeta(did) {
  return deviceCache.find((el) => el.id === did);
}

function selectDevice(did) {
  var meta = getDeviceMeta(did);
  if (!meta) {
    selectedDevice = '';
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
            '?did=' + selectedDevice);
    req.setRequestHeader("Authenticator", token);
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
  return true;
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
    if (this.statusCode != 200) {
      console.warn('get-devices', this.statusCode, this.response);
      return;
    }
    console.log('get-devices', this.statusCode, this.response);
    deviceCache = this.response.data || [];
    refreshDeviceList();
  }, function() {
    refreshDeviceList();
  });
}
fetchUserInfo();
