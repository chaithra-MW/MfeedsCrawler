const axios = require('axios');
const mongoose = require("mongoose");
const cheerio = require('cheerio');
const Listing = require("./model/mfeedsDocRepo");
const { Timestamp } = require('mongodb');
require('dotenv').config();
const url2 = process.env.DB;

// Connect to MongoDB
async function connectToMongoDb() {
  try {
    await mongoose.connect(url2, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("MongoDB connection established.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

async function fetchHTML(urlm) {
    try {
        const { data } = await axios.get(urlm);
        return data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.warn(`Page not found: ${urlm}`);
            return null;
        }
        console.error(`Error fetching URL: ${urlm}`, error);
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeListings() {
    const urlm = "https://op-koti.fi/myytavat/asunnot";
    const html = await fetchHTML(urlm);
    if (!html) return;
    
    const $ = cheerio.load(html);
    const links = [];

    $('.result-card-wrapper .listing-result__link').each((index, element) => {
        const id = parseInt($(element).attr('id'));
        if (id) {
            links.push(`https://op-koti.fi/kohde/${id}`);
        }
    });
    
    console.log(`Total URLs found: ${links.length}`); // Debugging
    
    for (const link of links) {
        await delay(2000); // Increased delay to avoid rate limits
        await checkId(link);
        
        const itemHtml = await fetchHTML(link);
        let time = Math.floor(Date.now() / 1000); // Store timestamp in seconds
        let date_new = new Date();
                // store date in ISO 8601 format
                let date = date_new.toISOString(); 



        if (!itemHtml) continue;
        
        const $$ = cheerio.load(itemHtml);
        const pToA = $$("dt:contains('Kohdetyyppi')").next().text().trim();
        const p_address = $$("dt:contains('Osoite')").next().text().trim();
        const title = $$("dt:contains('Huoneet')").next().text().trim();
        const areaElement = $$("dt:contains('Asuinpinta-ala')").next().find(".area-with-units span");
        let area = areaElement.text().trim();$$("dt:contains('Asuinpinta-ala')").next().find(".area-with-units + div").remove();
        const pYOC = $$("dt:contains('Käyttöönottovuosi')").next().text().trim();
        const pAssociation = $$("dt:contains('Taloyhtiön nimi')").next().text().trim();
        const pNoR = $$("dt:contains('Asuinhuoneistoja')").next().text().trim();
        const pRennoPlanned = $$("h3:contains('Suunnitellut korjaukset')").next().text().trim();
        
        
        const url=link;
        const vendor="OP-koti";
        const sourceType="Finnish Renovation";
        const price = $$("dt:contains('Myyntihinta')").next().text().trim();
  
        

        if (!pRennoPlanned) continue; // Skip this record if "Planned Repairs" is empty
        
        const listing = new Listing({ url, vendor, sourceType, pRennoPlanned, pToA, pNoR, pYOC, p_address, title, area, pAssociation, date, time, price });
        //console.log(listing); // Print all listings with details
        try {
            await listing.save();
            console.log("Listing saved to database:", listing);
        } catch (error) {
            console.error("Error saving listing:", error);
        }
    
    
      }
}

async function checkId(link) {
    console.log(`Checking link: ${link}`);
    // Implement logic for checking ID in a database if needed
}
connectToMongoDb();
scrapeListings();