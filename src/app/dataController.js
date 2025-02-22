import {ListenerHandler} from '../utils/listen';
import {mergeObjects} from '../utils/operator';

// doc imports
/* eslint-disable no-unused-vars */
import {Image} from '../image/image';
/* eslint-enable no-unused-vars */

/**
 * DICOM data: meta and possible image.
 */
class DicomData {
  /**
   * DICOM meta data.
   *
   * @type {object}
   */
  meta;
  /**
   * DICOM image.
   *
   * @type {Image|undefined}
   */
  image;

  /**
   * @param {object} meta The DICOM meta data.
   * @param {Image} image The DICOM image.
   */
  constructor(meta, image) {
    this.meta = meta;
    this.image = image;
  }
}

/*
 * Data (list of {image, meta}) controller.
 */
export class DataController {

  /**
   * List of DICOM data.
   *
   * @type {Object<string, DicomData>}
   */
  _dataList = {};

  /**
   * Distinct data loaded counter.
   *
   * @type {number}
   */
  _dataIdCounter = -1;

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Get the next data id.
   *
   * @returns {string} The data id.
   */
  getNextDataId() {
    ++this._dataIdCounter;
    return this._dataIdCounter.toString();
  }

  /**
   * Get the list of ids in the data storage.
   *
   * @returns {string[]} The list of data ids.
   */
  getDataIds() {
    return Object.keys(this._dataList);
  }

  /**
   * Reset the class: empty the data storage.
   */
  reset() {
    this._dataList = {};
  }

  /**
   * Get a data at a given index.
   *
   * @param {string} dataId The data id.
   * @returns {DicomData|undefined} The DICOM data.
   */
  get(dataId) {
    return this._dataList[dataId];
  }

  /**
   * Get the list of dataIds that contain the input UIDs.
   *
   * @param {string[]} uids A list of UIDs.
   * @returns {string[]} The list of dataIds that contain the UIDs.
   */
  getDataIdsFromSopUids(uids) {
    const res = [];
    // check input
    if (typeof uids === 'undefined' ||
      uids.length === 0) {
      return res;
    }
    const keys = Object.keys(this._dataList);
    for (const key of keys) {
      if (this._dataList[key].image.containsImageUids(uids)) {
        res.push(key);
      }
    }
    return res;
  }

  /**
   * Set the image at a given index.
   *
   * @param {string} dataId The data id.
   * @param {Image} image The image to set.
   */
  setImage(dataId, image) {
    this._dataList[dataId].image = image;
    // fire image set
    this._fireEvent({
      type: 'imageset',
      value: [image],
      dataid: dataId
    });
    // listen to image change
    image.addEventListener('imagecontentchange', this._getFireEvent(dataId));
    image.addEventListener('imagegeometrychange', this._getFireEvent(dataId));
  }

  /**
   * Add a new data.
   *
   * @param {string} dataId The data id.
   * @param {Image} image The image.
   * @param {object} meta The image meta.
   */
  addNew(dataId, image, meta) {
    if (typeof this._dataList[dataId] !== 'undefined') {
      throw new Error('Data id already used in storage: ' + dataId);
    }
    // store the new image
    this._dataList[dataId] = new DicomData(meta, image);
    // listen to image change
    if (typeof image !== 'undefined') {
      image.addEventListener('imagecontentchange', this._getFireEvent(dataId));
      image.addEventListener('imagegeometrychange', this._getFireEvent(dataId));
    }
  }

  /**
   * Remove a data from the list.
   *
   * @param {string} dataId The data id.
   */
  remove(dataId) {
    if (typeof this._dataList[dataId] !== 'undefined') {
      // stop listeners
      const image = this._dataList[dataId].image;
      if (typeof image !== 'undefined') {
        image.removeEventListener(
          'imagecontentchange', this._getFireEvent(dataId));
        image.removeEventListener(
          'imagegeometrychange', this._getFireEvent(dataId));
      }
      // fire a data remove event
      this._fireEvent({
        type: 'imageremove',
        dataid: dataId
      });
      // remove data from list
      delete this._dataList[dataId];
    }
  }

  /**
   * Update the current data.
   *
   * @param {string} dataId The data id.
   * @param {Image} image The image.
   * @param {object} meta The image meta.
   */
  update(dataId, image, meta) {
    if (typeof this._dataList[dataId] === 'undefined') {
      throw new Error('Cannot find data to update: ' + dataId);
    }
    const dataToUpdate = this._dataList[dataId];

    // add slice to current image
    if (typeof dataToUpdate.image !== 'undefined' &&
      typeof image !== 'undefined'
    ) {
      dataToUpdate.image.appendSlice(image);
    }

    // update meta data
    // TODO add time support
    let idKey = '';
    if (typeof meta['00020010'] !== 'undefined') {
      // dicom case, use 'InstanceNumber'
      idKey = '00200013';
    } else {
      idKey = 'imageUid';
    }
    dataToUpdate.meta = mergeObjects(
      dataToUpdate.meta,
      meta,
      idKey,
      'value');
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

  /**
   * Get a fireEvent function that adds the input data id
   * to the event value.
   *
   * @param {string} dataId The data id.
   * @returns {Function} A fireEvent function.
   */
  _getFireEvent(dataId) {
    return (event) => {
      event.dataid = dataId;
      this._fireEvent(event);
    };
  }

} // DataController class
