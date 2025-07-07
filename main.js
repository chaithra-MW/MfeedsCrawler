const file1 = require('./assunot.js');
const file2 = require('./tori.js');
const file3 = require('./etuovi.js');
const file4 = require('./habita.js');
 const file5 = require('./huoneistokeskus.js');
const file6 = require('./kiinteistomaailma.js');
const file7 = require('./opkoti.js');
const file8 = require('./torietuovi.js');
const file9 = require('./materiaalitori.js');



async function runAllFiles() {
    try {
      // Execute the cron job function from each file
    await file1();
    await file2();
    await file3();
    await file4();
     await file5();
    await file6();
    await file7();
     await file8();
     await file9();

  
      console.log('All cron jobs executed successfully.');
    } catch (error) {
      console.error('Error executing cron jobs:', error);
    }
  }
  
   runAllFiles();
