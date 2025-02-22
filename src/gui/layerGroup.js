import {getIdentityMat33} from '../math/matrix';
import {getCoronalMat33} from '../math/orientation';
import {Index} from '../math/index';
import {Point} from '../math/point';
import {Vector3D} from '../math/vector';
import {viewEventNames} from '../image/view';
import {ListenerHandler} from '../utils/listen';
import {logger} from '../utils/logger';
import {precisionRound} from '../utils/string';
import {ViewLayer} from './viewLayer';
import {DrawLayer} from './drawLayer';

// doc imports
/* eslint-disable no-unused-vars */
import {Matrix33} from '../math/matrix';
import {Point2D, Point3D} from '../math/point';
import {Scalar2D, Scalar3D} from '../math/scalar';
/* eslint-enable no-unused-vars */

/**
 * Get the layer div id.
 *
 * @param {string} groupDivId The layer group div id.
 * @param {number} layerId The lyaer id.
 * @returns {string} A string id.
 */
export function getLayerDivId(groupDivId, layerId) {
  return groupDivId + '-layer-' + layerId;
}

/**
 * Get the layer details from a div id.
 *
 * @param {string} idString The layer div id.
 * @returns {object} The layer details as {groupDivId, layerId}.
 */
export function getLayerDetailsFromLayerDivId(idString) {
  const split = idString.split('-layer-');
  if (split.length !== 2) {
    logger.warn('Not the expected layer div id format...');
  }
  return {
    groupDivId: split[0],
    layerId: split[1]
  };
}

/**
 * Get the layer details from a mouse event.
 *
 * @param {object} event The event to get the layer div id from. Expecting
 * an event origininating from a canvas inside a layer HTML div
 * with the 'layer' class and id generated with `getLayerDivId`.
 * @returns {object} The layer details as {groupDivId, layerId}.
 */
export function getLayerDetailsFromEvent(event) {
  let res = null;
  // get the closest element from the event target and with the 'layer' class
  const layerDiv = event.target.closest('.layer');
  if (layerDiv && typeof layerDiv.id !== 'undefined') {
    res = getLayerDetailsFromLayerDivId(layerDiv.id);
  }
  return res;
}

/**
 * Get the view orientation according to an image and target orientation.
 * The view orientation is used to go from target to image space.
 *
 * @param {Matrix33} imageOrientation The image geometry.
 * @param {Matrix33} targetOrientation The target orientation.
 * @returns {Matrix33} The view orientation.
 */
export function getViewOrientation(imageOrientation, targetOrientation) {
  let viewOrientation = getIdentityMat33();
  if (typeof targetOrientation !== 'undefined') {
    // i: image, v: view, t: target, O: orientation, P: point
    // [Img] -- Oi --> [Real] <-- Ot -- [Target]
    // Pi = (Oi)-1 * Ot * Pt = Ov * Pt
    // -> Ov = (Oi)-1 * Ot
    // TODO: asOneAndZeros simplifies but not nice...
    viewOrientation =
      imageOrientation.asOneAndZeros().getInverse().multiply(targetOrientation);
  }
  // TODO: why abs???
  return viewOrientation.getAbs();
}

/**
 * Get the target orientation according to an image and view orientation.
 * The target orientation is used to go from target to real space.
 *
 * @param {Matrix33} imageOrientation The image geometry.
 * @param {Matrix33} viewOrientation The view orientation.
 * @returns {Matrix33} The target orientation.
 */
export function getTargetOrientation(imageOrientation, viewOrientation) {
  // i: image, v: view, t: target, O: orientation, P: point
  // [Img] -- Oi --> [Real] <-- Ot -- [Target]
  // Pi = (Oi)-1 * Ot * Pt = Ov * Pt
  // -> Ot = Oi * Ov
  // note: asOneAndZeros as in getViewOrientation...
  let targetOrientation =
    imageOrientation.asOneAndZeros().multiply(viewOrientation);

  // TODO: why abs???
  const simpleImageOrientation = imageOrientation.asOneAndZeros().getAbs();
  if (simpleImageOrientation.equals(getCoronalMat33().getAbs())) {
    targetOrientation = targetOrientation.getAbs();
  }

  return targetOrientation;
}

/**
 * Get a scaled offset to adapt to new scale and such as the input center
 * stays at the same position.
 *
 * @param {Scalar2D} offset The previous offset as {x,y}.
 * @param {Scalar2D} scale The previous scale as {x,y}.
 * @param {Scalar2D} newScale The new scale as {x,y}.
 * @param {Scalar2D} center The scale center as {x,y}.
 * @returns {Scalar2D} The scaled offset as {x,y}.
 */
export function getScaledOffset(offset, scale, newScale, center) {
  // worldPoint = indexPoint / scale + offset
  //=> indexPoint = (worldPoint - offset ) * scale

  // plane center should stay the same:
  // indexCenter / newScale + newOffset =
  //   indexCenter / oldScale + oldOffset
  //=> newOffset = indexCenter / oldScale + oldOffset -
  //     indexCenter / newScale
  //=> newOffset = worldCenter - indexCenter / newScale
  const indexCenter = {
    x: (center.x - offset.x) * scale.x,
    y: (center.y - offset.y) * scale.y
  };
  return {
    x: center.x - (indexCenter.x / newScale.x),
    y: center.y - (indexCenter.y / newScale.y)
  };
}

/**
 * Layer group.
 *
 * - Display position: {x,y},
 * - Plane position: Index (access: get(i)),
 * - (world) Position: Point3D (access: getX, getY, getZ).
 *
 * Display -> World:
 * - planePos = viewLayer.displayToPlanePos(displayPos)
 *   -> compensate for layer scale and offset,
 * - pos = viewController.getPositionFromPlanePoint(planePos).
 *
 * World -> Display:
 * - planePos = viewController.getOffset3DFromPlaneOffset(pos)
 *   no need yet for a planePos to displayPos...
 */
export class LayerGroup {

  /**
   * The container div.
   *
   * @type {HTMLElement}
   */
  _containerDiv;

  // jsdoc does not like
  // @type {(ViewLayer|DrawLayer)[]}

  /**
   * List of layers.
   *
   * @type {Array<ViewLayer|DrawLayer>}
   */
  _layers = [];

  /**
   * The layer scale as {x,y,z}.
   *
   * @type {Scalar3D}
   */
  _scale = {x: 1, y: 1, z: 1};

  /**
   * The base scale as {x,y,z}: all posterior scale will be on top of this one.
   *
   * @type {Scalar3D}
   */
  _baseScale = {x: 1, y: 1, z: 1};

  /**
   * The layer offset as {x,y,z}.
   *
   * @type {Scalar3D}
   */
  _offset = {x: 0, y: 0, z: 0};

  /**
   * Active view layer index.
   *
   * @type {number}
   */
  _activeViewLayerIndex = undefined;

  /**
   * Active draw layer index.
   *
   * @type {number}
   */
  _activeDrawLayerIndex = undefined;

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Flag to activate crosshair or not.
   *
   * @type {boolean}
   */
  _showCrosshair = false;

  /**
   * Crosshair HTML elements.
   *
   * @type {HTMLElement[]}
   */
  _crosshairHtmlElements = [];

  /**
   * Tooltip HTML element.
   *
   * @type {HTMLElement}
   */
  _tooltipHtmlElement;

  /**
   * The current position used for the crosshair.
   *
   * @type {Point}
   */
  _currentPosition;

  /**
   * Image smoothing flag.
   *
   * @type {boolean}
   */
  _imageSmoothing = false;

  /**
   * @param {HTMLElement} containerDiv The associated HTML div.
   */
  constructor(containerDiv) {
    this._containerDiv = containerDiv;
  }

  /**
   * Get the showCrosshair flag.
   *
   * @returns {boolean} True to display the crosshair.
   */
  getShowCrosshair() {
    return this._showCrosshair;
  }

  /**
   * Set the showCrosshair flag.
   *
   * @param {boolean} flag True to display the crosshair.
   */
  setShowCrosshair(flag) {
    this._showCrosshair = flag;
    if (flag) {
      // listen to offset and zoom change
      this.addEventListener('offsetchange', this._updateCrosshairOnChange);
      this.addEventListener('zoomchange', this._updateCrosshairOnChange);
      // show crosshair div
      this._showCrosshairDiv();
    } else {
      // listen to offset and zoom change
      this.removeEventListener('offsetchange', this._updateCrosshairOnChange);
      this.removeEventListener('zoomchange', this._updateCrosshairOnChange);
      // remove crosshair div
      this._removeCrosshairDiv();
    }
  }

  /**
   * Set the imageSmoothing flag value.
   *
   * @param {boolean} flag True to enable smoothing.
   */
  setImageSmoothing(flag) {
    this._imageSmoothing = flag;
    // set for existing layers
    for (const layer of this._layers) {
      if (layer instanceof ViewLayer) {
        layer.setImageSmoothing(flag);
      }
    }
  }

  /**
   * Update crosshair on offset or zoom change.
   *
   * @param {object} _event The change event.
   */
  _updateCrosshairOnChange = (_event) => {
    this._showCrosshairDiv();
  };

  /**
   * Get the Id of the container div.
   *
   * @returns {string} The id of the div.
   */
  getDivId() {
    return this._containerDiv.id;
  }

  /**
   * Get the layer scale.
   *
   * @returns {Scalar3D} The scale as {x,y,z}.
   */
  getScale() {
    return this._scale;
  }

  /**
   * Get the base scale.
   *
   * @returns {Scalar3D} The scale as {x,y,z}.
   */
  getBaseScale() {
    return this._baseScale;
  }

  /**
   * Get the added scale: the scale added to the base scale.
   *
   * @returns {Scalar3D} The scale as {x,y,z}.
   */
  getAddedScale() {
    return {
      x: this._scale.x / this._baseScale.x,
      y: this._scale.y / this._baseScale.y,
      z: this._scale.z / this._baseScale.z
    };
  }

  /**
   * Get the layer offset.
   *
   * @returns {Scalar3D} The offset as {x,y,z}.
   */
  getOffset() {
    return this._offset;
  }

  /**
   * Get the number of layers handled by this class.
   *
   * @returns {number} The number of layers.
   */
  getNumberOfLayers() {
    let count = 0;
    this._layers.forEach(item => {
      if (typeof item !== 'undefined') {
        count++;
      }
    });
    return count;
  }

  /**
   * Check if this layerGroup contains a layer with the input id.
   *
   * @param {string} id The layer id to look for.
   * @returns {boolean} True if this group contains
   *   a layer with the input id.
   */
  includes(id) {
    if (typeof id === 'undefined') {
      return false;
    }
    for (const layer of this._layers) {
      if (typeof layer !== 'undefined' &&
        layer.getId() === id) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the number of view layers handled by this class.
   *
   * @returns {number} The number of layers.
   */
  getNumberOfViewLayers() {
    let count = 0;
    this._layers.forEach(item => {
      if (typeof item !== 'undefined' &&
        item instanceof ViewLayer) {
        count++;
      }
    });
    return count;
  }

  /**
   * Get the active image layer.
   *
   * @returns {ViewLayer|undefined} The layer.
   */
  getActiveViewLayer() {
    let layer;
    if (typeof this._activeViewLayerIndex !== 'undefined') {
      const tmpLayer = this._layers[this._activeViewLayerIndex];
      if (tmpLayer instanceof ViewLayer) {
        layer = tmpLayer;
      }
    } else {
      logger.info('No active view layer to return');
    }
    return layer;
  }

  /**
   * Get the base view layer.
   *
   * @returns {ViewLayer|undefined} The layer.
   */
  getBaseViewLayer() {
    let layer;
    if (this._layers[0] instanceof ViewLayer) {
      layer = this._layers[0];
    }
    return layer;
  }

  /**
   * Get the view layers associated to a data id.
   *
   * @param {string} dataId The data id.
   * @returns {ViewLayer[]} The layers.
   */
  getViewLayersByDataId(dataId) {
    const res = [];
    for (const layer of this._layers) {
      if (layer instanceof ViewLayer &&
        layer.getDataId() === dataId) {
        res.push(layer);
      }
    }
    return res;
  }

  /**
   * Search view layers for equal imae meta data.
   *
   * @param {object} meta The meta data to find.
   * @returns {ViewLayer[]} The list of view layers that contain matched data.
   */
  searchViewLayers(meta) {
    const res = [];
    for (const layer of this._layers) {
      if (layer instanceof ViewLayer) {
        if (layer.getViewController().equalImageMeta(meta)) {
          res.push(layer);
        }
      }
    }
    return res;
  }

  /**
   * Get the view layers data indices.
   *
   * @returns {string[]} The list of indices.
   */
  getViewDataIndices() {
    const res = [];
    for (const layer of this._layers) {
      if (layer instanceof ViewLayer) {
        res.push(layer.getDataId());
      }
    }
    return res;
  }

  /**
   * Get the active draw layer.
   *
   * @returns {DrawLayer|undefined} The layer.
   */
  getActiveDrawLayer() {
    let layer;
    if (typeof this._activeDrawLayerIndex !== 'undefined') {
      const tmpLayer = this._layers[this._activeDrawLayerIndex];
      if (tmpLayer instanceof DrawLayer) {
        layer = tmpLayer;
      }
    } else {
      logger.info('No active draw layer to return');
    }
    return layer;
  }

  /**
   * Get the draw layers associated to a data id.
   *
   * @param {string} dataId The data id.
   * @returns {DrawLayer[]} The layers.
   */
  getDrawLayersByDataId(dataId) {
    const res = [];
    for (const layer of this._layers) {
      if (layer instanceof DrawLayer &&
        layer.getDataId() === dataId) {
        res.push(layer);
      }
    }
    return res;
  }

  /**
   * Set the active view layer.
   *
   * @param {number} index The index of the layer to set as active.
   */
  setActiveViewLayer(index) {
    if (this._layers[index] instanceof ViewLayer) {
      this._activeViewLayerIndex = index;
      /**
       * Active view layer change event.
       *
       * @event LayerGroup_activeviewlayerchange
       * @type {object}
       * @property {Array} value The changed value.
       */
      this._fireEvent({
        type: 'activelayerchange',
        value: [this._layers[index]]
      });
    } else {
      logger.warn('No view layer to set as active with index: ' +
        index);
    }
  }

  /**
   * Set the active view layer with a data id.
   *
   * @param {string} dataId The data id.
   */
  setActiveViewLayerByDataId(dataId) {
    let index;
    for (let i = 0; i < this._layers.length; ++i) {
      if (this._layers[i] instanceof ViewLayer &&
        this._layers[i].getDataId() === dataId) {
        // stop at first one
        index = i;
        break;
      }
    }
    if (typeof index !== 'undefined') {
      this.setActiveViewLayer(index);
    } else {
      logger.warn('No view layer to set as active with dataId: ' +
        dataId);
    }
  }

  /**
   * Set the active draw layer.
   *
   * @param {number} index The index of the layer to set as active.
   */
  setActiveDrawLayer(index) {
    if (this._layers[index] instanceof DrawLayer) {
      this._activeDrawLayerIndex = index;
      this._fireEvent({
        type: 'activelayerchange',
        value: [this._layers[index]]
      });
    } else {
      logger.warn('No draw layer to set as active with index: ' +
        index);
    }
  }

  /**
   * Set the active draw layer with a data id.
   *
   * @param {string} dataId The data id.
   */
  setActiveDrawLayerByDataId(dataId) {
    let index;
    for (let i = 0; i < this._layers.length; ++i) {
      if (this._layers[i] instanceof DrawLayer &&
        this._layers[i].getDataId() === dataId) {
        // stop at first one
        index = i;
        break;
      }
    }
    if (typeof index !== 'undefined') {
      this.setActiveDrawLayer(index);
    } else {
      logger.warn('No draw layer to set as active with dataId: ' +
        dataId);
    }
  }

  /**
   * Add a view layer.
   *
   * The new layer will be marked as the active view layer.
   *
   * @returns {ViewLayer} The created layer.
   */
  addViewLayer() {
    // layer index
    const viewLayerIndex = this._layers.length;
    // create div
    const div = this._getNextLayerDiv();
    // prepend to container
    this._containerDiv.append(div);
    // view layer
    const layer = new ViewLayer(div);
    layer.setImageSmoothing(this._imageSmoothing);
    // add layer
    this._layers.push(layer);
    // mark it as active
    this.setActiveViewLayer(viewLayerIndex);
    // bind view layer events
    this._bindViewLayer(layer);
    // return
    return layer;
  }

  /**
   * Add a draw layer.
   *
   * The new layer will be marked as the active draw layer.
   *
   * @returns {DrawLayer} The created layer.
   */
  addDrawLayer() {
    // store active index
    this._activeDrawLayerIndex = this._layers.length;
    // create div
    const div = this._getNextLayerDiv();
    // prepend to container
    this._containerDiv.append(div);
    // draw layer
    const layer = new DrawLayer(div);
    // add layer
    this._layers.push(layer);
    // bind draw layer events
    this._bindDrawLayer(layer);
    // return
    return layer;
  }

  /**
   * Bind view layer events to this.
   *
   * @param {ViewLayer} viewLayer The view layer to bind.
   */
  _bindViewLayer(viewLayer) {
    // listen to position change to update other group layers
    viewLayer.addEventListener(
      'positionchange', this.updateLayersToPositionChange);
    // propagate view viewLayer-layer events
    for (const eventName of viewEventNames) {
      viewLayer.addEventListener(eventName, this._fireEvent);
    }
    // propagate viewLayer events
    viewLayer.addEventListener('renderstart', this._fireEvent);
    viewLayer.addEventListener('renderend', this._fireEvent);
  }

  /**
   * Un-bind a view layer events to this.
   *
   * @param {ViewLayer} viewLayer The view layer to unbind.
   */
  _unbindViewLayer(viewLayer) {
    // stop listening to position change to update other group layers
    viewLayer.removeEventListener(
      'positionchange', this.updateLayersToPositionChange);
    // stop propagating view viewLayer-layer events
    for (const eventName of viewEventNames) {
      viewLayer.removeEventListener(eventName, this._fireEvent);
    }
    // stop propagating viewLayer events
    viewLayer.removeEventListener('renderstart', this._fireEvent);
    viewLayer.removeEventListener('renderend', this._fireEvent);

    // stop view layer - image binding
    // (binding is done in layer.setView)
    viewLayer.unbindImage();
  }

  /**
   * Bind draw layer events to this.
   *
   * @param {DrawLayer} drawLayer The draw layer to bind.
   */
  _bindDrawLayer(drawLayer) {
    // propagate drawLayer events
    drawLayer.addEventListener('drawcreate', this._fireEvent);
    drawLayer.addEventListener('drawdelete', this._fireEvent);
  }

  /**
   * Un-bind a draw layer events to this.
   *
   * @param {DrawLayer} drawLayer The draw layer to unbind.
   */
  _unbindDrawLayer(drawLayer) {
    // propagate drawLayer events
    drawLayer.removeEventListener('drawcreate', this._fireEvent);
    drawLayer.removeEventListener('drawdelete', this._fireEvent);
  }

  /**
   * Get the next layer DOM div.
   *
   * @returns {HTMLDivElement} A DOM div.
   */
  _getNextLayerDiv() {
    const div = document.createElement('div');
    div.id = getLayerDivId(this.getDivId(), this._layers.length);
    div.className = 'layer';
    div.style.pointerEvents = 'none';
    return div;
  }

  /**
   * Empty the layer list.
   */
  empty() {
    this._layers = [];
    // reset active indices
    this._activeViewLayerIndex = undefined;
    this._activeDrawLayerIndex = undefined;
    // remove possible crosshair
    this._removeCrosshairDiv();
    // clean container div
    const previous = this._containerDiv.getElementsByClassName('layer');
    if (previous) {
      while (previous.length > 0) {
        previous[0].remove();
      }
    }
  }

  /**
   * Remove all layers for a specific data.
   *
   * @param {string} dataId The data to remove its layers.
   */
  removeLayersByDataId(dataId) {
    for (const layer of this._layers) {
      if (typeof layer !== 'undefined' &&
        layer.getDataId() === dataId) {
        this.removeLayer(layer);
      }
    }
  }

  /**
   * Remove a layer from this layer group.
   * Warning: if current active layer, the index will
   *   be set to `undefined`. Call one of the setActive
   *   methods to define the active index.
   *
   * @param {ViewLayer | DrawLayer} layer The layer to remove.
   */
  removeLayer(layer) {
    // find layer
    const index = this._layers.findIndex((item) => item === layer);
    if (index === -1) {
      throw new Error('Cannot find layer to remove');
    }
    // unbind and update active index
    if (layer instanceof ViewLayer) {
      this._unbindViewLayer(layer);
      if (this._activeViewLayerIndex === index) {
        if (index - 2 >= 0) {
          this.setActiveViewLayer(index - 2);
        } else {
          this._activeViewLayerIndex = undefined;
        }
      }
    } else {
      // delete layer draws
      const numberOfDraws = layer.getNumberOfDraws();
      if (typeof numberOfDraws !== 'undefined') {
        let count = 0;
        layer.addEventListener('drawdelete', (_event) => {
          ++count;
          // unbind when all draw are deleted
          if (count === numberOfDraws) {
            this._unbindDrawLayer(layer);
          }
        });
      }
      layer.deleteDraws();
      if (typeof numberOfDraws === 'undefined') {
        this._unbindDrawLayer(layer);
      }
      // reset active index
      if (this._activeDrawLayerIndex === index) {
        if (index - 2 >= 0) {
          this.setActiveDrawLayer(index - 2);
        } else {
          this._activeDrawLayerIndex = undefined;
        }
      }
    }
    // reset in storage
    this._layers[index] = undefined;
    // update html
    layer.removeFromDOM();
  }

  /**
   * Show a crosshair at a given position.
   *
   * @param {Point} [position] The position where to show the crosshair,
   *   defaults to current position.
   */
  _showCrosshairDiv(position) {
    if (typeof position === 'undefined') {
      position = this._currentPosition;
    }

    // remove previous
    this._removeCrosshairDiv();

    // use first layer as base for calculating position and
    // line sizes
    let baseLayer;
    for (const layer of this._layers) {
      if (layer instanceof ViewLayer) {
        baseLayer = layer;
        break;
      }
    }
    if (typeof baseLayer === 'undefined') {
      logger.warn('No layer to show crosshair');
      return;
    }

    const vc = baseLayer.getViewController();
    const planePos = vc.getPlanePositionFromPosition(position);
    const displayPos = baseLayer.planePosToDisplay(planePos);

    // horizontal line
    if (typeof displayPos.getY() !== 'undefined') {
      const lineH = document.createElement('hr');
      lineH.id = this.getDivId() + '-scroll-crosshair-horizontal';
      lineH.className = 'horizontal';
      lineH.style.width = this._containerDiv.offsetWidth + 'px';
      lineH.style.left = '0px';
      lineH.style.top = displayPos.getY() + 'px';
      // add to local array
      this._crosshairHtmlElements.push(lineH);
      // add to html
      this._containerDiv.appendChild(lineH);
    }

    // vertical line
    if (typeof displayPos.getX() !== 'undefined') {
      const lineV = document.createElement('hr');
      lineV.id = this.getDivId() + '-scroll-crosshair-vertical';
      lineV.className = 'vertical';
      lineV.style.width = this._containerDiv.offsetHeight + 'px';
      lineV.style.left = (displayPos.getX()) + 'px';
      lineV.style.top = '0px';
      // add to local array
      this._crosshairHtmlElements.push(lineV);
      // add to html
      this._containerDiv.appendChild(lineV);
    }
  }

  /**
   * Remove crosshair divs.
   */
  _removeCrosshairDiv() {
    for (const element of this._crosshairHtmlElements) {
      element.remove();
    }
    this._crosshairHtmlElements = [];
  }

  /**
   * Displays a tooltip in a temporary `span`.
   * Works with css to hide/show the span only on mouse hover.
   *
   * @param {Point2D} point The update point.
   */
  showTooltip(point) {
    // remove previous div
    this.removeTooltipDiv();

    const viewLayer = this.getActiveViewLayer();
    const viewController = viewLayer.getViewController();
    const planePos = viewLayer.displayToPlanePos(point);
    const position = viewController.getPositionFromPlanePoint(planePos);
    const value = viewController.getRescaledImageValue(position);

    // create
    if (typeof value !== 'undefined') {
      const span = document.createElement('span');
      span.id = 'scroll-tooltip';
      // tooltip position
      span.style.left = (point.getX() + 10) + 'px';
      span.style.top = (point.getY() + 10) + 'px';
      let text = precisionRound(value, 3).toString();
      if (typeof viewController.getPixelUnit() !== 'undefined') {
        text += ' ' + viewController.getPixelUnit();
      }
      span.appendChild(document.createTextNode(text));
      // add to local var
      this._tooltipHtmlElement = span;
      // add to html
      this._containerDiv.appendChild(span);
    }
  }

  /**
   * Remove the tooltip html div.
   */
  removeTooltipDiv() {
    if (typeof this._tooltipHtmlElement !== 'undefined') {
      this._tooltipHtmlElement.remove();
      this._tooltipHtmlElement = undefined;
    }
  }


  /**
   * Test if one of the view layers satisfies an input callbackFn.
   *
   * @param {Function} callbackFn A function that takes a ViewLayer as input
   *   and returns a boolean.
   * @returns {boolean} True if one of the ViewLayers satisfies the callbackFn.
   */
  someViewLayer(callbackFn) {
    let hasOne = false;
    for (const layer of this._layers) {
      if (layer instanceof ViewLayer &&
        callbackFn(layer)) {
        hasOne = true;
        break;
      }
    }
    return hasOne;
  }

  /**
   * Can the input position be set on one of the view layers.
   *
   * @param {Point} position The input position.
   * @returns {boolean} True if one view layer accepts the input position.
   */
  isPositionInBounds(position) {
    return this.someViewLayer(function (layer) {
      return layer.getViewController().isPositionInBounds(position);
    });
  }

  /**
   * Can one of the view layers be scrolled.
   *
   * @returns {boolean} True if one view layer can be scrolled.
   */
  canScroll() {
    return this.someViewLayer(function (layer) {
      return layer.getViewController().canScroll();
    });
  }

  /**
   * Does one of the view layer have more than one slice in the
   *   given dimension.
   *
   * @param {number} dim The input dimension.
   * @returns {boolean} True if one view layer has more than one slice.
   */
  moreThanOne(dim) {
    return this.someViewLayer(function (layer) {
      return layer.getViewController().moreThanOne(dim);
    });
  }

  /**
   * Update layers (but not the active view layer) to a position change.
   *
   * @param {object} event The position change event.
   * @function
   */
  updateLayersToPositionChange = (event) => {
    // pause positionchange listeners
    for (const layer of this._layers) {
      if (layer instanceof ViewLayer) {
        layer.removeEventListener(
          'positionchange', this.updateLayersToPositionChange);
        layer.removeEventListener('positionchange', this._fireEvent);
      }
    }

    const index = new Index(event.value[0]);
    const position = new Point(event.value[1]);

    // store current position
    this._currentPosition = position;

    if (this._showCrosshair) {
      this._showCrosshairDiv(position);
    }

    // origin of the first view layer
    let baseViewLayerOrigin0;
    let baseViewLayerOrigin;
    let scrollOffset;
    let planeOffset;
    // update position for all layers except the source one
    for (const layer of this._layers) {
      if (typeof layer === 'undefined') {
        continue;
      }

      // update base offset (does not trigger redraw)
      let hasSetOffset = false;
      if (layer instanceof ViewLayer) {
        const vc = layer.getViewController();
        // origin0 should always be there
        const origin0 = vc.getOrigin();
        // depending on position, origin could be undefined
        const origin = vc.getOrigin(position);

        if (typeof baseViewLayerOrigin === 'undefined') {
          // first view layer, store origins
          baseViewLayerOrigin0 = origin0;
          baseViewLayerOrigin = origin;
          // no offset
          scrollOffset = new Vector3D(0, 0, 0);
          planeOffset = new Vector3D(0, 0, 0);
        } else {
          if (vc.isPositionInBounds(position) &&
            typeof origin !== 'undefined') {
            // TODO: compensate for possible different orientation between views
            const scrollDiff = baseViewLayerOrigin0.minus(origin0);
            scrollOffset = new Vector3D(
              scrollDiff.getX(), scrollDiff.getY(), scrollDiff.getZ());
            const planeDiff = baseViewLayerOrigin.minus(origin);
            planeOffset = new Vector3D(
              planeDiff.getX(), planeDiff.getY(), planeDiff.getZ());
          }
        }
      }

      // also set for draw layers
      // (should be next after a view layer)
      if (typeof scrollOffset !== 'undefined' &&
        typeof planeOffset !== 'undefined') {
        hasSetOffset =
          layer.setBaseOffset(
            scrollOffset, planeOffset,
            baseViewLayerOrigin, baseViewLayerOrigin0
          );
      }

      // reset to not propagate after draw layer
      // TODO: revise, could be unstable...
      if (layer instanceof DrawLayer) {
        scrollOffset = undefined;
        planeOffset = undefined;
      }

      // update position (triggers redraw)
      let hasSetPos = false;
      if (layer.getId() !== event.srclayerid) {
        hasSetPos = layer.setCurrentPosition(position, index);
      }

      // force redraw if needed
      if (!hasSetPos && hasSetOffset) {
        layer.draw();
      }
    }

    // re-start positionchange listeners
    for (const layer of this._layers) {
      if (layer instanceof ViewLayer) {
        layer.addEventListener(
          'positionchange', this.updateLayersToPositionChange);
        layer.addEventListener('positionchange', this._fireEvent);
      }
    }
  };

  /**
   * Calculate the div to world size ratio needed to fit
   *   the largest data.
   *
   * @returns {number|undefined} The ratio.
   */
  getDivToWorldSizeRatio() {
    // check container
    if (this._containerDiv.offsetWidth === 0 &&
      this._containerDiv.offsetHeight === 0) {
      throw new Error('Cannot fit to zero sized container.');
    }
    // get max world size
    const maxWorldSize = this.getMaxWorldSize();
    if (typeof maxWorldSize === 'undefined') {
      return undefined;
    }
    // if the container has a width but no height,
    // resize it to follow the same ratio to completely
    // fill the div with the image
    if (this._containerDiv.offsetHeight === 0) {
      const ratioX = this._containerDiv.offsetWidth / maxWorldSize.x;
      const height = maxWorldSize.y * ratioX;
      this._containerDiv.style.height = height + 'px';
    }
    // return best fit
    return Math.min(
      this._containerDiv.offsetWidth / maxWorldSize.x,
      this._containerDiv.offsetHeight / maxWorldSize.y
    );
  }

  /**
   * Fit to container: set the layers div to world size ratio.
   *
   * @param {number} divToWorldSizeRatio The ratio.
   */
  fitToContainer(divToWorldSizeRatio) {
    // get maximum world size
    const maxWorldSize = this.getMaxWorldSize();
    // exit if none
    if (typeof maxWorldSize === 'undefined') {
      return;
    }

    const containerSize = {
      x: this._containerDiv.offsetWidth,
      y: this._containerDiv.offsetHeight
    };
    // offset to keep data centered
    const fitOffset = {
      x: -0.5 *
        (containerSize.x - Math.floor(maxWorldSize.x * divToWorldSizeRatio)),
      y: -0.5 *
        (containerSize.y - Math.floor(maxWorldSize.y * divToWorldSizeRatio))
    };

    // apply to layers
    for (const layer of this._layers) {
      if (typeof layer !== 'undefined') {
        layer.fitToContainer(containerSize, divToWorldSizeRatio, fitOffset);
      }
    }

    // update crosshair
    if (this._showCrosshair) {
      this._showCrosshairDiv();
    }
  }

  /**
   * Get the largest data world (mm) size.
   *
   * @returns {Scalar2D|undefined} The largest size as {x,y}.
   */
  getMaxWorldSize() {
    let maxSize = {x: 0, y: 0};
    for (const layer of this._layers) {
      if (layer instanceof ViewLayer) {
        const size = layer.getImageWorldSize();
        if (size.x > maxSize.x) {
          maxSize.x = size.x;
        }
        if (size.y > maxSize.y) {
          maxSize.y = size.y;
        }
      }
    }
    if (maxSize.x === 0 && maxSize.y === 0) {
      maxSize = undefined;
    }
    return maxSize;
  }

  /**
   * Flip all layers along the Z axis without offset compensation.
   */
  flipScaleZ() {
    this._baseScale.z *= -1;
    this.setScale(this._baseScale);
  }

  /**
   * Add scale to the layers. Scale cannot go lower than 0.1.
   *
   * @param {number} scaleStep The scale to add.
   * @param {Point3D} center The scale center Point3D.
   */
  addScale(scaleStep, center) {
    const newScale = {
      x: this._scale.x * (1 + scaleStep),
      y: this._scale.y * (1 + scaleStep),
      z: this._scale.z * (1 + scaleStep)
    };
    this.setScale(newScale, center);
  }

  /**
   * Set the layers' scale.
   *
   * @param {Scalar3D} newScale The scale to apply as {x,y,z}.
   * @param {Point3D} [center] The scale center Point3D.
   * @fires LayerGroup_zoomchange
   */
  setScale(newScale, center) {
    this._scale = newScale;
    // apply to layers
    for (const layer of this._layers) {
      if (typeof layer !== 'undefined') {
        layer.setScale(this._scale, center);
      }
    }

    // event value
    const value = [
      newScale.x,
      newScale.y,
      newScale.z
    ];
    if (typeof center !== 'undefined') {
      value.push(center.getX());
      value.push(center.getY());
      value.push(center.getZ());
    }

    /**
     * Zoom change event.
     *
     * @event LayerGroup_zoomchange
     * @type {object}
     * @property {Array} value The changed value.
     */
    this._fireEvent({
      type: 'zoomchange',
      value: value
    });
  }

  /**
   * Add translation to the layers.
   *
   * @param {Scalar3D} translation The translation as {x,y,z}.
   */
  addTranslation(translation) {
    this.setOffset({
      x: this._offset.x - translation.x,
      y: this._offset.y - translation.y,
      z: this._offset.z - translation.z
    });
  }

  /**
   * Set the layers' offset.
   *
   * @param {Scalar3D} newOffset The offset as {x,y,z}.
   * @fires LayerGroup_offsetchange
   */
  setOffset(newOffset) {
    // store
    this._offset = newOffset;
    // apply to layers
    for (const layer of this._layers) {
      if (typeof layer !== 'undefined') {
        layer.setOffset(this._offset);
      }
    }

    /**
     * Offset change event.
     *
     * @event LayerGroup_offsetchange
     * @type {object}
     * @property {Array} value The changed value.
     */
    this._fireEvent({
      type: 'offsetchange',
      value: [
        this._offset.x,
        this._offset.y,
        this._offset.z
      ]
    });
  }

  /**
   * Reset the stage to its initial scale and no offset.
   */
  reset() {
    this.setScale(this._baseScale);
    this.setOffset({x: 0, y: 0, z: 0});
  }

  /**
   * Draw the layer.
   */
  draw() {
    for (const layer of this._layers) {
      if (typeof layer !== 'undefined') {
        layer.draw();
      }
    }
  }

  /**
   * Display the layer.
   *
   * @param {boolean} flag Whether to display the layer or not.
   */
  display(flag) {
    for (const layer of this._layers) {
      if (typeof layer !== 'undefined') {
        layer.display(flag);
      }
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
    this._listenerHandler.fireEvent(event);
  };

} // LayerGroup class
