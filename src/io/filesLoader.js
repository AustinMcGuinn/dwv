import {MultiProgressHandler} from '../utils/progress';
import {loaderList} from './loaderList';

// file content types
export const fileContentTypes = {
  Text: 0,
  ArrayBuffer: 1,
  DataURL: 2
};

/**
 * Files loader.
 */
export class FilesLoader {

  /**
   * Input data.
   *
   * @type {File[]}
   */
  _inputData = null;

  /**
   * Array of launched file readers.
   *
   * @type {FileReader[]}
   */
  _readers = [];

  /**
   * Data loader.
   *
   * @type {object}
   */
  _runningLoader = null;

  /**
   * Number of loaded data.
   *
   * @type {number}
   */
  _nLoad = 0;

  /**
   * Number of load end events.
   *
   * @type {number}
   */
  _nLoadend = 0;

  /**
   * The default character set (optional).
   *
   * @type {string}
   */
  _defaultCharacterSet;

  /**
   * Get the default character set.
   *
   * @returns {string} The default character set.
   */
  getDefaultCharacterSet() {
    return this._defaultCharacterSet;
  }

  /**
   * Set the default character set.
   *
   * @param {string} characterSet The character set.
   */
  setDefaultCharacterSet(characterSet) {
    this._defaultCharacterSet = characterSet;
  }

  /**
   * Store the current input.
   *
   * @param {File[]} data The input data.
   */
  _storeInputData(data) {
    this._inputData = data;
    // reset counters
    this._nLoad = 0;
    this._nLoadend = 0;
    // clear storage
    this._clearStoredReaders();
    this._clearStoredLoader();
  }

  /**
   * Store a launched reader.
   *
   * @param {FileReader} reader The launched reader.
   */
  _storeReader(reader) {
    this._readers.push(reader);
  }

  /**
   * Clear the stored readers.
   *
   */
  _clearStoredReaders() {
    this._readers = [];
  }

  /**
   * Store the launched loader.
   *
   * @param {object} loader The launched loader.
   */
  _storeLoader(loader) {
    this._runningLoader = loader;
  }

  /**
   * Clear the stored loader.
   *
   */
  _clearStoredLoader() {
    this._runningLoader = null;
  }

  /**
   * Increment the number of loaded data
   *   and call onload if loaded all data.
   *
   * @param {object} _event The load data event.
   */
  _addLoad = (_event) => {
    this._nLoad++;
    // call onload when all is loaded
    // (not using the input event since it is
    //   an individual load)
    if (this._nLoad === this._inputData.length) {
      this.onload({
        source: this._inputData
      });
    }
  };

  /**
   * Increment the counter of load end events
   *   and run callbacks when all done, erroneus or not.
   *
   * @param {object} _event The load end event.
   */
  _addLoadend = (_event) => {
    this._nLoadend++;
    // call onloadend when all is run
    // (not using the input event since it is
    //   an individual load end)
    if (this._nLoadend === this._inputData.length) {
      this.onloadend({
        source: this._inputData
      });
    }
  };

  /**
   * @callback eventFn
   * @param {object} event The event.
   */

  /**
   * Augment a callback event with a srouce.
   *
   * @param {object} callback The callback to augment its event.
   * @param {object} source The source to add to the event.
   * @returns {eventFn} The augmented callback.
   */
  _augmentCallbackEvent(callback, source) {
    return (event) => {
      event.source = source;
      callback(event);
    };
  }

  /**
   * Get a load handler for a data element.
   *
   * @param {object} loader The associated loader.
   * @param {File} dataElement The data element.
   * @param {number} i The index of the element.
   * @returns {eventFn} A load handler.
   */
  _getLoadHandler(loader, dataElement, i) {
    return (event) => {
      loader.load(event.target.result, dataElement, i);
    };
  }


  /**
   * Load a list of files.
   *
   * @param {File[]} data The list of files to load.
   */
  load(data) {
    // check input
    if (typeof data === 'undefined' || data.length === 0) {
      return;
    }
    this._storeInputData(data);

    // send start event
    this.onloadstart({
      source: data
    });

    // create prgress handler
    const mproghandler = new MultiProgressHandler(this.onprogress);
    mproghandler.setNToLoad(data.length);

    // create loaders
    const loaders = [];
    for (let m = 0; m < loaderList.length; ++m) {
      loaders.push(new loaderList[m]());
    }

    // find an appropriate loader
    let dataElement = data[0];
    let loader = null;
    let foundLoader = false;
    for (let l = 0; l < loaders.length; ++l) {
      loader = loaders[l];
      if (loader.canLoadFile(dataElement)) {
        foundLoader = true;
        // load options
        loader.setOptions({
          numberOfFiles: data.length,
          defaultCharacterSet: this.getDefaultCharacterSet()
        });
        // set loader callbacks
        // loader.onloadstart: nothing to do
        loader.onprogress = mproghandler.getUndefinedMonoProgressHandler(1);
        loader.onloaditem = this.onloaditem;
        loader.onload = this._addLoad;
        loader.onloadend = this._addLoadend;
        loader.onerror = this.onerror;
        loader.onabort = this.onabort;

        // store loader
        this._storeLoader(loader);
        // exit
        break;
      }
    }
    if (!foundLoader) {
      throw new Error('No loader found for file: ' + dataElement.name);
    }

    // loop on I/O elements
    for (let i = 0; i < data.length; ++i) {
      dataElement = data[i];

      // check loader
      if (!loader.canLoadFile(dataElement)) {
        throw new Error('Input file of different type: ' + dataElement);
      }

      /**
       * The file reader.
       *
       * Ref: {@link https://developer.mozilla.org/en-US/docs/Web/API/FileReader}.
       *
       * @external FileReader
       */
      const reader = new FileReader();
      // store reader
      this._storeReader(reader);

      // set reader callbacks
      // reader.onloadstart: nothing to do
      reader.onprogress = this._augmentCallbackEvent(
        mproghandler.getMonoProgressHandler(i, 0), dataElement);
      reader.onload = this._getLoadHandler(loader, dataElement, i);
      // reader.onloadend: nothing to do
      const errorCallback =
        this._augmentCallbackEvent(this.onerror, dataElement);
      reader.onerror = (event) => {
        this._addLoadend();
        errorCallback(event);
      };
      const abortCallback =
        this._augmentCallbackEvent(this.onabort, dataElement);
      reader.onabort = (event) => {
        this._addLoadend();
        abortCallback(event);
      };
      // read
      if (loader.loadFileAs() === fileContentTypes.Text) {
        reader.readAsText(dataElement);
      } else if (loader.loadFileAs() === fileContentTypes.DataURL) {
        reader.readAsDataURL(dataElement);
      } else if (loader.loadFileAs() === fileContentTypes.ArrayBuffer) {
        reader.readAsArrayBuffer(dataElement);
      }
    }
  }

  /**
   * Abort a load.
   */
  abort() {
    // abort readers
    for (let i = 0; i < this._readers.length; ++i) {
      // 0: EMPTY, 1: LOADING, 2: DONE
      if (this._readers[i].readyState === 1) {
        this._readers[i].abort();
      }
    }
    // abort loader
    if (this._runningLoader && this._runningLoader.isLoading()) {
      this._runningLoader.abort();
    }
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
   * Handle a load item event.
   * Default does nothing.
   *
   * @param {object} _event The load item event fired
   *   when a file item has been loaded successfully.
   */
  onloaditem(_event) {}

  /**
   * Handle a load event.
   * Default does nothing.
   *
   * @param {object} _event The load event fired
   *   when a file has been loaded successfully.
   */
  onload(_event) {}

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

} // class FilesLoader
