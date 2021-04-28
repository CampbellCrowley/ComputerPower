// Campbell Crowley (web@campbellcrowley.com)
// March 2021
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');

const PowerController = require('./PowerController.js');
const PowerStateGoal = require('./enum/PowerStateGoal.js');

class PowerServer {
  /**
   * Create instance of PowerServer.
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
     * Instance of PowerController for managing power state info.
     * @private
     * @constant
     * @type {PowerController}
     */
    this._controller = new PowerController();

    this._registerEndpoints();
  }
  /**
   * Start the server.
   * @public
   */
  start() {
    console.log(
        `PowerServer server starting... (${this._address}:${this._port}).`);
    this._controller.start();
    this._server = http.createServer(this._app);
    this._server.listen(this._port, this._address, () => {
      console.log(`PowerServer server begin.`);
    });
  }
  /**
   * Shutdown the server.
   * @public
   */
  shutdown() {
    this._controller.shutdown();
    if (this._server) {
      console.log('PowerServer server stopping...');
      this._server.close(() => {
        console.log('PowerServer server closed.');
        this._server = null;
      });
    } else {
      console.log('PowerServer already stopped?');
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

    // Returns current power state. Either On or Off.
    this._app.get('/get-state', (req, res) => {
      const state = this._controller.currentState;
      res.status(200);
      res.json({data: state, code: 200});
    });
    // Gets summary of current state info.
    this._app.get('/get-info', (req, res) => {
      res.status(200).json({
        data: {
          summary: this._controller.history.getWeekSummary(),
          currentState: this._controller.currentState,
        },
        code: 200
      });
    });
    // Gets data history for graphing.
    this._app.get('/get-history', (req, res) => {
      res.status(200).json(
          {data: this._controller.history.getEventHistory(), code: 200});
    });
    // Request pressing of a button. Either power or reset.
    this._app.post('/press-button', (req, res) => {
      if (!req.body) {
        res.status(400).json({error: 'Bad Request', code: 400});
      } else {
        this._controller.pressButton(req.body.button, (err, msg) => {
          if (err) {
            if (err.code) {
              res.status(err.code);
            } else {
              res.status(200);
            }
            res.json(err);
          } else {
            res.status(200).json(msg);
          }
        });
      }
    });
    // Request holding of a button. Either power or reset.
    this._app.post('/hold-button', (req, res) => {
      if (!req.body) {
        res.status(400).json({error: 'Bad Request', code: 400});
      } else {
        this._controller.holdButton(req.body.button, (err, msg) => {
          if (err) {
            if (err.code) {
              res.status(err.code);
            } else {
              res.status(200);
            }
            res.json(err);
          } else {
            res.status(200).json(msg);
          }
        });
      }
    });
    // Request the computer enter a certain power state. Either On or Off.
    this._app.post('/request-state', (req, res) => {
      if (!req.body) {
        res.status(400).json({error: 'Bad Request', code: 400});
      } else {
        const goalState = this._controller.inferPowerState(req.body.state);
        if (goalState == PowerStateGoal.UNKNOWN) {
          res.status(400).json({error: 'Bad Goal State', code: 400});
        } else {
          this._controller.requestPowerState(goalState, (err, msg) => {
            if (err) {
              if (err.code) {
                res.status(err.code);
              } else {
                res.status(200);
              }
              res.json(err);
            } else {
              res.status(200).json(msg)
            }
          });
        }
      }
    });

    // All routes, fallback.
    this._app.use((req, res) => res.status(404).json({
      error: '404 Not Found',
      code: 404,
    }));
  }
}
module.exports = PowerServer;
