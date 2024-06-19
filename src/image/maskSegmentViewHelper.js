import {logger} from '../utils/logger';

// doc imports
/* eslint-disable no-unused-vars */
import {MaskSegment} from '../dicom/dicomSegment';
/* eslint-enable no-unused-vars */

/**
 * Mask segment view helper: handles hidden segments.
 */
export class MaskSegmentViewHelper {

  /**
   * List of hidden segments.
   *
   * @type {MaskSegment[]}
   */
  _hiddenSegments = [];

  _isMonochrome;

  /**
   * Get the index of a segment in the hidden list.
   *
   * @param {number} segmentNumber The segment number.
   * @returns {number} The index in the array, -1 if not found.
   */
  _findHiddenIndex(segmentNumber) {
    return this._hiddenSegments.findIndex(function (item) {
      return item.number === segmentNumber;
    });
  }

  /**
   * Check if a segment is in the hidden list.
   *
   * @param {number} segmentNumber The segment number.
   * @returns {boolean} True if the segment is in the list.
   */
  isHidden(segmentNumber) {
    return this._findHiddenIndex(segmentNumber) !== -1;
  }

  /**
   * Add a segment to the hidden list.
   *
   * @param {MaskSegment} segment The segment to add.
   */
  addToHidden(segment) {
    if (!this.isHidden(segment.number)) {
      this._hiddenSegments.push(segment);
      // base flag on latest added
      this._isMonochrome = typeof segment.displayValue !== 'undefined';
    } else {
      logger.warn(
        'Not hidding segment, it is allready in the hidden list: ' +
          segment.number);
    }
  }

  /**
   * Remove a segment from the hidden list.
   *
   * @param {number} segmentNumber The segment number.
   */
  removeFromHidden(segmentNumber) {
    const index = this._findHiddenIndex(segmentNumber);
    if (index !== -1) {
      this._hiddenSegments.splice(index, 1);
    } else {
      logger.warn(
        'Cannot remove segment, it is not in the hidden list: ' +
          segmentNumber);
    }
  }

  /**
   * @callback alphaFn
   * @param {number[]|number} value The pixel value.
   * @param {number} index The values' index.
   * @returns {number} The opacity of the input value.
   */

  /**
   * Get the alpha function to apply hidden colors.
   *
   * @returns {alphaFn} The corresponding alpha function.
   */
  getAlphaFunc() {
    // get colours
    const hiddenColours = [];
    if (this._isMonochrome) {
      hiddenColours[0] = 0;
    } else {
      hiddenColours[0] = {r: 0, g: 0, b: 0};
    }
    for (const segment of this._hiddenSegments) {
      if (this._isMonochrome) {
        hiddenColours.push(segment.displayValue);
      } else {
        hiddenColours.push(segment.displayRGBValue);
      }
    }

    // create alpha function
    let resultFn;
    if (this._isMonochrome) {
      resultFn = function (value/*, index*/) {
        for (let i = 0; i < hiddenColours.length; ++i) {
          if (value === hiddenColours[i]) {
            return 0;
          }
        }
        // default
        return 255;
      };
    } else {
      resultFn = function (value/*, index*/) {
        for (let i = 0; i < hiddenColours.length; ++i) {
          if (value[0] === hiddenColours[i].r &&
            value[1] === hiddenColours[i].g &&
            value[2] === hiddenColours[i].b) {
            return 0;
          }
        }
        // default
        return 255;
      };
    }
    return resultFn;
  }
}