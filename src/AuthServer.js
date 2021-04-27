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
    // All routes, logging.
    this._app.use((req, res, next) => {
      next();
      console.log(
          `${req.method} ${res.statusCode} ${req.originalUrl} FROM ${req.ip}`);
    });

    // Homepage.
    this._app.get('/', (req, res) => res.send('Hello World!'));

    // Returns current power state. Either On or Off.
    this._app.get('/get-state', (req, res) => {
      const state = this._controller.currentState();
      res.status(200);
      res.json({data: state, code: 200});
    });
    // Gets summary of current state info.
    this._app.get('/get-info', (req, res) => {
      res.status(501).json(
          {error: 'Not Yet Implemented', code: 501, device: 'Auth'});
    });
    // Gets data history for graphing.
    this._app.get('/get-history', (req, res) => {
      res.status(501).json(
          {error: 'Not Yet Implemented', code: 501, device: 'Auth'});
    });
    // Request pressing of a button. Either power or reset.
    this._app.post('/press-button', (req, res) => {
      if (!req.body) {
        res.status(400).json({error: 'Bad Request', code: 400, device: 'Auth'});
      } else {
        this._controller.pressButton(req.body.button, (err) => {
          if (err) {
            if (err.code) {
              res.status(err.code);
            } else {
              res.status(200);
            }
            res.json(err);
          } else {
            res.status(204);
            res.send();
          }
        });
      }
    });
    // Request holding of a button. Either power or reset.
    this._app.post('/hold-button', (req, res) => {
      if (!req.body) {
        res.status(400).json({error: 'Bad Request', code: 400, device: 'Auth'});
      } else {
        this._controller.holdButton(req.body.button, (err) => {
          if (err) {
            if (err.code) {
              res.status(err.code);
            } else {
              res.status(200);
            }
            res.json(err);
          } else {
            res.status(204);
            res.send();
          }
        });
      }
    });
    // Request the computer enter a certain power state. Either On or Off.
    this._app.post('/request-state', (req, res) => {
      res.status(501).json({error: 'Not Yet Implemented', code: 501});
    });

    // All routes, fallback.
    this._app.use((req, res) => res.status(404).json({
      error: '404 Not Found',
      code: 404,
    }));
  }
}
module.exports = AuthServer;
