// Campbell Crowley (web@campbellcrowley.com)
// March 2021
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');

const saveFile = './save/powerStateHistory.json';

const totalDays = 7;
const totalHours = 24;
const totalMilliseconds = totalHours * 60 * 60 * 1000;

/**
 * Stores historic information about this device's power states.
 * @class
 */
class PowerHistory {
  /**
   * Create instance of PowerHistory. Loads history from file if it exists.
   */
  constructor() {
    /**
     * History of events for the past week. Each element represents 1 day of the
     * week. Each element contains a sorted list of events from the most recent
     * day.
     * @private
     * @default
     * @type {Array.<Array.<PowerStateEvent>>}
     */
    this._eventHistory = [[], [], [], [], [], [], []];

    this._readFile();
  }

  /**
   * Read the data saved to disk if it exists. Creates the file if it doesn't.
   * @private
   * @param {basicCB} [cb] Callback once complete.
   */
  _readFile(cb) {
    if (typeof cb !== 'function') cb = () => {};
    fs.readFile(saveFile, (err, data) => {
      if (err) {
        if (err.code == 'ENOENT') {
          _saveFile(cb);
        } else {
          console.error(`Could not create save file: ${saveFile}`);
          console.error(err);
          cb(err);
        }
        return;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(data);
      } catch (err) {
        console.error('Failed to parse PowerHistory from file.');
        console.error(err);
        cb(err);
        return;
      }
      this._eventHistory = parsed.map((day) => {
        return day.map((evt) => {
          return new PowerStateEvent(evt.timestamp, evt.state);
        });
      });
      cb(null, this._eventHistory);
    });
  }

  /**
   * Save history to file.
   * @private
   * @param {basicCB} [cb] Callback once complete.
   */
  _saveFile() {
    if (typeof cb !== 'function') cb = () => {};
    const dir = path.dirname(saveFile);
    mkdirp(dir)
        .then(() => {
          const serialized = this._eventHistory.map((day) => {
            return day.map((evt) => {
              return evt.serialize();
            });
          });
          const writable = JSON.stringify(serialized, null, 2);
          fs.writeFile(saveFile, writable, (err) => {
            if (err) {
              console.error(`Failed to write saveFile: ${saveFile}`);
              console.error(err);
              cb(err);
            } else {
              cb(null, {});
            }
          });
        })
        .catch((err) => {
          console.error(`Failed to make directory for save file: ${dir}`);
          console.error(err);
          cb(err);
        });
  }

  /**
   * Create a new PowerStateEvent.
   * @param {PowerController.PowerState} state The new state due to this event.
   * @param {number} [timestamp] Timestamp of the event, if not specified it is
   *     assumed the event occurred now.
   */
  createEvent(state, timestamp) {
    const now = Date.now();
    if (!timestamp) timestamp = now;
    const evt = new PowerStateEvent(timestamp, state);

    const dow = new Date(evt.timestamp).getDay();

    this._eventHistory[dow].push(evt);

    this.purge();
  }
  /**
   * Purge events older than 7 days.
   * @public
   */
  purge() {
    const now = Date.now();
    const old = now - totalMilliseconds * totalDays;

    this._eventHistory = this._eventHistory.forEach((day) => {
      while (day.length > 0 && day[0].timestamp < old) day.shift();
    });
  }
}

/**
 * Object storing a single event.
 * @class
 */
class PowerStateEvent {
  /**
   * Create a new PowerStateEvent instance.
   * @param {number} timestamp Timestamp of event.
   * @param {PowerController.PowerState} state The new PowerState.
   */
  constructor(timestamp, state) {
    /**
     * Timestamp of this event.
     * @public
     * @constant
     * @type {number}
     */
    this.timestamp = timestamp;
    /**
     * PowerState following this event.
     * @public
     * @constant
     * @type {PowerController.PowerState}
     */
    this.state = state;
  }
  /**
   * Get serializable instance of this object.
   * @public
   * @returns {object}
   */
  serialize() {
    return {
      timestamp: this.timestamp,
      state: this.state,
    };
  }
}

PowerHistory.PowerStateEvent = PowerStateEvent;
module.exports = PowerHistory;
