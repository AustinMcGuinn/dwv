// doc imports
/* eslint-disable no-unused-vars */
import {RescaleSlopeAndIntercept} from './rsi';
/* eslint-enable no-unused-vars */

/**
 * Modality LUT class: compensates for any modality-specific presentation.
 * Typically consists of a rescale slope and intercept to
 * rescale the data range.
 *
 * Ref: {@link https://dicom.nema.org/medical/dicom/2022a/output/chtml/part03/sect_C.11.html}.
 */
export class ModalityLut {

  /**
   * The rescale slope.
   *
   * @type {RescaleSlopeAndIntercept}
   */
  _rsi;

  /**
   * Is the RSI an identity one.
   *
   * @type {boolean}
   */
  _isIdRsi;

  /**
   * The size of the LUT array.
   *
   * @type {number}
   */
  _length;

  /**
   * The internal LUT array.
   *
   * @type {Float32Array}
   */
  _lut;

  /**
   * @param {RescaleSlopeAndIntercept} rsi The rescale slope and intercept.
   * @param {number} bitsStored The number of bits used to store the data.
   */
  constructor(rsi, bitsStored) {
    this._rsi = rsi;
    this._isIdRsi = rsi.isID();

    this._length = Math.pow(2, bitsStored);

    // create lut if not identity RSI
    if (!this._isIdRsi) {
      this._lut = new Float32Array(this._length);
      for (let i = 0; i < this._length; ++i) {
        this._lut[i] = this._rsi.apply(i);
      }
    }
  }

  /**
   * Get the Rescale Slope and Intercept (RSI).
   *
   * @returns {RescaleSlopeAndIntercept} The rescale slope and intercept object.
   */
  getRSI() {
    return this._rsi;
  }

  /**
   * Get the length of the LUT array.
   *
   * @returns {number} The length of the LUT array.
   */
  getLength() {
    return this._length;
  }

  /**
   * Get the value of the LUT at the given offset.
   *
   * @param {number} offset The input offset in [0,2^bitsStored] range
   *   or full range for ID rescale.
   * @returns {number} The float32 value of the LUT at the given offset.
   */
  getValue(offset) {
    return this._isIdRsi ? offset : this._lut[offset];
  }

} // class ModalityLut
