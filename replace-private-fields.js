const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');

// Function to replace private fields
function replacePrivateFields(filePath) {
	const fileContent = fs.readFileSync(filePath, 'utf8');
	const updatedContent = fileContent.replace(/#([a-zA-Z0-9_]+)/g, '_$1');

	fs.writeFileSync(filePath, updatedContent, 'utf8');
	console.log(`Updated: ${filePath}`);
}

// Find all JavaScript and TypeScript files in the src directory
const files = glob
	.sync(path.join(__dirname, 'src/**/*.js'))
	.concat(glob.sync(path.join(__dirname, 'src/**/*.ts')));

// Replace private fields in each file
files.forEach((filePath) => replacePrivateFields(filePath));

console.log('All files have been processed.');
