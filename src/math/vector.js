/**
 * Immutable 3D vector.
 */
export class Vector3D {

  /**
   * X coordinate.
   *
   * @type {number}
   */
  _x;

  /**
   * Y coordinate.
   *
   * @type {number}
   */
  _y;

  /**
   * Z coordinate.
   *
   * @type {number}
   */
  _z;

  /**
   * @param {number} x The X component of the vector.
   * @param {number} y The Y component of the vector.
   * @param {number} z The Z component of the vector.
   */
  constructor(x, y, z) {
    this._x = x;
    this._y = y;
    this._z = z;
  }

  /**
   * Get the X component of the vector.
   *
   * @returns {number} The X component of the vector.
   */
  getX() {
    return this._x;
  }

  /**
   * Get the Y component of the vector.
   *
   * @returns {number} The Y component of the vector.
   */
  getY() {
    return this._y;
  }

  /**
   * Get the Z component of the vector.
   *
   * @returns {number} The Z component of the vector.
   */
  getZ() {
    return this._z;
  }

  /**
   * Check for Vector3D equality.
   *
   * @param {Vector3D} rhs The other vector to compare to.
   * @returns {boolean} True if both vectors are equal.
   */
  equals(rhs) {
    return rhs !== null &&
      this._x === rhs.getX() &&
      this._y === rhs.getY() &&
      this._z === rhs.getZ();
  }

  /**
   * Get a string representation of the Vector3D.
   *
   * @returns {string} The vector as a string.
   */
  toString() {
    return '(' + this._x +
      ', ' + this._y +
      ', ' + this._z + ')';
  }

  /**
   * Get the norm of the vector.
   *
   * @returns {number} The norm.
   */
  norm() {
    return Math.sqrt(
      (this._x * this._x) +
      (this._y * this._y) +
      (this._z * this._z)
    );
  }

  /**
   * Get the cross product with another Vector3D, ie the
   * vector that is perpendicular to both a and b.
   * If both vectors are parallel, the cross product is a zero vector.
   *
   * Ref: {@link https://en.wikipedia.org/wiki/Cross_product}.
   *
   * @param {Vector3D} vector3D The input vector.
   * @returns {Vector3D} The result vector.
   */
  crossProduct(vector3D) {
    return new Vector3D(
      (this._y * vector3D.getZ()) - (vector3D.getY() * this._z),
      (this._z * vector3D.getX()) - (vector3D.getZ() * this._x),
      (this._x * vector3D.getY()) - (vector3D.getX() * this._y));
  }

  /**
   * Get the dot product with another Vector3D.
   *
   * Ref: {@link https://en.wikipedia.org/wiki/Dot_product}.
   *
   * @param {Vector3D} vector3D The input vector.
   * @returns {number} The dot product.
   */
  dotProduct(vector3D) {
    return (this._x * vector3D.getX()) +
      (this._y * vector3D.getY()) +
      (this._z * vector3D.getZ());
  }

  /**
   * Is this vector codirectional to an input one.
   *
   * @param {Vector3D} vector3D The vector to test.
   * @returns {boolean} True if codirectional, false is opposite.
   */
  isCodirectional(vector3D) {
    // a.dot(b) = ||a|| * ||b|| * cos(theta)
    // (https://en.wikipedia.org/wiki/Dot_product_Geometric_definition)
    // -> the sign of the dot product depends on the cosinus of
    //    the angle between the vectors
    //   -> >0 => vectors are codirectional
    //   -> <0 => vectors are opposite
    return this.dotProduct(vector3D) > 0;
  }

} // Vector3D class