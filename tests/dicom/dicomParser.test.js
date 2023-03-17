import {
  cleanString,
  hasDicomPrefix,
  DicomParser
} from '../../src/dicom/dicomParser';
import {getFileListFromDicomDir} from '../../src/dicom/dicomElementsWrapper';
import {b64urlToArrayBuffer} from './utils';

import dwvTestSimple from '../data/dwv-test-simple.dcm';
import dwvTestSequence from '../data/dwv-test-sequence.dcm';
import dwvDicomDir from '../data/DICOMDIR';

/**
 * Tests for the 'dicom/dicomParser.js' file.
 */
// Do not warn if these variables were not defined before.
/* global QUnit */

/**
 * Tests for {@link DicomParser} using simple DICOM data.
 * Using remote file for CI integration.
 *
 * @function module:tests/dicom~dicomParserSimpleDicom
 */
QUnit.test('Test simple DICOM parsing.', function (assert) {

  var buffer = b64urlToArrayBuffer(dwvTestSimple);

  assert.ok(hasDicomPrefix(buffer), 'Response has DICOM prefix.');

  // parse DICOM
  var dicomParser = new DicomParser();
  dicomParser.parse(buffer);

  var numRows = 32;
  var numCols = 32;

  // raw tags
  var rawTags = dicomParser.getRawDicomElements();
  // check values
  assert.equal(rawTags.x00280010.value[0], numRows, 'Number of rows (raw)');
  assert.equal(
    rawTags.x00280011.value[0], numCols, 'Number of columns (raw)');
  // ReferencedImageSequence - ReferencedSOPInstanceUID
  assert.equal(rawTags.x00081140.value[0].x00081155.value[0],
    '1.3.12.2.1107.5.2.32.35162.2012021515511672669154094',
    'ReferencedImageSequence SQ (raw)');

  // wrapped tags
  var tags = dicomParser.getDicomElements();
  // wrong key
  assert.equal(tags.getFromKey('x12345678'), null, 'Wrong key');
  assert.notOk(tags.getFromKey('x12345678'), 'Wrong key fails if test');
  // empty key
  assert.equal(tags.getFromKey('x00081050'), '', 'Empty key');
  assert.notOk(tags.getFromKey('x00081050'), 'Empty key fails if test');
  // good key
  assert.equal(tags.getFromKey('x00280010'), numRows, 'Good key');
  assert.ok(tags.getFromKey('x00280010'), 'Good key passes if test');
  // zero value (passes test since it is a string)
  assert.equal(tags.getFromKey('x00181318'), 0, 'Good key, zero value');
  assert.ok(tags.getFromKey('x00181318'),
    'Good key, zero value passes if test');

  // check values
  assert.equal(tags.getFromName('Rows'), numRows, 'Number of rows');
  assert.equal(tags.getFromName('Columns'), numCols, 'Number of columns');
  // ReferencedImageSequence - ReferencedSOPInstanceUID
  // only one item value -> returns the object directly
  // (no need for tags.getFromName("ReferencedImageSequence")[0])
  assert.equal(tags.getFromName('ReferencedImageSequence').x00081155.value[0],
    '1.3.12.2.1107.5.2.32.35162.2012021515511672669154094',
    'ReferencedImageSequence SQ');

});

/**
 * Tests for {@link DicomParser} using sequence test DICOM data.
 * Using remote file for CI integration.
 *
 * @function module:tests/dicom~dicomParserSequenceDicom
 */
QUnit.test('Test sequence DICOM parsing.', function (assert) {

  var buffer = b64urlToArrayBuffer(dwvTestSequence);

  assert.ok(hasDicomPrefix(buffer), 'Response has DICOM prefix.');

  // parse DICOM
  var dicomParser = new DicomParser();
  dicomParser.parse(buffer);
  // raw tags
  var rawTags = dicomParser.getRawDicomElements();
  assert.ok((Object.keys(rawTags).length !== 0), 'Got raw tags.');
  // wrapped tags
  var tags = dicomParser.getDicomElements();
  assert.ok((tags.dumpToObject().length !== 0), 'Got wrapped tags.');

  // ReferencedImageSequence: explicit sequence
  var seq00 = tags.getFromName('ReferencedImageSequence');
  assert.equal(seq00.length, 3, 'ReferencedImageSequence length');
  assert.equal(seq00[0].x00081155.value[0],
    '1.3.12.2.1107.5.2.32.35162.2012021515511672669154094',
    'ReferencedImageSequence - item0 - ReferencedSOPInstanceUID');
  assert.equal(seq00[1].x00081155.value[0],
    '1.3.12.2.1107.5.2.32.35162.2012021515511286933854090',
    'ReferencedImageSequence - item1 - ReferencedSOPInstanceUID');

  // SourceImageSequence: implicit sequence
  var seq01 = tags.getFromName('SourceImageSequence');
  assert.equal(seq01.length, 3, 'SourceImageSequence length');
  assert.equal(seq01[0].x00081155.value[0],
    '1.3.12.2.1107.5.2.32.35162.2012021515511672669154094',
    'SourceImageSequence - item0 - ReferencedSOPInstanceUID');
  assert.equal(seq01[1].x00081155.value[0],
    '1.3.12.2.1107.5.2.32.35162.2012021515511286933854090',
    'SourceImageSequence - item1 - ReferencedSOPInstanceUID');

  // ReferencedPatientSequence: explicit empty sequence
  var seq10 = tags.getFromName('ReferencedPatientSequence');
  assert.equal(seq10.length, 0, 'ReferencedPatientSequence length');

  // ReferencedOverlaySequence: implicit empty sequence
  var seq11 = tags.getFromName('ReferencedOverlaySequence');
  assert.equal(seq11.length, 0, 'ReferencedOverlaySequence length');

  // ReferringPhysicianIdentificationSequence: explicit empty item
  var seq12 = tags.getFromName('ReferringPhysicianIdentificationSequence');
  assert.equal(seq12.xFFFEE000.value.length, 0,
    'ReferringPhysicianIdentificationSequence item length');

  // ConsultingPhysicianIdentificationSequence: implicit empty item
  var seq13 = tags.getFromName('ConsultingPhysicianIdentificationSequence');
  assert.equal(seq13.length, 0,
    'ConsultingPhysicianIdentificationSequence item length');

  // ReferencedStudySequence: explicit sequence of sequence
  var seq20 = tags.getFromName('ReferencedStudySequence');
  // just one element
  //assert.equal(seq20.length, 2, "ReferencedStudySequence length");
  assert.equal(seq20.x0040A170.value[0].x00080100.value[0],
    '123456',
    'ReferencedStudySequence - seq - item0 - CodeValue');

  // ReferencedSeriesSequence: implicit sequence of sequence
  var seq21 = tags.getFromName('ReferencedSeriesSequence');
  // just one element
  //assert.equal(seq21.length, 2, "ReferencedSeriesSequence length");
  assert.equal(seq21.x0040A170.value[0].x00080100.value[0],
    '789101',
    'ReferencedSeriesSequence - seq - item0 - CodeValue');

  // ReferencedInstanceSequence: explicit empty sequence of sequence
  var seq30 = tags.getFromName('ReferencedInstanceSequence');
  assert.equal(seq30.x0040A170.value.length, 0,
    'ReferencedInstanceSequence - seq - length');

  // ReferencedVisitSequence: implicit empty sequence of sequence
  var seq31 = tags.getFromName('ReferencedVisitSequence');
  assert.equal(seq31.x0040A170.value.length, 0,
    'ReferencedVisitSequence - seq - length');

});

/**
 * Tests for {@link cleanString}.
 *
 * @function module:tests/dicom~cleanString
 */
QUnit.test('Test cleanString.', function (assert) {
  // undefined
  assert.equal(cleanString(), null, 'Clean undefined');
  // null
  assert.equal(cleanString(null), null, 'Clean null');
  // empty
  assert.equal(cleanString(''), '', 'Clean empty');
  // short
  assert.equal(cleanString('a'), 'a', 'Clean short');
  // special
  var special = String.fromCharCode('u200B');
  assert.equal(cleanString(special), '', 'Clean just special');
  // regular
  var str = ' El cielo azul ';
  var refStr = 'El cielo azul';
  assert.equal(cleanString(str), refStr, 'Clean regular');
  // regular with special
  str = ' El cielo azul' + special;
  refStr = 'El cielo azul';
  assert.equal(
    cleanString(str), refStr, 'Clean regular with special');
  // regular with special and ending space (not trimmed)
  str = ' El cielo azul ' + special;
  refStr = 'El cielo azul ';
  assert.equal(
    cleanString(str), refStr, 'Clean regular with special 2');
});

/**
 * Tests for {@link DicomParser} using DICOMDIR data.
 * Using remote file for CI integration.
 *
 * @function module:tests/dicom~dicomParserDicomDir
 */
QUnit.test('Test DICOMDIR parsing.', function (assert) {

  // get the file list
  var list = getFileListFromDicomDir(
    b64urlToArrayBuffer(dwvDicomDir)
  );

  // check file list
  var nFilesSeries0Study0 = 23;
  var nFilesSeries1Study0 = 20;
  var nFilesSeries0Study1 = 1;
  assert.equal(list.length, 2, 'Number of study');
  assert.equal(list[0].length, 2, 'Number of series in first study');
  assert.equal(list[1].length, 1, 'Number of series in second study');
  assert.equal(
    list[0][0].length,
    nFilesSeries0Study0,
    'Study#0:Series#0 number of files');
  assert.equal(
    list[0][1].length,
    nFilesSeries1Study0,
    'Study#0:Series#1 number of files');
  assert.equal(
    list[1][0].length,
    nFilesSeries0Study1,
    'Study#1:Series#0 number of files'
  );

  // files
  var files00 = [];
  var iStart = 0;
  var iEnd = nFilesSeries0Study0;
  for (var i = iStart; i < iEnd; ++i) {
    files00.push('IMAGES/IM' + i);
  }
  assert.deepEqual(list[0][0], files00, 'Study#0:Series#0 file names');
  var files01 = [];
  iStart = iEnd;
  iEnd += nFilesSeries1Study0;
  for (i = iStart; i < iEnd; ++i) {
    files01.push('IMAGES/IM' + i);
  }
  assert.deepEqual(list[0][0], files00, 'Study#0:Series#1 file names');
  var files10 = [];
  iStart = iEnd;
  iEnd += nFilesSeries0Study1;
  for (i = iStart; i < iEnd; ++i) {
    files10.push('IMAGES/IM' + i);
  }
  assert.deepEqual(list[0][0], files00, 'Study#1:Series#0 file names');

});
