import {
  DicomDictionary,
  DicomTagGroups
} from './dictionary';

/**
 * Immutable tag.
 *
 * @class
 * @param {string} group The tag group as '0x####'.
 * @param {string} element The tag element as '0x####'.
 */
export class Tag {

  #group;
  #element;

  constructor(group, element) {
    if (!group || typeof group === 'undefined') {
      throw new Error('Cannot create tag with no group.');
    }
    if (group.length !== 6 || !group.startsWith('0x')) {
      throw new Error('Cannot create tag with badly formed group.');
    }
    if (!element || typeof element === 'undefined') {
      throw new Error('Cannot create tag with no element.');
    }
    if (element.length !== 6 || !element.startsWith('0x')) {
      throw new Error('Cannot create tag with badly formed element.');
    }
    this.#group = group;
    this.#element = element;
  }

  /**
   * Get the tag group.
   *
   * @returns {string} The tag group.
   */
  getGroup() {
    return this.#group;
  }

  /**
   * Get the tag element.
   *
   * @returns {string} The tag element.
   */
  getElement() {
    return this.#element;
  }

  toString() {
    return this.getKey() + ': ' + this.getNameFromDictionary();
  }

  /**
   * Check for Tag equality.
   *
   * @param {Tag} rhs The other tag to compare to.
   * @returns {boolean} True if both tags are equal.
   */
  equals(rhs) {
    return rhs !== null &&
      typeof rhs !== 'undefined' &&
      this.getGroup() === rhs.getGroup() &&
      this.getElement() === rhs.getElement();
  }

  /**
   * Get the group-element key used to store DICOM elements.
   *
   * @returns {string} The key as 'x########'.
   */
  getKey() {
    // group and element are in the '0x####' form
    return 'x' + this.getGroup().substring(2) + this.getElement().substring(2);
  }

  /**
   * Get a simplified group-element key.
   *
   * @returns {string} The key as '########'.
   */
  getKey2() {
    // group and element are in the '0x####' form
    return this.getGroup().substring(2) + this.getElement().substring(2);
  }

  /**
   * Get the group name as defined in TagGroups.
   *
   * @returns {string} The name.
   */
  getGroupName() {
    // group is in the '0x####' form
    // TagGroups include the x
    return DicomTagGroups[this.getGroup().substring(1)];
  }

  /**
   * Does this tag have a VR.
   * Basically the Item, ItemDelimitationItem and SequenceDelimitationItem tags.
   *
   * @returns {boolean} True if this tag has a VR.
   */
  isWithVR() {
    var element = this.getElement();
    return !(this.getGroup() === '0xFFFE' &&
      (element === '0xE000' || element === '0xE00D' || element === '0xE0DD')
    );
  }

  /**
   * Is the tag group a private tag group ?
   * see: http://dicom.nema.org/medical/dicom/2015a/output/html/part05.html#sect_7.8
   *
   * @returns {boolean} True if the tag group is private,
   *   ie if its group is an odd number.
   */
  isPrivate() {
    // group is in the '0x####' form
    var groupNumber = parseInt(this.getGroup().substring(2), 16);
    return groupNumber % 2 === 1;
  }

  /**
   * Get the tag info from the dicom dictionary.
   *
   * @returns {Array} The info as [vr, multiplicity, name].
   */
  getInfoFromDictionary() {
    var info = null;
    if (typeof DicomDictionary[this.getGroup()] !== 'undefined' &&
      typeof DicomDictionary[this.getGroup()][this.getElement()] !==
        'undefined') {
      info = DicomDictionary[this.getGroup()][this.getElement()];
    }
    return info;
  }

  /**
   * Get the tag Value Representation (VR) from the dicom dictionary.
   *
   * @returns {string} The VR.
   */
  getVrFromDictionary() {
    var vr = null;
    var info = this.getInfoFromDictionary();
    if (info !== null) {
      vr = info[0];
    }
    return vr;
  }

  /**
   * Get the tag name from the dicom dictionary.
   *
   * @returns {string} The VR.
   */
  getNameFromDictionary() {
    var name = null;
    var info = this.getInfoFromDictionary();
    if (info !== null) {
      name = info[2];
    }
    return name;
  }

} // Tag class

/**
 * Tag compare function.
 *
 * @param {Tag} a The first tag.
 * @param {Tag} b The second tag.
 * @returns {number} The result of the tag comparison,
 *   positive for b before a, negative for a before b and
 *   zero to keep same order.
 */
export function tagCompareFunction(a, b) {
  // first by group
  var res = parseInt(a.getGroup()) - parseInt(b.getGroup());
  if (res === 0) {
    // by element if same group
    res = parseInt(a.getElement()) - parseInt(b.getElement());
  }
  return res;
}

/**
 * Split a group-element key used to store DICOM elements.
 *
 * @param {string} key The key in form "x00280102" as generated by tag::getKey.
 * @returns {object} The DICOM tag.
 */
export function getTagFromKey(key) {
  return new Tag(
    '0x' + key.substring(1, 5),
    '0x' + key.substring(5, 9));
}

/**
 * Get the TransferSyntaxUID Tag.
 *
 * @returns {object} The tag.
 */
export function getTransferSyntaxUIDTag() {
  return new Tag('0x0002', '0x0010');
}

/**
 * Get the FileMetaInformationGroupLength Tag.
 *
 * @returns {object} The tag.
 */
export function getFileMetaInformationGroupLengthTag() {
  return new Tag('0x0002', '0x0000');
}

/**
 * Is the input tag the FileMetaInformationGroupLength Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isFileMetaInformationGroupLengthTag(tag) {
  return tag.equals(getFileMetaInformationGroupLengthTag());
}

/**
 * Get the Item Tag.
 *
 * @returns {Tag} The tag.
 */
export function getItemTag() {
  return new Tag('0xFFFE', '0xE000');
}

/**
 * Is the input tag the Item Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isItemTag(tag) {
  return tag.equals(getItemTag());
}

/**
 * Get the ItemDelimitationItem Tag.
 *
 * @returns {Tag} The tag.
 */
export function getItemDelimitationItemTag() {
  return new Tag('0xFFFE', '0xE00D');
}

/**
 * Is the input tag the ItemDelimitationItem Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isItemDelimitationItemTag(tag) {
  return tag.equals(getItemDelimitationItemTag());
}

/**
 * Get the SequenceDelimitationItem Tag.
 *
 * @returns {Tag} The tag.
 */
export function getSequenceDelimitationItemTag() {
  return new Tag('0xFFFE', '0xE0DD');
}

/**
 * Is the input tag the SequenceDelimitationItem Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isSequenceDelimitationItemTag(tag) {
  return tag.equals(getSequenceDelimitationItemTag());
}

/**
 * Get the PixelData Tag.
 *
 * @returns {Tag} The tag.
 */
export function getPixelDataTag() {
  return new Tag('0x7FE0', '0x0010');
}

/**
 * Is the input tag the PixelData Tag.
 *
 * @param {Tag} tag The tag to test.
 * @returns {boolean} True if the asked tag.
 */
export function isPixelDataTag(tag) {
  return tag.equals(getPixelDataTag());
}

/**
 * Get a tag from the dictionary using a tag string name.
 *
 * @param {string} tagName The tag string name.
 * @returns {object|null} The tag object or null if not found.
 */
export function getTagFromDictionary(tagName) {
  if (typeof tagName === 'undefined' || tagName === null) {
    return null;
  }
  var group = null;
  var element = null;
  var dict = DicomDictionary;
  var keys0 = Object.keys(dict);
  var keys1 = null;
  var foundTag = false;
  // search through dictionary
  for (var k0 = 0, lenK0 = keys0.length; k0 < lenK0; ++k0) {
    group = keys0[k0];
    keys1 = Object.keys(dict[group]);
    for (var k1 = 0, lenK1 = keys1.length; k1 < lenK1; ++k1) {
      element = keys1[k1];
      if (dict[group][element][2] === tagName) {
        foundTag = true;
        break;
      }
    }
    if (foundTag) {
      break;
    }
  }
  var tag = null;
  if (foundTag) {
    tag = new Tag(group, element);
  }
  return tag;
}
