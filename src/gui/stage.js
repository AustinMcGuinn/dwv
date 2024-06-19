import {Point, Point3D} from '../math/point';
import {WindowLevel} from '../image/windowLevel';
import {LayerGroup} from './layerGroup';
import {logger} from '../utils/logger';

// doc imports
/* eslint-disable no-unused-vars */
import {ViewLayer} from '../gui/viewLayer';
import {DrawLayer} from '../gui/drawLayer';
/* eslint-enable no-unused-vars */

/**
 * Window/level binder.
 */
export class WindowLevelBinder {
  getEventType = function () {
    return 'wlchange';
  };
  getCallback = function (layerGroup) {
    return function (event) {
      const viewLayers = layerGroup.getViewLayersByDataId(event.dataid);
      if (viewLayers.length !== 0) {
        const vc = viewLayers[0].getViewController();
        if (event.value.length === 2) {
          const wl = new WindowLevel(event.value[0], event.value[1]);
          vc.setWindowLevel(wl);
        }
        if (event.value.length === 3) {
          vc.setWindowLevelPreset(event.value[2]);
        }
      }
    };
  };
}

/**
 * Colour map binder.
 */
export class ColourMapBinder {
  getEventType = function () {
    return 'colourmapchange';
  };
  getCallback = function (layerGroup) {
    return function (event) {
      const viewLayers = layerGroup.getViewLayersByDataId(event.dataid);
      if (viewLayers.length !== 0) {
        const vc = viewLayers[0].getViewController();
        vc.setColourMap(event.value[0]);
      }
    };
  };
}

/**
 * Position binder.
 */
export class PositionBinder {
  getEventType = function () {
    return 'positionchange';
  };
  getCallback = function (layerGroup) {
    return function (event) {
      const pointValues = event.value[1];
      const vc = layerGroup.getActiveViewLayer().getViewController();
      // handle different number of dimensions
      const currentPos = vc.getCurrentPosition();
      const currentDims = currentPos.length();
      const inputDims = pointValues.length;
      if (inputDims !== currentDims) {
        if (inputDims === currentDims - 1) {
          // add missing dim, for ex: input 3D -> current 4D
          pointValues.push(currentPos.get(currentDims - 1));
        } else if (inputDims === currentDims + 1) {
          // remove extra dim, for ex: input 4D -> current 3D
          pointValues.pop();
        }
      }
      vc.setCurrentPosition(new Point(pointValues));
    };
  };
}

/**
 * Zoom binder.
 */
export class ZoomBinder {
  getEventType = function () {
    return 'zoomchange';
  };
  getCallback = function (layerGroup) {
    return function (event) {
      const scale = {
        x: event.value[0],
        y: event.value[1],
        z: event.value[2]
      };
      let center;
      if (event.value.length === 6) {
        center = new Point3D(
          event.value[3],
          event.value[4],
          event.value[5]
        );
      }
      layerGroup.setScale(scale, center);
      layerGroup.draw();
    };
  };
}

/**
 * Offset binder.
 */
export class OffsetBinder {
  getEventType = function () {
    return 'offsetchange';
  };
  getCallback = function (layerGroup) {
    return function (event) {
      layerGroup.setOffset({
        x: event.value[0],
        y: event.value[1],
        z: event.value[2]
      });
      layerGroup.draw();
    };
  };
}

/**
 * Opacity binder. Only propagates to view layers of the same data.
 */
export class OpacityBinder {
  getEventType = function () {
    return 'opacitychange';
  };
  getCallback = function (layerGroup) {
    return function (event) {
      // exit if no data id
      if (typeof event.dataid === 'undefined') {
        return;
      }
      // propagate to first view layer
      const viewLayers = layerGroup.getViewLayersByDataId(event.dataid);
      if (viewLayers.length !== 0) {
        viewLayers[0].setOpacity(event.value);
        viewLayers[0].draw();
      }
    };
  };
}

/**
 * List of binders.
 */
export const binderList = {
  WindowLevelBinder,
  PositionBinder,
  ZoomBinder,
  OffsetBinder,
  OpacityBinder,
  ColourMapBinder
};

/**
 * Stage: controls a list of layer groups and their
 * synchronisation.
 */
export class Stage {

  /**
   * Associated layer groups.
   *
   * @type {LayerGroup[]}
   */
  _layerGroups = [];

  /**
   * Active layer group index.
   *
   * @type {number|undefined}
   */
  _activeLayerGroupIndex;

  /**
   * Image smoothing flag.
   *
   * @type {boolean}
   */
  _imageSmoothing = false;

  // layer group binders
  _binders = [];
  // binder callbacks
  _callbackStore = null;

  /**
   * Get the layer group at the given index.
   *
   * @param {number} index The index.
   * @returns {LayerGroup|undefined} The layer group.
   */
  getLayerGroup(index) {
    return this._layerGroups[index];
  }

  /**
   * Get the number of layer groups that form the stage.
   *
   * @returns {number} The number of layer groups.
   */
  getNumberOfLayerGroups() {
    return this._layerGroups.length;
  }

  /**
   * Get the active layer group.
   *
   * @returns {LayerGroup|undefined} The layer group.
   */
  getActiveLayerGroup() {
    return this.getLayerGroup(this._activeLayerGroupIndex);
  }

  /**
   * Set the active layer group.
   *
   * @param {number} index The layer group index.
   */
  setActiveLayerGroup(index) {
    if (typeof this.getLayerGroup(index) !== 'undefined') {
      this._activeLayerGroupIndex = index;
    } else {
      logger.warn('No layer group to set as active with index: ' +
        index);
    }
  }

  /**
   * Get the view layers associated to a data id.
   *
   * @param {string} dataId The data id.
   * @returns {ViewLayer[]} The layers.
   */
  getViewLayersByDataId(dataId) {
    let res = [];
    for (let i = 0; i < this._layerGroups.length; ++i) {
      res = res.concat(this._layerGroups[i].getViewLayersByDataId(dataId));
    }
    return res;
  }

  /**
   * Get the draw layers associated to a data id.
   *
   * @param {string} dataId The data id.
   * @returns {DrawLayer[]} The layers.
   */
  getDrawLayersByDataId(dataId) {
    let res = [];
    for (let i = 0; i < this._layerGroups.length; ++i) {
      res = res.concat(this._layerGroups[i].getDrawLayersByDataId(dataId));
    }
    return res;
  }

  /**
   * Add a layer group to the list.
   *
   * The new layer group will be marked as the active layer group.
   *
   * @param {object} htmlElement The HTML element of the layer group.
   * @returns {LayerGroup} The newly created layer group.
   */
  addLayerGroup(htmlElement) {
    this._activeLayerGroupIndex = this._layerGroups.length;
    const layerGroup = new LayerGroup(htmlElement);
    layerGroup.setImageSmoothing(this._imageSmoothing);
    // add to storage
    const isBound = this._callbackStore && this._callbackStore.length !== 0;
    if (isBound) {
      this.unbindLayerGroups();
    }
    this._layerGroups.push(layerGroup);
    if (isBound) {
      this.bindLayerGroups();
    }
    // return created group
    return layerGroup;
  }

  /**
   * Get a layer group from an HTML element id.
   *
   * @param {string} id The element id to find.
   * @returns {LayerGroup} The layer group.
   */
  getLayerGroupByDivId(id) {
    return this._layerGroups.find(function (item) {
      return item.getDivId() === id;
    });
  }

  /**
   * Set the layer groups binders.
   *
   * @param {Array} list The list of binder objects.
   */
  setBinders(list) {
    if (typeof list === 'undefined' || list === null) {
      throw new Error('Cannot set null or undefined binders');
    }
    if (this._binders.length !== 0) {
      this.unbindLayerGroups();
    }
    this._binders = list.slice();
    this.bindLayerGroups();
  }

  /**
   * Empty the layer group list.
   */
  empty() {
    this.unbindLayerGroups();
    for (let i = 0; i < this._layerGroups.length; ++i) {
      this._layerGroups[i].empty();
    }
    this._layerGroups = [];
    this._activeLayerGroupIndex = undefined;
  }

  /**
   * Remove all layers for a specific data.
   *
   * @param {string} dataId The data to remove its layers.
   */
  removeLayersByDataId(dataId) {
    for (const layerGroup of this._layerGroups) {
      layerGroup.removeLayersByDataId(dataId);
    }
  }

  /**
   * Remove a layer group from this stage.
   *
   * @param {LayerGroup} layerGroup The layer group to remove.
   */
  removeLayerGroup(layerGroup) {
    // find layer
    const index = this._layerGroups.findIndex((item) => item === layerGroup);
    if (index === -1) {
      throw new Error('Cannot find layerGroup to remove');
    }
    // unbind
    this.unbindLayerGroups();
    // empty layer group
    layerGroup.empty();
    // remove from storage
    this._layerGroups.splice(index, 1);
    // update active index
    if (this._activeLayerGroupIndex === index) {
      this._activeLayerGroupIndex = undefined;
    }
    // bind
    this.bindLayerGroups();
  }

  /**
   * Reset the stage: calls reset on all layer groups.
   */
  reset() {
    for (let i = 0; i < this._layerGroups.length; ++i) {
      this._layerGroups[i].reset();
    }
  }

  /**
   * Draw the stage: calls draw on all layer groups.
   */
  draw() {
    for (let i = 0; i < this._layerGroups.length; ++i) {
      this._layerGroups[i].draw();
    }
  }

  /**
   * Fit to container: synchronise the div to world size ratio
   *   of the group layers.
   */
  fitToContainer() {
    // find the minimum ratio
    let minRatio;
    const hasRatio = [];
    for (let i = 0; i < this._layerGroups.length; ++i) {
      const ratio = this._layerGroups[i].getDivToWorldSizeRatio();
      if (typeof ratio !== 'undefined') {
        hasRatio.push(i);
        if (typeof minRatio === 'undefined' || ratio < minRatio) {
          minRatio = ratio;
        }
      }
    }
    // exit if no ratio
    if (typeof minRatio === 'undefined') {
      return;
    }
    // apply min ratio to layers
    for (let j = 0; j < this._layerGroups.length; ++j) {
      if (hasRatio.includes(j)) {
        this._layerGroups[j].fitToContainer(minRatio);
      }
    }
  }

  /**
   * Bind the layer groups of the stage.
   */
  bindLayerGroups() {
    if (this._layerGroups.length === 0 ||
      this._layerGroups.length === 1 ||
      this._binders.length === 0) {
      return;
    }
    // create callback store
    this._callbackStore = new Array(this._layerGroups.length);
    // add listeners
    for (let i = 0; i < this._layerGroups.length; ++i) {
      for (let j = 0; j < this._binders.length; ++j) {
        this._addEventListeners(i, this._binders[j]);
      }
    }
  }

  /**
   * Unbind the layer groups of the stage.
   */
  unbindLayerGroups() {
    if (this._layerGroups.length === 0 ||
      this._layerGroups.length === 1 ||
      this._binders.length === 0 ||
      !this._callbackStore) {
      return;
    }
    // remove listeners
    for (let i = 0; i < this._layerGroups.length; ++i) {
      for (let j = 0; j < this._binders.length; ++j) {
        this._removeEventListeners(i, this._binders[j]);
      }
    }
    // clear callback store
    this._callbackStore = null;
  }

  /**
   * Set the imageSmoothing flag value.
   *
   * @param {boolean} flag True to enable smoothing.
   */
  setImageSmoothing(flag) {
    this._imageSmoothing = flag;
    // set for existing layer groups
    for (let i = 0; i < this._layerGroups.length; ++i) {
      this._layerGroups[i].setImageSmoothing(flag);
    }
  }

  /**
   * Get the binder callback function for a given layer group index.
   * The function is created if not yet stored.
   *
   * @param {object} binder The layer binder.
   * @param {number} index The index of the associated layer group.
   * @returns {Function} The binder function.
   */
  _getBinderCallback(binder, index) {
    if (typeof this._callbackStore[index] === 'undefined') {
      this._callbackStore[index] = [];
    }
    const store = this._callbackStore[index];
    let binderObj = store.find(function (elem) {
      return elem.binder === binder;
    });
    if (typeof binderObj === 'undefined') {
      // create new callback object
      binderObj = {
        binder: binder,
        callback: (event) => {
          // stop listeners
          this._removeEventListeners(index, binder);
          // apply binder
          binder.getCallback(this._layerGroups[index])(event);
          // re-start listeners
          this._addEventListeners(index, binder);
        }
      };
      this._callbackStore[index].push(binderObj);
    }
    return binderObj.callback;
  }

  /**
   * Add event listeners for a given layer group index and binder.
   *
   * @param {number} index The index of the associated layer group.
   * @param {object} binder The layer binder.
   */
  _addEventListeners(index, binder) {
    for (let i = 0; i < this._layerGroups.length; ++i) {
      if (i !== index) {
        this._layerGroups[index].addEventListener(
          binder.getEventType(),
          this._getBinderCallback(binder, i)
        );
      }
    }
  }

  /**
   * Remove event listeners for a given layer group index and binder.
   *
   * @param {number} index The index of the associated layer group.
   * @param {object} binder The layer binder.
   */
  _removeEventListeners(index, binder) {
    for (let i = 0; i < this._layerGroups.length; ++i) {
      if (i !== index) {
        this._layerGroups[index].removeEventListener(
          binder.getEventType(),
          this._getBinderCallback(binder, i)
        );
      }
    }
  }

} // class Stage
