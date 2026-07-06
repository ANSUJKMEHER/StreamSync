const md = require('react-icons/md');

const iconsToCheck = [
  'MdClose', 'MdPublic', 'MdLock', 'MdAccountCircle', 'MdKeyboardArrowDown',
  'MdSearch', 'MdFolderZip', 'MdPerson', 'MdError', 'MdSync', 'MdShare',
  'MdPlayArrow', 'MdTerminal', 'MdEdit', 'MdNoteAdd', 'MdCreateNewFolder',
  'MdUnfoldLess', 'MdDelete', 'MdFolder', 'MdDescription', 'MdOutlineRotateRight'
];

for (const icon of iconsToCheck) {
  if (!md[icon]) {
    console.log(`Missing: ${icon}`);
  }
}
console.log('Check complete.');
