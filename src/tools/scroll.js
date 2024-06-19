import {getLayerDetailsFromEvent} from '../gui/layerGroup';
import {
  getMousePoint,
  getTouchPoints
} from '../gui/generic';
import {ScrollWheel} from './scrollWheel';

// doc imports
/* eslint-disable no-unused-vars */
import {App} from '../app/application';
import {Point2D} from '../math/point';
/* eslint-enable no-unused-vars */

/**
 * Scroll class.
 *
 * @example
 * // create the dwv app
 * const app = new dwv.App();
 * // initialise
 * const viewConfig0 = new dwv.ViewConfig('layerGroup0');
 * const viewConfigs = {'*': [viewConfig0]};
 * const options = new dwv.AppOptions(viewConfigs);
 * options.tools = {Scroll: new dwv.ToolConfig()};
 * app.init(options);
 * // activate tool
 * app.addEventListener('load', function () {
 *   app.setTool('Scroll');
 * });
 * // load dicom data
 * app.loadURLs([
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323851.dcm',
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323707.dcm',
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323563.dcm'
 * ]);
 * @example <caption>Example with slider</caption>
 * // create the dwv app
 * const app = new dwv.App();
 * // initialise
 * const viewConfig0 = new dwv.ViewConfig('layerGroup0');
 * const viewConfigs = {'*': [viewConfig0]};
 * const options = new dwv.AppOptions(viewConfigs);
 * options.tools = {Scroll: new dwv.ToolConfig()};
 * app.init(options);
 * // create range
 * const range = document.createElement('input');
 * range.type = 'range';
 * range.min = 0;
 * range.id = 'sliceRange';
 * document.body.appendChild(range);
 * // update app on slider change
 * range.oninput = function () {
 *   const lg = app.getLayerGroupByDivId('layerGroup0');
 *   const vc = lg.getActiveViewLayer().getViewController();
 *   const index = vc.getCurrentIndex();
 *   const values = index.getValues();
 *   values[2] = this.value;
 *   vc.setCurrentIndex(new dwv.Index(values));
 * }
 * // activate tool and update range max on load
 * app.addEventListener('load', function () {
 *   app.setTool('Scroll');
 *   const size = app.getImage(0).getGeometry().getSize();
 *   range.max = size.get(2) - 1;
 * });
 * // update slider on slice change (for ex via mouse wheel)
 * app.addEventListener('positionchange', function () {
 *   const lg = app.getLayerGroupByDivId('layerGroup0');
 *   const vc = lg.getActiveViewLayer().getViewController();
 *   range.value = vc.getCurrentIndex().get(2);
 * });
 * // load dicom data
 * app.loadURLs([
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323851.dcm',
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323707.dcm',
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323563.dcm'
 * ]);
 */
export class Scroll {
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
   * Touch timer ID (created by setTimeout).
   *
   * @type {number}
   */
  _touchTimerID;

  /**
   * Option to show or not a value tooltip on mousemove.
   *
   * @type {boolean}
   */
  _displayTooltip = false;

  /**
   * Current layer group div id.
   *
   * @type {string}
   */
  _currentDivId;

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
   * @param {string} divId The layer group divId.
   */
  _start(point, divId) {
    // optional tooltip
    this._removeTooltipDiv();

    // stop viewer if playing
    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const viewController = viewLayer.getViewController();
    if (viewController.isPlaying()) {
      viewController.stop();
    }

    // start flag
    this._started = true;
    this._startPoint = point;

    // update controller position
    const planePos = viewLayer.displayToPlanePos(point);
    const position = viewController.getPositionFromPlanePoint(planePos);
    viewController.setCurrentPosition(position);
  }

  /**
   * Update tool interaction.
   *
   * @param {Point2D} point The update point.
   * @param {string} divId The layer group divId.
   */
  _update(point, divId) {
    if (!this._started) {
      // optional tooltip
      if (this._displayTooltip) {
        this._showTooltip(point, divId);
      }
      return;
    }

    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const viewController = viewLayer.getViewController();

    let newPosition;

    // difference to last Y position
    const diffY = point.getY() - this._startPoint.getY();
    const yMove = (Math.abs(diffY) > 15);
    // do not trigger for small moves
    if (yMove && layerGroup.canScroll()) {
      // update view controller
      if (diffY > 0) {
        newPosition = viewController.getDecrementScrollPosition();
      } else {
        newPosition = viewController.getIncrementScrollPosition();
      }
    }

    // difference to last X position
    const diffX = point.getX() - this._startPoint.getX();
    const xMove = (Math.abs(diffX) > 15);
    // do not trigger for small moves
    if (xMove && layerGroup.moreThanOne(3)) {
      // update view controller
      if (diffX > 0) {
        newPosition = viewController.getIncrementPosition(3);
      } else {
        newPosition = viewController.getDecrementPosition(3);
      }
    }

    // set all layers if at least one can be set
    if (typeof newPosition !== 'undefined' &&
      layerGroup.isPositionInBounds(newPosition)) {
      viewController.setCurrentPosition(newPosition);
    }

    // reset origin point
    if (xMove || yMove) {
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
    const layerDetails = getLayerDetailsFromEvent(event);
    this._start(mousePoint, layerDetails.groupDivId);
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
    // remove possible tooltip div
    this._removeTooltipDiv();
  };

  /**
   * Handle touch start event.
   *
   * @param {object} event The touch start event.
   */
  touchstart = (event) => {
    // long touch triggers the dblclick
    // @ts-ignore
    this._touchTimerID = setTimeout(() => {
      this.dblclick(event);
    }, 500);
    // call start
    const touchPoints = getTouchPoints(event);
    const layerDetails = getLayerDetailsFromEvent(event);
    this._start(touchPoints[0], layerDetails.groupDivId);
  };

  /**
   * Handle touch move event.
   *
   * @param {object} event The touch move event.
   */
  touchmove = (event) => {
    // abort timer if move
    if (this._touchTimerID !== null) {
      clearTimeout(this._touchTimerID);
      this._touchTimerID = null;
    }
    // call update
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
    // abort timer
    if (this._touchTimerID !== null) {
      clearTimeout(this._touchTimerID);
      this._touchTimerID = null;
    }
    // call mouse equivalent
    this._finish();
  };

  /**
   * Handle mouse wheel event.
   *
   * @param {WheelEvent} event The mouse wheel event.
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
    event.context = 'Scroll';
    this._app.onKeydown(event);
  };

  /**
   * Handle double click.
   *
   * @param {object} event The key down event.
   */
  dblclick = (event) => {
    const layerDetails = getLayerDetailsFromEvent(event);

    const layerGroup = this._app.getLayerGroupByDivId(layerDetails.groupDivId);
    const viewController =
      layerGroup.getActiveViewLayer().getViewController();
    viewController.play();
  };

  /**
   * Display a tooltip at the given point.
   *
   * @param {Point2D} point The update point.
   * @param {string} divId The layer group divId.
   */
  _showTooltip(point, divId) {
    // get layer group
    const layerGroup = this._app.getLayerGroupByDivId(divId);
    this._currentDivId = divId;
    // show new tooltip
    layerGroup.showTooltip(point);
  }

  /**
   * Remove the last tooltip html div.
   */
  _removeTooltipDiv() {
    if (typeof this._currentDivId !== 'undefined') {
      const layerGroup = this._app.getLayerGroupByDivId(this._currentDivId);
      layerGroup.removeTooltipDiv();
      this._currentDivId = undefined;
    }
  }

  /**
   * Activate the tool.
   *
   * @param {boolean} _bool The flag to activate or not.
   */
  activate(_bool) {
    // remove tooltip html when deactivating
    if (!_bool) {
      this._removeTooltipDiv();
    }
  }

  /**
   * Set the tool live features: disaply tooltip.
   *
   * @param {object} features The list of features.
   */
  setFeatures(features) {
    if (typeof features.displayTooltip !== 'undefined') {
      this._displayTooltip = features.displayTooltip;
    }
  }

  /**
   * Initialise the tool.
   */
  init() {
    // does nothing
  }

} // Scroll class
