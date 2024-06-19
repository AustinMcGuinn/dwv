import {startsWith, getFileExtension} from '../utils/string';
import {getUrlFromUri} from '../utils/uri';
import {fileContentTypes} from './filesLoader';
import {urlContentTypes} from './urlsLoader';
import {MemoryLoader} from './memoryLoader';

/**
 * The zip library.
 *
 * Ref: {@link https://github.com/Stuk/jszip}.
 *
 * @external JSZip
 */
import JSZip from 'jszip';

/**
 * ZIP data loader.
 */
export class ZipLoader {

  /**
   * Loading flag.
   *
   * @type {boolean}
   */
  _isLoading = false;

  /**
   * Set the loader options.
   *
   * @param {object} _opt The input options.
   */
  setOptions(_opt) {
    // does nothing
  }

  /**
   * Is the load ongoing?
   *
   * @returns {boolean} True if loading.
   */
  isLoading() {
    return this._isLoading;
  }

  _filename = '';
  _files = [];
  _zobjs = null;

  /**
   * JSZip.async callback.
   *
   * @param {ArrayBuffer} content Unzipped file image.
   * @param {object} origin The origin of the file.
   * @param {number} index The data index.
   */
  _zipAsyncCallback(content, origin, index) {
    this._files.push({filename: this._filename, data: content});

    // sent un-ziped progress with the data index
    // (max 50% to take into account the memory loading)
    const unzipPercent = this._files.length * 100 / this._zobjs.length;
    this.onprogress({
      lengthComputable: true,
      loaded: (unzipPercent / 2),
      total: 100,
      index: index,
      item: {
        loaded: unzipPercent,
        total: 100,
        source: origin
      }
    });

    // recursively call until we have all the files
    if (this._files.length < this._zobjs.length) {
      const num = this._files.length;
      this._filename = this._zobjs[num].name;
      this._zobjs[num].async('arrayBuffer').then((content) => {
        this._zipAsyncCallback(content, origin, index);
      });
    } else {
      const memoryIO = new MemoryLoader();
      // memoryIO.onloadstart: nothing to do
      memoryIO.onprogress = (progress) => {
        // add 50% to take into account the un-zipping
        progress.loaded = 50 + progress.loaded / 2;
        // set data index
        progress.index = index;
        this.onprogress(progress);
      };
      memoryIO.onloaditem = this.onloaditem;
      memoryIO.onload = this.onload;
      memoryIO.onloadend = (event) => {
        // reset loading flag
        this._isLoading = false;
        // call listeners
        this.onloadend(event);
      };
      memoryIO.onerror = this.onerror;
      memoryIO.onabort = this.onabort;
      // launch
      memoryIO.load(this._files);
    }
  }

  /**
   * Load data.
   *
   * @param {object} buffer The DICOM buffer.
   * @param {string} origin The data origin.
   * @param {number} index The data index.
   */
  load(buffer, origin, index) {
    // send start event
    this.onloadstart({
      source: origin
    });
    // set loading flag
    this._isLoading = true;

    JSZip.loadAsync(buffer).then((zip) => {
      this._files = [];
      this._zobjs = zip.file(/.*\.dcm/);
      // recursively load zip files into the files array
      const num = this._files.length;
      this._filename = this._zobjs[num].name;
      this._zobjs[num].async('arrayBuffer').then((content) => {
        this._zipAsyncCallback(content, origin, index);
      });
    });
  }

  /**
   * Abort load: pass to listeners.
   */
  abort() {
    // reset loading flag
    this._isLoading = false;
    // call listeners
    this.onabort({});
    this.onloadend({});
  }

  /**
   * Check if the loader can load the provided file.
   * True if the file has a 'zip' extension.
   *
   * @param {File} file The file to check.
   * @returns {boolean} True if the file can be loaded.
   */
  canLoadFile(file) {
    const ext = getFileExtension(file.name);
    return (ext === 'zip');
  }

  /**
   * Check if the loader can load the provided url.
   * True if one of the folowing conditions is true:
   * - the `options.forceLoader` is 'zip',
   * - the `options.requestHeaders` contains an item
   *   starting with 'Accept: application/zip'.
   * - the url has a 'zip' extension.
   *
   * @param {string} url The url to check.
   * @param {object} [options] Optional url request options.
   * @returns {boolean} True if the url can be loaded.
   */
  canLoadUrl(url, options) {
    // check options
    if (typeof options !== 'undefined') {
      // check options.forceLoader
      if (typeof options.forceLoader !== 'undefined' &&
        options.forceLoader === 'zip') {
        return true;
      }
      // check options.requestHeaders for 'Accept'
      if (typeof options.requestHeaders !== 'undefined') {
        const isNameAccept = function (element) {
          return element.name === 'Accept';
        };
        const acceptHeader = options.requestHeaders.find(isNameAccept);
        if (typeof acceptHeader !== 'undefined') {
          // starts with 'application/zip'
          return startsWith(acceptHeader.value, 'application/zip');
        }
      }
    }

    const urlObjext = getUrlFromUri(url);
    const ext = getFileExtension(urlObjext.pathname);
    return (ext === 'zip');
  }

  /**
   * Check if the loader can load the provided memory object.
   *
   * @param {object} mem The memory object.
   * @returns {boolean} True if the object can be loaded.
   */
  canLoadMemory(mem) {
    const contentType = mem['Content-Type'];
    if (typeof contentType !== 'undefined' &&
      contentType.startsWith('application/zip')) {
      return true;
    }
    if (typeof mem.filename !== 'undefined') {
      const tmpFile = new File(['from memory'], mem.filename);
      return this.canLoadFile(tmpFile);
    }
    return false;
  }

  /**
   * Get the file content type needed by the loader.
   *
   * @returns {number} One of the 'fileContentTypes'.
   */
  loadFileAs() {
    return fileContentTypes.ArrayBuffer;
  }

  /**
   * Get the url content type needed by the loader.
   *
   * @returns {number} One of the 'urlContentTypes'.
   */
  loadUrlAs() {
    return urlContentTypes.ArrayBuffer;
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
   * Handle an load end event.
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

} // class ZipLoader
