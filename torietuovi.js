const axios = require('axios');
const mongoose = require("mongoose");
const cheerio = require('cheerio');
const Listing = require("./model/mfeedsDocRepo");
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

async function fetchHTML(url) {
    try {
        const { data } = await axios.get(url);
        return data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.warn(`Page not found: ${url}`);
            return null;
        }
        console.error(`Error fetching URL: ${url}`, error);
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeListings() {
    const url = "https://www.etuovi.com/myytavat-tontit/tulokset?haku=M1075597570&rd=10";
    const html = await fetchHTML(url);
    if (!html) return;
    
    const $ = cheerio.load(html);
    const links = [];

    $('#announcement-list > div > div > div > div > div > a').each((index, element) => {
        const id = parseInt($(element).attr('id'));
        if (id) {
            links.push(`https://www.etuovi.com/kohde/${id}?haku=M1075597570`);
        }
    });
    
    console.log(`Total URLs found: ${links.length}`); // Debugging
    
    for (const link of links) {
        await delay(2000); // Increased delay to avoid rate limits
        await checkId(link);
        
        const itemHtml = await fetchHTML(link);
        if (!itemHtml) continue;

         let area = '';
        let time = Math.floor(Date.now() / 1000); // Store timestamp in seconds
        let date_new = new Date();
                // store date in ISO 8601 format
                let date = date_new.toISOString(); 
          const url=link;
          const vendor="Etuovi-Tontit";
        const sourceType="Plots";

        const $$ = cheerio.load(itemHtml);
        //title
        const title = $('h2').first().text().trim(); 

        //const body = $('div > div > div > div > p').text().trim();

        //plot type
        $$("div").each((index, element) => {
        if ($$(element).text().includes("Tyyppi")) {
            pToA = $$(element).next("div").text().trim();
        }
    });

    //plot id
    $$("div").each((index, element) => {
        if ($$(element).text().includes("Kiinteistötunnus","Kohdenumero")) {
            lotid = $$(element).next("div").text().trim();
        }
    });

    //Zoning Situation
    $$("div").each((index, element) => {
        if ($$(element).text().includes("Kaavoitustilanne")) {
            pPstatus = $$(element).next("div").text().trim();
        }
    });

    $$("div").each((index, element) => {
        if ($$(element).text().includes("Tontin pinta-ala")) {
            let areaRaw = $$(element).next("div").text().trim();
            area = areaRaw.replace(/(\d)\s(?=\d)/g, '$1');
             //area = $$(element).next("div").text().trim();
        }
    });

    $$("div").each((index, element) => {
        if ($$(element).text().includes("Sijainti")) {
            p_address = $$(element).next("div").text().trim();
        }
    });

    const price = $$("h2:contains('Hinta'), h3:contains('Hinta')").next().text().trim();

        const listing = new Listing({ url, vendor, sourceType, title, pToA, lotid, pPstatus, price, p_address, area });
        //console.log(listing); 
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
}
connectToMongoDb();
scrapeListings();