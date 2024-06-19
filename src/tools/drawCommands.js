// external
import Konva from 'konva';

// doc imports
/* eslint-disable no-unused-vars */
import {Style} from '../gui/style';
import {DrawLayer} from '../gui/drawLayer';
import {ViewController} from '../app/viewController';
import {Scalar2D} from '../math/scalar';
/* eslint-enable no-unused-vars */

/**
 * Get the display name of the input shape.
 *
 * @param {Konva.Shape} shape The Konva shape.
 * @returns {string} The display name.
 */
export function getShapeDisplayName(shape) {
  let displayName = 'shape';
  if (shape instanceof Konva.Line) {
    if (shape.points().length === 4) {
      displayName = 'line';
    } else if (shape.points().length === 6) {
      displayName = 'protractor';
    } else {
      displayName = 'roi';
    }
  } else if (shape instanceof Konva.Rect) {
    displayName = 'rectangle';
  } else if (shape instanceof Konva.Ellipse) {
    displayName = 'ellipse';
  }
  // return
  return displayName;
}

/**
 * Draw group command.
 */
export class DrawGroupCommand {

  /**
   * The group to draw.
   *
   * @type {Konva.Group}
   */
  _group;

  /**
   * The shape display name.
   *
   * @type {string}
   */
  _name;

  /**
   * The draw layer.
   *
   * @type {DrawLayer}
   */
  _layer;

  /**
   * Flag to send events.
   *
   * @type {boolean}
   */
  _isSilent;

  /**
   * The group parent.
   *
   * @type {object}
   */
  _parent;

  /**
   * @param {Konva.Group} group The group draw.
   * @param {string} name The shape display name.
   * @param {DrawLayer} layer The layer where to draw the group.
   * @param {boolean} [silent] Whether to send a creation event or not.
   */
  constructor(group, name, layer, silent) {
    this._group = group;
    this._name = name;
    this._layer = layer;
    this._isSilent = (typeof silent === 'undefined') ? false : silent;
    this._parent = group.getParent();
  }

  /**
   * Get the command name.
   *
   * @returns {string} The command name.
   */
  getName() {
    return 'Draw-' + this._name;
  }

  /**
   * Execute the command.
   *
   * @fires DrawGroupCommand_drawcreate
   */
  execute() {
    // add the group to the parent (in case of undo/redo)
    this._parent.add(this._group);
    // draw
    this._layer.getKonvaLayer().draw();
    // callback
    if (!this._isSilent) {
      /**
       * Draw create event.
       *
       * @event DrawGroupCommand_drawcreate
       * @type {object}
       * @property {string} id The id of the created draw.
       * @property {string} srclayerid The id of the layer of the draw.
       * @property {string} dataid The associated data id.
       */
      this.onExecute({
        type: 'drawcreate',
        id: this._group.id(),
        srclayerid: this._layer.getId(),
        dataid: this._layer.getDataId()
      });
    }
  }

  /**
   * Undo the command.
   *
   * @fires DeleteGroupCommand_drawdelete
   */
  undo() {
    // remove the group from the parent layer
    this._group.remove();
    // draw
    this._layer.getKonvaLayer().draw();
    // callback
    this.onUndo({
      type: 'drawdelete',
      id: this._group.id(),
      srclayerid: this._layer.getId(),
      dataid: this._layer.getDataId()
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

} // DrawGroupCommand class


/**
 * Move group command.
 */
export class MoveGroupCommand {

  /**
   * The group to move.
   *
   * @type {Konva.Group}
   */
  _group;

  /**
   * The shape display name.
   *
   * @type {string}
   */
  _name;

  /**
   * The 2D translation as {x,y}.
   *
   * @type {Scalar2D}
   */
  _translation;

  /**
   * The draw layer.
   *
   * @type {DrawLayer}
   */
  _layer;

  /**
   * @param {Konva.Group} group The group draw.
   * @param {string} name The shape display name.
   * @param {object} translation A 2D translation to move the group by.
   * @param {DrawLayer} layer The layer where to move the group.
   */
  constructor(group, name, translation, layer) {
    this._group = group;
    this._name = name;
    this._translation = translation;
    this._layer = layer;
  }

  /**
   * Get the command name.
   *
   * @returns {string} The command name.
   */
  getName() {
    return 'Move-' + this._name;
  }

  /**
   * Execute the command.
   *
   * @fires MoveGroupCommand_drawmove
   */
  execute() {
    // translate group
    this._group.move(this._translation);
    // draw
    this._layer.getKonvaLayer().draw();
    // callback
    /**
     * Draw move event.
     *
     * @event MoveGroupCommand_drawmove
     * @type {object}
     * @property {string} id The id of the create draw.
     * @property {string} srclayerid The id of the layer of the draw.
     * @property {string} dataid The associated data id.
     */
    this.onExecute({
      type: 'drawmove',
      id: this._group.id(),
      srclayerid: this._layer.getId(),
      dataid: this._layer.getDataId()
    });
  }

  /**
   * Undo the command.
   *
   * @fires MoveGroupCommand_drawmove
   */
  undo() {
    // invert translate group
    const minusTrans = {
      x: -this._translation.x,
      y: -this._translation.y
    };
    this._group.move(minusTrans);
    // draw
    this._layer.getKonvaLayer().draw();
    // callback
    this.onUndo({
      type: 'drawmove',
      id: this._group.id(),
      srclayerid: this._layer.getId(),
      dataid: this._layer.getDataId()
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

} // MoveGroupCommand class


/**
 * Change group command.
 */
export class ChangeGroupCommand {

  /**
   * The shape display name.
   *
   * @type {string}
   */
  _name;

  /**
   * The shape factory.
   *
   * @type {object}
   */
  _factory;

  /**
   * The start anchor.
   *
   * @type {object}
   */
  _startAnchor;

  /**
   * The end anchor.
   *
   * @type {object}
   */
  _endAnchor;

  /**
   * The draw layer.
   *
   * @type {DrawLayer}
   */
  _layer;

  /**
   * The associated view controller.
   *
   * @type {ViewController}
   */
  _viewController;

  /**
   * The app style.
   *
   * @type {Style}
   */
  _style;

  /**
   * @param {string} name The shape display name.
   * @param {object} factory The shape factory.
   * @param {object} startAnchor The anchor that starts the change.
   * @param {object} endAnchor The anchor that ends the change.
   * @param {DrawLayer} layer The layer where to change the group.
   * @param {ViewController} viewController The associated viewController.
   * @param {Style} style The app style.
   */
  constructor(
    name, factory, startAnchor, endAnchor, layer, viewController, style) {
    this._name = name;
    this._factory = factory;
    this._startAnchor = startAnchor;
    this._endAnchor = endAnchor;
    this._layer = layer;
    this._viewController = viewController;
    this._style = style;
  }

  /**
   * Get the command name.
   *
   * @returns {string} The command name.
   */
  getName() {
    return 'Change-' + this._name;
  }

  /**
   * Execute the command.
   *
   * @fires ChangeGroupCommand_drawchange
   */
  execute() {
    // change shape
    this._factory.update(
      this._endAnchor,
      this._style,
      this._viewController
    );
    // draw
    this._layer.getKonvaLayer().draw();
    // callback
    /**
     * Draw change event.
     *
     * @event ChangeGroupCommand_drawchange
     * @type {object}
     * @property {string} id The id of the created draw.
     * @property {string} srclayerid The id of the layer of the draw.
     * @property {string} dataid The associated data id.
     */
    this.onExecute({
      type: 'drawchange',
      id: this._endAnchor.getParent().id(),
      srclayerid: this._layer.getId(),
      dataid: this._layer.getDataId()
    });
  }

  /**
   * Undo the command.
   *
   * @fires ChangeGroupCommand_drawchange
   */
  undo() {
    // invert change shape
    this._factory.update(
      this._startAnchor,
      this._style,
      this._viewController
    );
    // draw
    this._layer.getKonvaLayer().draw();
    // callback
    this.onUndo({
      type: 'drawchange',
      id: this._startAnchor.getParent().id(),
      srclayerid: this._layer.getId(),
      dataid: this._layer.getDataId()
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

} // ChangeGroupCommand class

/**
 * Delete group command.
 */
export class DeleteGroupCommand {

  /**
   * The group to draw.
   *
   * @type {Konva.Group}
   */
  _group;

  /**
   * The shape display name.
   *
   * @type {string}
   */
  _name;

  /**
   * The draw layer.
   *
   * @type {DrawLayer}
   */
  _layer;

  /**
   * The group parent.
   *
   * @type {Konva.Container}
   */
  _parent;

  /**
   * @param {Konva.Group} group The group draw.
   * @param {string} name The shape display name.
   * @param {DrawLayer} layer The layer where to delete the group.
   */
  constructor(group, name, layer) {
    this._group = group;
    this._name = name;
    this._layer = layer;
    this._parent = group.getParent();
  }

  /**
   * Get the command name.
   *
   * @returns {string} The command name.
   */
  getName() {
    return 'Delete-' + this._name;
  }

  /**
   * Execute the command.
   *
   * @fires DeleteGroupCommand_drawdelete
   */
  execute() {
    // remove the group from its parent
    this._group.remove();
    // draw
    this._layer.getKonvaLayer().draw();
    // callback
    /**
     * Draw delete event.
     *
     * @event DeleteGroupCommand_drawdelete
     * @type {object}
     * @property {string} id The id of the created draw.
     * @property {string} srclayerid The id of the layer of the draw.
     * @property {string} dataid The associated data id.
     */
    this.onExecute({
      type: 'drawdelete',
      id: this._group.id(),
      srclayerid: this._layer.getId(),
      dataid: this._layer.getDataId()
    });
  }

  /**
   * Undo the command.
   *
   * @fires DrawGroupCommand_drawcreate
   */
  undo() {
    // add the group to its parent
    this._parent.add(this._group);
    // draw
    this._layer.getKonvaLayer().draw();
    // callback
    this.onUndo({
      type: 'drawcreate',
      id: this._group.id(),
      srclayerid: this._layer.getId(),
      dataid: this._layer.getDataId()
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

} // DeleteGroupCommand class
