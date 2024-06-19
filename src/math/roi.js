// doc imports
/* eslint-disable no-unused-vars */
import {Point2D} from '../math/point';
/* eslint-enable no-unused-vars */

/**
 * Region Of Interest shape.
 * Note: should be a closed path.
 */
export class ROI {

  /**
   * List of points.
   *
   * @type {Point2D[]}
   */
  _points = [];

  /**
   * Get a point of the list at a given index.
   *
   * @param {number} index The index of the point to get
   *   (beware, no size check).
   * @returns {Point2D} The Point2D at the given index.
   */
  getPoint(index) {
    return this._points[index];
  }

  /**
   * Get the length of the point list.
   *
   * @returns {number} The length of the point list.
   */
  getLength() {
    return this._points.length;
  }

  /**
   * Add a point to the ROI.
   *
   * @param {Point2D} point The Point2D to add.
   */
  addPoint(point) {
    this._points.push(point);
  }

  /**
   * Add points to the ROI.
   *
   * @param {Point2D[]} rhs The array of POints2D to add.
   */
  addPoints(rhs) {
    this._points = this._points.concat(rhs);
  }

} // ROI class
