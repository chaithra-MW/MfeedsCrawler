const mongoose = require("mongoose");

const https = require('https');
const axios = require("axios");
const cheerio = require("cheerio");
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



// Define the API URL for fetching data
const apiUrl = 'https://www.habita.com/propertysearch/results/fi/1/50/full?sort=newest&type=ResidenceSale';




  https.get(apiUrl, async (response) => {
    let data = "";

    // Collect data chunks
    response.on("data", (chunk) => {
      data += chunk;
    });

    // When the response ends, parse the data and map the fields
    response.on("end", async () => {
      try {
        const parsedData = JSON.parse(data); // Parse JSON response

        if (!parsedData.results || parsedData.results.length === 0) {
          console.log("No listings found in the API response.");
          return;
        }

        // Loop through the API results
        for (const item of parsedData.results) {
          const address = `${item.district}, ${item.country}`;
          console.log(`Processing ID: ${item.id} | Title: ${item.title} | Address: ${address} | Price: ${item.currency}${item.price}`);

          const propID = item.id;
          const propUrl = `https://www.habita.com/kohde/${item.id}`;

          // Scrape the listing data
          const scrapedData = await scrapeData(propUrl);

          // Log listing data before saving
          console.log("Scraped Data:", scrapedData);
          // Get the current date and time
          let time = Math.floor(Date.now() / 1000); // Store timestamp in seconds
          let date_new = new Date();
                  // store date in ISO 8601 format
                  let date = date_new.toISOString(); 
          // Create a new listing object and save to the database
          const newListing = new Listing({
            title: item.title,
            url: propUrl,
            p_address: address,
            vendor: "Habita",
            sourceType: "Finnish Renovation",
            pYOC: scrapedData.year || "",
            pRennoPlanned: scrapedData.correction || "",
            area: item.area,
            price: `${item.currency}${item.price}`,
            pAssociation: scrapedData.pAssociation || "",
            body:  scrapedData.body || "",
            pToA: item.type,
            lotid: "",
            pNoR: scrapedData.pNoR || "",
            pPstatus: "",
            pAddInfo: "",
            pIdentifier: "",
            date: date, 
            time: time

            
          });

          
          // Save the listing to MongoDB and handle errors
          try {
            await newListing.save();
            console.log(` Listing saved successfully: ${item.id}`);
          } catch (saveError) {
            console.error(` Error saving listing ${item.id}:`, saveError);
          }
        }
      } catch (error) {
        console.error("Error parsing JSON response:", error);
      }
    });
  }).on("error", (err) => {
    console.error(" Error making API call:", err);
  });


// Async function to scrape the property page for additional details
async function scrapeData(propUrl) {
  try {
    // Fetch HTML of the page to scrape
    const { data } = await axios.get(propUrl);
    const $ = cheerio.load(data);

    // Scrape property details
    //const pAssociation = $("div.property-details-container section:nth-child(1)  div:nth-child(2) table:nth-child(6) tbody tr:nth-child(1)").text().trim();
    // company name: #property > div.property-details-container > section:nth-child(1) > div:nth-child(2) > table:nth-child(4) > tbody > tr:nth-child(1) > th

    const pAssociation = $("#property > div.property-details-container > section:nth-child(1) > div:nth-child(2) > table:nth-child(6) > tbody > tr:nth-child(1) > td").text().trim();

    //const pNoR = $("div.property-details-container section:nth-child(1) div:nth-child(2) table:nth-child(4) tbody tr:nth-child(2)").text().trim();
    const pNoR = $("#key-details > div:nth-child(2) > span").text().trim();
    
    //const year = $("div.property-details-container section:nth-child(1) div:nth-child(2) table:nth-child(2) tbody tr:nth-child(1)").text().trim();
    const year = $("#property > div.property-details-container > section:nth-child(1) > div:nth-child(2) > table:nth-child(2) > tbody > tr:nth-child(1) > td").text().trim();

    //const correction = $("div.property-details-container section:nth-child(1) div:nth-child(2) table:nth-child(2) tbody tr:nth-child(12)").text().trim();
    const correction = $("div.property-details-container section:nth-child(1) div:nth-child(2) table:nth-child(2) tbody tr:nth-child(12) > td").text().trim();
  
    const body = $("#promotion-text").text().trim();

    return {
      pAssociation,
      pNoR,
      year,
      correction,
      body
    };
  } catch (err) {
    console.error(`Error scraping ${propUrl}:`, err);
    return {};
  }
}

// Connect to MongoDB 
connectToMongoDb();


//date and time 