// Author: Campbell Crowley (github@campbellcrowley.com).
// February, 2021
const firebase = require('firebase-admin');
const sql = require('mysql');

const serviceAccount =
    require('../config/campbells-app-firebase-adminsdk-tbe4g-bbf05adeed.json');
const databaseConfig = require('../config/authconfig.json');

/**
 * @callback basicCB
 * @param {?object} err Optional error response.
 * @param {?object} data Returned data on success.
 */

/**
 * Manages authenticating users via Firebase.
 * @class
 */
class Authenticator {
  constructor() {
    firebase.initializeApp({
      credential: firebase.credential.cert(serviceAccount),
    });
    /**
     * Connection instance to the SQL server.
     *
     * @private
     * @type {sql.ConnectionConfig}
     */
    this._sqlCon = this._connectSQL();
  }

  /**
   * Create a connection to the SQL server. If a connection still exists, this
   * will return the current connection instance.
   * @private
   * @param {boolean} [force=false] Force a new connection to be established.
   * @returns {sql.ConnectionConfig} Current SQL connection instance.
   */
  _connectSQL(force = false) {
    if (this._sqlCon && !force) return this._sqlCon;
    if (this._sqlCon && this._sqlCon.end) this._sqlCon.end();
    /* eslint-disable-next-line new-cap */
    this._sqlCon = new sql.createConnection(databaseConfig);
    this._sqlCon.on('error', (e) => {
      console.error(e);
      if (e.fatal || e.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
        this._connectSQL(true);
      }
    });
    console.log('SQL Connection created');
    return this._sqlCon;
  }

  /**
   * Verify an ID token from the app.
   * @public
   * @param {string} token Token to verify.
   * @param {basicCB} cb Callback once verified or failed. Contains decoded info
   *     if succeeded.
   */
  verify(token, cb) {
    if (typeof cb !== 'function') {
      throw new TypeError('cb must be a callback function');
    }
    firebase.auth()
        .verifyIdToken(token)
        .then((decodedToken) => {
          console.log(
              `Authenticated: ${decodedToken.uid} ${decodedToken.name}`);
          cb(null, decodedToken)
        })
        .catch((error) => {
          console.error(`Failed to validate token: ${token}`);
          console.error(error);
          cb({error: 'Failed to verify ID Token', code: 403}, error);
        });
  }

  /**
   * Get all of the device for a given user ID.
   * @public
   * @param {string} uid User ID.
   * @param {basicCB} cb Callback once fetched or failed.
   */
  getDevices(uid, cb) {
    const query = 'SELECT * FROM ?? WHERE ??=?';
    const formatted = sql.format(query, [databaseConfig.table, 'uId', uid]);

    this._sqlCon.query(formatted, (err, res) => {
      if (err) {
        console.error(`Query Failed: ${formatted}`);
        console.error(err);
        cb({code: 500, error: 'SQL Query Failure'});
        return;
      }
      console.log(res);
      cb(null, res);
    });
  }

  /**
   * Check if a user can access a specified device.
   * @public
   * @param {string} uid User ID.
   * @param {string} did Device ID.
   * @param {basicCB} cb Callback once validated or failed. Response will be
   *     embedded in success object.
   */
  checkDeviceAccess(uid, did, cb) {
    const query = 'SELECT ?? FROM ?? WHERE ??=? AND ??=? LIMIT 1';
    const formatted = sql.format(
        query, ['dId', databaseConfig.table, 'uId', uid, 'dId', did]);

    this._sqlCon.query(formatted, (err, res) => {
      if (err) {
        console.error(`Query Failed: ${formatted}`);
        console.error(err);
        cb({code: 500, error: 'SQL Query Failure'});
        return;
      }
      console.log(res);
      cb(null, {uId: uid, dId: did, hasAccess: res.length > 0});
    });
  }
  /**
   * Get the host info for sending a request to the given device.
   * @public
   * @param {string} did Device ID.
   * @param {basicCB] cb Callback once fetched or failed.
   */
  getDeviceHost(did, cb) {
    const query = 'SELECT ?? FROM ?? WHERE ??=? LIMIT 1';
    const formatted =
        sql.format(query, ['dHost', databaseConfig.table, 'dId', did]);

    this._sqlCon.query(formatted, (err, res) => {
      if (err) {
        console.error(`Query Failed: ${formatted}`);
        console.error(err);
        cb({code: 500, error: 'SQL Query Failure'});
        return;
      }
      console.log(res);
      cb(null, res[0].dHost);
    });
  }
}

module.exports = Authenticator;
