// doc imports
/* eslint-disable no-unused-vars */
import {WindowLevel} from './windowLevel';
/* eslint-enable no-unused-vars */

/**
 * VOI (Values of Interest) LUT class: apply window centre and width.
 *
 * ```
 * if (x <= c - 0.5 - (w-1)/2) then y = ymin
 * else if (x > c - 0.5 + (w-1)/2) then y = ymax
 * else y = ((x - (c - 0.5)) / (w-1) + 0.5) * (ymax - ymin) + ymin
 * ```
 *
 * Ref: {@link https://dicom.nema.org/medical/dicom/2022a/output/chtml/part03/sect_C.11.2.html}.
 */
export class VoiLut {

  /**
   * The window and level.
   *
   * @type {WindowLevel}
   */
  _windowLevel;

  /**
   * Signed data offset. Defaults to 0.
   *
   * @type {number}
   */
  _signedOffset = 0;

  /**
   * Output value minimum. Defaults to 0.
   *
   * @type {number}
   */
  _ymin = 0;

  /**
   * Output value maximum. Defaults to 255.
   *
   * @type {number}
   */
  _ymax = 255;

  /**
   * Input value minimum (calculated).
   *
   * @type {number}
   */
  _xmin = null;

  /**
   * Input value maximum (calculated).
   *
   * @type {number}
   */
  _xmax = null;

  /**
   * Window level equation slope (calculated).
   *
   * @type {number}
   */
  _slope = null;

  /**
   * Window level equation intercept (calculated).
   *
   * @type {number}
   */
  _inter = null;

  /**
   * @param {WindowLevel} wl The window center and width.
   */
  constructor(wl) {
    this._windowLevel = wl;
    this._init();
  }

  /**
   * Get the window and level.
   *
   * @returns {WindowLevel} The window center and width.
   */
  getWindowLevel() {
    return this._windowLevel;
  }

  /**
   * Initialise members. Called at construction.
   *
   */
  _init() {
    const center = this._windowLevel.center;
    const width = this._windowLevel.width;
    const c = center + this._signedOffset;
    // from the standard
    this._xmin = c - 0.5 - ((width - 1) / 2);
    this._xmax = c - 0.5 + ((width - 1) / 2);
    // develop the equation:
    // y = ( ( x - (c - 0.5) ) / (w-1) + 0.5 ) * (ymax - ymin) + ymin
    // y = ( x / (w-1) ) * (ymax - ymin) +
    //     ( -(c - 0.5) / (w-1) + 0.5 ) * (ymax - ymin) + ymin
    this._slope = (this._ymax - this._ymin) / (width - 1);
    this._inter = (-(c - 0.5) / (width - 1) + 0.5) *
      (this._ymax - this._ymin) + this._ymin;
  }

  /**
   * Set the signed offset.
   *
   * @param {number} offset The signed data offset,
   *   typically: slope * ( size / 2).
   */
  setSignedOffset(offset) {
    this._signedOffset = offset;
    // re-initialise
    this._init();
  }

  /**
   * Apply the window level on an input value.
   *
   * @param {number} value The value to rescale as an integer.
   * @returns {number} The leveled value, in the
   *  [ymin, ymax] range (default [0,255]).
   */
  apply(value) {
    if (value <= this._xmin) {
      return this._ymin;
    } else if (value > this._xmax) {
      return this._ymax;
    } else {
      return (value * this._slope) + this._inter;
    }
  }

} // class VoiLut
