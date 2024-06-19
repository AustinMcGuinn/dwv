import {logger} from '../utils/logger';
import {getShapeDisplayName, ChangeGroupCommand} from './drawCommands';
import {validateAnchorPosition} from './draw';
// external
import Konva from 'konva';

// doc imports
/* eslint-disable no-unused-vars */
import {App} from '../app/application';
import {ViewController} from '../app/viewController';
import {DrawLayer} from '../gui/drawLayer';
import {Style} from '../gui/style';
/* eslint-enable no-unused-vars */

/**
 * Get the default anchor shape.
 *
 * @param {number} x The X position.
 * @param {number} y The Y position.
 * @param {string} id The shape id.
 * @param {Style} style The application style.
 * @returns {Konva.Ellipse} The default anchor shape.
 */
export function getDefaultAnchor(x, y, id, style) {
  const radius = style.applyZoomScale(3);
  const absRadius = {
    x: Math.abs(radius.x),
    y: Math.abs(radius.y)
  };
  return new Konva.Ellipse({
    x: x,
    y: y,
    stroke: '_999',
    fill: 'rgba(100,100,100,0.7',
    strokeWidth: style.getStrokeWidth(),
    strokeScaleEnabled: false,
    radius: absRadius,
    radiusX: absRadius.x,
    radiusY: absRadius.y,
    name: 'anchor',
    id: id.toString(),
    dragOnTop: false,
    draggable: true,
    visible: false
  });
}

/**
 * Shape editor.
 */
export class ShapeEditor {

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
   * Shape factory list.
   *
   * @type {object}
   */
  _shapeFactoryList = null;

  /**
   * Current shape factory.
   *
   * @type {object}
   */
  _currentFactory = null;

  /**
   * Edited shape.
   *
   * @type {Konva.Shape}
   */
  _shape = null;

  /**
   * Associated draw layer. Used to bound anchor move.
   *
   * @type {DrawLayer}
   */
  _drawLayer;

  /**
   * Associated view controller. Used for quantification update.
   *
   * @type {ViewController}
   */
  _viewController = null;

  /**
   * Active flag.
   *
   * @type {boolean}
   */
  _isActive = false;

  /**
   * @callback eventFn
   * @param {object} event The event.
   */

  /**
   * Draw event callback.
   *
   * @type {eventFn}
   */
  _drawEventCallback = null;

  /**
   * Set the tool options.
   *
   * @param {Array} list The list of shape classes.
   */
  setFactoryList(list) {
    this._shapeFactoryList = list;
  }

  /**
   * Set the shape to edit.
   *
   * @param {Konva.Shape} inshape The shape to edit.
   * @param {DrawLayer} drawLayer The associated draw layer.
   * @param {ViewController} viewController The associated view controller.
   */
  setShape(inshape, drawLayer, viewController) {
    this._shape = inshape;
    this._drawLayer = drawLayer;
    this._viewController = viewController;
    if (this._shape) {
      // remove old anchors
      this._removeAnchors();
      // find a factory for the input shape
      const group = this._shape.getParent();
      const keys = Object.keys(this._shapeFactoryList);
      this._currentFactory = null;
      for (let i = 0; i < keys.length; ++i) {
        const factory = new this._shapeFactoryList[keys[i]];
        if (factory.isFactoryGroup(group)) {
          this._currentFactory = factory;
          // stop at first find
          break;
        }
      }
      if (this._currentFactory === null) {
        throw new Error('Could not find a factory to update shape.');
      }
      // add new anchors
      this._addAnchors();
    }
  }

  /**
   * Get the edited shape.
   *
   * @returns {Konva.Shape} The edited shape.
   */
  getShape() {
    return this._shape;
  }

  /**
   * Get the active flag.
   *
   * @returns {boolean} The active flag.
   */
  isActive() {
    return this._isActive;
  }

  /**
   * Set the draw event callback.
   *
   * @param {eventFn} callback The callback.
   */
  setDrawEventCallback(callback) {
    this._drawEventCallback = callback;
  }

  /**
   * Enable the editor. Redraws the layer.
   */
  enable() {
    this._isActive = true;
    if (this._shape) {
      this._setAnchorsVisible(true);
      if (this._shape.getLayer()) {
        this._shape.getLayer().draw();
      }
    }
  }

  /**
   * Disable the editor. Redraws the layer.
   */
  disable() {
    this._isActive = false;
    if (this._shape) {
      this._setAnchorsVisible(false);
      if (this._shape.getLayer()) {
        this._shape.getLayer().draw();
      }
    }
  }

  /**
   * Reset the editor.
   */
  reset() {
    this._shape = undefined;
    this._drawLayer = undefined;
    this._viewController = undefined;
  }

  /**
   * Reset the anchors.
   */
  resetAnchors() {
    // remove previous controls
    this._removeAnchors();
    // add anchors
    this._addAnchors();
    // set them visible
    this._setAnchorsVisible(true);
  }

  /**
   * Apply a function on all anchors.
   *
   * @param {object} func A f(shape) function.
   */
  _applyFuncToAnchors(func) {
    if (this._shape && this._shape.getParent()) {
      const anchors = this._shape.getParent().find('.anchor');
      anchors.forEach(func);
    }
  }

  /**
   * Set anchors visibility.
   *
   * @param {boolean} flag The visible flag.
   */
  _setAnchorsVisible(flag) {
    this._applyFuncToAnchors(function (anchor) {
      anchor.visible(flag);
    });
  }

  /**
   * Set anchors active.
   *
   * @param {boolean} flag The active (on/off) flag.
   */
  setAnchorsActive(flag) {
    let func = null;
    if (flag) {
      func = (anchor) => {
        this._setAnchorOn(anchor);
      };
    } else {
      func = (anchor) => {
        this._setAnchorOff(anchor);
      };
    }
    this._applyFuncToAnchors(func);
  }

  /**
   * Remove anchors.
   */
  _removeAnchors() {
    this._applyFuncToAnchors(function (anchor) {
      anchor.remove();
    });
  }

  /**
   * Add the shape anchors.
   */
  _addAnchors() {
    // exit if no shape or no layer
    if (!this._shape || !this._shape.getLayer()) {
      return;
    }
    // get shape group
    const group = this._shape.getParent();

    // activate and add anchors to group
    const anchors =
      this._currentFactory.getAnchors(this._shape, this._app.getStyle());
    for (let i = 0; i < anchors.length; ++i) {
      // set anchor on
      this._setAnchorOn(anchors[i]);
      // add the anchor to the group
      group.add(anchors[i]);
    }
  }

  /**
   * Get a simple clone of the input anchor.
   *
   * @param {Konva.Shape} anchor The anchor to clone.
   * @returns {object} A clone of the input anchor.
   */
  _getClone(anchor) {
    // create closure to properties
    const parent = anchor.getParent();
    const id = anchor.id();
    const x = anchor.x();
    const y = anchor.y();
    // create clone object
    const clone = {};
    clone.getParent = function () {
      return parent;
    };
    clone.id = function () {
      return id;
    };
    clone.x = function () {
      return x;
    };
    clone.y = function () {
      return y;
    };
    return clone;
  }

  /**
   * Set the anchor on listeners.
   *
   * @param {Konva.Ellipse} anchor The anchor to set on.
   */
  _setAnchorOn(anchor) {
    let startAnchor = null;

    // command name based on shape type
    const shapeDisplayName = getShapeDisplayName(this._shape);

    // drag start listener
    anchor.on('dragstart.edit', (event) => {
      const anchor = event.target;
      if (!(anchor instanceof Konva.Shape)) {
        return;
      }
      startAnchor = this._getClone(anchor);
      // prevent bubbling upwards
      event.cancelBubble = true;
    });
    // drag move listener
    anchor.on('dragmove.edit', (event) => {
      const anchor = event.target;
      if (!(anchor instanceof Konva.Shape)) {
        return;
      }
      // validate the anchor position
      validateAnchorPosition(this._drawLayer.getBaseSize(), anchor);
      // update shape
      this._currentFactory.update(
        anchor, this._app.getStyle(), this._viewController);
      // redraw
      if (anchor.getLayer()) {
        anchor.getLayer().draw();
      } else {
        logger.warn('No layer to draw the anchor!');
      }
      // prevent bubbling upwards
      event.cancelBubble = true;
    });
    // drag end listener
    anchor.on('dragend.edit', (event) => {
      const anchor = event.target;
      if (!(anchor instanceof Konva.Shape)) {
        return;
      }
      const endAnchor = this._getClone(anchor);
      // store the change command
      const chgcmd = new ChangeGroupCommand(
        shapeDisplayName,
        this._currentFactory,
        startAnchor,
        endAnchor,
        this._drawLayer,
        this._viewController,
        this._app.getStyle()
      );
      chgcmd.onExecute = this._drawEventCallback;
      chgcmd.onUndo = this._drawEventCallback;
      chgcmd.execute();
      this._app.addToUndoStack(chgcmd);
      // reset start anchor
      startAnchor = endAnchor;
      // prevent bubbling upwards
      event.cancelBubble = true;
    });
    // mouse down listener
    anchor.on('mousedown touchstart', (event) => {
      const anchor = event.target;
      anchor.moveToTop();
    });
    // mouse over styling
    anchor.on('mouseover.edit', (event) => {
      const anchor = event.target;
      if (!(anchor instanceof Konva.Shape)) {
        return;
      }
      // style is handled by the group
      anchor.stroke('_ddd');
      if (anchor.getLayer()) {
        anchor.getLayer().draw();
      } else {
        logger.warn('No layer to draw the anchor!');
      }
    });
    // mouse out styling
    anchor.on('mouseout.edit', (event) => {
      const anchor = event.target;
      if (!(anchor instanceof Konva.Shape)) {
        return;
      }
      // style is handled by the group
      anchor.stroke('_999');
      if (anchor.getLayer()) {
        anchor.getLayer().draw();
      } else {
        logger.warn('No layer to draw the anchor!');
      }
    });
  }

  /**
   * Set the anchor off listeners.
   *
   * @param {Konva.Ellipse} anchor The anchor to set off.
   */
  _setAnchorOff(anchor) {
    anchor.off('dragstart.edit');
    anchor.off('dragmove.edit');
    anchor.off('dragend.edit');
    anchor.off('mousedown touchstart');
    anchor.off('mouseover.edit');
    anchor.off('mouseout.edit');
  }

} // class Editor
