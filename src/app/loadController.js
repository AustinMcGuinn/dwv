import {FilesLoader} from '../io/filesLoader';
import {MemoryLoader} from '../io/memoryLoader';
import {UrlsLoader} from '../io/urlsLoader';

/**
 * Load controller.
 */
export class LoadController {

  /**
   * The default character set.
   *
   * @type {string}
   */
  _defaultCharacterSet;

  /**
   * List of current loaders.
   *
   * @type {object}
   */
  _currentLoaders = {};

  /**
   * @param {string} defaultCharacterSet The default character set.
   */
  constructor(defaultCharacterSet) {
    this._defaultCharacterSet = defaultCharacterSet;
  }

  /**
   * Load a list of files. Can be image files or a state file.
   *
   * @param {File[]} files The list of files to load.
   * @param {string} dataId The data Id.
   */
  loadFiles(files, dataId) {
    // has been checked for emptiness.
    const ext = files[0].name.split('.').pop().toLowerCase();
    if (ext === 'json') {
      this._loadStateFile(files[0], dataId);
    } else {
      this._loadImageFiles(files, dataId);
    }
  }

  /**
   * Load a list of URLs. Can be image files or a state file.
   *
   * @param {string[]} urls The list of urls to load.
   * @param {string} dataId The data Id.
   * @param {object} [options] The load options:
   * - requestHeaders: an array of {name, value} to use as request headers.
   * - withCredentials: credentials flag to pass to the request.
   */

  loadURLs(urls, dataId, options) {
    // has been checked for emptiness.
    const ext = urls[0].split('.').pop().toLowerCase();
    if (ext === 'json') {
      this._loadStateUrl(urls[0], dataId, options);
    } else {
      this._loadImageUrls(urls, dataId, options);
    }
  }

  /**
   * Load a list of ArrayBuffers.
   *
   * @param {Array} data The list of ArrayBuffers to load
   *   in the form of [{name: '', filename: '', data: data}].
   * @param {string} dataId The data Id.
   */
  loadImageObject(data, dataId) {
    // create IO
    const memoryIO = new MemoryLoader();
    // load data
    this._loadData(data, memoryIO, 'image', dataId);
  }

  /**
   * Get the currently loaded data ids.
   *
   * @returns {string[]} The data ids.
   */
  getLoadingDataIds() {
    return Object.keys(this._currentLoaders);
  }

  /**
   * Abort an individual current loader.
   *
   * @param {string} dataId The data to stop loading.
   */
  abort(dataId) {
    if (typeof this._currentLoaders[dataId] !== 'undefined') {
      this._currentLoaders[dataId].loader.abort();
      delete this._currentLoaders[dataId];
    }
  }

  // private ----------------------------------------------------------------

  /**
   * Load a list of image files.
   *
   * @param {File[]} files The list of image files to load.
   * @param {string} dataId The data Id.
   */
  _loadImageFiles(files, dataId) {
    // create IO
    const fileIO = new FilesLoader();
    fileIO.setDefaultCharacterSet(this._defaultCharacterSet);
    // load data
    this._loadData(files, fileIO, 'image', dataId);
  }

  /**
   * Load a list of image URLs.
   *
   * @param {string[]} urls The list of urls to load.
   * @param {string} [dataId] The data Id.
   * @param {object} [options] The load options:
   * - requestHeaders: an array of {name, value} to use as request headers.
   * - withCredentials: credentials flag to pass to the request.
   */
  _loadImageUrls(urls, dataId, options) {
    // create IO
    const urlIO = new UrlsLoader();
    urlIO.setDefaultCharacterSet(this._defaultCharacterSet);
    // load data
    this._loadData(urls, urlIO, 'image', dataId, options);
  }

  /**
   * Load a State file.
   *
   * @param {File} file The state file to load.
   * @param {string} dataId The data Id.
   */
  _loadStateFile(file, dataId) {
    // create IO
    const fileIO = new FilesLoader();
    // load data
    this._loadData([file], fileIO, 'state', dataId);
  }


  /**
   * Load a State url.
   *
   * @param {string} url The state url to load.
   * @param {string} [dataId] The data Id.
   * @param {object} [options] The load options:
   * - requestHeaders: an array of {name, value} to use as request headers.
   * - withCredentials: credentials flag to pass to the request.
   */
  _loadStateUrl(url, dataId, options) {
    // create IO
    const urlIO = new UrlsLoader();
    // load data
    this._loadData([url], urlIO, 'state', dataId, options);
  }

  /**
   * Load a list of data.
   *
   * @param {string[]|File[]|Array} data Array of data to load.
   * @param {object} loader The data loader.
   * @param {string} loadType The data load type: 'image' or 'state'.
   * @param {string} dataId The data id.
   * @param {object} [options] Options passed to the final loader.
   */
  _loadData(data, loader, loadType, dataId, options) {
    const eventInfo = {
      loadtype: loadType,
      dataid: dataId
    };

    // set callbacks
    loader.onloadstart = (event) => {
      // store loader to allow abort
      this._currentLoaders[dataId] = {
        loader: loader,
        isFirstItem: true
      };
      // callback
      this._augmentCallbackEvent(this.onloadstart, eventInfo)(event);
    };
    loader.onprogress = this._augmentCallbackEvent(this.onprogress, eventInfo);
    loader.onloaditem = (event) => {
      const eventInfoItem = {
        loadtype: loadType,
        dataid: dataId
      };
      if (typeof this._currentLoaders[dataId] !== 'undefined') {
        eventInfoItem.isfirstitem = this._currentLoaders[dataId].isFirstItem;
      }
      // callback
      this._augmentCallbackEvent(this.onloaditem, eventInfoItem)(event);
      // update loader
      if (typeof this._currentLoaders[dataId] !== 'undefined' &&
        this._currentLoaders[dataId].isFirstItem) {
        this._currentLoaders[dataId].isFirstItem = false;
      }
    };
    loader.onload = this._augmentCallbackEvent(this.onload, eventInfo);
    loader.onloadend = (event) => {
      // reset current loader
      delete this._currentLoaders[dataId];
      // callback
      this._augmentCallbackEvent(this.onloadend, eventInfo)(event);
    };
    loader.onerror = this._augmentCallbackEvent(this.onerror, eventInfo);
    loader.onabort = this._augmentCallbackEvent(this.onabort, eventInfo);
    // launch load
    try {
      loader.load(data, options);
    } catch (error) {
      this.onerror({
        error: error,
        dataid: dataId
      });
      this.onloadend({
        dataid: dataId
      });
      return;
    }
  }

  /**
   * Augment a callback event: adds loadtype to the event
   *  passed to a callback.
   *
   * @param {object} callback The callback to update.
   * @param {object} info Info object to append to the event.
   * @returns {object} A function representing the modified callback.
   */
  _augmentCallbackEvent(callback, info) {
    return function (event) {
      const keys = Object.keys(info);
      for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        event[key] = info[key];
      }
      callback(event);
    };
  }

  /**
   * Handle a load start event.
   * Default does nothing.
   *
   * @param {object} _event The load start event.
   */
  onloadstart(_event) {}

  /**
   * Handle a load progress event.
   * Default does nothing.
   *
   * @param {object} _event The progress event.
   */
  onprogress(_event) {}

  /**
   * Handle a load event.
   * Default does nothing.
   *
   * @param {object} _event The load event fired
   *   when a file has been loaded successfully.
   */
  onload(_event) {}

  /**
   * Handle a load item event.
   * Default does nothing.
   *
   * @param {object} _event The load event fired
   *   when an item has been loaded successfully.
   */
  onloaditem(_event) {}

  /**
   * Handle a load end event.
   * Default does nothing.
   *
   * @param {object} _event The load end event fired
   *  when a file load has completed, successfully or not.
   */
  onloadend(_event) {}

  /**
   * Handle an error event.
   * Default does nothing.
   *
   * @param {object} _event The error event.
   */
  onerror(_event) {}

  /**
   * Handle an abort event.
   * Default does nothing.
   *
   * @param {object} _event The abort event.
   */
  onabort(_event) {}

} // class LoadController
