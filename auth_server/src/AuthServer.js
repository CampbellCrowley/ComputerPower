// Campbell Crowley (web@campbellcrowley.com)
// March 2021
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');
const Authenticator = require('./Authenticator.js');

class AuthServer {
  /**
   * Create instance of AuthServer.
   * @param {number} [port=80] Port for server to listen on.
   * @param {string} [address='127.0.0.1'] Address to bind to.
   */
  constructor(port = 80, address = '127.0.0.1') {
    this._app = express();
    this._app.use(compression());
    this._app.use(bodyParser.json());

    /**
     * Port to bind to.
     * @private
     * @constant
     * @default 80
     * @type {number}
     */
    this._port = port;
    /**
     * Address to listen on.
     * @private
     * @constant
     * @default '127.0.0.1'
     * @type {string}
     */
    this._address = address;
    /**
     * http.Server instance from Express.
     * @private
     * @default
     * @type {?http.Server}
     */
    this._server = null;

    /**
     * Instance of Authenticator for managing user permissions.
     * @private
     * @constant
     * @type {Authenticator}
     */
    this._authenticator = new Authenticator();

    this._registerEndpoints();
  }
  /**
   * Start the server.
   * @public
   */
  start() {
    console.log(`AuthServer starting... (${this._address}:${this._port}).`);
    this._server = http.createServer(this._app);
    this._server.listen(this._port, this._address, () => {
      console.log(`AuthServer server begin.`);
    });
  }
  /**
   * Shutdown the server.
   * @public
   */
  shutdown() {
    if (this._server) {
      console.log('AuthServer server stopping...');
      this._server.close(() => {
        console.log('AuthServer server closed.');
        this._server = null;
      });
    } else {
      console.log('AuthServer already stopped?');
    }
  }
  /**
   * Register ExpressJS endpoint handlers.
   * @private
   */
  _registerEndpoints() {
    // Error handler.
    this._app.use((err, req, res, next) => {
      if (err) {
        console.error('Encountered error while handing request:');
        console.error(err);
        if (err instanceof SyntaxError) {
          res.status(400).json({error: 'Syntax Error', code: 400});
          console.error(
              `${req.method} ${res.statusCode} ${req.originalUrl} ${req.ip}`);
        } else {
          res.status(400).json({error: 'Unknown Error', code: 400});
          console.error(
              `${req.method} ${res.statusCode} ${req.originalUrl} ${req.ip}`);
        }
      } else {
        next();
      }
    });

    // All routes, logging.
    this._app.use((req, res, next) => {
      next();
      console.log(
          `${req.method} ${res.statusCode} ${req.originalUrl} FROM ${req.ip}`);
    });

    // Homepage.
    this._app.get('/', (req, res) => res.send('Hello World!'));

    this._app.get('/get-devices', (req, res) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({error: '401 Unauthorized. No Token.', code: 401});
      } else {
        this._authenticator.verify(authHeader, (err, user) => {
          if (err) {
            res.status(err.code).json(err);
            return;
          } else if (!user) {
            res.status(401).json(
                {error: '401 Unauthorized. Bad Token.', code: 401});
            return;
          }
          this._authenticator.getDevices(user.uid, (err, list) => {
            res.status(200).json({data: list, message: 'Success!', code: 200});
          });
        });
      }
    });

    // Proxy Routes.
    this._app.get('/get-state/:dId', (...args) => this.tryProxy(...args));
    this._app.get('/get-info/:dId', (...args) => this.tryProxy(...args));
    this._app.get('/get-history/:dId', (...args) => this.tryProxy(...args));
    this._app.post('/press-button/:dId', (...args) => this.tryProxy(...args));
    this._app.post('/hold-button/:dId', (...args) => this.tryProxy(...args));
    this._app.post('/request-state/:dId', (...args) => this.tryProxy(...args));

    // All routes, fallback.
    this._app.use((req, res) => res.status(404).json({
      error: '404 Not Found',
      code: 404,
    }));
  }

  /**
   * Attempt to proxy a request to the specified device if the requester has
   * permission.
   * @public
   * @param {express.Request} req Request.
   * @param {express.Response} res Response.
   */
  tryProxy(req, res) {
    const authHeader = req.headers.authorization;
    let did = req.params.dId;

    if (!authHeader) {
      res.status(401).json({error: '401 Unauthorized.', code: 401});
    } else if (!did) {
      res.status(400).json({error: '400 Bad Request.', code: 400});
    } else {
      did = decodeURIComponent(did);
      this._authenticator.verify(authHeader, (err, user) => {
        if (err) {
          res.status(err.code).json(err);
          return;
        } else if (!user) {
          res.status(401).json({error: '401 Unauthorized.', code: 401});
          return;
        }
        this._authenticator.checkDeviceAccess(user.uid, did, (err, access) => {
          if (err) {
            res.status(err.code).json(err);
            return;
          } else if (!access.hasAccess) {
            res.status(401).json({error: '401 Unauthorized.', code: 401});
            return;
          }
          this._authenticator.getDeviceHost(did, (err, host) => {
            if (err) {
              res.status(err.code).json(err);
              return;
            } else if (!host || !host.length) {
              res.status(500).json({error: 'Internal Server Error', code: 500});
              return;
            }
            const url = `${host}${req.url}`;
            const req2 = http.request(url, (res2) => {
              res.status(res2.statusCode);
              res.setHeader('content-type', res2.headers['content-type']);
              let body = '';
              res2.on('data', (chunk) => body += chunk);
              res2.on('end', () => {
                res.send(body);
              });
            });
            req2.on('error', (err) => {
              console.error(`Error while proxying request to ${url}`);
              console.error(err);
              res.status(504).json({error: 'Device Unavailable', code: 504});
            });
            req2.write(JSON.stringify(req.body));
            req2.end();
          });
        });
      });
    }
  }
}
module.exports = AuthServer;
