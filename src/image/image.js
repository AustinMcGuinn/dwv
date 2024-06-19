import {Index} from '../math/index';
import {Point3D} from '../math/point';
import {logger} from '../utils/logger';
import {arrayContains} from '../utils/array';
import {getTypedArray} from '../dicom/dicomParser';
import {ListenerHandler} from '../utils/listen';
import {colourRange} from './iterator';
import {RescaleSlopeAndIntercept} from './rsi';
import {ImageFactory} from './imageFactory';
import {MaskFactory} from './maskFactory';

// doc imports
/* eslint-disable no-unused-vars */
import {Geometry} from './geometry';
import {Matrix33} from '../math/matrix';
import {NumberRange} from '../math/stats';
import {DataElement} from '../dicom/dataElement';
import {RGB} from '../utils/colour';
/* eslint-enable no-unused-vars */

/**
 * Get the slice index of an input slice into a volume geometry.
 *
 * @param {Geometry} volumeGeometry The volume geometry.
 * @param {Geometry} sliceGeometry The slice geometry.
 * @returns {Index} The index of the slice in the volume geomtry.
 */
function getSliceIndex(volumeGeometry, sliceGeometry) {
  // possible time
  const timeId = sliceGeometry.getInitialTime();
  // index values
  const values = [];
  // x, y
  values.push(0);
  values.push(0);
  // z
  values.push(volumeGeometry.getSliceIndex(sliceGeometry.getOrigin(), timeId));
  // time
  if (typeof timeId !== 'undefined') {
    values.push(timeId);
  }
  // return index
  return new Index(values);
}

/**
 * Create an Image from DICOM elements.
 *
 * @param {Object<string, DataElement>} elements The DICOM elements.
 * @returns {Image} The Image object.
 */
export function createImage(elements) {
  const factory = new ImageFactory();
  return factory.create(
    elements,
    elements['7FE00010'].value[0],
    1
  );
}

/**
 * Create a mask Image from DICOM elements.
 *
 * @param {Object<string, DataElement>} elements The DICOM elements.
 * @returns {Image} The mask Image object.
 */
export function createMaskImage(elements) {
  const factory = new MaskFactory();
  return factory.create(
    elements,
    elements['7FE00010'].value[0]
  );
}

/**
 * Image class.
 * Usable once created, optional are:
 * - rescale slope and intercept (default 1:0),
 * - photometric interpretation (default MONOCHROME2),
 * - planar configuration (default RGBRGB...).
 *
 * @example
 * // XMLHttpRequest onload callback
 * const onload = function (event) {
 *   // parse the dicom buffer
 *   const dicomParser = new dwv.DicomParser();
 *   dicomParser.parse(event.target.response);
 *   // create the image object
 *   const image = dwv.createImage(dicomParser.getDicomElements());
 *   // result div
 *   const div = document.getElementById('dwv');
 *   // display the image size
 *   const size = image.getGeometry().getSize();
 *   div.appendChild(document.createTextNode(
 *     'Size: ' + size.toString() +
 *     ' (should be 256,256,1)'));
 *   // break line
 *   div.appendChild(document.createElement('br'));
 *   // display a pixel value
 *   div.appendChild(document.createTextNode(
 *     'Pixel @ [128,40,0]: ' +
 *     image.getRescaledValue(128,40,0) +
 *     ' (should be 101)'));
 * };
 * // DICOM file request
 * const request = new XMLHttpRequest();
 * const url = 'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323851.dcm';
 * request.open('GET', url);
 * request.responseType = 'arraybuffer';
 * request.onload = onload;
 * request.send();
 */
export class Image {

  /**
   * Data geometry.
   *
   * @type {Geometry}
   */
  _geometry;

  /**
   * List of compatible typed arrays.
   *
   * @typedef {(
   *   Uint8Array | Int8Array |
   *   Uint16Array | Int16Array |
   *   Uint32Array | Int32Array
   * )} TypedArray
   */

  /**
   * Data buffer.
   *
   * @type {TypedArray}
   */
  _buffer;

  /**
   * Image UIDs.
   *
   * @type {string[]}
   */
  _imageUids;

  /**
   * Constant rescale slope and intercept (default).
   *
   * @type {RescaleSlopeAndIntercept}
   */
  _rsi = new RescaleSlopeAndIntercept(1, 0);

  /**
   * Varying rescale slope and intercept.
   *
   * @type {RescaleSlopeAndIntercept[]}
   */
  _rsis = null;

  /**
   * Flag to know if the RSIs are all identity (1,0).
   *
   * @type {boolean}
   */
  _isIdentityRSI = true;

  /**
   * Flag to know if the RSIs are all equals.
   *
   * @type {boolean}
   */
  _isConstantRSI = true;

  /**
   * Photometric interpretation (MONOCHROME, RGB...).
   *
   * @type {string}
   */
  _photometricInterpretation = 'MONOCHROME2';

  /**
   * Planar configuration for RGB data (`0:RGBRGBRGBRGB...` or
   *   `1:RRR...GGG...BBB...`).
   *
   * @type {number}
   */
  _planarConfiguration = 0;

  /**
   * Number of components.
   *
   * @type {number}
   */
  _numberOfComponents;

  /**
   * Meta information.
   *
   * @type {Object<string, any>}
   */
  _meta = {};

  /**
   * Data range.
   *
   * @type {NumberRange}
   */
  _dataRange = null;

  /**
   * Rescaled data range.
   *
   * @type {NumberRange}
   */
  _rescaledDataRange = null;

  /**
   * Histogram.
   *
   * @type {Array}
   */
  _histogram = null;

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * @param {Geometry} geometry The geometry of the image.
   * @param {TypedArray} buffer The image data as a one dimensional buffer.
   * @param {string[]} [imageUids] An array of Uids indexed to slice number.
   */
  constructor(geometry, buffer, imageUids) {
    this._geometry = geometry;
    this._buffer = buffer;
    this._imageUids = imageUids;

    this._numberOfComponents = this._buffer.length / (
      this._geometry.getSize().getTotalSize());
  }

  /**
   * Get the image UID at a given index.
   *
   * @param {Index} [index] The index at which to get the id.
   * @returns {string} The UID.
   */
  getImageUid(index) {
    let uid = this._imageUids[0];
    if (this._imageUids.length !== 1 && typeof index !== 'undefined') {
      uid = this._imageUids[this.getSecondaryOffset(index)];
    }
    return uid;
  }

  /**
   * Check if this image includes the input uids.
   *
   * @param {string[]} uids UIDs to test for presence.
   * @returns {boolean} True if all uids are in this image uids.
   */
  containsImageUids(uids) {
    return arrayContains(this._imageUids, uids);
  }

  /**
   * Get the geometry of the image.
   *
   * @returns {Geometry} The geometry.
   */
  getGeometry() {
    return this._geometry;
  }

  /**
   * Get the data buffer of the image.
   *
   * @todo Dangerous...
   * @returns {TypedArray} The data buffer of the image.
   */
  getBuffer() {
    return this._buffer;
  }

  /**
   * Can the image values be quantified?
   *
   * @returns {boolean} True if only one component.
   */
  canQuantify() {
    return this.getNumberOfComponents() === 1;
  }

  /**
   * Can window and level be applied to the data?
   *
   * @returns {boolean} True if the data is monochrome.
   * @deprecated Please use isMonochrome instead.
   */
  canWindowLevel() {
    return this.isMonochrome();
  }

  /**
   * Is the data monochrome.
   *
   * @returns {boolean} True if the data is monochrome.
   */
  isMonochrome() {
    return this.getPhotometricInterpretation()
      .match(/MONOCHROME/) !== null;
  }

  /**
   * Can the data be scrolled?
   *
   * @param {Matrix33} viewOrientation The view orientation.
   * @returns {boolean} True if the data has a third dimension greater than one
   *   after applying the view orientation.
   */
  canScroll(viewOrientation) {
    const size = this.getGeometry().getSize();
    // also check the numberOfFiles in case we are in the middle of a load
    let nFiles = 1;
    if (typeof this._meta.numberOfFiles !== 'undefined') {
      nFiles = this._meta.numberOfFiles;
    }
    return size.canScroll(viewOrientation) || nFiles !== 1;
  }

  /**
   * Get the secondary offset max.
   *
   * @returns {number} The maximum offset.
   */
  _getSecondaryOffsetMax() {
    return this._geometry.getSize().getTotalSize(2);
  }

  /**
   * Get the secondary offset: an offset that takes into account
   *   the slice and above dimension numbers.
   *
   * @param {Index} index The index.
   * @returns {number} The offset.
   */
  getSecondaryOffset(index) {
    return this._geometry.getSize().indexToOffset(index, 2);
  }

  /**
   * Get the rescale slope and intercept.
   *
   * @param {Index} [index] The index (only needed for non constant rsi).
   * @returns {RescaleSlopeAndIntercept} The rescale slope and intercept.
   */
  getRescaleSlopeAndIntercept(index) {
    let res = this._rsi;
    if (!this.isConstantRSI()) {
      if (typeof index === 'undefined') {
        throw new Error('Cannot get non constant RSI with empty slice index.');
      }
      const offset = this.getSecondaryOffset(index);
      if (typeof this._rsis[offset] !== 'undefined') {
        res = this._rsis[offset];
      } else {
        logger.warn('undefined non constant rsi at ' + offset);
      }
    }
    return res;
  }

  /**
   * Get the rsi at a specified (secondary) offset.
   *
   * @param {number} offset The desired (secondary) offset.
   * @returns {RescaleSlopeAndIntercept} The coresponding rsi.
   */
  _getRescaleSlopeAndInterceptAtOffset(offset) {
    return this._rsis[offset];
  }

  /**
   * Set the rescale slope and intercept.
   *
   * @param {RescaleSlopeAndIntercept} inRsi The input rescale
   *   slope and intercept.
   * @param {number} [offset] The rsi offset (only needed for non constant rsi).
   */
  setRescaleSlopeAndIntercept(inRsi, offset) {
    // update identity flag
    this._isIdentityRSI = this._isIdentityRSI && inRsi.isID();
    // update constant flag
    if (!this._isConstantRSI) {
      if (typeof offset === 'undefined') {
        throw new Error(
          'Cannot store non constant RSI with empty slice index.');
      }
      this._rsis.splice(offset, 0, inRsi);
    } else {
      if (!this._rsi.equals(inRsi)) {
        if (typeof offset === 'undefined') {
          // no slice index, replace existing
          this._rsi = inRsi;
        } else {
          // first non constant rsi
          this._isConstantRSI = false;
          // switch to non constant mode
          this._rsis = [];
          // initialise RSIs
          for (let i = 0, leni = this._getSecondaryOffsetMax(); i < leni; ++i) {
            this._rsis.push(this._rsi);
          }
          // store
          this._rsi = null;
          this._rsis.splice(offset, 0, inRsi);
        }
      }
    }
  }

  /**
   * Are all the RSIs identity (1,0).
   *
   * @returns {boolean} True if they are.
   */
  isIdentityRSI() {
    return this._isIdentityRSI;
  }

  /**
   * Are all the RSIs equal.
   *
   * @returns {boolean} True if they are.
   */
  isConstantRSI() {
    return this._isConstantRSI;
  }

  /**
   * Get the photometricInterpretation of the image.
   *
   * @returns {string} The photometricInterpretation of the image.
   */
  getPhotometricInterpretation() {
    return this._photometricInterpretation;
  }

  /**
   * Set the photometricInterpretation of the image.
   *
   * @param {string} interp The photometricInterpretation of the image.
   */
  setPhotometricInterpretation(interp) {
    this._photometricInterpretation = interp;
  }

  /**
   * Get the planarConfiguration of the image.
   *
   * @returns {number} The planarConfiguration of the image.
   */
  getPlanarConfiguration() {
    return this._planarConfiguration;
  }

  /**
   * Set the planarConfiguration of the image.
   *
   * @param {number} config The planarConfiguration of the image.
   */
  setPlanarConfiguration(config) {
    this._planarConfiguration = config;
  }

  /**
   * Get the numberOfComponents of the image.
   *
   * @returns {number} The numberOfComponents of the image.
   */
  getNumberOfComponents() {
    return this._numberOfComponents;
  }

  /**
   * Get the meta information of the image.
   *
   * @returns {Object<string, any>} The meta information of the image.
   */
  getMeta() {
    return this._meta;
  }

  /**
   * Set the meta information of the image.
   *
   * @param {Object<string, any>} rhs The meta information of the image.
   */
  setMeta(rhs) {
    this._meta = rhs;
  }

  /**
   * Get value at offset. Warning: No size check...
   *
   * @param {number} offset The desired offset.
   * @returns {number} The value at offset.
   */
  getValueAtOffset(offset) {
    return this._buffer[offset];
  }

  /**
   * Get the offsets where the buffer equals the input value.
   * Loops through the whole volume, can get long for big data...
   *
   * @param {number|RGB} value The value to check.
   * @returns {number[]} The list of offsets.
   */
  getOffsets(value) {
    // value to array
    let bufferValue;
    if (typeof value === 'number') {
      if (this._numberOfComponents !== 1) {
        throw new Error(
          'Number of components is not 1 for getting single value.');
      }
      bufferValue = [value];
    } else if (typeof value.r !== 'undefined' &&
      typeof value.g !== 'undefined' &&
      typeof value.b !== 'undefined') {
      if (this._numberOfComponents !== 3) {
        throw new Error(
          'Number of components is not 3 for getting RGB value.');
      }
      bufferValue = [value.r, value.g, value.b];
    }

    // main loop
    const offsets = [];
    let equal;
    for (let i = 0; i < this._buffer.length; i = i + this._numberOfComponents) {
      equal = true;
      for (let j = 0; j < this._numberOfComponents; ++j) {
        if (this._buffer[i + j] !== bufferValue[j]) {
          equal = false;
          break;
        }
      }
      if (equal) {
        offsets.push(i);
      }
    }
    return offsets;
  }

  /**
   * Check if the input values are in the buffer.
   * Could loop through the whole volume, can get long for big data...
   *
   * @param {Array} values The values to check.
   * @returns {boolean[]} A list of booleans for each input value,
   *   set to true if the value is present in the buffer.
   */
  hasValues(values) {
    // check input
    if (typeof values === 'undefined' ||
      values.length === 0) {
      return [];
    }
    // final array value
    const finalValues = [];
    for (let v1 = 0; v1 < values.length; ++v1) {
      if (this._numberOfComponents === 1) {
        finalValues.push([values[v1]]);
      } else if (this._numberOfComponents === 3) {
        finalValues.push([
          values[v1].r,
          values[v1].g,
          values[v1].b
        ]);
      }
    }
    // find callback
    let equalFunc;
    if (this._numberOfComponents === 1) {
      equalFunc = function (a, b) {
        return a[0] === b[0];
      };
    } else if (this._numberOfComponents === 3) {
      equalFunc = function (a, b) {
        return a[0] === b[0] &&
          a[1] === b[1] &&
          a[2] === b[2];
      };
    }
    const getEqualCallback = function (value) {
      return function (item) {
        return equalFunc(item, value);
      };
    };
    // main loop
    const res = new Array(values.length);
    res.fill(false);
    const valuesToFind = finalValues.slice();
    let equal;
    let indicesToRemove;
    for (let i = 0, leni = this._buffer.length;
      i < leni; i = i + this._numberOfComponents) {
      indicesToRemove = [];
      for (let v = 0; v < valuesToFind.length; ++v) {
        equal = true;
        // check value(s)
        for (let j = 0; j < this._numberOfComponents; ++j) {
          if (this._buffer[i + j] !== valuesToFind[v][j]) {
            equal = false;
            break;
          }
        }
        // if found, store answer and add to indices to remove
        if (equal) {
          const valIndex = finalValues.findIndex(
            getEqualCallback(valuesToFind[v]));
          res[valIndex] = true;
          indicesToRemove.push(v);
        }
      }
      // remove found values
      for (let r = 0; r < indicesToRemove.length; ++r) {
        valuesToFind.splice(indicesToRemove[r], 1);
      }
      // exit if no values to find
      if (valuesToFind.length === 0) {
        break;
      }
    }
    // return
    return res;
  }

  /**
   * Clone the image.
   *
   * @returns {Image} A clone of this image.
   */
  clone() {
    // clone the image buffer
    const clonedBuffer = this._buffer.slice(0);
    // create the image copy
    const copy = new Image(this.getGeometry(), clonedBuffer, this._imageUids);
    // copy the RSI(s)
    if (this.isConstantRSI()) {
      copy.setRescaleSlopeAndIntercept(this.getRescaleSlopeAndIntercept());
    } else {
      for (let i = 0; i < this._getSecondaryOffsetMax(); ++i) {
        copy.setRescaleSlopeAndIntercept(
          this._getRescaleSlopeAndInterceptAtOffset(i), i);
      }
    }
    // copy extras
    copy.setPhotometricInterpretation(this.getPhotometricInterpretation());
    copy.setPlanarConfiguration(this.getPlanarConfiguration());
    copy.setMeta(this.getMeta());
    // return
    return copy;
  }

  /**
   * Re-allocate buffer memory to an input size.
   *
   * @param {number} size The new size.
   */
  _realloc(size) {
    // save buffer
    let tmpBuffer = this._buffer;
    // create new
    this._buffer = getTypedArray(
      this._buffer.BYTES_PER_ELEMENT * 8,
      this._meta.IsSigned ? 1 : 0,
      size);
    if (this._buffer === null) {
      throw new Error('Cannot reallocate data for image.');
    }
    // put old in new
    this._buffer.set(tmpBuffer);
    // clean
    tmpBuffer = null;
  }

  /**
   * Append a slice to the image.
   *
   * @param {Image} rhs The slice to append.
   * @fires Image_imagegeometrychange
   */
  appendSlice(rhs) {
    // check input
    if (rhs === null) {
      throw new Error('Cannot append null slice');
    }
    const rhsSize = rhs.getGeometry().getSize();
    let size = this._geometry.getSize();
    if (rhsSize.get(2) !== 1) {
      throw new Error('Cannot append more than one slice');
    }
    if (size.get(0) !== rhsSize.get(0)) {
      throw new Error('Cannot append a slice with different number of columns');
    }
    if (size.get(1) !== rhsSize.get(1)) {
      throw new Error('Cannot append a slice with different number of rows');
    }
    if (!this._geometry.getOrientation().equals(
      rhs.getGeometry().getOrientation(), 0.0001)) {
      throw new Error('Cannot append a slice with different orientation');
    }
    if (this._photometricInterpretation !==
      rhs.getPhotometricInterpretation()) {
      throw new Error(
        'Cannot append a slice with different photometric interpretation');
    }
    // all meta should be equal
    for (const key in this._meta) {
      if (key === 'windowPresets' || key === 'numberOfFiles' ||
        key === 'custom') {
        continue;
      }
      if (this._meta[key] !== rhs.getMeta()[key]) {
        throw new Error('Cannot append a slice with different ' + key +
          ': ' + this._meta[key] + ' != ' + rhs.getMeta()[key]);
      }
    }

    // update ranges
    const rhsRange = rhs.getDataRange();
    const range = this.getDataRange();
    this._dataRange = {
      min: Math.min(rhsRange.min, range.min),
      max: Math.max(rhsRange.max, range.max),
    };
    const rhsResRange = rhs.getRescaledDataRange();
    const resRange = this.getRescaledDataRange();
    this._rescaledDataRange = {
      min: Math.min(rhsResRange.min, resRange.min),
      max: Math.max(rhsResRange.max, resRange.max),
    };

    // possible time
    const timeId = rhs.getGeometry().getInitialTime();

    // append frame if needed
    let isNewFrame = false;
    if (typeof timeId !== 'undefined' &&
      !this._geometry.hasSlicesAtTime(timeId)) {
      // update grometry
      this.appendFrame(timeId, rhs.getGeometry().getOrigin());
      // update size
      size = this._geometry.getSize();
      // update flag
      isNewFrame = true;
    }

    // get slice index
    const index = getSliceIndex(this._geometry, rhs.getGeometry());

    // calculate slice size
    const sliceSize = this._numberOfComponents * size.getDimSize(2);

    // create full buffer if not done yet
    if (typeof this._meta.numberOfFiles === 'undefined') {
      throw new Error('Missing number of files for buffer manipulation.');
    }
    const fullBufferSize = sliceSize * this._meta.numberOfFiles;
    if (this._buffer.length !== fullBufferSize) {
      this._realloc(fullBufferSize);
    }

    // slice index
    const sliceIndex = index.get(2);

    // slice index including possible 4D
    let fullSliceIndex = sliceIndex;
    if (typeof timeId !== 'undefined') {
      fullSliceIndex +=
        this._geometry.getCurrentNumberOfSlicesBeforeTime(timeId);
    }
    // offset of the input slice
    const indexOffset = fullSliceIndex * sliceSize;
    const maxOffset =
      this._geometry.getCurrentTotalNumberOfSlices() * sliceSize;
    // move content if needed
    if (indexOffset < maxOffset) {
      this._buffer.set(
        this._buffer.subarray(indexOffset, maxOffset),
        indexOffset + sliceSize
      );
    }
    // add new slice content
    this._buffer.set(rhs.getBuffer(), indexOffset);

    // update geometry
    if (!isNewFrame) {
      this._geometry.appendOrigin(
        rhs.getGeometry().getOrigin(), sliceIndex, timeId);
    }
    // update rsi
    // (rhs should just have one rsi)
    this.setRescaleSlopeAndIntercept(
      rhs.getRescaleSlopeAndIntercept(), fullSliceIndex);

    // current number of images
    const numberOfImages = this._imageUids.length;

    // insert sop instance UIDs
    this._imageUids.splice(fullSliceIndex, 0, rhs.getImageUid());

    // update window presets
    if (typeof this._meta.windowPresets !== 'undefined') {
      const windowPresets = this._meta.windowPresets;
      const rhsPresets = rhs.getMeta().windowPresets;
      const keys = Object.keys(rhsPresets);
      let pkey = null;
      for (let i = 0; i < keys.length; ++i) {
        pkey = keys[i];
        const rhsPreset = rhsPresets[pkey];
        const windowPreset = windowPresets[pkey];
        if (typeof windowPreset !== 'undefined') {
          // if not set or false, check perslice
          if (typeof windowPreset.perslice === 'undefined' ||
            windowPreset.perslice === false) {
            // if different preset.wl, mark it as perslice
            if (!windowPreset.wl[0].equals(rhsPreset.wl[0])) {
              windowPreset.perslice = true;
              // fill wl array with copy of wl[0]
              // (loop on number of images minus the existing one)
              for (let j = 0; j < numberOfImages - 1; ++j) {
                windowPreset.wl.push(windowPreset.wl[0]);
              }
            }
          }
          // store (first) rhs preset.wl if needed
          if (typeof windowPreset.perslice !== 'undefined' &&
            windowPreset.perslice === true) {
            windowPresets[pkey].wl.splice(
              fullSliceIndex, 0, rhsPreset.wl[0]);
          }
        } else {
          // if not defined (it should be), store all
          windowPresets[pkey] = rhsPresets[pkey];
        }
      }
    }
    /**
     * Image geometry change event.
     *
     * @event Image_imagegeometrychange
     * @type {object}
     */
    this._fireEvent({type: 'imagegeometrychange'});
  }

  /**
   * Append a frame buffer to the image.
   *
   * @param {object} frameBuffer The frame buffer to append.
   * @param {number} frameIndex The frame index.
   */
  appendFrameBuffer(frameBuffer, frameIndex) {
    // create full buffer if not done yet
    const size = this._geometry.getSize();
    const frameSize = this._numberOfComponents * size.getDimSize(2);
    if (typeof this._meta.numberOfFiles === 'undefined') {
      throw new Error('Missing number of files for frame buffer manipulation.');
    }
    const fullBufferSize = frameSize * this._meta.numberOfFiles;
    if (this._buffer.length !== fullBufferSize) {
      this._realloc(fullBufferSize);
    }
    // check index
    if (frameIndex >= this._meta.numberOfFiles) {
      logger.warn('Ignoring frame at index ' + frameIndex +
        ' (size: ' + this._meta.numberOfFiles + ')');
      return;
    }
    // append
    this._buffer.set(frameBuffer, frameSize * frameIndex);
    // update geometry
    this.appendFrame(frameIndex, new Point3D(0, 0, 0));
  }

  /**
   * Append a frame to the image.
   *
   * @param {number} time The frame time value.
   * @param {Point3D} origin The origin of the frame.
   */
  appendFrame(time, origin) {
    this._geometry.appendFrame(origin, time);
    this._fireEvent({type: 'appendframe'});
    // memory will be updated at the first appendSlice or appendFrameBuffer
  }

  /**
   * Get the data range.
   *
   * @returns {NumberRange} The data range.
   */
  getDataRange() {
    if (!this._dataRange) {
      this._dataRange = this.calculateDataRange();
    }
    return this._dataRange;
  }

  /**
   * Get the rescaled data range.
   *
   * @returns {NumberRange} The rescaled data range.
   */
  getRescaledDataRange() {
    if (!this._rescaledDataRange) {
      this._rescaledDataRange = this.calculateRescaledDataRange();
    }
    return this._rescaledDataRange;
  }

  /**
   * Get the histogram.
   *
   * @returns {Array} The histogram.
   */
  getHistogram() {
    if (!this._histogram) {
      const res = this.calculateHistogram();
      this._dataRange = res.dataRange;
      this._rescaledDataRange = res.rescaledDataRange;
      this._histogram = res.histogram;
    }
    return this._histogram;
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {Function} callback The function associated with the provided
   *   event type, will be called with the fired event.
   */
  addEventListener(type, callback) {
    this._listenerHandler.add(type, callback);
  }

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {Function} callback The function associated with the provided
   *   event type.
   */
  removeEventListener(type, callback) {
    this._listenerHandler.remove(type, callback);
  }

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   */
  _fireEvent = (event) => {
    this._listenerHandler.fireEvent(event);
  };

  // ****************************************
  // image data modifiers... carefull...
  // ****************************************

  /**
   * Set the inner buffer values at given offsets.
   *
   * @param {number[]} offsets List of offsets where to set the data.
   * @param {number|RGB} value The value to set at the given offsets.
   * @fires Image_imagecontentchange
   */
  setAtOffsets(offsets, value) {
    // value to array
    let bufferValue;
    if (typeof value === 'number') {
      if (this._numberOfComponents !== 1) {
        throw new Error(
          'Number of components is not 1 for setting single value.');
      }
      bufferValue = [value];
    } else if (typeof value.r !== 'undefined' &&
      typeof value.g !== 'undefined' &&
      typeof value.b !== 'undefined') {
      if (this._numberOfComponents !== 3) {
        throw new Error(
          'Number of components is not 3 for setting RGB value.');
      }
      bufferValue = [value.r, value.g, value.b];
    }

    let offset;
    for (let i = 0, leni = offsets.length; i < leni; ++i) {
      offset = offsets[i];
      for (let j = 0; j < this._numberOfComponents; ++j) {
        this._buffer[offset + j] = bufferValue[j];
      }
    }
    // fire imagecontentchange
    this._fireEvent({type: 'imagecontentchange'});
  }

  /**
   * Set the inner buffer values at given offsets.
   *
   * @param {number[][]} offsetsLists List of offset lists where
   *   to set the data.
   * @param {RGB} value The value to set at the given offsets.
   * @returns {Array} A list of objects representing the original values before
   *  replacing them.
   * @fires Image_imagecontentchange
   */
  setAtOffsetsAndGetOriginals(offsetsLists, value) {
    const originalColoursLists = [];

    // update and store
    for (let j = 0; j < offsetsLists.length; ++j) {
      const offsets = offsetsLists[j];
      // first colour
      let offset = offsets[0] * 3;
      let previousColour = {
        r: this._buffer[offset],
        g: this._buffer[offset + 1],
        b: this._buffer[offset + 2]
      };
      // original value storage
      const originalColours = [];
      originalColours.push({
        index: 0,
        colour: previousColour
      });
      for (let i = 0; i < offsets.length; ++i) {
        offset = offsets[i] * 3;
        const currentColour = {
          r: this._buffer[offset],
          g: this._buffer[offset + 1],
          b: this._buffer[offset + 2]
        };
        // check if new colour
        if (previousColour.r !== currentColour.r ||
          previousColour.g !== currentColour.g ||
          previousColour.b !== currentColour.b) {
          // store new colour
          originalColours.push({
            index: i,
            colour: currentColour
          });
          previousColour = currentColour;
        }
        // write update colour
        this._buffer[offset] = value.r;
        this._buffer[offset + 1] = value.g;
        this._buffer[offset + 2] = value.b;
      }
      originalColoursLists.push(originalColours);
    }
    // fire imagecontentchange
    this._fireEvent({type: 'imagecontentchange'});
    return originalColoursLists;
  }

  /**
   * Set the inner buffer values at given offsets.
   *
   * @param {number[][]} offsetsLists List of offset lists
   *   where to set the data.
   * @param {RGB|Array} value The value to set at the given offsets.
   * @fires Image_imagecontentchange
   */
  setAtOffsetsWithIterator(offsetsLists, value) {
    for (let j = 0; j < offsetsLists.length; ++j) {
      const offsets = offsetsLists[j];
      let iterator;
      if (Array.isArray(value)) {
        // input value is a list of iterators
        // created by setAtOffsetsAndGetOriginals
        iterator = colourRange(
          value[j], offsets.length);
      } else if (typeof value.r !== 'undefined' &&
        typeof value.g !== 'undefined' &&
        typeof value.b !== 'undefined') {
        // input value is a simple color
        iterator = colourRange(
          [{index: 0, colour: value}], offsets.length);
      }

      // set values
      let ival = iterator.next();
      while (!ival.done) {
        const offset = offsets[ival.index] * 3;
        this._buffer[offset] = ival.value.r;
        this._buffer[offset + 1] = ival.value.g;
        this._buffer[offset + 2] = ival.value.b;
        ival = iterator.next();
      }
    }
    /**
     * Image change event.
     *
     * @event Image_imagecontentchange
     * @type {object}
     */
    this._fireEvent({type: 'imagecontentchange'});
  }

  /**
   * Get the value of the image at a specific coordinate.
   *
   * @param {number} i The X index.
   * @param {number} j The Y index.
   * @param {number} k The Z index.
   * @param {number} f The frame number.
   * @returns {number} The value at the desired position.
   * Warning: No size check...
   */
  getValue(i, j, k, f) {
    const frame = (f || 0);
    const index = new Index([i, j, k, frame]);
    return this.getValueAtOffset(
      this.getGeometry().getSize().indexToOffset(index));
  }

  /**
   * Get the value of the image at a specific index.
   *
   * @param {Index} index The index.
   * @returns {number} The value at the desired position.
   * Warning: No size check...
   */
  getValueAtIndex(index) {
    return this.getValueAtOffset(
      this.getGeometry().getSize().indexToOffset(index));
  }

  /**
   * Get the rescaled value of the image at a specific position.
   *
   * @param {number} i The X index.
   * @param {number} j The Y index.
   * @param {number} k The Z index.
   * @param {number} f The frame number.
   * @returns {number} The rescaled value at the desired position.
   * Warning: No size check...
   */
  getRescaledValue(i, j, k, f) {
    if (typeof f === 'undefined') {
      f = 0;
    }
    let val = this.getValue(i, j, k, f);
    if (!this.isIdentityRSI()) {
      if (this.isConstantRSI()) {
        val = this.getRescaleSlopeAndIntercept().apply(val);
      } else {
        const values = [i, j, k, f];
        const index = new Index(values);
        val = this.getRescaleSlopeAndIntercept(index).apply(val);
      }
    }
    return val;
  }

  /**
   * Get the rescaled value of the image at a specific index.
   *
   * @param {Index} index The index.
   * @returns {number} The rescaled value at the desired position.
   * Warning: No size check...
   */
  getRescaledValueAtIndex(index) {
    return this.getRescaledValueAtOffset(
      this.getGeometry().getSize().indexToOffset(index)
    );
  }

  /**
   * Get the rescaled value of the image at a specific offset.
   *
   * @param {number} offset The desired offset.
   * @returns {number} The rescaled value at the desired offset.
   * Warning: No size check...
   */
  getRescaledValueAtOffset(offset) {
    let val = this.getValueAtOffset(offset);
    if (!this.isIdentityRSI()) {
      if (this.isConstantRSI()) {
        val = this.getRescaleSlopeAndIntercept().apply(val);
      } else {
        const index = this.getGeometry().getSize().offsetToIndex(offset);
        val = this.getRescaleSlopeAndIntercept(index).apply(val);
      }
    }
    return val;
  }

  /**
   * Calculate the data range of the image.
   * WARNING: for speed reasons, only calculated on the first frame...
   *
   * @returns {object} The range {min, max}.
   */
  calculateDataRange() {
    let min = this.getValueAtOffset(0);
    let max = min;
    let value = 0;
    const size = this.getGeometry().getSize();
    let leni = size.getTotalSize();
    // max to 3D
    if (size.length() >= 3) {
      leni = size.getDimSize(3);
    }
    for (let i = 0; i < leni; ++i) {
      value = this.getValueAtOffset(i);
      if (value > max) {
        max = value;
      }
      if (value < min) {
        min = value;
      }
    }
    // return
    return {min: min, max: max};
  }

  /**
   * Calculate the rescaled data range of the image.
   * WARNING: for speed reasons, only calculated on the first frame...
   *
   * @returns {object} The range {min, max}.
   */
  calculateRescaledDataRange() {
    if (this.isIdentityRSI()) {
      return this.getDataRange();
    } else if (this.isConstantRSI()) {
      const range = this.getDataRange();
      const resmin = this.getRescaleSlopeAndIntercept().apply(range.min);
      const resmax = this.getRescaleSlopeAndIntercept().apply(range.max);
      return {
        min: ((resmin < resmax) ? resmin : resmax),
        max: ((resmin > resmax) ? resmin : resmax)
      };
    } else {
      let rmin = this.getRescaledValueAtOffset(0);
      let rmax = rmin;
      let rvalue = 0;
      const size = this.getGeometry().getSize();
      let leni = size.getTotalSize();
      // max to 3D
      if (size.length() === 3) {
        leni = size.getDimSize(3);
      }
      for (let i = 0; i < leni; ++i) {
        rvalue = this.getRescaledValueAtOffset(i);
        if (rvalue > rmax) {
          rmax = rvalue;
        }
        if (rvalue < rmin) {
          rmin = rvalue;
        }
      }
      // return
      return {min: rmin, max: rmax};
    }
  }

  /**
   * Calculate the histogram of the image.
   *
   * @returns {object} The histogram, data range and rescaled data range.
   */
  calculateHistogram() {
    const size = this.getGeometry().getSize();
    const histo = [];
    let min = this.getValueAtOffset(0);
    let max = min;
    let value = 0;
    let rmin = this.getRescaledValueAtOffset(0);
    let rmax = rmin;
    let rvalue = 0;
    for (let i = 0, leni = size.getTotalSize(); i < leni; ++i) {
      value = this.getValueAtOffset(i);
      if (value > max) {
        max = value;
      }
      if (value < min) {
        min = value;
      }
      rvalue = this.getRescaledValueAtOffset(i);
      if (rvalue > rmax) {
        rmax = rvalue;
      }
      if (rvalue < rmin) {
        rmin = rvalue;
      }
      histo[rvalue] = (histo[rvalue] || 0) + 1;
    }
    // set data range
    const dataRange = {min: min, max: max};
    const rescaledDataRange = {min: rmin, max: rmax};
    // generate data for plotting
    const histogram = [];
    for (let b = rmin; b <= rmax; ++b) {
      histogram.push([b, (histo[b] || 0)]);
    }
    // return
    return {
      dataRange: dataRange,
      rescaledDataRange: rescaledDataRange,
      histogram: histogram
    };
  }

  /**
   * Convolute the image with a given 2D kernel.
   *
   * Note: Uses raw buffer values.
   *
   * @param {number[]} weights The weights of the 2D kernel as a 3x3 matrix.
   * @returns {Image} The convoluted image.
   */
  convolute2D(weights) {
    if (weights.length !== 9) {
      throw new Error(
        'The convolution matrix does not have a length of 9; it has ' +
        weights.length);
    }

    const newImage = this.clone();
    const newBuffer = newImage.getBuffer();

    const imgSize = this.getGeometry().getSize();
    const dimOffset = imgSize.getDimSize(2) * this.getNumberOfComponents();
    for (let k = 0; k < imgSize.get(2); ++k) {
      this.convoluteBuffer(weights, newBuffer, k * dimOffset);
    }

    return newImage;
  }

  /**
   * Convolute an image buffer with a given 2D kernel.
   *
   * Note: Uses raw buffer values.
   *
   * @param {number[]} weights The weights of the 2D kernel as a 3x3 matrix.
   * @param {TypedArray} buffer The buffer to convolute.
   * @param {number} startOffset The index to start at.
   */
  convoluteBuffer(
    weights, buffer, startOffset) {
    const imgSize = this.getGeometry().getSize();
    const ncols = imgSize.get(0);
    const nrows = imgSize.get(1);
    const ncomp = this.getNumberOfComponents();

    // number of component and planar configuration vars
    let factor = 1;
    let componentOffset = 1;
    if (ncomp === 3) {
      if (this.getPlanarConfiguration() === 0) {
        factor = 3;
      } else {
        componentOffset = imgSize.getDimSize(2);
      }
    }

    // allow special indent for matrices
    /*jshint indent:false */

    // default weight offset matrix
    const wOff = [];
    wOff[0] = (-ncols - 1) * factor;
    wOff[1] = (-ncols) * factor;
    wOff[2] = (-ncols + 1) * factor;
    wOff[3] = -factor;
    wOff[4] = 0;
    wOff[5] = 1 * factor;
    wOff[6] = (ncols - 1) * factor;
    wOff[7] = (ncols) * factor;
    wOff[8] = (ncols + 1) * factor;

    // border weight offset matrices
    // borders are extended (see http://en.wikipedia.org/wiki/Kernel_%28image_processing%29)

    // i=0, j=0
    const wOff00 = [];
    wOff00[0] = wOff[4]; wOff00[1] = wOff[4]; wOff00[2] = wOff[5];
    wOff00[3] = wOff[4]; wOff00[4] = wOff[4]; wOff00[5] = wOff[5];
    wOff00[6] = wOff[7]; wOff00[7] = wOff[7]; wOff00[8] = wOff[8];
    // i=0, j=*
    const wOff0x = [];
    wOff0x[0] = wOff[1]; wOff0x[1] = wOff[1]; wOff0x[2] = wOff[2];
    wOff0x[3] = wOff[4]; wOff0x[4] = wOff[4]; wOff0x[5] = wOff[5];
    wOff0x[6] = wOff[7]; wOff0x[7] = wOff[7]; wOff0x[8] = wOff[8];
    // i=0, j=nrows
    const wOff0n = [];
    wOff0n[0] = wOff[1]; wOff0n[1] = wOff[1]; wOff0n[2] = wOff[2];
    wOff0n[3] = wOff[4]; wOff0n[4] = wOff[4]; wOff0n[5] = wOff[5];
    wOff0n[6] = wOff[4]; wOff0n[7] = wOff[4]; wOff0n[8] = wOff[5];

    // i=*, j=0
    const wOffx0 = [];
    wOffx0[0] = wOff[3]; wOffx0[1] = wOff[4]; wOffx0[2] = wOff[5];
    wOffx0[3] = wOff[3]; wOffx0[4] = wOff[4]; wOffx0[5] = wOff[5];
    wOffx0[6] = wOff[6]; wOffx0[7] = wOff[7]; wOffx0[8] = wOff[8];
    // i=*, j=* -> wOff
    // i=*, j=nrows
    const wOffxn = [];
    wOffxn[0] = wOff[0]; wOffxn[1] = wOff[1]; wOffxn[2] = wOff[2];
    wOffxn[3] = wOff[3]; wOffxn[4] = wOff[4]; wOffxn[5] = wOff[5];
    wOffxn[6] = wOff[3]; wOffxn[7] = wOff[4]; wOffxn[8] = wOff[5];

    // i=ncols, j=0
    const wOffn0 = [];
    wOffn0[0] = wOff[3]; wOffn0[1] = wOff[4]; wOffn0[2] = wOff[4];
    wOffn0[3] = wOff[3]; wOffn0[4] = wOff[4]; wOffn0[5] = wOff[4];
    wOffn0[6] = wOff[6]; wOffn0[7] = wOff[7]; wOffn0[8] = wOff[7];
    // i=ncols, j=*
    const wOffnx = [];
    wOffnx[0] = wOff[0]; wOffnx[1] = wOff[1]; wOffnx[2] = wOff[1];
    wOffnx[3] = wOff[3]; wOffnx[4] = wOff[4]; wOffnx[5] = wOff[4];
    wOffnx[6] = wOff[6]; wOffnx[7] = wOff[7]; wOffnx[8] = wOff[7];
    // i=ncols, j=nrows
    const wOffnn = [];
    wOffnn[0] = wOff[0]; wOffnn[1] = wOff[1]; wOffnn[2] = wOff[1];
    wOffnn[3] = wOff[3]; wOffnn[4] = wOff[4]; wOffnn[5] = wOff[4];
    wOffnn[6] = wOff[3]; wOffnn[7] = wOff[4]; wOffnn[8] = wOff[4];

    // restore indent for rest of method
    /*jshint indent:4 */

    // loop vars
    let pixelOffset = startOffset;
    let newValue = 0;
    let wOffFinal = [];
    for (let c = 0; c < ncomp; ++c) {
      // component offset
      pixelOffset += c * componentOffset;
      for (let j = 0; j < nrows; ++j) {
        for (let i = 0; i < ncols; ++i) {
          wOffFinal = wOff;
          // special border cases
          if (i === 0 && j === 0) {
            wOffFinal = wOff00;
          } else if (i === 0 && j === (nrows - 1)) {
            wOffFinal = wOff0n;
          } else if (i === (ncols - 1) && j === 0) {
            wOffFinal = wOffn0;
          } else if (i === (ncols - 1) && j === (nrows - 1)) {
            wOffFinal = wOffnn;
          } else if (i === 0 && j !== (nrows - 1) && j !== 0) {
            wOffFinal = wOff0x;
          } else if (i === (ncols - 1) && j !== (nrows - 1) && j !== 0) {
            wOffFinal = wOffnx;
          } else if (i !== 0 && i !== (ncols - 1) && j === 0) {
            wOffFinal = wOffx0;
          } else if (i !== 0 && i !== (ncols - 1) && j === (nrows - 1)) {
            wOffFinal = wOffxn;
          }
          // calculate the weighed sum of the source image pixels that
          // fall under the convolution matrix
          newValue = 0;
          for (let wi = 0; wi < 9; ++wi) {
            newValue += this.getValueAtOffset(
              pixelOffset + wOffFinal[wi]) * weights[wi];
          }
          buffer[pixelOffset] = newValue;
          // increment pixel offset
          pixelOffset += factor;
        }
      }
    }
  }

  /**
   * Transform an image using a specific operator.
   * WARNING: no size check!
   *
   * @param {Function} operator The operator to use when transforming.
   * @returns {Image} The transformed image.
   * Note: Uses the raw buffer values.
   */
  transform(operator) {
    const newImage = this.clone();
    const newBuffer = newImage.getBuffer();
    for (let i = 0, leni = newBuffer.length; i < leni; ++i) {
      newBuffer[i] = operator(newImage.getValueAtOffset(i));
    }
    return newImage;
  }

  /**
   * Compose this image with another one and using a specific operator.
   * WARNING: no size check!
   *
   * @param {Image} rhs The image to compose with.
   * @param {Function} operator The operator to use when composing.
   * @returns {Image} The composed image.
   * Note: Uses the raw buffer values.
   */
  compose(rhs, operator) {
    const newImage = this.clone();
    const newBuffer = newImage.getBuffer();
    for (let i = 0, leni = newBuffer.length; i < leni; ++i) {
      // using the operator on the local buffer, i.e. the
      // latest (not original) data
      newBuffer[i] = Math.floor(
        operator(this.getValueAtOffset(i), rhs.getValueAtOffset(i))
      );
    }
    return newImage;
  }

} // class Image
