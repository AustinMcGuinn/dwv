import {Point2D} from '../math/point';
import {Line} from '../math/line';
import {getLayerDetailsFromEvent} from '../gui/layerGroup';
import {
  getMousePoint,
  getTouchPoints
} from '../gui/generic';

// doc imports
/* eslint-disable no-unused-vars */
import {App} from '../app/application';
/* eslint-enable no-unused-vars */

/**
 * ZoomAndPan class.
 *
 * @example
 * // create the dwv app
 * const app = new dwv.App();
 * // initialise
 * const viewConfig0 = new dwv.ViewConfig('layerGroup0');
 * const viewConfigs = {'*': [viewConfig0]};
 * const options = new dwv.AppOptions(viewConfigs);
 * options.tools = {ZoomAndPan: new dwv.ToolConfig()};
 * app.init(options);
 * // activate tool
 * app.addEventListener('load', function () {
 *   app.setTool('ZoomAndPan');
 * });
 * // load dicom data
 * app.loadURLs([
 *   'https://raw.githubusercontent.com/ivmartel/dwv/master/tests/data/bbmri-53323851.dcm'
 * ]);
 */
export class ZoomAndPan {

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
   * Move flag: true if mouse or touch move.
   *
   * @type {boolean}
   */
  _hasMoved;

  /**
   * Line between input points.
   *
   * @type {Line}
   */
  _pointsLine;

  /**
   * PointsLine midpoint.
   *
   * @type {Point2D}
   */
  _midPoint;

  /**
   * @param {App} app The associated application.
   */
  constructor(app) {
    this._app = app;
  }

  /**
   * Start tool interaction.
   *
   * @param {Point2D} point The start point.
   */
  _start(point) {
    this._started = true;
    this._startPoint = point;
    this._hasMoved = false;
  }

  /**
   * Two touch start.
   *
   * @param {Point2D[]} points The start points.
   */
  _twoTouchStart = (points) => {
    this._started = true;
    this._startPoint = points[0];
    this._hasMoved = false;
    // points line
    this._pointsLine = new Line(points[0], points[1]);
    this._midPoint = this._pointsLine.getMidpoint();
  };

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
    this._hasMoved = true;

    // calculate translation
    const tx = point.getX() - this._startPoint.getX();
    const ty = point.getY() - this._startPoint.getY();
    // apply translation
    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const viewController = viewLayer.getViewController();
    const planeOffset = viewLayer.displayToPlaneScale(
      new Point2D(tx, ty)
    );
    const offset3D = viewController.getOffset3DFromPlaneOffset({
      x: planeOffset.getX(),
      y: planeOffset.getY()
    });
    layerGroup.addTranslation({
      x: offset3D.getX(),
      y: offset3D.getY(),
      z: offset3D.getZ()
    });
    layerGroup.draw();
    // reset origin point
    this._startPoint = point;
  }

  /**
   * Two touch update.
   *
   * @param {Point2D[]} points The update points.
   * @param {string} divId The layer group divId.
   */
  _twoTouchUpdate = (points, divId) => {
    if (!this._started) {
      return;
    }
    this._hasMoved = true;

    const newLine = new Line(points[0], points[1]);
    const lineRatio = newLine.getLength() / this._pointsLine.getLength();

    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const viewController = viewLayer.getViewController();

    if (lineRatio === 1) {
      // scroll mode
      // difference  to last position
      const diffY = points[0].getY() - this._startPoint.getY();
      // do not trigger for small moves
      if (Math.abs(diffY) < 15) {
        return;
      }
      // update view controller
      if (layerGroup.canScroll()) {
        let newPosition;
        if (diffY > 0) {
          newPosition = viewController.getIncrementScrollPosition();
        } else {
          newPosition = viewController.getDecrementScrollPosition();
        }
        // set all layers if at least one can be set
        if (typeof newPosition !== 'undefined' &&
          layerGroup.isPositionInBounds(newPosition)) {
          viewController.setCurrentPosition(newPosition);
        }
      }
    } else {
      // zoom mode
      const zoom = (lineRatio - 1) / 10;
      if (Math.abs(zoom) % 0.1 <= 0.05 &&
        typeof this._midPoint !== 'undefined') {
        const planePos = viewLayer.displayToMainPlanePos(this._midPoint);
        const center = viewController.getPlanePositionFromPlanePoint(planePos);
        layerGroup.addScale(zoom, center);
        layerGroup.draw();
      }
    }
  };

  /**
   * Set the current position.
   *
   * @param {Point2D} point The update point.
   * @param {string} divId The layer group divId.
   */
  _setCurrentPosition(point, divId) {
    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const viewController = viewLayer.getViewController();
    const planePos = viewLayer.displayToPlanePos(point);
    const position = viewController.getPositionFromPlanePoint(planePos);
    viewController.setCurrentPosition(position);
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
   * @param {object} event The mouse up event.
   */
  mouseup = (event) => {
    // update position if no move
    if (!this._hasMoved) {
      const mousePoint = getMousePoint(event);
      const layerDetails = getLayerDetailsFromEvent(event);
      this._setCurrentPosition(mousePoint, layerDetails.groupDivId);
    }
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
    if (touchPoints.length === 1) {
      this._start(touchPoints[0]);
    } else if (touchPoints.length === 2) {
      this._twoTouchStart(touchPoints);
    }
  };

  /**
   * Handle touch move event.
   *
   * @param {object} event The touch move event.
   */
  touchmove = (event) => {
    const touchPoints = getTouchPoints(event);
    const layerDetails = getLayerDetailsFromEvent(event);
    if (touchPoints.length === 1) {
      this._update(touchPoints[0], layerDetails.groupDivId);
    } else if (touchPoints.length === 2) {
      this._twoTouchUpdate(touchPoints, layerDetails.groupDivId);
    }
  };

  /**
   * Handle touch end event.
   *
   * @param {object} event The touch end event.
   */
  touchend = (event) => {
    // update position if no move
    if (!this._hasMoved) {
      const mousePoint = getMousePoint(event);
      const layerDetails = getLayerDetailsFromEvent(event);
      this._setCurrentPosition(mousePoint, layerDetails.groupDivId);
    }
    this._finish();
  };

  /**
   * Handle mouse wheel event.
   *
   * @param {object} event The mouse wheel event.
   */
  wheel = (event) => {
    // prevent default page scroll
    event.preventDefault();

    const step = -event.deltaY / 500;

    const layerDetails = getLayerDetailsFromEvent(event);
    const mousePoint = getMousePoint(event);

    const layerGroup = this._app.getLayerGroupByDivId(layerDetails.groupDivId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const viewController = viewLayer.getViewController();
    const planePos = viewLayer.displayToMainPlanePos(mousePoint);
    const center = viewController.getPlanePositionFromPlanePoint(planePos);
    layerGroup.addScale(step, center);
    layerGroup.draw();
  };

  /**
   * Handle key down event.
   *
   * @param {object} event The key down event.
   */
  keydown = (event) => {
    event.context = 'ZoomAndPan';
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

} // ZoomAndPan class
