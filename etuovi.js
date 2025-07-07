const puppeteer = require("puppeteer");
const mongoose = require("mongoose");
const Listing = require("./model/mfeedsDocRepo");
require('dotenv').config();

const url2 = process.env.DB;

async function connectToMongoDb() {
  try {
    await mongoose.connect(url2, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("MongoDB connection established.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

async function scrapeEtuoviListings() {
  await connectToMongoDb();

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  //Speed up page load by blocking images, styles, and fonts
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (["image", "stylesheet", "font"].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  console.log("\nFetching main page URLs...\n");

  // Visit the main listing page
  await page.goto("https://www.etuovi.com/myytavat-asunnot/tulokset?haku=M28373768&rd=50", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // Extract property URLs from the main page
  const propertyUrls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("#announcement-list a"))
      .map(a => a.id ? `http://www.etuovi.com/kohde/${a.id}` : null)
      .filter(url => url);
  });

  console.log("Found URLs on main page:");
  propertyUrls.forEach(url => console.log(url));

  let results = [];
  let skippedUrls = [];

  console.log("\nScraping individual property pages...\n");

  for (const url of propertyUrls) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Extract property details from each page
      const propertyDetails = await page.evaluate(() => {
        const labels = [
          "Sijainti", "Tyyppi", "Huoneistoselitelmä", "Huoneita",
          "Asuintilojen pinta-ala", "Rakennusvuosi", "Velaton hinta",
          "Tulevat remontit", "Taloyhtiön nimi"
        ];

        let extractedData = {};

        labels.forEach(label => {
          const labelElement = Array.from(document.querySelectorAll("div"))
            .find(div => div.textContent.trim() === label);

          if (labelElement && labelElement.nextElementSibling) {
            extractedData[label] = labelElement.nextElementSibling.textContent.trim();
          } else {
            extractedData[label] = null;
          }
        });

        return extractedData;
      });

      // Skip properties where "Tulevat remontit" is missing
      if (!propertyDetails["Tulevat remontit"]) {
        skippedUrls.push(url);
        continue;
      }

      // Format "Tyyppi": take text before "("
      if (propertyDetails["Tyyppi"]) {
        propertyDetails["Tyyppi"] = propertyDetails["Tyyppi"].split("(")[0].trim();
      }

      // Format "Huoneita": extract only the number
      if (propertyDetails["Huoneita"]) {
        const match = propertyDetails["Huoneita"].match(/\d+/);
        propertyDetails["Huoneita"] = match ? match[0] : null;
      }

      let time = Math.floor(Date.now() / 1000); // Store timestamp in seconds
      let date_new = new Date();
              // store date in ISO 8601 format
              let date = date_new.toISOString(); 
      // Map extracted fields to the desired database format and add vendor/sourceType/date/time
      const listingData = {
        p_address: propertyDetails["Sijainti"],
        pToA: propertyDetails["Tyyppi"],
        title: propertyDetails["Huoneistoselitelmä"],
        pNoR: propertyDetails["Huoneita"],
        area: propertyDetails["Asuintilojen pinta-ala"],
        pYOC: propertyDetails["Rakennusvuosi"],
        price: propertyDetails["Velaton hinta"],
        pRennoPlanned: propertyDetails["Tulevat remontit"],
        pAssociation: propertyDetails["Taloyhtiön nimi"],
        url: url,
        date: date,
        time: time,
        sourceType: "Finnish rennovation",
        vendor: "Etuovi_assunot"
      };

      results.push(listingData);

      // Save listing data to MongoDB using the Listing model
      const listing = new Listing(listingData);
      try {
        await listing.save();
        console.log("Listing saved to database:", listing);
      } catch (error) {
        console.error("Error saving listing:", error);
      }
    } catch (error) {
      console.warn(`⚠️ Skipping ${url} due to error: ${error.message}`);
      skippedUrls.push(url);
    }
  }

  await browser.close();

  console.log("\n Skipped URLs (missing Tulevat remontit):");
  if (skippedUrls.length > 0) {
    skippedUrls.forEach(url => console.log(url));
  } else {
    console.log("None");
  }

  console.log("\n Scraped Data:");
  console.log(JSON.stringify(results, null, 2));
}

scrapeEtuoviListings();
connectToMongoDb();
