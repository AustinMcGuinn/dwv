import {Index} from '../math/index';
import {ListenerHandler} from '../utils/listen';
import {viewEventNames} from '../image/view';
import {ViewController} from '../app/viewController';
import {Point2D} from '../math/point';
import {
  canCreateCanvas,
  InteractionEventNames
} from './generic';
import {getScaledOffset} from './layerGroup';

// doc imports
/* eslint-disable no-unused-vars */
import {Vector3D} from '../math/vector';
import {Point, Point3D} from '../math/point';
import {Scalar2D, Scalar3D} from '../math/scalar';
/* eslint-enable no-unused-vars */

/**
 * View layer.
 */
export class ViewLayer {

  /**
   * Container div.
   *
   * @type {HTMLElement}
   */
  _containerDiv;

  /**
   * The view controller.
   *
   * @type {ViewController}
   */
  _viewController = null;

  /**
   * The main display canvas.
   *
   * @type {object}
   */
  _canvas = null;

  /**
   * The offscreen canvas: used to store the raw, unscaled pixel data.
   *
   * @type {object}
   */
  _offscreenCanvas = null;

  /**
   * The associated CanvasRenderingContext2D.
   *
   * @type {object}
   */
  _context = null;

  /**
   * Flag to know if the current position is valid.
   *
   * @type {boolean}
   */
  _isValidPosition = true;

  /**
   * The image data array.
   *
   * @type {ImageData}
   */
  _imageData = null;

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
   * The layer opacity.
   *
   * @type {number}
   */
  _opacity = 1;

  /**
   * The layer scale.
   *
   * @type {Scalar2D}
   */
  _scale = {x: 1, y: 1};

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
   * The layer offset.
   *
   * @type {Scalar2D}
   */
  _offset = {x: 0, y: 0};

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
   * Data update flag.
   *
   * @type {boolean}
   */
  _needsDataUpdate = null;

  /**
   * The associated data id.
   *
   * @type {string}
   */
  _dataId;

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Image smoothing flag.
   *
   * See: {@link https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled}.
   *
   * @type {boolean}
   */
  _imageSmoothing = false;

  /**
   * Layer group origin.
   *
   * @type {Point3D}
   */
  _layerGroupOrigin;

  /**
   * Layer group first origin.
   *
   * @type {Point3D}
   */
  _layerGroupOrigin0;

  /**
   * @param {HTMLElement} containerDiv The layer div, its id will be used
   *   as this layer id.
   */
  constructor(containerDiv) {
    this._containerDiv = containerDiv;
    // specific css class name
    this._containerDiv.className += ' viewLayer';
  }

  /**
   * Get the associated data id.
   *
   * @returns {string} The data id.
   */
  getDataId() {
    return this._dataId;
  }

  /**
   * Get the layer scale.
   *
   * @returns {Scalar2D} The scale as {x,y}.
   */
  getScale() {
    return this._scale;
  }

  /**
   * Get the layer zoom offset without the fit scale.
   *
   * @returns {Scalar2D} The offset as {x,y}.
   */
  getAbsoluteZoomOffset() {
    return {
      x: this._zoomOffset.x * this._fitScale.x,
      y: this._zoomOffset.y * this._fitScale.y
    };
  }

  /**
   * Set the imageSmoothing flag value.
   *
   * @param {boolean} flag True to enable smoothing.
   */
  setImageSmoothing(flag) {
    this._imageSmoothing = flag;
  }

  /**
   * Set the associated view.
   *
   * @param {object} view The view.
   * @param {string} dataId The associated data id.
   */
  setView(view, dataId) {
    this._dataId = dataId;
    // local listeners
    view.addEventListener('wlchange', this._onWLChange);
    view.addEventListener('colourmapchange', this._onColourMapChange);
    view.addEventListener('positionchange', this._onPositionChange);
    view.addEventListener('alphafuncchange', this._onAlphaFuncChange);
    // view events
    for (let j = 0; j < viewEventNames.length; ++j) {
      view.addEventListener(viewEventNames[j], this._fireEvent);
    }
    // create view controller
    this._viewController = new ViewController(view);
    // bind layer and image
    this.bindImage();
  }

  /**
   * Get the view controller.
   *
   * @returns {ViewController} The controller.
   */
  getViewController() {
    return this._viewController;
  }

  /**
   * Get the canvas image data.
   *
   * @returns {object} The image data.
   */
  getImageData() {
    return this._imageData;
  }

  /**
   * Handle an image set event.
   *
   * @param {object} event The event.
   * @function
   */
  onimageset = (event) => {
    // event.value = [index, image]
    if (this._dataId === event.dataid) {
      this._viewController.setImage(event.value[0]);
      this._setBaseSize(this._viewController.getImageSize().get2D());
      this._needsDataUpdate = true;
    }
  };

  /**
   * Bind this layer to the view image.
   */
  bindImage() {
    if (this._viewController) {
      this._viewController.bindImageAndLayer(this);
    }
  }

  /**
   * Unbind this layer to the view image.
   */
  unbindImage() {
    if (this._viewController) {
      this._viewController.unbindImageAndLayer(this);
    }
  }

  /**
   * Handle an image content change event.
   *
   * @param {object} event The event.
   * @function
   */
  onimagecontentchange = (event) => {
    // event.value = [index]
    if (this._dataId === event.dataid) {
      this._isValidPosition = this._viewController.isPositionInBounds();
      // flag update and draw
      this._needsDataUpdate = true;
      this.draw();
    }
  };

  /**
   * Handle an image change event.
   *
   * @param {object} event The event.
   * @function
   */
  onimagegeometrychange = (event) => {
    // event.value = [index]
    if (this._dataId === event.dataid) {
      const vcSize = this._viewController.getImageSize().get2D();
      if (this._baseSize.x !== vcSize.x ||
        this._baseSize.y !== vcSize.y) {
        // size changed, recalculate base offset
        // in case origin changed
        if (typeof this._layerGroupOrigin !== 'undefined' &&
          typeof this._layerGroupOrigin0 !== 'undefined') {
          const origin0 = this._viewController.getOrigin();
          const scrollOffset = this._layerGroupOrigin0.minus(origin0);
          const origin = this._viewController.getOrigin(
            this._viewController.getCurrentPosition()
          );
          const planeOffset = this._layerGroupOrigin.minus(origin);
          this.setBaseOffset(scrollOffset, planeOffset);
        }
        // update base size
        this._setBaseSize(vcSize);
        // flag update and draw
        this._needsDataUpdate = true;
        this.draw();
      }
    }
  };

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
   * Get the image world (mm) 2D size.
   *
   * @returns {Scalar2D} The 2D size as {x,y}.
   */
  getImageWorldSize() {
    return this._viewController.getImageWorldSize();
  }

  /**
   * Get the layer opacity.
   *
   * @returns {number} The opacity ([0:1] range).
   */
  getOpacity() {
    return this._opacity;
  }

  /**
   * Set the layer opacity.
   *
   * @param {number} alpha The opacity ([0:1] range).
   */
  setOpacity(alpha) {
    if (alpha === this._opacity) {
      return;
    }

    this._opacity = Math.min(Math.max(alpha, 0), 1);

    /**
     * Opacity change event.
     *
     * @event App_opacitychange
     * @type {object}
     * @property {string} type The event type.
     */
    const event = {
      type: 'opacitychange',
      value: [this._opacity]
    };
    this._fireEvent(event);
  }

  /**
   * Add a flip offset along the layer X axis.
   */
  addFlipOffsetX() {
    this._flipOffset.x += this._canvas.width / this._scale.x;
    this._offset.x += this._flipOffset.x;
  }

  /**
   * Add a flip offset along the layer Y axis.
   */
  addFlipOffsetY() {
    this._flipOffset.y += this._canvas.height / this._scale.y;
    this._offset.y += this._flipOffset.y;
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
    const helper = this._viewController.getPlaneHelper();
    const orientedNewScale = helper.getTargetOrientedPositiveXYZ({
      x: newScale.x * this._flipScale.x,
      y: newScale.y * this._flipScale.y,
      z: newScale.z * this._flipScale.z,
    });
    const finalNewScale = {
      x: this._fitScale.x * orientedNewScale.x,
      y: this._fitScale.y * orientedNewScale.y
    };

    if (Math.abs(newScale.x) === 1 &&
      Math.abs(newScale.y) === 1 &&
      Math.abs(newScale.z) === 1) {
      // reset zoom offset for scale=1
      const resetOffset = {
        x: this._offset.x - this._zoomOffset.x,
        y: this._offset.y - this._zoomOffset.y
      };
      // store new offset
      this._zoomOffset = {x: 0, y: 0};
      this._offset = resetOffset;
    } else {
      if (typeof center !== 'undefined') {
        let worldCenter = helper.getPlaneOffsetFromOffset3D({
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
          this._offset, this._scale, finalNewScale, worldCenter);

        const newZoomOffset = {
          x: this._zoomOffset.x + newOffset.x - this._offset.x,
          y: this._zoomOffset.y + newOffset.y - this._offset.y
        };
        // store new offset
        this._zoomOffset = newZoomOffset;
        this._offset = newOffset;
      }
    }

    // store new scale
    this._scale = finalNewScale;
  }

  /**
   * Initialise the layer scale.
   *
   * @param {Scalar3D} newScale The scale as {x,y,z}.
   * @param {Scalar2D} absoluteZoomOffset The zoom offset as {x,y}
   *   without the fit scale (as provided by getAbsoluteZoomOffset).
   */
  initScale(newScale, absoluteZoomOffset) {
    const helper = this._viewController.getPlaneHelper();
    const orientedNewScale = helper.getTargetOrientedPositiveXYZ({
      x: newScale.x * this._flipScale.x,
      y: newScale.y * this._flipScale.y,
      z: newScale.z * this._flipScale.z,
    });
    const finalNewScale = {
      x: this._fitScale.x * orientedNewScale.x,
      y: this._fitScale.y * orientedNewScale.y
    };
    this._scale = finalNewScale;

    this._zoomOffset = {
      x: absoluteZoomOffset.x / this._fitScale.x,
      y: absoluteZoomOffset.y / this._fitScale.y
    };
    this._offset = {
      x: this._offset.x + this._zoomOffset.x,
      y: this._offset.y + this._zoomOffset.y
    };
  }

  /**
   * Set the base layer offset. Updates the layer offset.
   *
   * @param {Vector3D} scrollOffset The scroll offset vector.
   * @param {Vector3D} planeOffset The plane offset vector.
   * @param {Point3D} [layerGroupOrigin] The layer group origin.
   * @param {Point3D} [layerGroupOrigin0] The layer group first origin.
   * @returns {boolean} True if the offset was updated.
   */
  setBaseOffset(
    scrollOffset, planeOffset,
    layerGroupOrigin, layerGroupOrigin0) {
    const helper = this._viewController.getPlaneHelper();
    const scrollIndex = helper.getNativeScrollIndex();
    const newOffset = helper.getPlaneOffsetFromOffset3D({
      x: scrollIndex === 0 ? scrollOffset.getX() : planeOffset.getX(),
      y: scrollIndex === 1 ? scrollOffset.getY() : planeOffset.getY(),
      z: scrollIndex === 2 ? scrollOffset.getZ() : planeOffset.getZ(),
    });
    const needsUpdate = this._baseOffset.x !== newOffset.x ||
      this._baseOffset.y !== newOffset.y;
    // store layer group origins
    if (typeof layerGroupOrigin !== 'undefined' &&
      typeof layerGroupOrigin0 !== 'undefined') {
      this._layerGroupOrigin = layerGroupOrigin;
      this._layerGroupOrigin0 = layerGroupOrigin0;
    }
    // reset offset if needed
    if (needsUpdate) {
      this._offset = {
        x: this._offset.x - this._baseOffset.x + newOffset.x,
        y: this._offset.y - this._baseOffset.y + newOffset.y
      };
      this._baseOffset = newOffset;
    }
    return needsUpdate;
  }

  /**
   * Set the layer offset.
   *
   * @param {Scalar3D} newOffset The offset as {x,y,z}.
   */
  setOffset(newOffset) {
    const helper = this._viewController.getPlaneHelper();
    const planeNewOffset = helper.getPlaneOffsetFromOffset3D(newOffset);
    this._offset = {
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
    };
  }

  /**
   * Transform a display position to a 2D index.
   *
   * @param {Point2D} point2D The input point.
   * @returns {Index} The equivalent 2D index.
   */
  displayToPlaneIndex(point2D) {
    const planePos = this.displayToPlanePos(point2D);
    return new Index([
      Math.floor(planePos.getX()),
      Math.floor(planePos.getY())
    ]);
  }

  /**
   * Remove scale from a display position.
   *
   * @param {Point2D} point2D The input point.
   * @returns {Point2D} The de-scaled point.
   */
  displayToPlaneScale(point2D) {
    return new Point2D(
      point2D.getX() / this._scale.x,
      point2D.getY() / this._scale.y
    );
  }

  /**
   * Get a plane position from a display position.
   *
   * @param {Point2D} point2D The input point.
   * @returns {Point2D} The plane position.
   */
  displayToPlanePos(point2D) {
    const deScaled = this.displayToPlaneScale(point2D);
    return new Point2D(
      deScaled.getX() + this._offset.x,
      deScaled.getY() + this._offset.y
    );
  }

  /**
   * Get a display position from a plane position.
   *
   * @param {Point2D} point2D The input point.
   * @returns {Point2D} The display position, can be individually
   *   undefined if out of bounds.
   */
  planePosToDisplay(point2D) {
    let posX =
      (point2D.getX() - this._offset.x + this._baseOffset.x) * this._scale.x;
    let posY =
      (point2D.getY() - this._offset.y + this._baseOffset.y) * this._scale.y;
    // check if in bounds
    if (posX < 0 || posX >= this._canvas.width) {
      posX = undefined;
    }
    if (posY < 0 || posY >= this._canvas.height) {
      posY = undefined;
    }
    return new Point2D(posX, posY);
  }

  /**
   * Get a main plane position from a display position.
   *
   * @param {Point2D} point2D The input point.
   * @returns {Point2D} The main plane position.
   */
  displayToMainPlanePos(point2D) {
    const planePos = this.displayToPlanePos(point2D);
    return new Point2D(
      planePos.getX() - this._baseOffset.x,
      planePos.getY() - this._baseOffset.y
    );
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
   *
   * @fires App_renderstart
   * @fires App_renderend
   */
  draw() {
    // skip for non valid position
    if (!this._isValidPosition) {
      return;
    }

    /**
     * Render start event.
     *
     * @event App_renderstart
     * @type {object}
     * @property {string} type The event type.
     */
    let event = {
      type: 'renderstart',
      layerid: this.getId(),
      dataid: this.getDataId()
    };
    this._fireEvent(event);

    // update data if needed
    if (this._needsDataUpdate) {
      this._updateImageData();
    }

    // context opacity
    this._context.globalAlpha = this._opacity;

    // clear context
    this.clear();

    // draw the cached canvas on the context
    // transform takes as input a, b, c, d, e, f to create
    // the transform matrix (column-major order):
    // [ a c e ]
    // [ b d f ]
    // [ 0 0 1 ]
    this._context.setTransform(
      this._scale.x,
      0,
      0,
      this._scale.y,
      -1 * this._offset.x * this._scale.x,
      -1 * this._offset.y * this._scale.y
    );

    // disable smoothing (set just before draw, could be reset by resize)
    this._context.imageSmoothingEnabled = this._imageSmoothing;
    // draw image
    this._context.drawImage(this._offscreenCanvas, 0, 0);

    /**
     * Render end event.
     *
     * @event App_renderend
     * @type {object}
     * @property {string} type The event type.
     */
    event = {
      type: 'renderend',
      layerid: this.getId(),
      dataid: this.getDataId()
    };
    this._fireEvent(event);
  }

  /**
   * Initialise the layer: set the canvas and context.
   *
   * @param {Scalar2D} size The image size as {x,y}.
   * @param {Scalar2D} spacing The image spacing as {x,y}.
   * @param {number} alpha The initial data opacity.
   */
  initialise(size, spacing, alpha) {
    // set locals
    this._baseSpacing = spacing;
    this._opacity = Math.min(Math.max(alpha, 0), 1);

    // create canvas
    // (canvas size is set in fitToContainer)
    this._canvas = document.createElement('canvas');
    this._containerDiv.appendChild(this._canvas);

    // check that the getContext method exists
    if (!this._canvas.getContext) {
      alert('Error: no canvas.getContext method.');
      return;
    }
    // get the 2D context
    this._context = this._canvas.getContext('2d');
    if (!this._context) {
      alert('Error: failed to get the 2D context.');
      return;
    }

    // off screen canvas
    this._offscreenCanvas = document.createElement('canvas');

    // set base size: needs an existing context and off screen canvas
    this._setBaseSize(size);

    // update data on first draw
    this._needsDataUpdate = true;
  }

  /**
   * Set the base size of the layer.
   *
   * @param {Scalar2D} size The size as {x,y}.
   */
  _setBaseSize(size) {
    // check canvas creation
    if (!canCreateCanvas(size.x, size.y)) {
      throw new Error('Cannot create canvas with size ' +
        size.x + ', ' + size.y);
    }

    // set local
    this._baseSize = size;

    // off screen canvas
    this._offscreenCanvas.width = this._baseSize.x;
    this._offscreenCanvas.height = this._baseSize.y;
    // original empty image data array
    this._context.clearRect(0, 0, this._baseSize.x, this._baseSize.y);
    this._imageData = this._context.createImageData(
      this._baseSize.x, this._baseSize.y);
  }

  /**
   * Fit the layer to its parent container.
   *
   * @param {Scalar2D} containerSize The fit size as {x,y}.
   * @param {number} divToWorldSizeRatio The div to world size ratio.
   * @param {Scalar2D} fitOffset The fit offset as {x,y}.
   */
  fitToContainer(containerSize, divToWorldSizeRatio, fitOffset) {
    let needsDraw = false;

    // set canvas size if different from previous
    if (this._canvas.width !== containerSize.x ||
      this._canvas.height !== containerSize.y) {
      if (!canCreateCanvas(containerSize.x, containerSize.y)) {
        throw new Error('Cannot resize canvas ' +
          containerSize.x + ', ' + containerSize.y);
      }
      // canvas size change triggers canvas reset
      this._canvas.width = containerSize.x;
      this._canvas.height = containerSize.y;
      // update draw flag
      needsDraw = true;
    }

    // fit scale
    const divToImageSizeRatio = {
      x: divToWorldSizeRatio * this._baseSpacing.x,
      y: divToWorldSizeRatio * this._baseSpacing.y
    };
    // _scale = inputScale * fitScale * flipScale
    // flipScale does not change here, we can omit it
    // newScale = (_scale / fitScale) * newFitScale
    const newScale = {
      x: this._scale.x * divToImageSizeRatio.x / this._fitScale.x,
      y: this._scale.y * divToImageSizeRatio.y / this._fitScale.y
    };

    // set scales if different from previous
    if (this._scale.x !== newScale.x ||
      this._scale.y !== newScale.y) {
      this._fitScale = divToImageSizeRatio;
      this._scale = newScale;
      // update draw flag
      needsDraw = true;
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
      this._offset = {
        x: this._offset.x +
          newViewOffset.x - this._viewOffset.x +
          newFlipOffset.x - this._flipOffset.x,
        y: this._offset.y +
          newViewOffset.y - this._viewOffset.y +
          newFlipOffset.y - this._flipOffset.y,
      };
      // update private local offsets
      this._flipOffset = newFlipOffset;
      this._viewOffset = newViewOffset;
      // update draw flag
      needsDraw = true;
    }

    // draw if needed
    if (needsDraw) {
      this.draw();
    }
  }

  /**
   * Enable and listen to container interaction events.
   */
  bindInteraction() {
    // allow pointer events
    this._containerDiv.style.pointerEvents = 'auto';
    // interaction events
    const names = InteractionEventNames;
    for (let i = 0; i < names.length; ++i) {
      const eventName = names[i];
      const passive = eventName !== 'wheel';
      this._containerDiv.addEventListener(
        eventName, this._fireEvent, {passive: passive});
    }
  }

  /**
   * Disable and stop listening to container interaction events.
   */
  unbindInteraction() {
    // disable pointer events
    this._containerDiv.style.pointerEvents = 'none';
    // interaction events
    const names = InteractionEventNames;
    for (let i = 0; i < names.length; ++i) {
      this._containerDiv.removeEventListener(names[i], this._fireEvent);
    }
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
   * Update the canvas image data.
   */
  _updateImageData() {
    // generate image data
    this._viewController.generateImageData(this._imageData);
    // pass the data to the off screen canvas
    this._offscreenCanvas.getContext('2d').putImageData(this._imageData, 0, 0);
    // update data flag
    this._needsDataUpdate = false;
  }

  /**
   * Handle window/level change.
   *
   * @param {object} event The event fired when changing the window/level.
   */
  _onWLChange = (event) => {
    // generate and draw if no skip flag
    const skip = typeof event.skipGenerate !== 'undefined' &&
      event.skipGenerate === true;
    if (!skip) {
      this._needsDataUpdate = true;
      this.draw();
    }
  };

  /**
   * Handle colour map change.
   *
   * @param {object} event The event fired when changing the colour map.
   */
  _onColourMapChange = (event) => {
    const skip = typeof event.skipGenerate !== 'undefined' &&
      event.skipGenerate === true;
    if (!skip) {
      this._needsDataUpdate = true;
      this.draw();
    }
  };

  /**
   * Handle position change.
   *
   * @param {object} event The event fired when changing the position.
   */
  _onPositionChange = (event) => {
    const skip = typeof event.skipGenerate !== 'undefined' &&
      event.skipGenerate === true;
    if (!skip) {
      let valid = true;
      if (typeof event.valid !== 'undefined') {
        valid = event.valid;
      }
      // clear for non valid events
      if (!valid) {
        // clear only once
        if (this._isValidPosition) {
          this._isValidPosition = false;
          this.clear();
        }
      } else {
        // 3D dimensions
        const dims3D = [0, 1, 2];
        // remove scroll index
        const indexScrollIndex =
          dims3D.indexOf(this._viewController.getScrollIndex());
        dims3D.splice(indexScrollIndex, 1);
        // remove non scroll index from diff dims
        const diffDims = event.diffDims.filter(function (item) {
          return dims3D.indexOf(item) === -1;
        });
        // update if we have something left
        if (diffDims.length !== 0 || !this._isValidPosition) {
          // reset valid flag
          this._isValidPosition = true;
          // reset update flag
          this._needsDataUpdate = true;
          this.draw();
        }
      }
    }
  };

  /**
   * Handle alpha function change.
   *
   * @param {object} event The event fired when changing the function.
   */
  _onAlphaFuncChange = (event) => {
    const skip = typeof event.skipGenerate !== 'undefined' &&
      event.skipGenerate === true;
    if (!skip) {
      this._needsDataUpdate = true;
      this.draw();
    }
  };

  /**
   * Set the current position.
   *
   * @param {Point} position The new position.
   * @param {Index} _index The new index.
   * @returns {boolean} True if the position was updated.
   */
  setCurrentPosition(position, _index) {
    return this._viewController.setCurrentPosition(position);
  }

  /**
   * Clear the context.
   */
  clear() {
    // clear the context: reset the transform first
    // store the current transformation matrix
    this._context.save();
    // use the identity matrix while clearing the canvas
    this._context.setTransform(1, 0, 0, 1, 0, 0);
    this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    // restore the transform
    this._context.restore();
  }

} // ViewLayer class
