const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const mongoose = require('mongoose');
const Listing = require("./model/mfeedsDocRepo");
require('dotenv').config();

puppeteer.use(StealthPlugin());

//process.env.DB;
const url2 = process.env.DB;
async function connectToMongoDb() {
  try {
    await mongoose.connect(url2, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("MongoDB connection established.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

const MAIN_URL = 'https://asunnot.oikotie.fi/myytavat-asunnot?asnewdevelopment%5Bnew_development%5D=1&aspublished%5Bpublished%5D=1&rss=0&limit=50&sortby=published%20desc';

(async () => {
  await connectToMongoDb(); // Connect to MongoDB before scraping
  try {
    console.log("Launching browser with stealth mode...");
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    console.log("Opening new page...");
    const page = await browser.newPage();

    console.log("Setting user agent...");
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );

    console.log("Navigating to main URL...");
    await page.goto(MAIN_URL, { waitUntil: 'networkidle2' });

    console.log(" Page loaded! Extracting URLs...");

    // Extract all listing URLs
    const urls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div.cards-v2__card.ng-star-inserted a'))
        .map(a => a.href)
        .filter(href => href);
    });

    console.log(`Found ${urls.length} listings.`);

    let results = [];

    for (const url of urls) {
      console.log(`Scraping: ${url}`);
      const listingPage = await browser.newPage();
      await listingPage.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      );

      await listingPage.goto(url, { waitUntil: 'networkidle2' });

      // Scrape listing details
      const listingData = await listingPage.evaluate(() => {
        const extractText = (label) => {
          const dt = Array.from(document.querySelectorAll('div.listing-details dt'))
            .find(el => el.textContent.trim() === label);
          return dt ? dt.nextElementSibling?.textContent.trim() || "" : "";
        };

        // First try to get "Velaton hinta", if not available, use "Myyntihinta"
        let price = extractText("Velaton hinta");
        if (!price) {
          price = extractText("Myyntihinta");
        }

        // Extract "listing-overview" div content
        const bodyContent = document.querySelector('.listing-overview')?.innerText.trim() || "";
        let time = Math.floor(Date.now() / 1000); // Store timestamp in seconds
        let date_new = new Date();
                // store date in ISO 8601 format
                let date = date_new.toISOString(); 
        return {
          url: window.location.href,
          address: extractText("Sijainti"),
          area: extractText("Asuinpinta-ala"),
          title: extractText("Huoneiston kokoonpano"),
          norooms: extractText("Huoneita"),
          price: price,
          toa: extractText("Rakennuksen tyyppi"),
          year: extractText("Rakennusvuosi"),
          plannedrenovations: extractText("Tulevat remontit"),
          housingcompany: extractText("Taloyhtiön nimi"),
          body: bodyContent,
          vendor: "Assunot",
          sourceType: "Finnish Renovation",
          date: date,
          time: time

        };
      });

      await listingPage.close();

      // Skip if "Tulevat remontit/Planned Renovations" is empty
      if (!listingData.plannedrenovations) {
        console.log(`Skipping: ${url} (No Planned Renovations)`);
        continue;
      }

      console.log("Scraped data:", listingData);
      results.push(listingData);

      // Save listing data to MongoDB using the Listing model
      const listing = new Listing({
        url: listingData.url,
        p_address: listingData.address,
        area: listingData.area,
        title: listingData.title,
        pNoR: listingData.norooms,
        price: listingData.price,
        pToA: listingData.toa,
        pYOC: listingData.year,
        pRennoPlanned: listingData.plannedrenovations,
        pAssociation: listingData.housingcompany,
        body: listingData.body,
        date: listingData.date,
        time: listingData.time,
        vendor: listingData.vendor,
        sourceType: listingData.sourceType,
      });
      try {
        await listing.save();
        console.log("Listing saved to database:", listing);
      } catch (error) {
        console.error("Error saving listing:", error);
      }
    }

    console.log("Done! Data Scraped");
    await browser.close();
  } catch (error) {
    console.error(" Error:", error.message);
  }
})();

