import {getLayerDetailsFromEvent} from '../gui/layerGroup';
import {ScrollWheel} from './scrollWheel';
import {
  getMousePoint,
  getTouchPoints
} from '../gui/generic';

// doc imports
/* eslint-disable no-unused-vars */
import {App} from '../app/application';
import {Point2D} from '../math/point';
/* eslint-enable no-unused-vars */

/**
 * Opacity class.
 *
 * @example
 * // create the dwv app
 * const app = new dwv.App();
 * // initialise
 * const viewConfig0 = new dwv.ViewConfig('layerGroup0');
 * const viewConfigs = {'*': [viewConfig0]};
 * const options = new dwv.AppOptions(viewConfigs);
 * options.tools = {Opacity: new dwv.ToolConfig()};
 * app.init(options);
 * // activate tool
 * app.addEventListener('load', function () {
 *   app.setTool('Opacity');
 * });
 * // load dicom data
 * app.loadURLs([
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323851.dcm'
 * ]);
 */
export class Opacity {
  /**
   * Associated app.
   *
   * @type {App}
   */
  _app;

  /**
   * Interaction start flag.
   *
   * @type {boolean}
   */
  _started = false;

  /**
   * Start point.
   *
   * @type {Point2D}
   */
  _startPoint;

  /**
   * Scroll wheel handler.
   *
   * @type {ScrollWheel}
   */
  _scrollWhell;

  /**
   * @param {App} app The associated application.
   */
  constructor(app) {
    this._app = app;
    this._scrollWhell = new ScrollWheel(app);
  }

  /**
   * Start tool interaction.
   *
   * @param {Point2D} point The start point.
   */
  _start(point) {
    this._started = true;
    this._startPoint = point;
  }

  /**
   * Update tool interaction.
   *
   * @param {Point2D} point The update point.
   * @param {string} divId The layer group divId.
   */
  _update(point, divId) {
    if (!this._started) {
      return;
    }

    // difference to last X position
    const diffX = point.getX() - this._startPoint.getX();
    const xMove = (Math.abs(diffX) > 15);
    // do not trigger for small moves
    if (xMove) {
      const layerGroup = this._app.getLayerGroupByDivId(divId);
      const viewLayer = layerGroup.getActiveViewLayer();
      const op = viewLayer.getOpacity();
      viewLayer.setOpacity(op + (diffX / 200));
      viewLayer.draw();

      // reset origin point
      this._startPoint = point;
    }
  }

  /**
   * Finish tool interaction.
   */
  _finish() {
    if (this._started) {
      this._started = false;
    }
  }

  /**
   * Handle mouse down event.
   *
   * @param {object} event The mouse down event.
   */
  mousedown = (event) => {
    const mousePoint = getMousePoint(event);
    this._start(mousePoint);
  };

  /**
   * Handle mouse move event.
   *
   * @param {object} event The mouse move event.
   */
  mousemove = (event) => {
    const mousePoint = getMousePoint(event);
    const layerDetails = getLayerDetailsFromEvent(event);
    this._update(mousePoint, layerDetails.groupDivId);
  };

  /**
   * Handle mouse up event.
   *
   * @param {object} _event The mouse up event.
   */
  mouseup = (_event) => {
    this._finish();
  };

  /**
   * Handle mouse out event.
   *
   * @param {object} _event The mouse out event.
   */
  mouseout = (_event) => {
    this._finish();
  };

  /**
   * Handle touch start event.
   *
   * @param {object} event The touch start event.
   */
  touchstart = (event) => {
    const touchPoints = getTouchPoints(event);
    this._start(touchPoints[0]);
  };

  /**
   * Handle touch move event.
   *
   * @param {object} event The touch move event.
   */
  touchmove = (event) => {
    const touchPoints = getTouchPoints(event);
    const layerDetails = getLayerDetailsFromEvent(event);
    this._update(touchPoints[0], layerDetails.groupDivId);
  };

  /**
   * Handle touch end event.
   *
   * @param {object} _event The touch end event.
   */
  touchend = (_event) => {
    this._finish();
  };

  /**
   * Handle mouse wheel event.
   *
   * @param {object} event The mouse wheel event.
   */
  wheel = (event) => {
    this._scrollWhell.wheel(event);
  };

  /**
   * Handle key down event.
   *
   * @param {object} event The key down event.
   */
  keydown = (event) => {
    event.context = 'Opacity';
    this._app.onKeydown(event);
  };

  /**
   * Activate the tool.
   *
   * @param {boolean} _bool The flag to activate or not.
   */
  activate(_bool) {
    // does nothing
  }

  /**
   * Initialise the tool.
   */
  init() {
    // does nothing
  }

  /**
   * Set the tool live features: does nothing.
   *
   * @param {object} _features The list of features.
   */
  setFeatures(_features) {
    // does nothing
  }

} // Opacity class
