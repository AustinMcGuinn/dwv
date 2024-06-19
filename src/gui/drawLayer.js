import {ListenerHandler} from '../utils/listen';
import {DrawController} from '../app/drawController';
import {getScaledOffset} from './layerGroup';
import {InteractionEventNames} from './generic';

// external
import Konva from 'konva';

// doc imports
/* eslint-disable no-unused-vars */
import {Point, Point3D} from '../math/point';
import {Index} from '../math/index';
import {Vector3D} from '../math/vector';
import {Scalar2D, Scalar3D} from '../math/scalar';
import {PlaneHelper} from '../image/planeHelper';
/* eslint-enable no-unused-vars */

/**
 * Draw layer.
 */
export class DrawLayer {

  /**
   * The container div.
   *
   * @type {HTMLDivElement}
   */
  _containerDiv;

  /**
   * Konva stage.
   *
   * @type {Konva.Stage}
   */
  _konvaStage = null;

  /**
   * The layer base size as {x,y}.
   *
   * @type {Scalar2D}
   */
  _baseSize;

  /**
   * The layer base spacing as {x,y}.
   *
   * @type {Scalar2D}
   */
  _baseSpacing;

  /**
   * The layer fit scale.
   *
   * @type {Scalar2D}
   */
  _fitScale = {x: 1, y: 1};

  /**
   * The layer flip scale.
   *
   * @type {Scalar3D}
   */
  _flipScale = {x: 1, y: 1, z: 1};

  /**
   * The base layer offset.
   *
   * @type {Scalar2D}
   */
  _baseOffset = {x: 0, y: 0};

  /**
   * The view offset.
   *
   * @type {Scalar2D}
   */
  _viewOffset = {x: 0, y: 0};

  /**
   * The zoom offset.
   *
   * @type {Scalar2D}
   */
  _zoomOffset = {x: 0, y: 0};

  /**
   * The flip offset.
   *
   * @type {Scalar2D}
   */
  _flipOffset = {x: 0, y: 0};

  /**
   * The draw controller.
   *
   * @type {object}
   */
  _drawController;

  /**
   * The plane helper.
   *
   * @type {PlaneHelper}
   */
  _planeHelper;

  /**
   * The associated data id.
   *
   * @type {string}
   */
  _dataId;

  /**
   * @param {HTMLDivElement} containerDiv The layer div, its id will be used
   *   as this layer id.
   */
  constructor(containerDiv) {
    this._containerDiv = containerDiv;
    // specific css class name
    this._containerDiv.className += ' drawLayer';
  }

  /**
   * Get the associated data id.
   *
   * @returns {string} The id.
   */
  getDataId() {
    return this._dataId;
  }

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Get the Konva stage.
   *
   * @returns {Konva.Stage} The stage.
   */
  getKonvaStage() {
    return this._konvaStage;
  }

  /**
   * Get the Konva layer.
   *
   * @returns {Konva.Layer} The layer.
   */
  getKonvaLayer() {
    // there should only be one layer
    return this._konvaStage.getLayers()[0];
  }

  /**
   * Get the draw controller.
   *
   * @returns {object} The controller.
   */
  getDrawController() {
    return this._drawController;
  }

  /**
   * Set the plane helper.
   *
   * @param {PlaneHelper} helper The helper.
   */
  setPlaneHelper(helper) {
    this._planeHelper = helper;
  }

  // common layer methods [start] ---------------

  /**
   * Get the id of the layer.
   *
   * @returns {string} The string id.
   */
  getId() {
    return this._containerDiv.id;
  }

  /**
   * Remove the HTML element from the DOM.
   */
  removeFromDOM() {
    this._containerDiv.remove();
  }

  /**
   * Get the layer base size (without scale).
   *
   * @returns {Scalar2D} The size as {x,y}.
   */
  getBaseSize() {
    return this._baseSize;
  }

  /**
   * Get the layer opacity.
   *
   * @returns {number} The opacity ([0:1] range).
   */
  getOpacity() {
    return this._konvaStage.opacity();
  }

  /**
   * Set the layer opacity.
   *
   * @param {number} alpha The opacity ([0:1] range).
   */
  setOpacity(alpha) {
    this._konvaStage.opacity(Math.min(Math.max(alpha, 0), 1));
  }

  /**
   * Add a flip offset along the layer X axis.
   */
  addFlipOffsetX() {
    // flip offset
    const scale = this._konvaStage.scale();
    const size = this._konvaStage.size();
    this._flipOffset.x += size.width / scale.x;
    // apply
    const offset = this._konvaStage.offset();
    offset.x += this._flipOffset.x;
    this._konvaStage.offset(offset);
  }

  /**
   * Add a flip offset along the layer Y axis.
   */
  addFlipOffsetY() {
    // flip offset
    const scale = this._konvaStage.scale();
    const size = this._konvaStage.size();
    this._flipOffset.y += size.height / scale.y;
    // apply
    const offset = this._konvaStage.offset();
    offset.y += this._flipOffset.y;
    this._konvaStage.offset(offset);
  }

  /**
   * Flip the scale along the layer X axis.
   */
  flipScaleX() {
    this._flipScale.x *= -1;
  }

  /**
   * Flip the scale along the layer Y axis.
   */
  flipScaleY() {
    this._flipScale.y *= -1;
  }

  /**
   * Flip the scale along the layer Z axis.
   */
  flipScaleZ() {
    this._flipScale.z *= -1;
  }

  /**
   * Set the layer scale.
   *
   * @param {Scalar3D} newScale The scale as {x,y,z}.
   * @param {Point3D} [center] The scale center.
   */
  setScale(newScale, center) {
    const orientedNewScale =
      this._planeHelper.getTargetOrientedPositiveXYZ({
        x: newScale.x * this._flipScale.x,
        y: newScale.y * this._flipScale.y,
        z: newScale.z * this._flipScale.z,
      });
    const finalNewScale = {
      x: this._fitScale.x * orientedNewScale.x,
      y: this._fitScale.y * orientedNewScale.y
    };

    const offset = this._konvaStage.offset();

    if (Math.abs(newScale.x) === 1 &&
      Math.abs(newScale.y) === 1 &&
      Math.abs(newScale.z) === 1) {
      // reset zoom offset for scale=1
      const resetOffset = {
        x: offset.x - this._zoomOffset.x,
        y: offset.y - this._zoomOffset.y
      };
      // store new offset
      this._zoomOffset = {x: 0, y: 0};
      this._konvaStage.offset(resetOffset);
    } else {
      if (typeof center !== 'undefined') {
        let worldCenter = this._planeHelper.getPlaneOffsetFromOffset3D({
          x: center.getX(),
          y: center.getY(),
          z: center.getZ()
        });
        // center was obtained with viewLayer.displayToMainPlanePos
        // compensated for baseOffset
        // TODO: justify...
        worldCenter = {
          x: worldCenter.x + this._baseOffset.x,
          y: worldCenter.y + this._baseOffset.y
        };

        const newOffset = getScaledOffset(
          offset, this._konvaStage.scale(), finalNewScale, worldCenter);

        const newZoomOffset = {
          x: this._zoomOffset.x + newOffset.x - offset.x,
          y: this._zoomOffset.y + newOffset.y - offset.y
        };
        // store new offset
        this._zoomOffset = newZoomOffset;
        this._konvaStage.offset(newOffset);
      }
    }

    this._konvaStage.scale(finalNewScale);
    // update labels
    this._updateLabelScale(finalNewScale);
  }

  /**
   * Set the layer offset.
   *
   * @param {Scalar3D} newOffset The offset as {x,y,z}.
   */
  setOffset(newOffset) {
    const planeNewOffset =
      this._planeHelper.getPlaneOffsetFromOffset3D(newOffset);
    this._konvaStage.offset({
      x: planeNewOffset.x +
        this._viewOffset.x +
        this._baseOffset.x +
        this._zoomOffset.x +
        this._flipOffset.x,
      y: planeNewOffset.y +
        this._viewOffset.y +
        this._baseOffset.y +
        this._zoomOffset.y +
        this._flipOffset.y
    });
  }

  /**
   * Set the base layer offset. Updates the layer offset.
   *
   * @param {Vector3D} scrollOffset The scroll offset vector.
   * @param {Vector3D} planeOffset The plane offset vector.
   * @returns {boolean} True if the offset was updated.
   */
  setBaseOffset(scrollOffset, planeOffset) {
    const scrollIndex = this._planeHelper.getNativeScrollIndex();
    const newOffset = this._planeHelper.getPlaneOffsetFromOffset3D({
      x: scrollIndex === 0 ? scrollOffset.getX() : planeOffset.getX(),
      y: scrollIndex === 1 ? scrollOffset.getY() : planeOffset.getY(),
      z: scrollIndex === 2 ? scrollOffset.getZ() : planeOffset.getZ(),
    });
    const needsUpdate = this._baseOffset.x !== newOffset.x ||
      this._baseOffset.y !== newOffset.y;
    // reset offset if needed
    if (needsUpdate) {
      const offset = this._konvaStage.offset();
      this._konvaStage.offset({
        x: offset.x - this._baseOffset.x + newOffset.x,
        y: offset.y - this._baseOffset.y + newOffset.y
      });
      this._baseOffset = newOffset;
    }
    return needsUpdate;
  }

  /**
   * Display the layer.
   *
   * @param {boolean} flag Whether to display the layer or not.
   */
  display(flag) {
    this._containerDiv.style.display = flag ? '' : 'none';
  }

  /**
   * Check if the layer is visible.
   *
   * @returns {boolean} True if the layer is visible.
   */
  isVisible() {
    return this._containerDiv.style.display === '';
  }

  /**
   * Draw the content (imageData) of the layer.
   * The imageData variable needs to be set.
   */
  draw() {
    this._konvaStage.draw();
  }

  /**
   * Initialise the layer: set the canvas and context.
   *
   * @param {Scalar2D} size The image size as {x,y}.
   * @param {Scalar2D} spacing The image spacing as {x,y}.
   * @param {string} dataId The associated data id.
   */
  initialise(size, spacing, dataId) {
    // set locals
    this._baseSize = size;
    this._baseSpacing = spacing;
    this._dataId = dataId;

    // create stage
    this._konvaStage = new Konva.Stage({
      container: this._containerDiv,
      width: this._baseSize.x,
      height: this._baseSize.y,
      listening: false
    });
    // reset style
    // (avoids a not needed vertical scrollbar)
    this._konvaStage.getContent().setAttribute('style', '');

    // create layer
    const konvaLayer = new Konva.Layer({
      listening: false,
      visible: true
    });
    this._konvaStage.add(konvaLayer);

    // create draw controller
    this._drawController = new DrawController(this);
  }

  /**
   * Fit the layer to its parent container.
   *
   * @param {Scalar2D} containerSize The container size as {x,y}.
   * @param {number} divToWorldSizeRatio The div to world size ratio.
   * @param {Scalar2D} fitOffset The fit offset as {x,y}.
   */
  fitToContainer(containerSize, divToWorldSizeRatio, fitOffset) {
    // update konva
    this._konvaStage.width(containerSize.x);
    this._konvaStage.height(containerSize.y);

    // fit scale
    const divToImageSizeRatio = {
      x: divToWorldSizeRatio * this._baseSpacing.x,
      y: divToWorldSizeRatio * this._baseSpacing.y
    };
    // _scale = inputScale * fitScale * flipScale
    // flipScale does not change here, we can omit it
    // newScale = (_scale / fitScale) * newFitScale
    const newScale = {
      x: this._konvaStage.scale().x * divToImageSizeRatio.x / this._fitScale.x,
      y: this._konvaStage.scale().y * divToImageSizeRatio.y / this._fitScale.y
    };

    // set scales if different from previous
    if (this._konvaStage.scale().x !== newScale.x ||
      this._konvaStage.scale().y !== newScale.y) {
      this._fitScale = divToImageSizeRatio;
      this._konvaStage.scale(newScale);
    }

    // view offset
    const newViewOffset = {
      x: fitOffset.x / divToImageSizeRatio.x,
      y: fitOffset.y / divToImageSizeRatio.y
    };
    // flip offset
    const scaledImageSize = {
      x: containerSize.x / divToImageSizeRatio.x,
      y: containerSize.y / divToImageSizeRatio.y
    };
    const newFlipOffset = {
      x: this._flipOffset.x !== 0 ? scaledImageSize.x : 0,
      y: this._flipOffset.y !== 0 ? scaledImageSize.y : 0,
    };

    // set offsets if different from previous
    if (this._viewOffset.x !== newViewOffset.x ||
      this._viewOffset.y !== newViewOffset.y ||
      this._flipOffset.x !== newFlipOffset.x ||
      this._flipOffset.y !== newFlipOffset.y) {
      // update global offset
      this._konvaStage.offset({
        x: this._konvaStage.offset().x +
          newViewOffset.x - this._viewOffset.x +
          newFlipOffset.x - this._flipOffset.x,
        y: this._konvaStage.offset().y +
          newViewOffset.y - this._viewOffset.y +
          newFlipOffset.y - this._flipOffset.y,
      });
      // update private local offsets
      this._flipOffset = newFlipOffset;
      this._viewOffset = newViewOffset;
    }
  }

  /**
   * Check the visibility of a given group.
   *
   * @param {string} id The id of the group.
   * @returns {boolean} True if the group is visible.
   */
  isGroupVisible(id) {
    // get the group
    const group = this._drawController.getGroup(id);
    if (typeof group === 'undefined') {
      return false;
    }
    // get visibility
    return group.isVisible();
  }

  /**
   * Toggle the visibility of a given group.
   *
   * @param {string} id The id of the group.
   * @returns {boolean} False if the group cannot be found.
   */
  toggleGroupVisibility(id) {
    // get the group
    const group = this._drawController.getGroup(id);
    if (typeof group === 'undefined') {
      return false;
    }
    // toggle visible
    group.visible(!group.isVisible());

    // udpate
    this.draw();

    return true;
  }

  /**
   * Delete a Draw from the stage.
   *
   * @param {string} id The id of the group to delete.
   * @param {object} exeCallback The callback to call once the
   *  DeleteCommand has been executed.
   */
  deleteDraw(id, exeCallback) {
    if (typeof this._drawController !== 'undefined') {
      this._drawController.deleteDraw(id, this._fireEvent, exeCallback);
    }
  }

  /**
   * Delete all Draws from the stage.
   *
   * @param {object} exeCallback The callback to call once the
   *  DeleteCommand has been executed.
   */
  deleteDraws(exeCallback) {
    if (typeof this._drawController !== 'undefined') {
      this._drawController.deleteDraws(this._fireEvent, exeCallback);
    }
  }

  /**
   * Get the total number of draws of this layer
   * (at all positions).
   *
   * @returns {number|undefined} The total number of draws.
   */
  getNumberOfDraws() {
    let res;
    if (typeof this._drawController !== 'undefined') {
      res = this._drawController.getNumberOfDraws();
    }
    return res;
  }

  /**
   * Enable and listen to container interaction events.
   */
  bindInteraction() {
    this._konvaStage.listening(true);
    // allow pointer events
    this._containerDiv.style.pointerEvents = 'auto';
    // interaction events
    const names = InteractionEventNames;
    for (let i = 0; i < names.length; ++i) {
      this._containerDiv.addEventListener(names[i], this._fireEvent);
    }
  }

  /**
   * Disable and stop listening to container interaction events.
   */
  unbindInteraction() {
    this._konvaStage.listening(false);
    // disable pointer events
    this._containerDiv.style.pointerEvents = 'none';
    // interaction events
    const names = InteractionEventNames;
    for (let i = 0; i < names.length; ++i) {
      this._containerDiv.removeEventListener(names[i], this._fireEvent);
    }
  }

  /**
   * Set the current position.
   *
   * @param {Point} position The new position.
   * @param {Index} index The new index.
   * @returns {boolean} True if the position was updated.
   */
  setCurrentPosition(position, index) {
    this.getDrawController().activateDrawLayer(
      index, this._planeHelper.getScrollIndex());
    // TODO: add check
    return true;
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
    event.srclayerid = this.getId();
    event.dataid = this._dataId;
    this._listenerHandler.fireEvent(event);
  };

  // common layer methods [end] ---------------

  /**
   * Update label scale: compensate for it so
   *   that label size stays visually the same.
   *
   * @param {Scalar2D} scale The scale to compensate for as {x,y}.
   */
  _updateLabelScale(scale) {
    // same formula as in style::applyZoomScale:
    // compensate for scale and times 2 so that font 10 looks like a 10
    const ratioX = 2 / scale.x;
    const ratioY = 2 / scale.y;
    // compensate scale for labels
    const labels = this._konvaStage.find('Label');
    for (let i = 0; i < labels.length; ++i) {
      labels[i].scale({x: ratioX, y: ratioY});
    }
  }

} // DrawLayer class
