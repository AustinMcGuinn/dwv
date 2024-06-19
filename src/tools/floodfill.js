import {DrawGroupCommand} from '../tools/drawCommands';
import {RoiFactory} from '../tools/roi';
import {guid} from '../math/stats';
import {Point2D} from '../math/point';
import {Style} from '../gui/style';
import {
  getMousePoint,
  getTouchPoints
} from '../gui/generic';
import {getLayerDetailsFromEvent} from '../gui/layerGroup';
import {ListenerHandler} from '../utils/listen';
import {logger} from '../utils/logger';

// doc imports
/* eslint-disable no-unused-vars */
import {App} from '../app/application';
import {LayerGroup} from '../gui/layerGroup';
import {Scalar2D} from '../math/scalar';
/* eslint-enable no-unused-vars */

/**
 * The magic wand namespace.
 *
 * Ref: {@link https://github.com/Tamersoul/magic-wand-js}.
 *
 * @external MagicWand
 */
import MagicWand from 'magic-wand-tool';

/**
 * Floodfill painting tool.
 */
export class Floodfill {
  /**
   * Associated app.
   *
   * @type {App}
   */
  _app;

  /**
   * @param {App} app The associated application.
   */
  constructor(app) {
    this._app = app;
  }

  /**
   * Original variables from external library. Used as in the lib example.
   *
   * @type {number}
   */
  _blurRadius = 5;
  /**
   * Original variables from external library. Used as in the lib example.
   *
   * @type {number}
   */
  _simplifyTolerant = 0;

  /**
   * Original variables from external library. Used as in the lib example.
   *
   * @type {number}
   */
  _simplifyCount = 2000;

  /**
   * Canvas info.
   *
   * @type {object}
   */
  _imageInfo = null;

  /**
   * Object created by MagicWand lib containing border points.
   *
   * @type {object}
   */
  _mask = null;

  /**
   * Threshold default tolerance of the tool border.
   *
   * @type {number}
   */
  _initialthreshold = 10;

  /**
   * Threshold tolerance of the tool border.
   *
   * @type {number}
   */
  _currentthreshold = null;

  /**
   * Interaction start flag.
   *
   * @type {boolean}
   */
  _started = false;
  /**
   * Draw command.
   *
   * @type {object}
   */
  _command = null;

  /**
   * Current shape group.
   *
   * @type {object}
   */
  _shapeGroup = null;

  /**
   * Coordinates of the fist mousedown event.
   *
   * @type {object}
   */
  _initialpoint;

  /**
   * Floodfill border.
   *
   * @type {object}
   */
  _border = null;

  /**
   * List of parent points.
   *
   * @type {Array}
   */
  _parentPoints = [];

  /**
   * Assistant variable to paint border on all slices.
   *
   * @type {boolean}
   */
  _extender = false;

  /**
   * Timeout for painting on mousemove.
   *
   */
  _painterTimeout;

  /**
   * Drawing style.
   *
   * @type {Style}
   */
  _style = new Style();

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Set extend option for painting border on all slices.
   *
   * @param {boolean} bool The option to set.
   */
  setExtend(bool) {
    this._extender = bool;
  }

  /**
   * Get extend option for painting border on all slices.
   *
   * @returns {boolean} The actual value of of the variable to use Floodfill
   *   on museup.
   */
  getExtend() {
    return this._extender;
  }

  /**
   * Get (x, y) coordinates referenced to the canvas.
   *
   * @param {Point2D} point The start point.
   * @param {string} divId The layer group divId.
   * @returns {Scalar2D} The coordinates as a {x,y}.
   */
  _getIndex = (point, divId) => {
    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const index = viewLayer.displayToPlaneIndex(point);
    return {
      x: index.get(0),
      y: index.get(1)
    };
  };

  /**
   * Calculate border.
   *
   * @param {object} points The input points.
   * @param {number} threshold The threshold of the floodfill.
   * @param {boolean} simple Return first points or a list.
   * @returns {Array} The parent points.
   */
  _calcBorder(points, threshold, simple) {

    this._parentPoints = [];
    const image = {
      data: this._imageInfo.data,
      width: this._imageInfo.width,
      height: this._imageInfo.height,
      bytes: 4
    };

    this._mask = MagicWand.floodFill(image, points.x, points.y, threshold);
    this._mask = MagicWand.gaussBlurOnlyBorder(this._mask, this._blurRadius);

    let cs = MagicWand.traceContours(this._mask);
    cs = MagicWand.simplifyContours(
      cs, this._simplifyTolerant, this._simplifyCount);

    if (cs.length > 0 && cs[0].points[0].x) {
      if (simple) {
        return cs[0].points;
      }
      for (let j = 0, icsl = cs[0].points.length; j < icsl; j++) {
        this._parentPoints.push(new Point2D(
          cs[0].points[j].x,
          cs[0].points[j].y
        ));
      }
      return this._parentPoints;
    } else {
      return [];
    }
  }

  /**
   * Paint Floodfill.
   *
   * @param {object} point The start point.
   * @param {number} threshold The border threshold.
   * @param {LayerGroup} layerGroup The origin layer group.
   * @returns {boolean} False if no border.
   */
  _paintBorder(point, threshold, layerGroup) {
    // Calculate the border
    this._border = this._calcBorder(point, threshold, false);
    // Paint the border
    if (this._border) {
      const factory = new RoiFactory();
      this._shapeGroup = factory.create(this._border, this._style);
      this._shapeGroup.id(guid());

      const drawLayer = layerGroup.getActiveDrawLayer();
      const drawController = drawLayer.getDrawController();

      // get the position group
      const posGroup = drawController.getCurrentPosGroup();
      // add shape group to position group
      posGroup.add(this._shapeGroup);

      // draw shape command
      this._command = new DrawGroupCommand(
        this._shapeGroup,
        'floodfill',
        drawLayer
      );
      this._command.onExecute = this._fireEvent;
      this._command.onUndo = this._fireEvent;
      // // draw
      this._command.execute();
      // save it in undo stack
      this._app.addToUndoStack(this._command);

      return true;
    } else {
      return false;
    }
  }

  /**
   * Create Floodfill in all the prev and next slices while border is found.
   *
   * @param {number} ini The first slice to extend to.
   * @param {number} end The last slice to extend to.
   * @param {object} layerGroup The origin layer group.
   */
  extend(ini, end, layerGroup) {
    //avoid errors
    if (!this._initialpoint) {
      throw '\'initialpoint\' not found. User must click before use extend!';
    }
    // remove previous draw
    if (this._shapeGroup) {
      this._shapeGroup.destroy();
    }

    const viewController =
      layerGroup.getActiveViewLayer().getViewController();

    const pos = viewController.getCurrentIndex();
    const imageSize = viewController.getImageSize();
    const threshold = this._currentthreshold || this._initialthreshold;

    // Iterate over the next images and paint border on each slice.
    for (let i = pos.get(2),
      len = end
        ? end : imageSize.get(2);
      i < len; i++) {
      if (!this._paintBorder(this._initialpoint, threshold, layerGroup)) {
        break;
      }
      viewController.incrementIndex(2);
    }
    viewController.setCurrentPosition(pos);

    // Iterate over the prev images and paint border on each slice.
    for (let j = pos.get(2), jl = ini ? ini : 0; j > jl; j--) {
      if (!this._paintBorder(this._initialpoint, threshold, layerGroup)) {
        break;
      }
      viewController.decrementIndex(2);
    }
    viewController.setCurrentPosition(pos);
  }

  /**
   * Modify tolerance threshold and redraw ROI.
   *
   * @param {number} modifyThreshold The new threshold.
   * @param {object} shape The shape to update.
   */
  modifyThreshold(modifyThreshold, shape) {

    if (!shape && this._shapeGroup) {
      shape = this._shapeGroup.getChildren(function (node) {
        return node.name() === 'shape';
      })[0];
    } else {
      throw 'No shape found';
    }

    clearTimeout(this._painterTimeout);
    this._painterTimeout = setTimeout(() => {
      this._border = this._calcBorder(
        this._initialpoint, modifyThreshold, true);
      if (!this._border) {
        return false;
      }
      const arr = [];
      for (let i = 0, bl = this._border.length; i < bl; ++i) {
        arr.push(this._border[i].x);
        arr.push(this._border[i].y);
      }
      shape.setPoints(arr);
      const shapeLayer = shape.getLayer();
      shapeLayer.draw();
      this.onThresholdChange(modifyThreshold);
    }, 100);
  }

  /**
   * Event fired when threshold change.
   *
   * @param {number} _value Current threshold.
   */
  onThresholdChange(_value) {
    // Defaults do nothing
  }

  /**
   * Start tool interaction.
   *
   * @param {Point2D} point The start point.
   * @param {string} divId The layer group divId.
   */
  _start(point, divId) {
    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const drawLayer = layerGroup.getActiveDrawLayer();

    this._imageInfo = viewLayer.getImageData();
    if (!this._imageInfo) {
      logger.error('No image found');
      return;
    }

    // update zoom scale
    this._style.setZoomScale(
      drawLayer.getKonvaLayer().getAbsoluteScale());

    this._started = true;
    this._initialpoint = this._getIndex(point, divId);
    this._paintBorder(this._initialpoint, this._initialthreshold, layerGroup);
    this.onThresholdChange(this._initialthreshold);
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

    const movedpoint = this._getIndex(point, divId);
    this._currentthreshold = Math.round(Math.sqrt(
      Math.pow((this._initialpoint.x - movedpoint.x), 2) +
      Math.pow((this._initialpoint.y - movedpoint.y), 2)) / 2);
    this._currentthreshold = this._currentthreshold < this._initialthreshold
      ? this._initialthreshold
      : this._currentthreshold - this._initialthreshold;
    this.modifyThreshold(this._currentthreshold);
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
    // TODO: re-activate
    // if (this._extender) {
    //   const layerDetails = getLayerDetailsFromEvent(event);
    //   const layerGroup =
    //     this._app.getLayerGroupByDivId(layerDetails.groupDivId);
    //   this.extend(layerGroup);
    // }
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
    const layerDetails = getLayerDetailsFromEvent(event);
    this._start(touchPoints[0], layerDetails.groupDivId);
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
   * Handle key down event.
   *
   * @param {object} event The key down event.
   */
  keydown = (event) => {
    event.context = 'Floodfill';
    this._app.onKeydown(event);
  };

  /**
   * Activate the tool.
   *
   * @param {boolean} bool The flag to activate or not.
   */
  activate(bool) {
    if (bool) {
      // init with the app window scale
      this._style.setBaseScale(this._app.getBaseScale());
      // set the default to the first in the list
      this.setFeatures({shapeColour: this._style.getLineColour()});
    }
  }

  /**
   * Initialise the tool.
   */
  init() {
    // does nothing
  }

  /**
   * Get the list of event names that this tool can fire.
   *
   * @returns {Array} The list of event names.
   */
  getEventNames() {
    return ['drawcreate', 'drawchange', 'drawmove', 'drawdelete'];
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {Function} callback The function associated with the provided
   *   event type, will be called with the fired event.
   */
  addEventListener(type, callback) {
    this._listenerHandler.add(type, callback);
  }

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {Function} callback The function associated with the provided
   *   event type.
   */
  removeEventListener(type, callback) {
    this._listenerHandler.remove(type, callback);
  }

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   */
  _fireEvent = (event) => {
    this._listenerHandler.fireEvent(event);
  };

  /**
   * Set the tool live features: shape colour.
   *
   * @param {object} features The list of features.
   */
  setFeatures(features) {
    if (typeof features.shapeColour !== 'undefined') {
      this._style.setLineColour(features.shapeColour);
    }
  }

} // Floodfill class
