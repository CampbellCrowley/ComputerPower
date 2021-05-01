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
var toggleStateButton = document.getElementById('toggleStateButton');
var graphCanvas = document.getElementById('graphCanvas');

var graph = null;
var selectedDevice = null;
var deviceCache = [];
var currentInfo = null;

function handleClick(action) {
  console.log('Click', action, typeof action);
  switch (action) {
    case 'toggleState':
      if (currentInfo) {
        sendRequest(
            'request-state', {state: !currentInfo.currentState ? 1 : 0},
            updateDeviceStatus);
      }
      break;
    case 'pressReset':
      sendRequest('press-button', {button: 'reset'}, updateDeviceStatus);
      break;
    case 'pressPower':
      sendRequest('press-button', {button: 'power'}, updateDeviceStatus);
      break;
    case 'holdPower':
      sendRequest('hold-button', {button: 'power'}, updateDeviceStatus);
      break;
    default:
      break;
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
  var summary = currentInfo && currentInfo.summary; // Graph data.

  deviceCover.style.display = (meta === null) ? 'block' : 'none';

  nameText.textContent = name;

  switch (state) {
    case 1:
      statusBox.style.backgroundColor = 'lime';
      statusText.textContent = 'On';

      toggleStateButton.value = 'Turn Off';
      toggleStateButton.style.backgroundColor = 'red';
      break;
    case 0:
      statusBox.style.backgroundColor = 'red';
      statusText.textContent = 'Off';

      toggleStateButton.value = 'Turn On';
      toggleStateButton.style.backgroundColor = 'lime';
      break;
    default:
      statusBox.style.backgroundColor = '#DDD';
      statusText.textContent = 'Unknown';

      toggleStateButton.value = '...';
      toggleStateButton.style.backgroundColor = '#DDD';
      break;
  }

  if (summary) {
    updateGraph(summary);
  } else {
    updateGraph(null);
  }
}

function createGraph() {
  var ctx = graphCanvas.getContext('2d');
  graph = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
        'Saturday'
      ],
      datasets: [{
        label: '% Uptime',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)', 'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)', 'rgba(75, 192, 192, 0.2)',
          'rgba(153, 102, 255, 0.2)', 'rgba(255, 159, 64, 0.2)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1,
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
        }
      },
      responsive: true,
    }
  });
}
function updateGraph(summary) {
  var percents = summary ?
      summary.map((el) => Math.max(Math.min(Math.floor(el * 100)), 100), 0) :
      [0, 0, 0, 0, 0, 0, 0];
  graph.data.datasets[0].data = percents;
  graph.update();
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
  console.log('Request', action, data);
  getIdToken(function(err, token) {
    if (err) {
      console.error(err);
      if (onfail) onfail();
      return;
    } else if (!token) {
      console.log('NoToken');
      if (onfail) onfail();
      return;
    }
    var req = new XMLHttpRequest();
    req.open(
        data ? 'POST' : 'GET',
        'https://dev.campbellcrowley.com/pc2/api/' + action +
            (selectedDevice ? '/' + encodeURIComponent(selectedDevice) : ''));
    req.setRequestHeader("Authorization", token);
    if (data) req.setRequestHeader('Content-Type', 'application/json');
    req.responseType = 'json';
    req.onload = onload;
    req.onerror = onfail;
    req.send(data ? JSON.stringify(data) : undefined);
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
createGraph();
