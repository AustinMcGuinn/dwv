import {InteractionEventNames} from '../gui/generic';

// doc imports
/* eslint-disable no-unused-vars */
import {LayerGroup} from '../gui/layerGroup';
import {ViewLayer} from '../gui/viewLayer';
import {DrawLayer} from '../gui/drawLayer';
/* eslint-enable no-unused-vars */

/**
 * Toolbox controller.
 */
export class ToolboxController {

  /**
   * List of tools to control.
   *
   * @type {object}
   */
  _toolList;

  /**
   * Selected tool.
   *
   * @type {object}
   */
  _selectedTool = null;

  /**
   * Callback store to allow attach/detach.
   *
   * @type {Array}
   */
  _callbackStore = [];

  /**
   * Current layers bound to tool.
   *
   * @type {object}
   */
  _boundLayers = {};

  /**
   * @param {object} toolList The list of tool objects.
   */
  constructor(toolList) {
    this._toolList = toolList;
  }

  /**
   * Initialise.
   */
  init() {
    for (const key in this._toolList) {
      this._toolList[key].init();
    }
    // enable shortcuts
    this.enableShortcuts(true);
  }

  /**
   * Enable or disable shortcuts. The 'init' methods enables shortcuts
   *  by default. Call this method after init to disable shortcuts.
   *
   * @param {boolean} flag True to enable shortcuts.
   */
  enableShortcuts(flag) {
    if (flag) {
      window.addEventListener('keydown',
        this._getCallback('window', 'keydown'), true);
    } else {
      window.removeEventListener('keydown',
        this._getCallback('window', 'keydown'), true);
    }
  }

  /**
   * Get the tool list.
   *
   * @returns {Array} The list of tool objects.
   */
  getToolList() {
    return this._toolList;
  }

  /**
   * Check if a tool is in the tool list.
   *
   * @param {string} name The name to check.
   * @returns {boolean} The tool list element for the given name.
   */
  hasTool(name) {
    return typeof this.getToolList()[name] !== 'undefined';
  }

  /**
   * Get the selected tool.
   *
   * @returns {object} The selected tool.
   */
  getSelectedTool() {
    return this._selectedTool;
  }

  /**
   * Get the selected tool event handler.
   *
   * @param {string} eventType The event type, for example
   *   mousedown, touchstart...
   * @returns {Function} The event handler.
   */
  getSelectedToolEventHandler(eventType) {
    return this.getSelectedTool()[eventType];
  }

  /**
   * Set the selected tool.
   *
   * @param {string} name The name of the tool.
   */
  setSelectedTool(name) {
    // check if we have it
    if (!this.hasTool(name)) {
      throw new Error('Unknown tool: \'' + name + '\'');
    }
    // de-activate previous
    if (this._selectedTool) {
      this._selectedTool.activate(false);
    }
    // set internal var
    this._selectedTool = this._toolList[name];
    // activate new tool
    this._selectedTool.activate(true);
  }

  /**
   * Set the selected tool live features.
   *
   * @param {object} list The list of features.
   */
  setToolFeatures(list) {
    if (this.getSelectedTool()) {
      this.getSelectedTool().setFeatures(list);
    }
  }

  /**
   * Listen to layer interaction events.
   *
   * @param {LayerGroup} layerGroup The associated layer group.
   * @param {ViewLayer|DrawLayer} layer The layer to listen to.
   */
  bindLayerGroup(layerGroup, layer) {
    const divId = layerGroup.getDivId();
    // listen to active layer changes
    layerGroup.addEventListener(
      'activelayerchange', this._getActiveLayerChangeHandler(divId));
    // bind the layer
    this._internalBindLayerGroup(divId, layer);
  }

  /**
   * Bind a layer group to this controller.
   *
   * @param {string} layerGroupDivId The layer group div id.
   * @param {ViewLayer|DrawLayer} layer The layer.
   */
  _internalBindLayerGroup(layerGroupDivId, layer) {
    // remove from local list if preset
    if (typeof this._boundLayers[layerGroupDivId] !== 'undefined') {
      this._unbindLayer(this._boundLayers[layerGroupDivId]);
    }
    // replace layer in local list
    this._boundLayers[layerGroupDivId] = layer;
    // bind layer
    this._bindLayer(layer);
  }

  /**
   * Get an active layer change handler.
   *
   * @param {string} divId The associated layer group div id.
   * @returns {Function} The event handler.
   */
  _getActiveLayerChangeHandler(divId) {
    return (event) => {
      const layer = event.value[0];
      this._internalBindLayerGroup(divId, layer);
    };
  }

  /**
   * Add canvas mouse and touch listeners to a layer.
   *
   * @param {ViewLayer|DrawLayer} layer The layer to start listening to.
   */
  _bindLayer(layer) {
    layer.bindInteraction();
    // interaction events
    const names = InteractionEventNames;
    for (let i = 0; i < names.length; ++i) {
      layer.addEventListener(names[i],
        this._getCallback(layer.getId(), names[i]));
    }
  }

  /**
   * Remove canvas mouse and touch listeners to a layer.
   *
   * @param {ViewLayer|DrawLayer} layer The layer to stop listening to.
   */
  _unbindLayer(layer) {
    layer.unbindInteraction();
    // interaction events
    const names = InteractionEventNames;
    for (let i = 0; i < names.length; ++i) {
      layer.removeEventListener(names[i],
        this._getCallback(layer.getId(), names[i]));
    }
  }

  /**
   * Mou(se) and (T)ouch event handler. This function just determines
   * the mouse/touch position relative to the canvas element.
   * It then passes it to the current tool.
   *
   * @param {string} layerId The layer id.
   * @param {string} eventType The event type.
   * @returns {object} A callback for the provided layer and event.
   */
  _getCallback(layerId, eventType) {
    if (typeof this._callbackStore[layerId] === 'undefined') {
      this._callbackStore[layerId] = [];
    }

    if (typeof this._callbackStore[layerId][eventType] === 'undefined') {
      const applySelectedTool = (event) => {
        // make sure we have a tool
        if (this._selectedTool) {
          const func = this._selectedTool[event.type];
          if (func) {
            func(event);
          }
        }
      };
      // store callback
      this._callbackStore[layerId][eventType] = applySelectedTool;
    }

    return this._callbackStore[layerId][eventType];
  }

} // class ToolboxController
