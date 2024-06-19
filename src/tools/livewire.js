import {Style} from '../gui/style';
import {
  getMousePoint,
  getTouchPoints
} from '../gui/generic';
import {Point2D} from '../math/point';
import {Path} from '../math/path';
import {Scissors} from '../math/scissors';
import {guid} from '../math/stats';
import {getLayerDetailsFromEvent} from '../gui/layerGroup';
import {ListenerHandler} from '../utils/listen';
import {RoiFactory} from '../tools/roi';
import {DrawGroupCommand} from '../tools/drawCommands';

// doc imports
/* eslint-disable no-unused-vars */
import {App} from '../app/application';
/* eslint-enable no-unused-vars */

/**
 * Livewire painting tool.
 */
export class Livewire {
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
   * Drawing style.
   *
   * @type {Style}
   */
  _style = new Style();

  /**
   * Path storage. Paths are stored in reverse order.
   *
   * @type {Path}
   */
  _path = new Path();

  /**
   * Current path storage. Paths are stored in reverse order.
   *
   * @type {Path}
   */
  _currentPath = new Path();

  /**
   * List of parent points.
   *
   * @type {Array}
   */
  _parentPoints = [];

  /**
   * Tolerance.
   *
   * @type {number}
   */
  _tolerance = 5;

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Clear the parent points list.
   *
   * @param {object} imageSize The image size.
   */
  _clearParentPoints(imageSize) {
    const nrows = imageSize.get(1);
    for (let i = 0; i < nrows; ++i) {
      this._parentPoints[i] = [];
    }
  }

  /**
   * Clear the stored paths.
   */
  _clearPaths() {
    this._path = new Path();
    this._currentPath = new Path();
  }

  /**
   * Scissor representation.
   *
   * @type {Scissors}
   */
  _scissors = new Scissors();

  /**
   * Start tool interaction.
   *
   * @param {Point2D} point The start point.
   * @param {string} divId The layer group divId.
   */
  _start(point, divId) {
    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const imageSize = viewLayer.getViewController().getImageSize();
    const index = viewLayer.displayToPlaneIndex(point);

    // first time
    if (!this._started) {
      this._started = true;
      this._startPoint = new Point2D(index.get(0), index.get(1));
      // clear vars
      this._clearPaths();
      this._clearParentPoints(imageSize);
      this._shapeGroup = null;
      // update zoom scale
      const drawLayer = layerGroup.getActiveDrawLayer();
      this._style.setZoomScale(
        drawLayer.getKonvaLayer().getAbsoluteScale());
      // do the training from the first point
      const p = {x: index.get(0), y: index.get(1)};
      this._scissors.doTraining(p);
      // add the initial point to the path
      const p0 = new Point2D(index.get(0), index.get(1));
      this._path.addPoint(p0);
      this._path.addControlPoint(p0);
    } else {
      const diffX = Math.abs(index.get(0) - this._startPoint.getX());
      const diffY = Math.abs(index.get(1) - this._startPoint.getY());
      // final point: at 'tolerance' of the initial point
      if (diffX < this._tolerance &&
        diffY < this._tolerance) {
        // finish
        this._finishShape();
      } else {
        // anchor point
        this._path = this._currentPath;
        this._clearParentPoints(imageSize);
        const pn = {x: index.get(0), y: index.get(1)};
        this._scissors.doTraining(pn);
        this._path.addControlPoint(this._currentPath.getPoint(0));
      }
    }
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
    const layerGroup = this._app.getLayerGroupByDivId(divId);
    const viewLayer = layerGroup.getActiveViewLayer();
    const index = viewLayer.displayToPlaneIndex(point);

    // set the point to find the path to
    let p = {x: index.get(0), y: index.get(1)};
    this._scissors.setPoint(p);
    // do the work
    let results = [];
    let stop = false;
    while (!this._parentPoints[p.y][p.x] && !stop) {
      results = this._scissors.doWork();

      if (results.length === 0) {
        stop = true;
      } else {
        // fill parents
        for (let i = 0; i < results.length - 1; i += 2) {
          const _p = results[i];
          const _q = results[i + 1];
          this._parentPoints[_p.y][_p.x] = _q;
        }
      }
    }

    // get the path
    this._currentPath = new Path();
    stop = false;
    while (p && !stop) {
      this._currentPath.addPoint(new Point2D(p.x, p.y));
      if (!this._parentPoints[p.y]) {
        stop = true;
      } else {
        if (!this._parentPoints[p.y][p.x]) {
          stop = true;
        } else {
          p = this._parentPoints[p.y][p.x];
        }
      }
    }
    this._currentPath.appenPath(this._path);

    // remove previous draw
    if (this._shapeGroup) {
      this._shapeGroup.destroy();
    }
    // create shape
    const factory = new RoiFactory();
    this._shapeGroup = factory.create(
      this._currentPath.pointArray, this._style);
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
      'livewire',
      drawLayer
    );
    // draw
    this._command.execute();
  }

  /**
   * Finish a livewire (roi) shape.
   */
  _finishShape() {
    // fire creation event (was not propagated during draw)
    this._fireEvent({
      type: 'drawcreate',
      id: this._shapeGroup.id()
    });
    // listen
    this._command.onExecute = this._fireEvent;
    this._command.onUndo = this._fireEvent;
    // save command in undo stack
    this._app.addToUndoStack(this._command);
    // set flag
    this._started = false;
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
  mouseup(_event) {
    // nothing to do
  }

  /**
   * Handle mouse out event.
   *
   * @param {object} _event The mouse out event.
   */
  mouseout = (_event) => {
    // nothing to do
  };

  /**
   * Handle double click event.
   *
   * @param {object} _event The double click event.
   */
  dblclick = (_event) => {
    this._finishShape();
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
    // nothing to do
  };

  /**
   * Handle key down event.
   *
   * @param {object} event The key down event.
   */
  keydown = (event) => {
    event.context = 'Livewire';
    this._app.onKeydown(event);
  };

  /**
   * Activate the tool.
   *
   * @param {boolean} bool The flag to activate or not.
   */
  activate(bool) {
    // start scissors if displayed
    if (bool) {
      const layerGroup = this._app.getActiveLayerGroup();
      const viewLayer = layerGroup.getActiveViewLayer();

      //scissors = new Scissors();
      const imageSize = viewLayer.getViewController().getImageSize();
      this._scissors.setDimensions(
        imageSize.get(0),
        imageSize.get(1));
      this._scissors.setData(viewLayer.getImageData().data);

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
   *    event type, will be called with the fired event.
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

} // Livewire class
