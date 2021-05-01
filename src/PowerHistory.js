// Campbell Crowley (web@campbellcrowley.com)
// March 2021
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');

const PowerState = require('./enum/PowerState.js');

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

    /**
     * Are we already reading/writing from/to file.
     * @private
     * @default
     * @type {boolean}
     */
    this._doingIO = false;

    this._readFile();
  }

  /**
   * Read the data saved to disk if it exists. Creates the file if it doesn't.
   * @private
   * @param {basicCB} [cb] Callback once complete.
   */
  _readFile(cb) {
    const finalCB = cb;
    cb = (...args) => {
      this._doingIO = false;
      if (typeof finalCB === 'function') finalCB(...args);
    };
    if (this._doingIO) {
      cb({error:'I/O in progress.'});
      return;
    }
    this._doingIO = true;

    fs.readFile(saveFile, (err, data) => {
      if (err) {
        if (err.code == 'ENOENT') {
          this._saveFile(cb);
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
      try {
        this._eventHistory = this._eventHistory.map((day, i) => {
          return parsed[i].map((evt) => {
            return new PowerStateEvent(evt.timestamp, evt.state);
          });
        });
      } catch (err) {
        console.error('Save file is malformed!');
        console.error(err);
        cb(err);
        return;
      }
      cb(null, this._eventHistory);
    });
  }

  /**
   * Save history to file.
   * @private
   * @param {basicCB} [cb] Callback once complete.
   */
  _saveFile(cb) {
    const finalCB = cb;
    cb = (...args) => {
      this._doingIO = false;
      if (typeof finalCB === 'function') finalCB(...args);
    };
    if (this._doingIO) {
      cb({error:'I/O in progress.'});
      return;
    }
    this._doingIO = true;

    const dir = path.dirname(saveFile);
    mkdirp(dir)
        .then(() => {
          const serialized = this._eventHistory.map((day) => {
            return day.map((evt) => {
              return evt.serialize();
            });
          });
          const writable = JSON.stringify(serialized, null, 2);
          const tmpFile = `${saveFile}.tmp`;
          fs.writeFile(tmpFile, writable, (err) => {
            if (err) {
              console.error(`Failed to write saveFile: ${tmpFile}`);
              console.error(err);
              cb(err);
              return;
            }
            fs.rename(tmpFile, saveFile, (err) => {
              if (err) {
                console.error(`Failed to rename ${tmpFile} to ${saveFile}`);
                console.error(err);
                cb(err);
              } else {
                cb(null, {});
              }
            });
          });
        })
        .catch((err) => {
          console.error(`Failed to make directory for save file: ${dir}`);
          console.error(err);
          cb(err);
        });
  }

  /**
   * Get summary of uptime from the last week as a percentage by day.
   * @public
   * @returns {number[]} 7 values 0-1.
   */
  getWeekSummary() {
    this.purge();
    return this._eventHistory.map((day) => this._getDayPercentage(day));
  }
  /**
   * Get the percentage of the given day of which the device was on.
   * @private
   * @returns {number} Value between 0 and 1.
   */
  _getDayPercentage(day) {
    let timeOn = 0;
    if (!day || !day.length) return timeOn;

    // Timestamp at end of this day.
    const endDate = new Date(day[0].timestamp);
    endDate.setHours(23, 59, 59, 999);
    const end = endDate.getTime()

    for (let i = 0; i < day.length; i++) {
      if (day[i].state != PowerState.ON) continue;

      let next = end;
      let diff = next - day[i].timestamp;
      for (let j = i + 1; j < day.length; j++) {
        if (day[j].state != PowerState.OFF) continue;

        diff = day[j].timestamp - day[i].timestamp;
        if (diff < totalMilliseconds) next = day[j].timestamp;
        diff = next - day[i].timestamp;

        i = j;
        break;
      }
      timeOn += diff;
    }
    return timeOn / totalMilliseconds;
  }

  /**
   * Get the full event history from the last week.
   * @public
   * @returns {Array.<Array.<PowerStateEvent>>} Full event history reference.
   */
  getEventHistory() {
    return this._eventHistory;
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

    this._saveFile();
  }
  /**
   * Purge events older than 7 days.
   * @public
   */
  purge() {
    const now = Date.now();
    const old = now - totalMilliseconds * totalDays;

    this._eventHistory.forEach((day) => {
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
