// Campbell Crowley (web@campbellcrowley.com)
// March 2021
const onoff = require('onoff');
const exec = require('child_process').exec;
const config = require('../config/pinconfig.json');
const PowerHistory = require('./PowerHistory.js');

const PowerState = require('./enum/PowerState.js');
const PowerStateGoal = require('./enum/PowerStateGoal.js');

class PowerController {
  /**
   * Create instance of PowerController.
   */
  constructor() {
    /**
     * Default time in milliseconds to press a button.
     * @public
     * @default
     * @constant
     * @type {number}
     */
    this.pressTime = 200;
    /**
     * Default time in milliseconds to hold a button.
     * @public
     * @default
     * @constant
     * @type {number}
     */
    this.holdTime = 5000;
    /**
     * Timestamp at which the next step should take place.
     * @private
     * @default
     * @type {number}
     */
    this._nextEventLoopStepTime = 0;
    /**
     * Time in milliseconds to wait once seeing a change in LED power state,
     * before determining that the power state of the device has changed.
     * @private
     * @default
     * @constant
     * @type {number}
     */
    this._powerStateChangeDelay = 1000;


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

    this._fakePin = {
      write: (_, cb) => cb(),
      writeSync: () => {},
      read: (cb) => cb(null, onoff.Gpio.LOW),
      readSync: () => 0,
      unexport: () => {},
    };

    /**
     * The most recently read LED value to detect if state has changed.
     * @private
     * @type {number}
     * @default
     */
    this._lastLEDValue = 0;

    /**
     * Current power state inferred from the LED pin.
     * @private
     * @type {PowerState}
     * @default
     */
    this._currentState = PowerState.UNKNOWN;
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
     * Power state history instance.
     * @public
     * @constant
     * @default
     * @type {PowerHistory}
     */
    this.history = new PowerHistory();

    /**
     * Timeout for the next button release time.
     * @private
     * @type {?Timeout}
     * @default
     */
    this._buttonReleaseTimeout = null;
    /**
     * Timeout for watching if the LED remains in its new state after changing.
     * @private
     * @type {?Timeout}
     * @default
     */
    this._powerStateTimeout = null;
  }
  /**
   * Start event loop and activate GPIO.
   * @public
   */
  start() {
    const Gpio = onoff.Gpio;
    if (Gpio.accessible) {
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
        this._ledPin = new Gpio(config.led, 'in', 'both');
        this._ledPin.watch((...args) => this._ledStateChange(...args));
      } catch (err) {
        console.error(
            'Failed to export LED pin! Reading states will not work.');
        console.error(err);
      }
    } else {
      console.error('GPIO is not accessible! Pins will be simulated.');
      this._powerPin = this._fakePin;
      this._resetPin = this._fakePin;
      this._ledPin = this._fakePin;
    }

    this._readPowerState();
  }
  /**
   * Shutdown event loop and deactivate GPIO.
   * @public
   */
  shutdown() {
    clearTimeout(this._powerStateTimeout);
    clearTimeout(this._buttonReleaseTimeout);
    if (this._powerPin) {
      this._powerPin.writeSync(onoff.Gpio.LOW);
      this._powerPin.unexport();
      this._powerPin = null;
    }
    if (this._resetPin) {
      this._resetPin.writeSync(onoff.Gpio.LOW);
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
   */
  requestPowerState(goal, cb) {
    if (typeof cb !== 'function') cb = () => {};

    if (goal == this._currentState || goal === PowerStateGoal.UNCHANGED) {
      cb(null, {message: 'State Unchanged', code: 200});
    } else {
      switch (goal) {
        case PowerStateGoal.ON:
          this.pressButton('power', cb);
          break;
        case PowerStateGoal.OFF:
          this.holdButton('power', cb);
          break;
        default:
          cb({error: `Unknown PowerStateGoal ${goal}`, code: 501});
          break;
      }
    }
  }
  /**
   * Handler for when the LED power state changes. May trigger
   * `_handlePowerStateChange()`.
   * @private
   * @param {Error} err Possible error.
   * @param {number} value LED Pin value.
   */
  _ledStateChange(err, value) {
    if (this._lastLEDValue != value) {
      console.log(`LED state changed from ${this._lastLEDValue} to ${value}`);
      clearTimeout(this._powerStateTimeout);

      const inferredState = this.inferPowerState(value);
      if (inferredState !== this._currentState) {
        this._powerStateTimeout = setTimeout(() => {
          this._currentState = inferredState;
          this._handlePowerStateChange();
        }, this._powerStateChangeDelay);
      }
    }
    this._lastLEDValue = value;
  }
  /**
   * Read the power state of the LED pin, and update accordingly. This is only
   * used to get initial state after statup.
   * @private
   */
  _readPowerState() {
    this._ledPin.read((err, val) => {
      if (err) {
        console.error(err);
        return;
      }

      const prevState = this._currentState;
      this._currentState = this.inferPowerState(val);
      if (this._currentState != prevState) this._handlePowerStateChange();
    });
  }
  /**
   * Infer a PowerState from a given pin value.
   * @public
   * @param {number|string} Value to infer PowerState from, or string value.
   * @returns {PowerState} Inferred state.
   */
  inferPowerState(value) {
    switch (value) {
      case onoff.Gpio.LOW:
      case 'off':
        return PowerState.OFF;
      case onoff.Gpio.HIGH:
      case 'on':
        return PowerState.ON;
      default:
        return PowerState.UNKNOWN;
    }
  }
  /**
   * Handle the device changing power state.
   * @private
   * @TODO: Implement sending notifications.
   */
  _handlePowerStateChange() {
    console.log(`Power State Changed to ${this._currentState}`);
    this.history.createEvent(this.currentState);
  }
  /**
   * Check if buttons are done being pressed and release them. This will not
   * start a button press.
   * @private
   * @param {object} [times] Time object to check, used internally.
   * @param {Gpio} [pin] Corresponding pin.
   */
  _checkButtonStates(times, pin) {
    const now = Date.now();
    if (!times) {
      clearTimeout(this._buttonReleaseTimeout);
      this._checkButtonStates(this._pressTimes.power, this._powerPin);
      this._checkButtonStates(this._pressTimes.reset, this._resetPin);

      const powerTime =
          this._pressTimes.power.start + this._pressTimes.power.duration;
      const resetTime =
          this._pressTimes.reset.start - this._pressTimes.reset.duration;
      let nextTime = 0;

      if (powerTime > now) nextTime = powerTime;
      if (resetTime < nextTime && resetTime > now) nextTime = powerTime;

      if (nextTime > 0) {
        this._buttonReleaseTimeout =
            setTimeout(() => this._checkButtonStates(), nextTime - now);
      }
      return;
    }

    if (times.start === 0 || times.duration === 0) return;

     if (now - times.duration > times.start) {
       times.duration = 0;
       times.start = 0;
       pin.write(onoff.Gpio.LOW, (err) => {
         if (!err) return;
         console.error('Failed to write pin low after duration.');
         console.error(err);
       });
     }
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
   * Set a button state for a time.
   * @public
   * @param {string} button Name of the button to hold. ("power" or "reset").
   * @param {number} time How long to set the button state in milliseconds.
   * @param {function} [cb] Callback once completed with optional error.
   */
  setButton(button, time, cb) {
    let pin = null;
    let pressTime = null;
    switch (button) {
      case 'power':
        pin = this._powerPin;
        pressTime = this._pressTimes.power;
        break;
      case 'reset':
        pin = this._resetPin;
        pressTime = this._pressTimes.reset;
        break;
      default:
        cb({
          error: 'Invalid Button',
          code: 400,
          message: `Requested button: "${button}" which is unknown.`
        });
        return;
    }

    pressTime.start = Date.now();
    pressTime.duration = time * 1;
    pin.write(onoff.Gpio.HIGH, (err) => {
      if (err) {
        console.error('Failed to write pin high.');
        console.error(err);
        cb({error: 'Failed to write pin state.', code: 500});
      } else {
        cb(null, {message: 'Success!', code: 200});
      }
      this._checkButtonStates();
    });
  }
}

module.exports = PowerController;
