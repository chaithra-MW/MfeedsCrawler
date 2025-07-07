const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require("mongoose");
const puppeteer = require('puppeteer');
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

async function fetchHTML(urlm) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  //user agent to avoid bot detection
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
  );

  try {
    await page.goto(urlm, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (error) {
    console.error(`Error navigating to ${urlm}: ${error.message}`);
    await browser.close();
    return null;
  }

  const html = await page.content();
  await browser.close();
  return html;
}

// function for delaying execution (to avoid rate limits)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeListings() {
  
  const urlm = "https://asunnot.oikotie.fi/myytavat-tontit?utm_source=tori_redirect";
  const html = await fetchHTML(urlm);
  if (!html) return;
  
  const $ = cheerio.load(html);
  const links = [];
  $('a.ot-card-v2, a[href]').each((index, element) => {
    const id = $(element).attr('href');
    if (id) {
      // regex 
      if (/\/\d+$/.test(id)) {
        links.push(id.startsWith('http') ? id : `https://asunnot.oikotie.fi${id}`);
      }
    }
  });
  
  console.log(`Total URLs found: ${links.length}`);
  console.log(links);

  // Processing each link with delay to avoid rate limits
  for (const link of links) {
    await delay(2000); // 2-second delay
    await checkId(link);

    const itemHtml = await fetchHTML(link);
    if (!itemHtml) continue;

    const $$ = cheerio.load(itemHtml);

    
    let title = '', pToA = '', lotid = '', area = '', p_address = '', price = '';
    let time = Math.floor(Date.now() / 1000); // Store timestamp in seconds
    let date_new = new Date();
            // store date in ISO 8601 format
            let date = date_new.toISOString(); 
    const vendor="Oikotie - Tontit";
    const sourceType="Plots";
    const url=link;

    title = $$('h1').first().text().trim();
    
    //plot type (harcoded)
    pToA = 'Tuntematon';

    //plot id
    const propertyId = $$("dt:contains('Kiinteistötunnus')").next().text().trim();
    const itemNumber = $$("dt:contains('Kohdenumero')").next().text().trim();
    if (propertyId) {  // If propertyId exists (not null or empty)
        lotid = propertyId; 
    } else {  
        lotid = itemNumber;
    }

    let areaRaw = $$("dt:contains('Tontin pinta-ala')").eq(0).next().text().trim();
    area = areaRaw.replace(/(\d)\s(?=\d)/g, '$1');
    p_address = $$("dt:contains('Sijainti')").next().text().trim();
    price = $$("dt:contains('Myyntihinta')").eq(0).next().text().trim();

    const listing = new Listing({ url, title, pToA, lotid, price, area, p_address, date, time, vendor, sourceType });
    //console.log(listing);
    try {
      await listing.save();
      console.log("Listing saved to database:", listing);
  } catch (error) {
      console.error("Error saving listing:", error);
  }
  }

  //check each link
  async function checkId(link) {
    console.log(`Checking link: ${link}`);
   
  }
}
connectToMongoDb();
scrapeListings();
