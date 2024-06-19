// doc imports
/* eslint-disable no-unused-vars */
import {Image} from './image';
import {MaskSegment} from '../dicom/dicomSegment';
import {RGB} from '../utils/colour';
/* eslint-enable no-unused-vars */

/**
 * Change segment colour command.
 */
export class ChangeSegmentColourCommand {

  /**
   * The associated mask.
   *
   * @type {Image}
   */
  _mask;

  /**
   * The segment to modify.
   *
   * @type {MaskSegment}
   */
  _segment;

  /**
   * The new segment colour.
   *
   * @type {RGB|number}
   */
  _newColour;

  /**
   * The previous segment colour.
   *
   * @type {RGB|number}
   */
  _previousColour;

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
   * @param {MaskSegment} segment The segment to modify.
   * @param {RGB|number} newColour The new segment colour.
   * @param {boolean} [silent] Whether to send a creation event or not.
   */
  constructor(mask, segment, newColour, silent) {
    this._mask = mask;
    this._segment = segment;
    this._newColour = newColour;

    this._isSilent = (typeof silent === 'undefined') ? false : silent;
    // list of offsets with the colour to delete
    if (typeof segment.displayRGBValue !== 'undefined') {
      this._previousColour = segment.displayRGBValue;
    } else {
      this._previousColour = segment.displayValue;
    }
    this._offsets = mask.getOffsets(this._previousColour);
  }

  /**
   * Get the command name.
   *
   * @returns {string} The command name.
   */
  getName() {
    return 'Change-segment-colour';
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
   * @fires ChangeSegmentColourCommand_changemasksegmentcolour
   */
  execute() {
    // remove
    this._mask.setAtOffsets(this._offsets, this._newColour);
    // update segment property
    if (typeof this._newColour === 'number') {
      this._segment.displayValue = this._newColour;
    } else {
      this._segment.displayRGBValue = this._newColour;
    }

    // callback
    if (!this._isSilent) {
      /**
       * Segment delete event.
       *
       * @event ChangeSegmentColourCommand_changemasksegmentcolour
       * @type {object}
       * @property {number} segmentnumber The segment number.
       */
      this.onExecute({
        type: 'changemasksegmentcolour',
        segmentnumber: this._segment.number,
        value: [this._newColour]
      });
    }
  }

  /**
   * Undo the command.
   *
   * @fires ChangeSegmentColourCommand_changemasksegmentcolour
   */
  undo() {
    // re-draw
    this._mask.setAtOffsets(this._offsets, this._previousColour);
    // update segment property
    if (typeof this._previousColour === 'number') {
      this._segment.displayValue = this._previousColour;
    } else {
      this._segment.displayRGBValue = this._previousColour;
    }

    // callback
    /**
     * Segment redraw event.
     *
     * @event ChangeSegmentColourCommand_changemasksegmentcolour
     * @type {object}
     * @property {number} segmentnumber The segment number.
     */
    this.onUndo({
      type: 'changemasksegmentcolour',
      segmentnumber: this._segment.number,
      value: [this._previousColour]
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

} // ChangeSegmentColourCommand class
