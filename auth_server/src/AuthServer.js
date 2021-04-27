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
   * @param {string} [address='0.0.0.0'] Address to bind to.
   */
  constructor(port = 80, address = '0.0.0.0') {
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
     * @default '0.0.0.0'
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

    // Proxy Routes.
    this._app.get('/get-state', (...args) => this.tryProxy(...args));
    this._app.get('/get-info', (...args) => this.tryProxy(...args));
    this._app.get('/get-history', (...args) => this.tryProxy(...args));
    this._app.post('/press-button', (...args) => this.tryProxy(...args));
    this._app.post('/hold-button', (...args) => this.tryProxy(...args));
    this._app.post('/request-state', (...args) => this.tryProxy(...args));

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
    const authHeader = req.header.authorization;
    const did = req.query.dId;

    if (!authHeader) {
      res.status(401).json({error: '401 Unauthorized.', code: 401});
    } else if (!did) {
      res.status(401).json({error: '400 Bad Request.', code: 400});
    } else {
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
            });
            req2.write(req.body);
            req2.end();
          });
        });
      });
    }
  }
}
module.exports = AuthServer;
