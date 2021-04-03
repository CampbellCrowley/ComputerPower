// Campbell Crowley (web@campbellcrowley.com)
// March 2021
const onoff = require('onoff');
const exec = require('child_process').exec;
const config = require('../config/pinconfig.json');

/**
 * Power states.
 * @readonly
 * @enum {number}
 */
const PowerState = {
  /** On. */
  ON: 1,
  /** Off. */
  OFF: 0,
  /** We don't know for some reason. */
  UNKNOWN: -1,
};
/**
 * Power state goals.
 * @readonly
 * @enum {number}
 */
const PowerStateGoal = {
  /** Attempt to achieve powered on state. */
  ON: 1,
  /** Attempt to achieve powered off state. */
  OFF: 0,
  /** We don't know what to do, something went wrong. */
  UNKNOWN: -1,
  /** Do not attempt to achieve a particular state. */
  UNCHANGED: -2,
};
/**
 * GPIO states.
 * @readonly
 * @enum {number}
 */
const PinState = {
  /** High state. */
  HIGH: 1,
  /** Low state. */
  LOW: 0,
  /** Between states, or value doesn't make sense. */
  UNSURE: 2,
  /** No value. */
  UNKNOWN: -1,
}

class PowerController {
  /**
   * Create instance of PowerController.
   */
  constructor() {
    /**
     * Default time in milliseconds to press a button.
     * @public
     * @default
     * @type {number}
     */
    this.pressTime = 200;
    /**
     * Default time in milliseconds to hold a button.
     * @public
     * @default
     * @type {number}
     */
    this.holdTime = 5000;
    /**
     * Time in milliseconds between each event loop step.
     * @public
     * @default
     * @type {number}
     */
    this.eventLoopTimeDelay = 50;
    /**
     * Timestamp at which the next step should take place.
     * @private
     * @default
     * @type {number}
     */
    this._nextEventLoopStepTime = 0;


    /**
     * Power button GPIO (out) pin. Pin set in `../config/pinconfig.json`
     * Initialized in `start()`.
     * @private
     * @constant
     * @type {?Gpio}
     */
    this._powerPin = null;
    /**
     * Reset button GPIO (out) pin. Pin set in `../config/pinconfig.json`
     * Initialized in `start()`.
     * @private
     * @constant
     * @type {?Gpio}
     */
    this._resetPin = null;
    /**
     * Power LED GPIO (in) pin. Pin set in `../config/pinconfig.json`.
     * Initialized in `start()`.
     * @private
     * @constant
     * @type {?Gpio}
     */
    this._ledPin = null;

    /**
     * Current power state inferred from the LED pin.
     * @private
     * @type {PowerState}
     * @default
     */
    this._currentState = PowerState.UNKNOWN;
    /**
     * Goal power state to attempt to achieve.
     * @private
     * @type {PowerStateGoal}
     * @default
     */
    this._goalState = PowerStateGoal.UNKNOWN;
    /**
     * Timestamps at which pins were last set to high.
     * @private
     * @default
     * @constant
     * @type {{power: {start: number, duration: number}, reset: {start: number,
     *     duration: number}}}
     */
    this._pressTimes = {
      power: {
        start: 0,
        duration: 0,
      },
      reset: {
        start: 0,
        duration: 0,
      },
    };

    /**
     * Timeout for the next event loop cycle to begin.
     * @private
     * @type {?Timeout}
     * @default
     */
    this._eventLoopTimeout = null;
  }
  /**
   * Start event loop and activate GPIO.
   * @public
   */
  start() {
    const Gpio = onoff.Gpio;
    try {
      this._powerPin = new Gpio(config.power, 'out');
    } catch (err) {
      console.error(
          'Failed to export power pin! Writing states will not work.');
      console.error(err);
    }
    try {
      this._resetPin = new Gpio(config.reset, 'out');
    } catch (err) {
      console.error(
          'Failed to export reset pin! Writing states will not work.');
      console.error(err);
    }
    try {
      this._ledPin = new Gpio(config.led, 'in');
    } catch (err) {
      console.error('Failed to export LED pin! Reading states will not work.');
      console.error(err);
    }

    this._step();
  }
  /**
   * Shutdown event loop and deactivate GPIO.
   * @public
   */
  shutdown() {
    clearTimeout(this._eventLoopTimeout);

    if (this._powerPin) {
      this._powerPin.writeSync(0);
      this._powerPin.unexport();
      this._powerPin = null;
    }
    if (this._resetPin) {
      this._resetPin.writeSync(0);
      this._resetPin.unexport();
      this._resetPin = null;
    }
    if (this._ledPin) {
      this._ledPin.unexport();
      this._ledPin = null;
    }
  }
  /**
   * Current power state inferred from the LED pin.
   * @public
   * @type {PowerState}
   * @readonly
   */
  get currentState() {
    return this._currentState;
  }
  /**
   * Set a new goal power state to attempt to achieve.
   * @public
   * @param {PowerStateGoal} goal Goal state to achieve.
   * @param {function} [cb] Callback once completed with optional error.
   * @TODO: Implement.
   */
  requestPowerState(goal, cb) {
    if (typeof cb !== 'function') cb = () => {};
    cb({error: 'Not Yet Implemented', code: 501});
  }
  /**
   * Perform one event loop step. This reads pin states, and updates timed
   * events.
   * @private
   */
  _step() {
    const startTime = Date.now();
    if (this._nextEventLoopStepTime > startTime) {
      this._rescheduleEventLoopStep();
      return;
    }

    this._readPowerState();
    this._checkButtonStates();

    this._rescheduleEventLoopStep();
  }
  /**
   * Reschedule the next event loop step time Timeout. If the currently
   * scheduled time is in the past, we will ensure the next time is in the
   * future.
   * @private
   */
  _rescheduleEventLoopStep() {
    const now = Date.now();

    // If no loop has happened yet.
    if (this._nextEventLoopStepTime == 0) {
      this._nextEventLoopStepTime = now + this.eventLoopTimeDelay;
    }

    // Ensure time is in future. Skip passed step times.
    while (this._nextEventLoopStepTime <= now) {
      this._nextEventLoopStepTime += this.eventLoopTimeDelay;
    }

    const nextStepDelay = this._nextEventLoopStepTime - now;
    clearTimeout(this._eventLoopTimeout);
    this._eventLoopTimeout = setTimeout(() => this._step, nextStepDelay);
  }
  /**
   * Read the power state of the LED pin, and update accordingly.
   * @private
   * @TODO: Implement.
   */
  _readPowerState() {
  }
  /**
   * Check if buttons are done being pressed and release them.
   * @private
   * @TODO: Implement.
   */
  _checkButtonStates() {

  }
  /**
   * Press a button.
   * @public
   * @param {string} button Name of the button to press. ("power" or "reset").
   * @param {function} [cb] Callback once completed with optional error.
   */
  pressButton(button, cb) {
    if (typeof cb !== 'function') cb = () => {};
    this.setButton(button, this.pressTime, cb);
  }
  /**
   * Hold a button.
   * @public
   * @param {string} button Name of the button to hold. ("power" or "reset").
   * @param {function} [cb] Callback once completed with optional error.
   */
  holdButton(button, cb) {
    if (typeof cb !== 'function') cb = () => {};
    this.setButton(button, this.holdTime, cb);
  }
  /**
   * Hold a button.
   * @public
   * @param {string} button Name of the button to hold. ("power" or "reset").
   * @param {number} time How long to set the button state in milliseconds.
   * @param {function} [cb] Callback once completed with optional error.
   */
  setButton(button, time, cb) {
    let pin = null;
    switch (button) {
      case 'power':
        pin = this._powerPin;
        break;
      case 'reset':
        pin = this._resetPin;
        break;
      default:
        cb({
          error: 'Invalid Button',
          code: 400,
          message: `Requested button: "${button}" which is unknown.`
        });
        return;
    }

    cb({error: 'Not Yet Implemented', code: 501});
  }
}
module.exports = PowerController;
