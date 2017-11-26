var fs = require('fs');

exports.padIp = function(str) {
  var res = str.split('.');
  for (var i = 0; i < res.length; i++) {
    res[i] = ("000" + res[i]).slice(-3);
    res[i] = res[i].replace(":", "0");
  }
  return res.join('.');
}

exports.res404 = function(prefix, res) {
  fs.exists("/var/www/html/404.html", function(exists) {
    if (exists) {
      console.log(prefix + "Serving ( 404 )");
      exports.getFile("/var/www/html/404.html", res, "text/html", true);
    } else {
      console.log(prefix + "File not found:  404.html");
      res.end("404");
    }
  });
}

exports.getFile = function(localPath, res, mimeType, is404) {
  fs.readFile(localPath, function(err, contents_) {
    if (!err) {
      try {
        var contents = contents_.toString();
        replaceHeader(contents, function(newcontents1) {
          if (newcontents1 !== undefined) contents = newcontents1;
          replaceFooter(contents, function(newcontents2) {
            if (newcontents2 !== undefined) contents = newcontents2;
            replaceStyles(contents, function(newcontents3) {
              if (newcontents3 !== undefined) contents = newcontents3;
              if (contents_.toString() !== contents)
                contents_ = Buffer.from(contents);
              res.setHeader("Content-Length", contents_.length);
              res.setHeader("Content-Type", mimeType);
              if (is404 !== undefined) {
                res.statusCode = 404;
              } else {
                res.statusCode = 200;
              }
              res.end(contents_);
            });
          });
        });
      } catch (e) {
        res.setHeader("Content-Length", contents_.length);
        res.setHeader("Content-Type", mimeType);
        if (is404 !== undefined) {
          res.statusCode = 404;
        } else {
          res.statusCode = 200;
        }
        res.end(contents_);
      }
    } else {
        res.writeHead(500);
        res.end();
    }
  });
}

function replaceHeader(contents, cb) {
  contents = contents.toString();
  var Tag = "<div id=\"mainheader\"></div>";
  if (contents.indexOf(Tag) > -1) {
    fs.readFile("/var/www/html/header.html", function(err2, file) {
      if (err2) {
        console.log("Failed to get header file");
        cb(contents);
      } else {
        contents = contents.replaceAll(Tag, file.toString());
        cb(contents);
      }
    });
  } else {
    cb(contents);
  }
}
function replaceFooter(contents, cb) {
  contents = contents.toString();
  var Tag = "<div id=\"mainfooter\"></div>";
  if (contents.indexOf(Tag) > -1) {
    fs.readFile("/var/www/html/footer.html", function(err2, file) {
      if (err2) {
        console.log("Failed to get footer file");
        cb(contents);
      } else {
        contents = contents.replaceAll(Tag, file.toString());
        cb(contents);
      }
    });
  } else {
    cb(contents);
  }
}
function replaceStyles(contents, cb) {
  contents = contents.toString();
  var Tag = "<style></style>";
  if (contents.indexOf(Tag) > -1) {
    fs.readFile("/var/www/html/styles.css", function(err2, file) {
      if (err2) {
        console.log("Failed to get styles file");
        cb(contents);
      } else {
        contents =
            contents.replaceAll(Tag, "<style>" + file.toString() + "</style>");
        cb(contents);
      }
    });
  } else {
    cb(contents);
  }
}

String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, 'g'), replacement);
};

