// doc imports
/* eslint-disable no-unused-vars */
import {ModalityLut} from './modalityLut';
import {VoiLut} from './voiLut';
/* eslint-enable no-unused-vars */

/**
 * Window LUT class: combines a modality LUT and a VOI LUT.
 */
export class WindowLut {

  /**
   * The modality LUT.
   *
   * @type {ModalityLut}
   */
  _modalityLut;

  /**
   * The VOI LUT.
   *
   * @type {VoiLut}
   */
  _voiLut;

  /**
   * The internal LUT array: Uint8ClampedArray clamps between 0 and 255.
   *
   * @type {Uint8ClampedArray}
   */
  _lut;

  /**
   * Shift for signed data.
   *
   * @type {number}
   */
  _signedShift = 0;

  /**
   * Is the RSI discrete.
   *
   * @type {boolean}
   */
  _isDiscrete = true;

  /**
   * Construct a window LUT object, VOI LUT is set with
   *   the 'setVoiLut' method.
   *
   * @param {ModalityLut} modalityLut The associated rescale LUT.
   * @param {boolean} isSigned Flag to know if the data is signed or not.
   * @param {boolean} isDiscrete Flag to know if the input data is discrete.
   */
  constructor(modalityLut, isSigned, isDiscrete) {
    this._modalityLut = modalityLut;

    if (isSigned) {
      const size = this._modalityLut.getLength();
      this._signedShift = size / 2;
    } else {
      this._signedShift = 0;
    }

    this._isDiscrete = isDiscrete;
  }

  /**
   * Get the VOI LUT.
   *
   * @returns {VoiLut} The VOI LUT.
   */
  getVoiLut() {
    return this._voiLut;
  }

  /**
   * Get the modality LUT.
   *
   * @returns {ModalityLut} The modality LUT.
   */
  getModalityLut() {
    return this._modalityLut;
  }

  /**
   * Set the VOI LUT.
   *
   * @param {VoiLut} lut The VOI LUT.
   */
  setVoiLut(lut) {
    // store the window values
    this._voiLut = lut;

    // possible signed shift (LUT indices are positive)
    this._voiLut.setSignedOffset(
      this._modalityLut.getRSI().getSlope() * this._signedShift);

    // create lut if not continous
    if (this._isDiscrete) {
      const size = this._modalityLut.getLength();
      // use clamped array (polyfilled in env.js)
      this._lut = new Uint8ClampedArray(size);
      // by default WindowLevel returns a value in the [0,255] range
      // this is ok with regular Arrays and ClampedArray.
      for (let i = 0; i < size; ++i) {
        this._lut[i] = this._voiLut.apply(this._modalityLut.getValue(i));
      }
    }
  }

  /**
   * Get the value of the LUT at the given offset.
   *
   * @param {number} offset The input offset in [0,2^bitsStored] range
   *   for discrete data or full range for non discrete.
   * @returns {number} The integer value (default [0,255]) of the LUT
   *   at the given offset.
   */
  getValue(offset) {
    if (this._isDiscrete) {
      return this._lut[offset + this._signedShift];
    } else {
      return Math.floor(this._voiLut.apply(offset + this._signedShift));
    }
  }

} // class WindowLut
