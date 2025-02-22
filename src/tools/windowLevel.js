import {ScrollWheel} from './scrollWheel';
import {
  getMousePoint,
  getTouchPoints
} from '../gui/generic';
import {getLayerDetailsFromEvent} from '../gui/layerGroup';
import {
  validateWindowWidth,
  WindowLevel as WindowLevelValues
} from '../image/windowLevel';

// doc imports
/* eslint-disable no-unused-vars */
import {App} from '../app/application';
import {Point2D} from '../math/point';
/* eslint-enable no-unused-vars */

/**
 * WindowLevel tool: handle window/level related events.
 *
 * @example
 * // create the dwv app
 * const app = new dwv.App();
 * // initialise
 * const viewConfig0 = new dwv.ViewConfig('layerGroup0');
 * const viewConfigs = {'*': [viewConfig0]};
 * const options = new dwv.AppOptions(viewConfigs);
 * options.tools = {WindowLevel: new dwv.ToolConfig()};
 * app.init(options);
 * // activate tool
 * app.addEventListener('load', function () {
 *   app.setTool('WindowLevel');
 * });
 * // load dicom data
 * app.loadURLs([
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323851.dcm'
 * ]);
 */
export class WindowLevel {

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
    // check start flag
    if (!this._started) {
      return;
    }

    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewController =
      layerGroup.getActiveViewLayer().getViewController();

    // difference to last position
    const diffX = point.getX() - this._startPoint.getX();
    const diffY = this._startPoint.getY() - point.getY();
    // data range
    const range = viewController.getImageRescaledDataRange();
    // 1/1000 seems to give reasonable results...
    const pixelToIntensity = (range.max - range.min) * 0.01;

    // calculate new window level
    const center = viewController.getWindowLevel().center;
    const width = viewController.getWindowLevel().width;
    const windowCenter = center + Math.round(diffY * pixelToIntensity);
    let windowWidth = width + Math.round(diffX * pixelToIntensity);
    // bound window width
    windowWidth = validateWindowWidth(windowWidth);
    // set
    const wl = new WindowLevelValues(windowCenter, windowWidth);
    viewController.setWindowLevel(wl);

    // store position
    this._startPoint = point;
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
   * Handle double click event.
   *
   * @param {object} event The double click event.
   */
  dblclick = (event) => {
    const layerDetails = getLayerDetailsFromEvent(event);
    const mousePoint = getMousePoint(event);

    const layerGroup = this._app.getLayerGroupByDivId(layerDetails.groupDivId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const index = viewLayer.displayToPlaneIndex(mousePoint);
    const viewController = viewLayer.getViewController();
    const image = this._app.getImage(viewLayer.getDataId());

    // update view controller
    const wl = new WindowLevelValues(
      image.getRescaledValueAtIndex(
        viewController.getCurrentIndex().getWithNew2D(
          index.get(0),
          index.get(1)
        )
      ),
      viewController.getWindowLevel().width
    );
    viewController.setWindowLevel(wl);
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
    event.context = 'WindowLevel';
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

} // WindowLevel class
