import {getShadowColour} from '../utils/colour';

// doc imports
/* eslint-disable no-unused-vars */
import {Scalar2D} from '../math/scalar';
/* eslint-enable no-unused-vars */

/**
 * Style class.
 */
export class Style {
  /**
   * Font size.
   *
   * @type {number}
   */
  _fontSize = 10;

  /**
   * Font family.
   *
   * @type {string}
   */
  _fontFamily = 'Verdana';

  /**
   * Text colour.
   *
   * @type {string}
   */
  _textColour = '_fff';

  /**
   * Line colour.
   *
   * @type {string}
   */
  _lineColour = '_ffff80';

  /**
   * Base scale.
   *
   * @type {Scalar2D}
   */
  _baseScale = {x: 1, y: 1};

  /**
   * Zoom scale.
   *
   * @type {Scalar2D}
   */
  _zoomScale = {x: 1, y: 1};

  /**
   * Stroke width.
   *
   * @type {number}
   */
  _strokeWidth = 2;

  /**
   * Shadow offset.
   *
   * @type {Scalar2D}
   */
  _shadowOffset = {x: 0.25, y: 0.25};

  /**
   * Tag opacity.
   *
   * @type {number}
   */
  _tagOpacity = 0.2;

  /**
   * Text padding.
   *
   * @type {number}
   */
  _textPadding = 3;

  /**
   * Get the font family.
   *
   * @returns {string} The font family.
   */
  getFontFamily() {
    return this._fontFamily;
  }

  /**
   * Get the font size.
   *
   * @returns {number} The font size.
   */
  getFontSize() {
    return this._fontSize;
  }

  /**
   * Get the stroke width.
   *
   * @returns {number} The stroke width.
   */
  getStrokeWidth() {
    return this._strokeWidth;
  }

  /**
   * Get the text colour.
   *
   * @returns {string} The text colour.
   */
  getTextColour() {
    return this._textColour;
  }

  /**
   * Get the line colour.
   *
   * @returns {string} The line colour.
   */
  getLineColour() {
    return this._lineColour;
  }

  /**
   * Set the line colour.
   *
   * @param {string} colour The line colour.
   */
  setLineColour(colour) {
    this._lineColour = colour;
  }

  /**
   * Set the base scale.
   *
   * @param {Scalar2D} scale The scale as {x,y}.
   */
  setBaseScale(scale) {
    this._baseScale = scale;
  }

  /**
   * Set the zoom scale.
   *
   * @param {Scalar2D} scale The scale as {x,y}.
   */
  setZoomScale(scale) {
    this._zoomScale = scale;
  }

  /**
   * Get the base scale.
   *
   * @returns {Scalar2D} The scale as {x,y}.
   */
  getBaseScale() {
    return this._baseScale;
  }

  /**
   * Get the zoom scale.
   *
   * @returns {Scalar2D} The scale as {x,y}.
   */
  getZoomScale() {
    return this._zoomScale;
  }

  /**
   * Scale an input value using the base scale.
   *
   * @param {number} value The value to scale.
   * @returns {number} The scaled value.
   */
  scale(value) {
    // TODO: 2D?
    return value / this._baseScale.x;
  }

  /**
   * Apply zoom scale on an input value.
   *
   * @param {number} value The value to scale.
   * @returns {Scalar2D} The scaled value as {x,y}.
   */
  applyZoomScale(value) {
    // times 2 so that the font size 10 looks like a 10...
    // (same logic as in the DrawController::updateLabelScale)
    return {
      x: 2 * value / this._zoomScale.x,
      y: 2 * value / this._zoomScale.y
    };
  }

  /**
   * Get the shadow offset.
   *
   * @returns {Scalar2D} The offset as {x,y}.
   */
  getShadowOffset() {
    return this._shadowOffset;
  }

  /**
   * Get the tag opacity.
   *
   * @returns {number} The opacity.
   */
  getTagOpacity() {
    return this._tagOpacity;
  }

  /**
   * Get the text padding.
   *
   * @returns {number} The padding.
   */
  getTextPadding() {
    return this._textPadding;
  }

  /**
   * Get the font definition string.
   *
   * @returns {string} The font definition string.
   */
  getFontStr() {
    return ('normal ' + this.getFontSize() + 'px sans-serif');
  }

  /**
   * Get the line height.
   *
   * @returns {number} The line height.
   */
  getLineHeight() {
    return (this.getFontSize() + this.getFontSize() / 5);
  }

  /**
   * Get the font size scaled to the display.
   *
   * @returns {number} The scaled font size.
   */
  getScaledFontSize() {
    return this.scale(this.getFontSize());
  }

  /**
   * Get the stroke width scaled to the display.
   *
   * @returns {number} The scaled stroke width.
   */
  getScaledStrokeWidth() {
    return this.scale(this.getStrokeWidth());
  }

  /**
   * Get the shadow line colour.
   *
   * @returns {string} The shadow line colour.
   */
  getShadowLineColour() {
    return getShadowColour(this.getLineColour());
  }

} // class Style
