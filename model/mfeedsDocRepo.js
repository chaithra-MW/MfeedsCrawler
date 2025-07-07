const mongoose = require('mongoose');
const removeDuplicates = require('./removeDuplicates');


// Define the schema
const mfeedsdocreposchema = new mongoose.Schema({
    title: String,
    url: { type: String, unique: true, required: true },
    pAssociation: String,
    body: String,
    p_address: String,
    vendor: String,
    sourceType: String,
    pYOC: String,
    pRennoPlanned: String,
    pNoR: Number,
    pToA: String,
    area: String,
    price: String, 
    date: Date, 
    time: Number, 
    lotid: String,
    pPstatus: String,
    pAddInfo: String,
    pIdentifier:String,
   
}, {
    collection: 'mfeedsdocrepo', 
});

mfeedsdocreposchema.plugin(removeDuplicates);

// Create and export the model
const mfeedsdocrepo = mongoose.model('mfeedsdocrepo', mfeedsdocreposchema);
module.exports = mfeedsdocrepo;
