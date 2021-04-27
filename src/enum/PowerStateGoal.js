const PowerState = require('./PowerState.js');
/**
 * Power state goals.
 * @readonly
 * @enum {number}
 */
const PowerStateGoal = {
  /** Attempt to achieve powered on state. */
  ON: PowerState.ON,
  /** Attempt to achieve powered off state. */
  OFF: PowerState.OFF,
  /** We don't know what to do, something went wrong. */
  UNKNOWN: PowerState.UNKNOWN,
  /** Do not attempt to achieve a particular state. Basically NOP.*/
  UNCHANGED: -2,
};

module.exports = PowerStateGoal;
