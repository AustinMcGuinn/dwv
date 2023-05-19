// doc imports
/* eslint-disable no-unused-vars */
import {RescaleSlopeAndIntercept} from './rsi';
/* eslint-enable no-unused-vars */

/**
 * Rescale LUT class.
 * Typically converts from integer to float.
 */
export class RescaleLut {

  /**
   * The rescale slope.
   *
   * @type {RescaleSlopeAndIntercept}
   */
  #rsi;

  /**
   * The internal array.
   *
   * @type {Float32Array}
   */
  #lut = null;

  /**
   * Flag to know if the lut is ready or not.
   *
   * @type {boolean}
   */
  #isReady = false;

  /**
   * The size of the LUT array.
   *
   * @type {number}
   */
  #length;

  /**
   * @param {RescaleSlopeAndIntercept} rsi The rescale slope and intercept.
   * @param {number} bitsStored The number of bits used to store the data.
   */
  constructor(rsi, bitsStored) {
    this.#rsi = rsi;
    this.#length = Math.pow(2, bitsStored);
  }

  /**
   * Get the Rescale Slope and Intercept (RSI).
   *
   * @returns {RescaleSlopeAndIntercept} The rescale slope and intercept object.
   */
  getRSI() {
    return this.#rsi;
  }

  /**
   * Is the lut ready to use or not? If not, the user must
   * call 'initialise'.
   *
   * @returns {boolean} True if the lut is ready to use.
   */
  isReady() {
    return this.#isReady;
  }

  /**
   * Initialise the LUT.
   */
  initialise() {
    // check if already initialised
    if (this.#isReady) {
      return;
    }
    // create lut and fill it
    this.#lut = new Float32Array(this.#length);
    for (let i = 0; i < this.#length; ++i) {
      this.#lut[i] = this.#rsi.apply(i);
    }
    // update ready flag
    this.#isReady = true;
  }

  /**
   * Get the length of the LUT array.
   *
   * @returns {number} The length of the LUT array.
   */
  getLength() {
    return this.#length;
  }

  /**
   * Get the value of the LUT at the given offset.
   *
   * @param {number} offset The input offset in [0,2^bitsStored] range.
   * @returns {number} The float32 value of the LUT at the given offset.
   */
  getValue(offset) {
    return this.#lut[offset];
  }

} // class RescaleLut
