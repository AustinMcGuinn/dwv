import {MaskSegmentHelper} from './maskSegmentHelper';
import {BLACK} from '../utils/colour';

// doc imports
/* eslint-disable no-unused-vars */
import {Image} from './image';
import {MaskSegment} from '../dicom/dicomSegment';
/* eslint-enable no-unused-vars */

/**
 * Delete segment command.
 */
export class DeleteSegmentCommand {

  /**
   * The associated mask.
   *
   * @type {Image}
   */
  _mask;

  /**
   * The segment to remove.
   *
   * @type {MaskSegment}
   */
  _segment;

  /**
   * Flag to send creation events.
   *
   * @type {boolean}
   */
  _isSilent;

  /**
   * List of offsets.
   *
   * @type {number[]}
   */
  _offsets;

  /**
   * @param {Image} mask The mask image.
   * @param {MaskSegment} segment The segment to remove.
   * @param {boolean} [silent] Whether to send a creation event or not.
   */
  constructor(mask, segment, silent) {
    this._mask = mask;
    this._segment = segment;

    this._isSilent = (typeof silent === 'undefined') ? false : silent;
    // list of offsets with the colour to delete
    if (typeof segment.displayRGBValue !== 'undefined') {
      this._offsets = mask.getOffsets(segment.displayRGBValue);
    } else {
      this._offsets = mask.getOffsets(segment.displayValue);
    }
  }

  /**
   * Get the command name.
   *
   * @returns {string} The command name.
   */
  getName() {
    return 'Delete-segment';
  }

  /**
   * Check if a command is valid and can be executed.
   *
   * @returns {boolean} True if the command is valid.
   */
  isValid() {
    return this._offsets.length !== 0;
  }

  /**
   * Execute the command.
   *
   * @fires DeleteSegmentCommand_masksegmentdelete
   */
  execute() {
    // remove from image
    if (typeof this._segment.displayRGBValue !== 'undefined') {
      this._mask.setAtOffsets(this._offsets, BLACK);
    } else {
      this._mask.setAtOffsets(this._offsets, 0);
    }
    // remove from segments
    const segHelper = new MaskSegmentHelper(this._mask);
    segHelper.removeSegment(this._segment.number);

    // callback
    if (!this._isSilent) {
      /**
       * Segment delete event.
       *
       * @event DeleteSegmentCommand_masksegmentdelete
       * @type {object}
       * @property {number} segmentnumber The segment number.
       */
      this.onExecute({
        type: 'masksegmentdelete',
        segmentnumber: this._segment.number
      });
    }
  }

  /**
   * Undo the command.
   *
   * @fires DeleteSegmentCommand_masksegmentredraw
   */
  undo() {
    // re-draw in image
    if (typeof this._segment.displayRGBValue !== 'undefined') {
      this._mask.setAtOffsets(this._offsets, this._segment.displayRGBValue);
    } else {
      this._mask.setAtOffsets(this._offsets, this._segment.displayValue);
    }
    // add back to segments
    const segHelper = new MaskSegmentHelper(this._mask);
    segHelper.addSegment(this._segment);

    // callback
    /**
     * Segment redraw event.
     *
     * @event DeleteSegmentCommand_masksegmentredraw
     * @type {object}
     * @property {number} segmentnumber The segment number.
     */
    this.onUndo({
      type: 'masksegmentredraw',
      segmentnumber: this._segment.number
    });
  }

  /**
   * Handle an execute event.
   *
   * @param {object} _event The execute event with type and id.
   */
  onExecute(_event) {
    // default does nothing.
  }

  /**
   * Handle an undo event.
   *
   * @param {object} _event The undo event with type and id.
   */
  onUndo(_event) {
    // default does nothing.
  }

} // DeleteSegmentCommand class
