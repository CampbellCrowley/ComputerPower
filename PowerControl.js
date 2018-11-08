var http = require('http');
var https = require('https');
var app = http.createServer(handler);
var fs = require('fs');
var dateFormat = require('dateformat');
var onoff = require('onoff');
var common = require('/home/pi/ComputerPower/common.js');
var exec = require('child_process').exec;

var lengthOfDay = 43200; // 1 day / 2 seconds
var statusHistory = new Array(lengthOfDay * 7); // LengthOfDay * 1 week
var statusHistoryTimestamps = new Array(lengthOfDay * 7);
var statusHistoryTimestampsDOW = new Array(lengthOfDay * 7);
var previousIndex = 0;
var currentIndex = 0;
var currentState = 'Off';
var previousState = 'Off';
var powerState = false;
var resetState = false;
var releaseTime = 0;
var initialTime = 0;
var formattedInitialTime = "Unknown";
var lastStateChange = 0;
var formattedLastStateChange = "Unknown";
var lastGetInfo = 0;
const historyTemplate = "Sunday_____________-->___________Saturday\n%SUMMARY%%MISSING%\nPrevious state change at %STATECHANGE%\nHistory Start: %HISTORYSTART%\nServer Start: %SERVERSTART%\nSaving in %SAVETIMER%m\nNow: %NOW%\nPrevious Event: %PREVIOUSACTION% at %PREVIOUSTIME%\nSTATE--: %STATENOW%";
var history = "";
var missing = "";
var nextWriteTime = new Date().getTime() + 1800000;
var previousAction = "Server Start";
var previousActionStart = new Date().getTime();
var formattedPreviousActionStart =
    dateFormat(previousActionStart, "ddd mm-dd HH:MM:ss");

var Gpio = onoff.Gpio;
var power = new Gpio(24, 'out');
var reset = new Gpio(23, 'out');
var led = new Gpio(18, 'in');
var interval;

var Request404 = {
  host: 'www.campbellcrowley.com',
  path: '/404.html',
  port: '443',
};
var date = dateFormat(new Date(), "mm-dd HH:MM:ss");
var startDate = date;
var formattedStartDate = dateFormat(startDate, "ddd mm-dd HH:MM:ss");

app.listen(84);

console.log("ComputerPower.js Begin " + date);

var prefix = "[ComputerPower.js " + date + " ]: ";

app.on('error', function(e) { console.log(e); });

loadData();

function callbackCaller(callback) {
  setTimeout(callback);
}
function handler (req, res) {
  callbackCaller(function() {
    var ip =
        req.headers['x-forwarded-for'] || req.connection.remoteAddress || "ERRR";
    updatePrefix(ip);
    var filename = req.url;
    filename = filename.replace('/mobile', '/');
    filename = filename.replace('/m', '/');
    filename = filename.replace('/pc/', '/');

    console.log(prefix + "Request: " + filename);
    if (filename.indexOf("get-current") == 1) {
      res.writeHead(200);
      res.end(currentState);
      // get current status (on/off)
    } else if (filename.indexOf("get-history") == 1) {
      res.writeHead(200);
      res.end(statusHistory + "\n" + statusHistoryTimestamps + "\n" +
              statusHistoryTimestampsDOW + "\n" + currentIndex + "/" +
              statusHistory.length);
    } else if (filename.indexOf("get-info") == 1) {
      getInfo(function() {
        res.writeHead(200);
        res.end(history);
      });
    } else if (filename.indexOf("press-power") == 1) {
      pressPower(200);

      res.writeHead(200);
      res.end("Pressed Power");
      sendEventToTopic("notification_power_pressed");
      // Press the power button briefly
    } else if (filename.indexOf("hold-power") == 1) {
      pressPower(5000);

      res.writeHead(200);
      res.end("Held Power");
      sendEventToTopic("notification_power_held");
      // Hold the power button until poweroff
    } else if (filename.indexOf("press-reset") == 1) {
      pressReset(200);

      res.writeHead(200);
      res.end("Pressed Reset");
      sendEventToTopic("notification_reset_pressed");
      // Press the reset button
    } else if (filename.indexOf("wake") == 1) {
      exec("wakeonlan 78:24:AF:45:2F:6E", puts);
      res.writeHead(200);
      res.end("Sent magic packet to computer");
      previousAction = "Sent magic packet to computer";
      previousActionStart = new Date();
      formattedPreviousActionStart =
          dateFormat(previousActionStart, "ddd mm-dd HH:MM:ss");
      sendEventToTopic("notification_wake_event");
    } else if (filename.indexOf("index.html") == 1) {
      common.getFile(__dirname + "/index.html", res, "text/html");
      console.log(prefix + "Served index.html");
    } else {
      https.get(Request404, function(response) {
            var content = '';
            response.on('data', function(chunk) { content += chunk; });
            response.on('end', function() {
              res.writeHead(404);
              console.log(prefix + "Served 404.html " + content.length);
              if (content !== undefined) res.end(content);
              else res.end("404");
            });
            response.on('close', function() {
              console.log(prefix + "404 request closed! " + content.length);
              res.writeHead(404);
              res.end("404");
            });
            response.on('error', function() {
              console.log(prefix + "404 request errored! " + content.length);
              res.writeHead(404);
              res.end("404");
            });
          }).end();
    }
  });
}

function getInfo(callback) {
  // Get the powerstate for the last period of time
  var now = new Date().getTime();
  if (lastGetInfo + 3000 > now) {
    console.log(prefix + "Serving cached history.");
  } else {
    lastGetInfo = now;
    history =
        historyTemplate.replace(/%SUMMARY%/, getWeekSummary())
            .replace(/%MISSING%/, missing)
            .replace(/%STATECHANGE%/, formattedLastStateChange)
            .replace(/%SERVERSTART%/, formattedStartDate)
            .replace(/%HISTORYSTART%/, formattedInitialTime)
            .replace(/%SAVETIMER%/, pad((nextWriteTime - now) / 1000 / 60, 5))
            .replace(/%NOW%/, new Date(now))
            .replace(/%PREVIOUSACTION%/, previousAction)
            .replace(/%PREVIOUSTIME%/, formattedPreviousActionStart)
            .replace(/%STATENOW%/, currentState);
  }
  callback();
}

function updatePrefix(ip) {
  ip = ip || "SELF           ";
  date = dateFormat(new Date(), "mm-dd hh:MM:ss");
  prefix = "[ComputerPower.js       " + date + " " +
           common.padIp(ip.replace("::ffff:", ""))
               .replace("127.000.000.001", "SELF           ")
               .replace("192.168.001.211", "RPi-2          ") +
           "]: ";
}

function puts(error, stdout, stderr) { console.log(stdout) }

function getWeekSummary() {
  var day = [0, 0, 0, 0, 0, 0, 0];
  var dayTotal = [0, 0, 0, 0, 0, 0, 0];

  const oldestAcceptable = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (var i = 0; i < lengthOfDay * 7; i++) {
    if (statusHistoryTimestamps[i] < oldestAcceptable) continue;
    day[statusHistoryTimestampsDOW[i]] += statusHistory[i];
    dayTotal[statusHistoryTimestampsDOW[i]]++;
  }
  for (var i = 0; i < day.length; i++) {
    if (dayTotal[i] == 0) {
      day[i] = "0.000";
    } else {
      day[i] = pad(day[i] / dayTotal[i] * 100.0, 5);
    }
  }
  return day;
}

function pad(num, digits) {
  if (Math.round(num) == num) num += ".";
  for (var i = 0; i < digits; i++) {
    num += "0";
  }
  num = num.substring(0, digits);
  return num;
}

interval = setInterval(function() {
  var now = Date.now();
  if (statusHistoryTimestamps[currentIndex] === undefined ||
      statusHistoryTimestamps[currentIndex] < now - 2000) {
    previousIndex = currentIndex;
    currentIndex++;
    if (currentIndex == statusHistory.length) currentIndex = 0;
    statusHistory[currentIndex] = led.readSync();
    statusHistoryTimestamps[currentIndex] = now;
    statusHistoryTimestampsDOW[currentIndex] = new Date(now).getDay();

    previousState = currentState;
    currentState = statusHistory[currentIndex] > 0.5 ? "On" : "Off";

    if (currentState != previousState) {
      if (initialTime == 0) {
        initialTime = now;
        formattedInitialTime = dateFormat(initialTime, "ddd mm-dd HH:MM:ss");
      }
      lastStateChange = now;
      formattedLastStateChange =
          dateFormat(lastStateChange, "ddd mm-dd HH:MM:ss");
      if (currentState == "On") {
        sendEventToTopic("notification_power_on");
      } else {
        sendEventToTopic("notification_power_off");
      }
    }
  }

  if (nextWriteTime < now) {
    nextWriteTime = now + 1800000; // 30 Minutes
    saveData();
  }

  if (powerState || resetState) {
    if (now > releaseTime) {
      powerState = false;
      resetState = false;
      power.writeSync(0);
      reset.writeSync(0);
      updatePrefix();
      console.log(prefix + "Release");
    }
  }

}, 50);

function sendEventToTopic(topic) {
  updatePrefix();
  console.log(prefix + "Sending topic request: " + topic);
  var sendTopic = {
    hostname: 'fcm.googleapis.com',
    path: '/fcm/send',
    headers: {"Content-Type": "application/json", "Authorization":"key=AIzaSyC2DBReduyo0U-4sm9Rm2ogIxV2v4yu0VY"},
    port: 443,
    method: "POST"
  };
  var message = "{\n  \"to\": \"/topics/" + topic + "\",\n  \"data\": {\n    \"message\":  \"" + topic + "\",\n  }\n}";
  var req = https.request(sendTopic, function(response) {
    var content = '';
    response.on('data', function(chunk) { content += chunk; });
    response.on('end', function() {
      updatePrefix();
      console.log(prefix + "Firebase replied: " + content);
    });
    response.on('close', function() {
      updatePrefix();
      console.log(prefix + "Firebase request closed! " + content.length);
    });
    response.on('error', function() {
      updatePrefix();
      console.log(prefix + "Firebase request errored! " + content.length);
    });
  });
  req.write(message);
  req.end();
  req.on('error', function(e) {console.log(e);});
}

function pressPower(duration) {
  if (new Date() > releaseTime && !powerState && !resetState) {
    powerState = true;
    power.writeSync(1);
    reset.writeSync(0);
    console.log(prefix + "Power Pressed (" + duration + ")");
    releaseTime = new Date(Date.now() + duration);
    previousAction = "Pressed Power for " + duration + "ms";
    previousActionStart = new Date();
    formattedPreviousActionStart =
        dateFormat(previousActionStart, "ddd mm-dd HH:MM:ss");
  }
}

function pressReset(duration) {
  if (new Date() > releaseTime && !resetState && !powerState) {
    resetState = true;
    power.writeSync(0);
    reset.writeSync(1);
    console.log(prefix + "Reset Pressed (" + duration + ")");
    releaseTime = new Date(Date.now() + duration);
    previousAction = "Pressed Reset for " + duration + "ms";
    previousActionStart = new Date();
    formattedPreviousActionStart =
        dateFormat(previousActionStart, "ddd mm-dd HH:MM:ss");
  }
}

function saveData() {
  var statusHistoryFile = fs.createWriteStream('statusHistory.dat');
  statusHistoryFile.on('error', function(e) { console.log(e); });
  statusHistoryFile.write(statusHistory + "");
  statusHistoryFile.end();
  statusHistoryFile.close();

  var statusHistoryTimestampsFile =
      fs.createWriteStream('statusHistoryTimestamps.dat');
  statusHistoryTimestampsFile.on('error', function(e) { console.log(e); });
  statusHistoryTimestampsFile.write(statusHistoryTimestamps + "");
  statusHistoryTimestampsFile.end();
  statusHistoryTimestampsFile.close();
  updatePrefix();
  console.log(prefix + "Wrote data to files.");
}

function loadData() {
  var buf = fs.readFileSync('statusHistory.dat');
  var temp = buf.toString().split(",");
  var finalChangeIndex = 0;
  for (var i = 0; i < temp.length && i < statusHistory.length; i++) {
    statusHistory[i] = Number(temp[i]);
  }
  updatePrefix();
  console.log(prefix + "Read files (1/2)");
  temp = fs.readFileSync('statusHistoryTimestamps.dat').toString().split(",");
  var tempDate = new Date();
  for (var i = 0; i < statusHistoryTimestampsDOW.length; i++) {
    statusHistoryTimestampsDOW[i] = 7;
  }
  for (var i = 0; i < temp.length && i < statusHistoryTimestamps.length; i++) {
    statusHistoryTimestamps[i] = Number(temp[i]);
    if (initialTime == 0 || statusHistoryTimestamps[i] < initialTime) {
      initialTime = statusHistoryTimestamps[i];
    }
    if (temp[i] != 0) {
      previousIndex = currentIndex;
      currentIndex = i;

      previousState = currentState;
      currentState = statusHistory[currentIndex] > 0.5 ? "On" : "Off";

      if (currentState != previousState) {
        finalChangeIndex = i;
      }
      tempDate.setTime(statusHistoryTimestamps[i]);
      statusHistoryTimestampsDOW[i] = tempDate.getDay();
      const current = statusHistoryTimestamps[i];
      const previous = statusHistoryTimestamps[i - 1];
      if (previous > 0 && current > 0 &&
          current - previous > 300000) {  // 5 mins
        missing += "\nMissing history from " +
            dateFormat(previous, "ddd mm/dd/yy HH:MM:ss") + " to " +
            dateFormat(current, "ddd mm/dd/yy HH:MM:ss");
      }
    }
  }
  formattedInitialTime = dateFormat(initialTime, "ddd mm/dd/yy HH:MM:ss");
  lastStateChange = Number(statusHistoryTimestamps[finalChangeIndex]);
  updatePrefix();
  console.log(prefix + "Read files (2/2)");
}

var app2 = http.createServer(handler2);
app2.listen(80);
function handler2(req, res) {
  res.writeHead(418);
  res.end('418: I\'m a teapot');
}

function exit() {
  clearInterval(interval);
  power.writeSync(0);
  power.unexport();
  reset.writeSync(0);
  reset.unexport();
  led.unexport();
  console.log('Goodbye');
  process.exit();
}

process.on('SIGINT', exit);
