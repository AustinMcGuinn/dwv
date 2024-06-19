import {ListenerHandler} from '../utils/listen';

/**
 * UndoStack class.
 */
export class UndoStack {
  /**
   * Array of commands.
   *
   * @type {Array}
   */
  _stack = [];

  /**
   * Current command index.
   *
   * @type {number}
   */
  _curCmdIndex = 0;

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  _listenerHandler = new ListenerHandler();

  /**
   * Get the stack size.
   *
   * @returns {number} The size of the stack.
   */
  getStackSize() {
    return this._stack.length;
  }

  /**
   * Get the current stack index.
   *
   * @returns {number} The stack index.
   */
  getCurrentStackIndex() {
    return this._curCmdIndex;
  }

  /**
   * Add a command to the stack.
   *
   * @param {object} cmd The command to add.
   * @fires UndoStack_undoadd
   */
  add(cmd) {
    // clear commands after current index
    this._stack = this._stack.slice(0, this._curCmdIndex);
    // store command
    this._stack.push(cmd);
    // increment index
    ++this._curCmdIndex;
    /**
     * Command add to undo stack event.
     *
     * @event UndoStack_undoadd
     * @type {object}
     * @property {string} command The name of the command added to the
     *   undo stack.
     */
    this._fireEvent({
      type: 'undoadd',
      command: cmd.getName()
    });
  }

  /**
   * Undo the last command.
   *
   * @fires UndoStack_undo
   */
  undo() {
    // a bit inefficient...
    if (this._curCmdIndex > 0) {
      // decrement command index
      --this._curCmdIndex;
      // undo last command
      this._stack[this._curCmdIndex].undo();
      /**
       * Command undo event.
       *
       * @event UndoStack_undo
       * @type {object}
       * @property {string} command The name of the undone command.
       */
      this._fireEvent({
        type: 'undo',
        command: this._stack[this._curCmdIndex].getName()
      });
    }
  }

  /**
   * Redo the last command.
   *
   * @fires UndoStack_redo
   */
  redo() {
    if (this._curCmdIndex < this._stack.length) {
      // run last command
      this._stack[this._curCmdIndex].execute();
      /**
       * Command redo event.
       *
       * @event UndoStack_redo
       * @type {object}
       * @property {string} command The name of the redone command.
       */
      this._fireEvent({
        type: 'redo',
        command: this._stack[this._curCmdIndex].getName()
      });
      // increment command index
      ++this._curCmdIndex;
    }
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

} // UndoStack class
