const axios = require("axios");
const mongoose = require("mongoose");
const API_URL = "https://www.kiinteistomaailma.fi/api/km/KM?limit=30&maxArea=&maxYearBuilt=&minArea=&minYearBuilt=&sort=latestPublishTimestamp&sortOrder=desc&type=property";
const vendor = "kiinteistomaailma";
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


async function fetchProperties() {
    try {
        // Fetch property listings from the API
        const { data } = await axios.get(API_URL);
        
        if (!data?.data?.results) {
            console.error("Invalid API response structure");
            return;
        }

        for (const item of data.data.results) {
            const url = `https://www.kiinteistomaailma.fi/${item.urlParts[0]}`;
            
            try {
                // Fetch individual property page
                const propertyPage = await axios.get(url);
                const jsonData = propertyPage.data; // Assuming it's JSON
                
                if (!jsonData?.specs?.housingcompany) continue;

                const pRennoPlanned = jsonData.specs.housingcompany["Tiedossa olevat korjaukset"] || "";

                if (!pRennoPlanned.trim() || pRennoPlanned === "-") continue; // Skip if empty or '-'

                // Get the current date and time
                let time = Math.floor(Date.now() / 1000); // Store timestamp in seconds
                let date_new = new Date();
                        // store date in ISO 8601 format
                        let date = date_new.toISOString(); 

                // Extract property details
                const title = item.roomTypes;
                //const area = item.showArea;
                //converting area - readable
                const area = item.showArea.replace(/&nbsp;/g, ' ').replace(/&sup2;/g, '²');
                const p_address = `${item.address}, ${item.postcode}, ${item.city}, ${item.country}, ${item.municipality}, ${item.district}`;
                const pToA= item.group;
                const  pYOC = jsonData.specs.housingcompany["Rakennusvuosi"];
                const pAssociation = jsonData.specs.housingcompany["Taloyhtiön nimi"];
                const huoneistot = jsonData.specs.housingcompany["Huoneistot yhteensä"]; //number of apts
                const lotid = jsonData.specs.housingcompany["olevat korjaukset"];
                const sourceType = "Finnish Renovation"
                const lat = item?.location?.coordinates?.[0];
                const lon = item?.location?.coordinates?.[1];
                const pNoR = item.roomAmount;
                const price = item.salesPrice + " €";;
                

                if (!lat || !lon) {
                    console.warn(`Skipping ${url}, missing coordinates`);
                    continue;
                }

                const coordinates = `POINT(${lon} ${lat})`;

                console.log(`Processed: ${url}`);

                console.log({ title, url, pNoR, area, price, p_address,sourceType, vendor, pYOC, pRennoPlanned, pYOC, pToA, pAssociation, huoneistot, coordinates,lotid, date, time });

                const listing = new Listing({ title, url, pNoR, area, price, p_address,sourceType, vendor, pYOC, pRennoPlanned, pYOC, pToA, pAssociation, huoneistot, coordinates,lotid, date, time });
                try {
                    await listing.save();
                    console.log("Listing saved to database:", listing);
                } catch (error) {
                    console.error("Error saving listing:", error);
    }
                
            } catch (error) {
                console.error(`Failed to fetch ${url}:`, error.message);
            }
        }
    } catch (error) {
        console.error("Error fetching properties:", error.message);
    }
    
}
connectToMongoDb();

fetchProperties();




