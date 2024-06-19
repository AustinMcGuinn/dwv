import Konva from 'konva';

/* eslint-disable no-unused-vars */
import {Scalar2D} from '../math/scalar';
import {DrawLayer} from '../gui/drawLayer';
/* eslint-enable no-unused-vars */

export class DrawTrash {
  /**
   * Trash draw: a cross.
   *
   * @type {Konva.Group}
   */
  _trash;

  constructor() {
    this.createTrashIcon();

  }

  /**
   * Creates the trash icon o positionates it.
   */
  createTrashIcon() {
    this._trash = new Konva.Group();
    // first line of the cross
    const trashLine1 = new Konva.Line({
      points: [-10, -10, 10, 10],
      stroke: 'red'
    });
    // second line of the cross
    const trashLine2 = new Konva.Line({
      points: [10, -10, -10, 10],
      stroke: 'red'
    });
    this._trash.width(20);
    this._trash.height(20);
    this._trash.add(trashLine1);
    this._trash.add(trashLine2);
  }

  /**
   *
   * Activates the trash, by showing the icon into the layer draw layer.
   *
   * @param {DrawLayer} drawLayer The draw layer where to draw.
   */
  activate(drawLayer) {
    const stage = drawLayer.getKonvaStage();
    const scale = stage.scale();
    const konvaLayer = drawLayer.getKonvaLayer();
    const invscale = {x: 1 / scale.x, y: 1 / scale.y};
    this._trash.x(stage.offset().x + (stage.width() / (2 * scale.x)));
    this._trash.y(stage.offset().y + (stage.height() / (15 * scale.y)));
    this._trash.scale(invscale);
    konvaLayer.add(this._trash);
    // draw
    konvaLayer.draw();
  }

  /**
   *
   * Change colour on trash over.
   *
   * @param {Scalar2D} eventPosition The event drag move position.
   * @param {Konva.Group} shapeGroup The shape group whose colour
   *   must be change.
   * @param {string} originalShapeColour The original shape colour.
   */
  changeChildrenColourOnTrashHover(eventPosition,
    shapeGroup, originalShapeColour) {
    if (this.isOverTrash(eventPosition)) {
      this.changeGroupChildrenColour(this._trash, 'orange');
      this.changeGroupChildrenColour(shapeGroup, 'red');
      return;

    }
    this.changeGroupChildrenColour(this._trash, 'red');
    this.changeGroupChildrenColour(shapeGroup, originalShapeColour);
  }

  /**
   * Change colour on trash out.
   *
   * @param {Konva.Group} group The group whose colour must be change.
   * @param {string} colour The new colour to be set.
   */
  changeGroupChildrenColour(group, colour) {
    group.getChildren().forEach(function (tshape) {
      if (tshape instanceof Konva.Shape &&
        typeof tshape.stroke !== 'undefined') {
        tshape.stroke(colour);
      }
    });
  }

  /**
   * Removes the trash from the draw layer.
   */
  remove() {
    this._trash.remove();
  }

  /**
   * Determines if the event is over trash.
   *
   * @param {Scalar2D} eventPosition The event position.
   * @returns {boolean} True if the event is over trash.
   */
  isOverTrash(eventPosition) {
    const trashHalfWidth =
        this._trash.width() * Math.abs(this._trash.scaleX()) / 2;
    const trashHalfHeight =
        this._trash.height() * Math.abs(this._trash.scaleY()) / 2;
    return Math.abs(eventPosition.x - this._trash.x()) < trashHalfWidth &&
        Math.abs(eventPosition.y - this._trash.y()) < trashHalfHeight;
  }

}