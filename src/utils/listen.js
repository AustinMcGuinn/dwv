import {logger} from './logger';

/**
 * ListenerHandler class: handles add/removing and firing listeners.
 *
 * Ref: {@link https://developer.mozilla.org/en-US/docs/Web/API/EventTarget_example}.
 */
export class ListenerHandler {
  /**
   * Listeners.
   *
   * @type {object}
   */
  _listeners = {};

  /**
   * Add an event listener.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *    event type, will be called with the fired event.
   */
  add(type, callback) {
    // create array if not present
    if (typeof this._listeners[type] === 'undefined') {
      this._listeners[type] = [];
    }
    // add callback to listeners array
    this._listeners[type].push(callback);
  }

  /**
   * Remove an event listener.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type.
   */
  remove(type, callback) {
    // check if the type is present
    if (typeof this._listeners[type] === 'undefined') {
      return;
    }
    // remove from listeners array
    let nFound = 0;
    for (let i = 0; i < this._listeners[type].length; ++i) {
      if (this._listeners[type][i] === callback) {
        ++nFound;
        this._listeners[type].splice(i, 1);
      }
    }
    if (nFound === 0) {
      logger.debug('No callback found on remove listener for type ' + type);
    }
  }

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   */
  fireEvent = (event) => {
    // check if they are listeners for the event type
    if (typeof this._listeners[event.type] === 'undefined') {
      return;
    }
    // fire events from a copy of the listeners array
    // to avoid interference from possible add/remove
    const stack = this._listeners[event.type].slice();
    for (let i = 0; i < stack.length; ++i) {
      stack[i](event);
    }
  };
}
