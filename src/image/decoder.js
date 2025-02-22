import {ThreadPool, WorkerTask} from '../utils/thread';

/**
 * The JPEG baseline decoder.
 *
 * Ref: {@link https://github.com/mozilla/pdf.js/blob/master/src/core/jpg.js}.
 *
 * @external JpegImage
 */
/* global JpegImage */
// @ts-ignore
const hasJpegBaselineDecoder = (typeof JpegImage !== 'undefined');

/**
 * The JPEG decoder namespace.
 *
 * Ref: {@link https://github.com/rii-mango/JPEGLosslessDecoderJS}.
 *
 * @external jpeg
 */
/* global jpeg */
const hasJpegLosslessDecoder =
  // @ts-ignore
  (typeof jpeg !== 'undefined') && (typeof jpeg.lossless !== 'undefined');

/**
 * The JPEG 2000 decoder.
 *
 * Ref: {@link https://github.com/jpambrun/jpx-medical/blob/master/jpx.js}.
 *
 * @external JpxImage
 */
/* global JpxImage */
// @ts-ignore
const hasJpeg2000Decoder = (typeof JpxImage !== 'undefined');

/* global dwvdecoder */

/**
 * Decoder scripts to be passed to web workers for image decoding.
 */
export const decoderScripts = {
  jpeg2000: '',
  'jpeg-lossless': '',
  'jpeg-baseline': '',
  rle: ''
};

/**
 * Asynchronous pixel buffer decoder.
 */
class AsynchPixelBufferDecoder {

  /**
   * The associated worker script.
   *
   * @type {string}
   */
  _script;

  /**
   * Associated thread pool.
   *
   * @type {ThreadPool}
   */
  _pool = new ThreadPool(10);

  /**
   * Flag to know if callbacks are set.
   *
   * @type {boolean}
   */
  _areCallbacksSet = false;

  /**
   * @param {string} script The path to the decoder script to be used
   *   by the web worker.
   * @param {number} _numberOfData The anticipated number of data to decode.
   */
  constructor(script, _numberOfData) {
    this._script = script;
  }

  /**
   * Decode a pixel buffer.
   *
   * @param {Array} pixelBuffer The pixel buffer.
   * @param {object} pixelMeta The input meta data.
   * @param {object} info Information object about the input data.
   */
  decode(pixelBuffer, pixelMeta, info) {
    if (!this._areCallbacksSet) {
      this._areCallbacksSet = true;
      // set event handlers
      this._pool.onworkstart = this.ondecodestart;
      this._pool.onworkitem = this.ondecodeditem;
      this._pool.onwork = this.ondecoded;
      this._pool.onworkend = this.ondecodeend;
      this._pool.onerror = this.onerror;
      this._pool.onabort = this.onabort;
    }
    // create worker task
    const workerTask = new WorkerTask(
      this._script,
      {
        buffer: pixelBuffer,
        meta: pixelMeta
      },
      info
    );
    // add it the queue and run it
    this._pool.addWorkerTask(workerTask);
  }

  /**
   * Abort decoding.
   */
  abort() {
    // abort the thread pool, will trigger pool.onabort
    this._pool.abort();
  }

  /**
   * Handle a decode start event.
   * Default does nothing.
   *
   * @param {object} _event The decode start event.
   */
  ondecodestart(_event) {}

  /**
   * Handle a decode item event.
   * Default does nothing.
   *
   * @param {object} _event The decode item event fired
   *   when a decode item ended successfully.
   */
  ondecodeditem(_event) {}

  /**
   * Handle a decode event.
   * Default does nothing.
   *
   * @param {object} _event The decode event fired
   *   when a file has been decoded successfully.
   */
  ondecoded(_event) {}

  /**
   * Handle a decode end event.
   * Default does nothing.
   *
   * @param {object} _event The decode end event fired
   *  when a file decoding has completed, successfully or not.
   */
  ondecodeend(_event) {}

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

} // class AsynchPixelBufferDecoder

/**
 * Synchronous pixel buffer decoder.
 */
class SynchPixelBufferDecoder {

  /**
   * Name of the compression algorithm.
   *
   * @type {string}
   */
  _algoName;

  /**
   * Number of data.
   *
   * @type {number}
   */
  _numberOfData;

  /**
   * @param {string} algoName The decompression algorithm name.
   * @param {number} numberOfData The anticipated number of data to decode.
   */
  constructor(algoName, numberOfData) {
    this._algoName = algoName;
    this._numberOfData = numberOfData;
  }

  // decode count
  _decodeCount = 0;

  /**
   * Decode a pixel buffer.
   *
   * @param {Array} pixelBuffer The pixel buffer.
   * @param {object} pixelMeta The input meta data.
   * @param {object} info Information object about the input data.
   * @external jpeg
   * @external JpegImage
   * @external JpxImage
   */
  decode(pixelBuffer, pixelMeta, info) {
    ++this._decodeCount;

    let decoder = null;
    let decodedBuffer = null;
    if (this._algoName === 'jpeg-lossless') {
      if (!hasJpegLosslessDecoder) {
        throw new Error('No JPEG Lossless decoder provided');
      }
      // bytes per element
      const bpe = pixelMeta.bitsAllocated / 8;
      const buf = new Uint8Array(pixelBuffer);
      // @ts-ignore
      decoder = new jpeg.lossless.Decoder();
      const decoded = decoder.decode(buf.buffer, 0, buf.buffer.byteLength, bpe);
      if (pixelMeta.bitsAllocated === 8) {
        if (pixelMeta.isSigned) {
          decodedBuffer = new Int8Array(decoded.buffer);
        } else {
          decodedBuffer = new Uint8Array(decoded.buffer);
        }
      } else if (pixelMeta.bitsAllocated === 16) {
        if (pixelMeta.isSigned) {
          decodedBuffer = new Int16Array(decoded.buffer);
        } else {
          decodedBuffer = new Uint16Array(decoded.buffer);
        }
      }
    } else if (this._algoName === 'jpeg-baseline') {
      if (!hasJpegBaselineDecoder) {
        throw new Error('No JPEG Baseline decoder provided');
      }
      // @ts-ignore
      decoder = new JpegImage();
      decoder.parse(pixelBuffer);
      decodedBuffer = decoder.getData(decoder.width, decoder.height);
    } else if (this._algoName === 'jpeg2000') {
      if (!hasJpeg2000Decoder) {
        throw new Error('No JPEG 2000 decoder provided');
      }
      // decompress pixel buffer into Int16 image
      // @ts-ignore
      decoder = new JpxImage();
      decoder.parse(pixelBuffer);
      // set the pixel buffer
      decodedBuffer = decoder.tiles[0].items;
    } else if (this._algoName === 'rle') {
      // decode DICOM buffer
      // @ts-ignore
      decoder = new dwvdecoder.RleDecoder();
      // set the pixel buffer
      decodedBuffer = decoder.decode(
        pixelBuffer,
        pixelMeta.bitsAllocated,
        pixelMeta.isSigned,
        pixelMeta.sliceSize,
        pixelMeta.samplesPerPixel,
        pixelMeta.planarConfiguration);
    }
    // send decode events
    this.ondecodeditem({
      data: [decodedBuffer],
      index: info.index,
      numberOfItems: info.numberOfItems,
      itemNumber: info.itemNumber
    });
    // decode end?
    if (this._decodeCount === this._numberOfData) {
      this.ondecoded({});
      this.ondecodeend({});
    }
  }

  /**
   * Abort decoding.
   */
  abort() {
    // nothing to do in the synchronous case.
    // callback
    this.onabort({});
    this.ondecodeend({});
  }

  /**
   * Handle a decode start event.
   * Default does nothing.
   *
   * @param {object} _event The decode start event.
   */
  ondecodestart(_event) {}

  /**
   * Handle a decode item event.
   * Default does nothing.
   *
   * @param {object} _event The decode item event fired
   *   when a decode item ended successfully.
   */
  ondecodeditem(_event) {}

  /**
   * Handle a decode event.
   * Default does nothing.
   *
   * @param {object} _event The decode event fired
   *   when a file has been decoded successfully.
   */
  ondecoded(_event) {}

  /**
   * Handle a decode end event.
   * Default does nothing.
   *
   * @param {object} _event The decode end event fired
   *  when a file decoding has completed, successfully or not.
   */
  ondecodeend(_event) {}

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

} // class SynchPixelBufferDecoder

/**
 * Decode a pixel buffer.
 *
 * If the 'decoderScripts' variable does not contain the desired,
 * algorythm the decoder will switch to the synchronous mode.
 */
export class PixelBufferDecoder {

  /**
   * Flag to know if callbacks are set.
   *
   * @type {boolean}
   */
  _areCallbacksSet = false;

  /**
   * Pixel decoder.
   * Defined only once.
   *
   * @type {object}
   */
  _pixelDecoder = null;

  /**
   * @param {string} algoName The decompression algorithm name.
   * @param {number} numberOfData The anticipated number of data to decode.
   */
  constructor(algoName, numberOfData) {
    // initialise the asynch decoder (if possible)
    if (typeof decoderScripts !== 'undefined' &&
      typeof decoderScripts[algoName] !== 'undefined') {
      this._pixelDecoder = new AsynchPixelBufferDecoder(
        decoderScripts[algoName], numberOfData);
    } else {
      this._pixelDecoder = new SynchPixelBufferDecoder(
        algoName, numberOfData);
    }
  }

  /**
   * Get data from an input buffer using a DICOM parser.
   *
   * @param {Array} pixelBuffer The input data buffer.
   * @param {object} pixelMeta The input meta data.
   * @param {object} info Information object about the input data.
   */
  decode(pixelBuffer, pixelMeta, info) {
    if (!this._areCallbacksSet) {
      this._areCallbacksSet = true;
      // set callbacks
      this._pixelDecoder.ondecodestart = this.ondecodestart;
      this._pixelDecoder.ondecodeditem = this.ondecodeditem;
      this._pixelDecoder.ondecoded = this.ondecoded;
      this._pixelDecoder.ondecodeend = this.ondecodeend;
      this._pixelDecoder.onerror = this.onerror;
      this._pixelDecoder.onabort = this.onabort;
    }
    // decode and call the callback
    this._pixelDecoder.decode(pixelBuffer, pixelMeta, info);
  }

  /**
   * Abort decoding.
   */
  abort() {
    // decoder classes should define an abort
    this._pixelDecoder.abort();
  }

  /**
   * Handle a decode start event.
   * Default does nothing.
   *
   * @param {object} _event The decode start event.
   */
  ondecodestart(_event) {}

  /**
   * Handle a decode item event.
   * Default does nothing.
   *
   * @param {object} _event The decode item event fired
   *   when a decode item ended successfully.
   */
  ondecodeditem(_event) {}

  /**
   * Handle a decode event.
   * Default does nothing.
   *
   * @param {object} _event The decode event fired
   *   when a file has been decoded successfully.
   */
  ondecoded(_event) {}

  /**
   * Handle a decode end event.
   * Default does nothing.
   *
   * @param {object} _event The decode end event fired
   *  when a file decoding has completed, successfully or not.
   */
  ondecodeend(_event) {}

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

} // class PixelBufferDecoder
