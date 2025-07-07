const puppeteer = require('puppeteer');
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

async function scrape() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    for (let pageNum = 0; pageNum < 2; pageNum++) {
        const url = `https://huoneistokeskus.fi/myytavat-asunnot/?page=${pageNum}`;
        console.log(`Fetching page ${pageNum}: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            await page.waitForSelector('.row.card-list .card-col');

            const listings = await page.$$eval('.row.card-list .card-col', items =>
                items.map(item => ({
                    url: item.querySelector('.card-title a')?.href || null
                }))
            );

            console.log(`Listings from Page ${pageNum}:`, listings);

            for (const listing of listings) {
                if (!listing.url) continue;

                console.log(`Visiting listing URL: ${listing.url}`);

                try {
                    await page.goto(listing.url, { waitUntil: 'networkidle2', timeout: 60000 });
                    await page.waitForSelector('.block-table');

                    const listingDetails = await page.evaluate(() => {
                        function getTextByLabel(labelText) {
                            const rows = document.querySelectorAll('.block-table tr');
                            for (let row of rows) {
                                const label = row.querySelector('th');
                                const value = row.querySelector('td');
                                if (label && value && label.textContent.includes(labelText)) {
                                    return value.textContent.trim();
                                }
                            }
                            return 'N/A';
                        }

                        return {
                            price: getTextByLabel('Velaton hinta'),
                            pRennoPlanned: getTextByLabel('Tulevat remontit'),
                            pAssociation: getTextByLabel('Taloyhtiön nimi'),
                            pToA: getTextByLabel('Tyyppi'),
                            p_address: getTextByLabel('Osoite'),
                            title: getTextByLabel('Huoneistoselitelmä'),
                            area: getTextByLabel('Asuintilojen pinta-ala'),
                            pYOC: getTextByLabel('Rakennusvuosi'),
                            pNoR: getTextByLabel('Huoneet'),
                        };
                    });

                    if (listingDetails.pRennoPlanned && listingDetails.pRennoPlanned !== 'N/A') {
                      let time = Math.floor(Date.now() / 1000); // Store timestamp in seconds
                      let date_new = new Date();
                              // store date in ISO 8601 format
                              let date = date_new.toISOString(); 
                        const newListing = new Listing({
                            url: listing.url,
                            vendor: "Huoneistokeskus",
                            sourceType: "Finnish Renovation",
                            pRennoPlanned: listingDetails.pRennoPlanned,
                            pToA: listingDetails.pToA,
                            pNoR: listingDetails.pNoR,
                            pYOC: listingDetails.pYOC,
                            p_address: listingDetails.p_address,
                            title: listingDetails.title,
                            area: listingDetails.area,
                            pAssociation: listingDetails.pAssociation,
                            date,
                            time,
                            price: listingDetails.price,
                        });

                        console.log("Saving listing:", newListing);

                        try {
                            await newListing.save();
                            console.log("Listing saved to database");
                        } catch (error) {
                            console.error("Error saving listing:", error);
                        }
                    } else {
                        console.log(`Excluding listing due to missing "pRennoPlanned".`);
                    }
                } catch (error) {
                    console.error(`Error scraping listing: ${listing.url}`, error);
                }
            }
        } catch (error) {
            console.error(`Error fetching page ${pageNum}:`, error);
        }
    }

    await browser.close();
}

async function main() {
    await connectToMongoDb();
    await scrape();
}

main();

