var http = require('http');
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
var lastStateChange = 0;
var lastGetInfo = 0;
var history = "";
var nextWriteTime = new Date().getTime() + 1800000;
var previousAction = "Server Start";
var previousActionStart = new Date().getTime();

var Gpio = onoff.Gpio;
var power = new Gpio(24, 'out');
var reset = new Gpio(23, 'out');
var led = new Gpio(18, 'in');
var interval;

var Request404 = {
  // host: 'Campbell-DesktopDeb.local',
  host: 'Campbell-Pi-2.local',
  path: '/404.html',
  port: '81',
};
var date = dateFormat(new Date(), "mm-dd HH:MM:ss");
var startDate = date;

app.listen(84);

console.log("ComputerPower.js Begin " + date);

var prefix = "[ComputerPower.js " + date + " ]: ";

app.on('error', function(e) { console.log(e); });

loadData();

function handler (req, res) {
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
    // Press the power button briefly
  } else if (filename.indexOf("hold-power") == 1) {
    pressPower(5000);

    res.writeHead(200);
    res.end("Held Power");
    // Hold the power button until poweroff
  } else if (filename.indexOf("press-reset") == 1) {
    pressReset(200);

    res.writeHead(200);
    res.end("Pressed Reset");
    // Press the reset button
  } else if (filename.indexOf("wake") == 1) {
    exec("wakeonlan 78:24:AF:45:2F:6E", puts);
    res.writeHead(200);
    res.end("Sent magic packet to computer");
    previousAction = "Sent magic packet to computer";
    previousActionStart = new Date();
  } else if (filename.indexOf("index.html") == 1) {
    common.getFile(__dirname + "/index.html", res, "text/html");
    console.log(prefix + "Served index.html");
  } else {
    http.get(Request404, function(response) {
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
}

function getInfo(callback) {
  // Get the powerstate for the last period of time
  var now = new Date().getTime();
  if (lastGetInfo + 2000 > now) {
    console.log(prefix + "Serving cached history.");
  } else {
    lastGetInfo = now;
    history = "Sunday_____________-->___________Saturday\n";
    history += getWeekSummary() + "\n";
    var spaces = statusHistoryTimestampsDOW[currentIndex] * 6.0 +
                 new Date(statusHistoryTimestamps[currentIndex]).getHours() / 4;
    for (var i = 1; i < spaces; i++) {
      history += "-";
    }
    history += "^";

    for (var i = 1; i < statusHistoryTimestamps.length; i++) {
      var current = Number(statusHistoryTimestamps[i]);
      var previous = Number(statusHistoryTimestamps[i - 1]);
      if (previous > 0 && current > 0 && current - previous > 300000) {
        history += "\nMissing history from " +
                   dateFormat(previous, "ddd HH:MM:ss") + " to " +
                   dateFormat(current, "ddd HH:MM:ss");
      }
    }
    if (lastStateChange != initialTime) {
      history += "\nPrevious state change at " +
                 dateFormat(new Date(lastStateChange), "ddd mm-dd HH:MM:ss");
    } else {
      history += "\n";
    }
    history += "\nServer Start: " + dateFormat(startDate, "ddd mm-dd HH:MM:ss");
    history +=
        "\nSaving in " + pad((nextWriteTime - now) / 1000 / 60, 5) + "mins";
    history += "\nNow: " + new Date(now);
    history += "\nPrevious Event: " + previousAction + " at " +
        dateFormat(previousActionStart, "ddd mm-dd HH:MM:ss");
    history += "\nSTATE--: " + currentState;
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
  var day = new Array(7);

  for (var i = 0; i < day.length; i++) { day[i] = 0.0; }
  for (var i = 0; i < lengthOfDay * 7; i++) {
    day[statusHistoryTimestampsDOW[i] || day.length] +=
        Number(statusHistory[i]) || 0;
  }
  var daystring = new Array(7);
  for (var i = 0; i < daystring.length; i++) {
    if (day[i] == 0.0) daystring[i] = "0.000";
    else if (day[i] == lengthOfDay) daystring[i] = "100.0";
    else daystring[i] = pad(day[i] / lengthOfDay * 100.0, 5);
  }
  return daystring;
}

function pad(num, digits) {
  for (var i = 0; i < digits; i++) {
    num += "0";
  }
  num = num.substring(0, digits);
  return num;
}

interval = setInterval(function() {
  var now = new Date().getTime();
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
      }
      lastStateChange = now;
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

}, 10);

function pressPower(duration) {
  if (new Date() > releaseTime && !powerState && !resetState) {
    powerState = true;
    power.writeSync(1);
    reset.writeSync(0);
    console.log(prefix + "Power Pressed (" + duration + ")");
    releaseTime = new Date(Date.now() + duration);
    previousAction = "Pressed Power for " + duration + "ms";
    previousActionStart = new Date();
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
    statusHistory[i] = temp[i];
    if (temp[i].length > 0) {
      previousIndex = currentIndex;
      currentIndex = i;

      previousState = currentState;
      currentState = statusHistory[currentIndex] > 0.5 ? "On" : "Off";

      if (currentState != previousState) {
        finalChangeIndex = i;
      }
    }
  }
  updatePrefix();
  console.log(prefix + "Read files (1/2)");
  temp = fs.readFileSync('statusHistoryTimestamps.dat').toString().split(",");
  var tempDate = new Date();
  for (var i = 0; i < temp.length && i < statusHistoryTimestamps.length; i++) {
    statusHistoryTimestamps[i] = temp[i];
    if (temp[i] != 0) {
      tempDate.setTime(Number(temp[i]));
      statusHistoryTimestampsDOW[i] = tempDate.getDay();
    }
  }
  lastStateChange = Number(statusHistoryTimestamps[finalChangeIndex]);
  updatePrefix();
  console.log(prefix + "Read files (2/2)");
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
