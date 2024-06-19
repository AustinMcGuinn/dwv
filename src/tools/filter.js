import {ListenerHandler} from '../utils/listen';
import {
  Threshold as ThresholdFilter,
  Sobel as SobelFilter,
  Sharpen as SharpenFilter
} from '../image/filter';

// doc imports
/* eslint-disable no-unused-vars */
import {App} from '../app/application';
/* eslint-enable no-unused-vars */

/**
 * Filter tool.
 */
export class Filter {

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
   * Filter list.
   *
   * @type {object}
   */
  _filterList = null;

  /**
   * Selected filter.
   *
   * @type {object}
   */
  _selectedFilter = 0;

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Activate the tool.
   *
   * @param {boolean} bool Flag to activate or not.
   */
  activate(bool) {
    // setup event listening
    for (const key in this._filterList) {
      if (bool) {
        this._filterList[key].addEventListener('filterrun', this._fireEvent);
        this._filterList[key].addEventListener('filter-undo', this._fireEvent);
      } else {
        this._filterList[key].removeEventListener(
          'filterrun', this._fireEvent);
        this._filterList[key].removeEventListener(
          'filter-undo', this._fireEvent);
      }
    }
  }

  /**
   * Set the tool options.
   *
   * @param {object} options The list of filter names amd classes.
   */
  setOptions(options) {
    this._filterList = {};
    // try to instanciate filters from the options
    for (const key in options) {
      this._filterList[key] = new options[key](this._app);
    }
  }

  /**
   * Get the type of tool options: here 'instance' since the filter
   * list contains instances of each possible filter.
   *
   * @returns {string} The type.
   */
  getOptionsType() {
    return 'instance';
  }

  /**
   * Initialise the filter. Called once the image is loaded.
   */
  init() {
    // setup event listening
    for (const key in this._filterList) {
      this._filterList[key].init();
    }
  }

  /**
   * Handle keydown event.
   *
   * @param {object} event The keydown event.
   */
  keydown = (event) => {
    event.context = 'Filter';
    this._app.onKeydown(event);
  };

  /**
   * Get the list of event names that this tool can fire.
   *
   * @returns {string[]} The list of event names.
   */
  getEventNames() {
    return ['filterrun', 'filterundo'];
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
   * Get the selected filter.
   *
   * @returns {object} The selected filter.
   */
  getSelectedFilter() {
    return this._selectedFilter;
  }

  /**
   * Set the tool live features: filter name.
   *
   * @param {object} features The list of features.
   */
  setFeatures(features) {
    if (typeof features.filterName !== 'undefined') {
      // check if we have it
      if (!this.hasFilter(features.filterName)) {
        throw new Error('Unknown filter: \'' + features.filterName + '\'');
      }
      // de-activate last selected
      if (this._selectedFilter) {
        this._selectedFilter.activate(false);
      }
      // enable new one
      this._selectedFilter = this._filterList[features.filterName];
      // activate the selected filter
      this._selectedFilter.activate(true);
    }
    if (typeof features.run !== 'undefined' && features.run) {
      let args = {};
      if (typeof features.runArgs !== 'undefined') {
        args = features.runArgs;
      }
      this.getSelectedFilter().run(args);
    }
  }

  /**
   * Get the list of filters.
   *
   * @returns {Array} The list of filter objects.
   */
  getFilterList() {
    return this._filterList;
  }

  /**
   * Check if a filter is in the filter list.
   *
   * @param {string} name The name to check.
   * @returns {string} The filter list element for the given name.
   */
  hasFilter(name) {
    return this._filterList[name];
  }

} // class Filter

/**
 * Threshold filter tool.
 */
export class Threshold {
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
   * Associated filter.
   *
   * @type {object}
   */
  _filter = new ThresholdFilter();

  /**
   * Flag to know wether to reset the image or not.
   *
   * @type {boolean}
   */
  _resetImage = true;

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Activate the filter.
   *
   * @param {boolean} bool Flag to activate or not.
   */
  activate(bool) {
    // reset the image when the tool is activated
    if (bool) {
      this._resetImage = true;
    }
  }

  /**
   * Initialise the filter. Called once the image is loaded.
   */
  init() {
    // does nothing
  }

  /**
   * Run the filter.
   *
   * @param {*} args The filter arguments.
   */
  run(args) {
    if (typeof args.dataId === 'undefined') {
      throw new Error('No dataId to run threshod filter on.');
    }
    this._filter.setMin(args.min);
    this._filter.setMax(args.max);
    // reset the image if asked
    if (this._resetImage) {
      this._filter.setOriginalImage(this._app.getImage(args.dataId));
      this._resetImage = false;
    }
    const command = new RunFilterCommand(this._filter, args.dataId, this._app);
    command.onExecute = this._fireEvent;
    command.onUndo = this._fireEvent;
    command.execute();
    // save command in undo stack
    this._app.addToUndoStack(command);
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {Function} callback The function associated with the provided
   *  event type, will be called with the fired event.
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

} // class Threshold

/**
 * Sharpen filter tool.
 */
export class Sharpen {
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
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Activate the filter.
   *
   * @param {boolean} _bool Flag to activate or not.
   */
  activate(_bool) {
    // does nothing
  }

  /**
   * Initialise the filter. Called once the image is loaded.
   */
  init() {
    // does nothing
  }

  /**
   * Run the filter.
   *
   * @param {*} args The filter arguments.
   */
  run(args) {
    if (typeof args.dataId === 'undefined') {
      throw new Error('No dataId to run sharpen filter on.');
    }
    const filter = new SharpenFilter();
    filter.setOriginalImage(this._app.getImage(args.dataId));
    const command = new RunFilterCommand(filter, args.dataId, this._app);
    command.onExecute = this._fireEvent;
    command.onUndo = this._fireEvent;
    command.execute();
    // save command in undo stack
    this._app.addToUndoStack(command);
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

} // filter.Sharpen

/**
 * Sobel filter tool.
 */
export class Sobel {
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
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Activate the filter.
   *
   * @param {boolean} _bool Flag to activate or not.
   */
  activate(_bool) {
    // does nothing
  }

  /**
   * Initialise the filter. Called once the image is loaded.
   */
  init() {
    // does nothing
  }

  /**
   * Run the filter.
   *
   * @param {*} args The filter arguments.
   */
  run(args) {
    if (typeof args.dataId === 'undefined') {
      throw new Error('No dataId to run sobel filter on.');
    }
    const filter = new SobelFilter();
    filter.setOriginalImage(this._app.getImage(args.dataId));
    const command = new RunFilterCommand(filter, args.dataId, this._app);
    command.onExecute = this._fireEvent;
    command.onUndo = this._fireEvent;
    command.execute();
    // save command in undo stack
    this._app.addToUndoStack(command);
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {Function} callback The function associated with the provided
   *  event type, will be called with the fired event.
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

} // class filter.Sobel

/**
 * Run filter command.
 */
export class RunFilterCommand {

  /**
   * The filter to run.
   *
   * @type {object}
   */
  _filter;

  /**
   * Data id.
   *
   * @type {string}
   */
  _dataId;

  /**
   * Associated app.
   *
   * @type {App}
   */
  _app;

  /**
   * @param {object} filter The filter to run.
   * @param {string} dataId The data to filter.
   * @param {App} app The associated application.
   */
  constructor(filter, dataId, app) {
    this._filter = filter;
    this._dataId = dataId;
    this._app = app;
  }

  /**
   * Get the command name.
   *
   * @returns {string} The command name.
   */
  getName() {
    return 'Filter-' + this._filter.getName();
  }

  /**
   * Execute the command.
   *
   * @fires RunFilterCommand_filterrun
   */
  execute() {
    // run filter and set app image
    this._app.setImage(this._dataId, this._filter.update());
    // update display
    this._app.render(this._dataId);
    /**
     * Filter run event.
     *
     * @event RunFilterCommand_filterrun
     * @type {object}
     * @property {string} type The event type: filterrun.
     * @property {number} id The id of the run command.
     */
    const event = {
      type: 'filterrun',
      id: this.getName(),
      dataId: this._dataId
    };
    // callback
    this.onExecute(event);
  }

  /**
   * Undo the command.
   *
   * @fires RunFilterCommand_filterundo
   */
  undo() {
    // reset the image
    this._app.setImage(this._dataId, this._filter.getOriginalImage());
    // update display
    this._app.render(this._dataId);
    /**
     * Filter undo event.
     *
     * @event RunFilterCommand_filterundo
     * @type {object}
     * @property {string} type The event type: filterundo.
     * @property {number} id The id of the undone run command.
     */
    const event = {
      type: 'filterundo',
      id: this.getName(),
      dataid: this._dataId
    }; // callback
    this.onUndo(event);
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

} // RunFilterCommand class
