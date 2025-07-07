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
async function scrapeListings() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto('https://materiaalitori.fi/ilmoitukset', {
        waitUntil: 'networkidle0',
        timeout: 60000,
    });

    await page.waitForSelector('a', { timeout: 60000 });

    
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
            .map(anchor => anchor.getAttribute('href'))
            .filter(href => href && href.startsWith('/ilmoitukset/') && !href.endsWith('/lisaa'))
            .map(href => 'https://materiaalitori.fi' + href);
    });

    console.log('Filtered links:', links);

    const listings = [];

    for (const link of links) {
        console.log(`Checking link: ${link}`);
        const propertyPage = await browser.newPage();

        try {
            await propertyPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Handle cookie popup
            try {
                await propertyPage.waitForSelector('#CybotCookiebotDialogBodyContentTitle', { timeout: 5000 });
                await propertyPage.click('button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
                console.log("Accepted cookies popup.");
            } catch (error) {
                console.log("No cookie popup detected.");
            }

            // Wait for the page to fully load
            await propertyPage.waitForFunction(() => document.querySelector('h1') && document.querySelector('h1').innerText.trim() !== 'Ladataan ilmoitusta', {
                timeout: 30000
            });

            // Extract title
            const title = await propertyPage.evaluate(() => {
                let titleElement = document.querySelector('h1');
                return titleElement ? titleElement.innerText.trim() : null;
            });

            const pToA = await propertyPage.evaluate(() => {
                // find element using its class
                let element = document.querySelector('.RequestForOffer_rfoTypeHeadingCaps__3bO6m');
            
                
                return element ? element.innerText.trim() : null;
            });
            
            //#root > div > div.Layout_container__2KxOq.flex-grow-1 > div > div > div:nth-child(1) > div.RequestForOffer_rfoTypeHeadingCaps__3bO6m


            //Extract address where label contains "sijainti"
            
            const p_address = await propertyPage.evaluate(() => {
                let labels = Array.from(document.querySelectorAll('h2'));
                for (let label of labels) {
                    if (label.textContent.toLowerCase().includes('sijainti')) {
                        let nextElement = label.nextElementSibling;
                        let addressParts = [];

                        while (nextElement && nextElement.tagName.toLowerCase() === 'p') {
                            addressParts.push(nextElement.innerText.trim());
                            nextElement = nextElement.nextElementSibling;
                        }
                        return addressParts.length ? addressParts.join(', ') : null;
                    }
                }
                return null;
            });

            const pYOC = await propertyPage.evaluate(() => {
                let labels = Array.from(document.querySelectorAll('*')); // Get all elements
                
                for (let label of labels) {
                    if (label.textContent.toLowerCase().includes('voimassa')) { // Look for 'voimassa'
                        let nextElement = label.nextElementSibling;
            
                        //find a valid date
                        while (nextElement) {
                            let text = nextElement.innerText?.trim();
                            
                            //Regex to extract only valid date (DD.MM.YYYY format)
                            let match = text.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/);
                            if (match) return match[0]; // Return only the date
                            
                            nextElement = nextElement.nextElementSibling;
                        }
                    }
                }
                return null;
            });
            const pAddInfo = await propertyPage.evaluate(() => {
                let labels = Array.from(document.querySelectorAll('h2, h3, strong, div')); // Find potential labels
                for (let label of labels) {
                    if (label.textContent.trim().toLowerCase() === 'luokittelu') { 
                        let nextElement = label.nextElementSibling;
            
                        //"Luokittelu"
                        while (nextElement) {
                            let text = nextElement.innerText.trim();
                            if (text) {
                                return text;
                            }
                            nextElement = nextElement.nextElementSibling;
                        }
                    }
                }
                return null; 
            });

            const area = await propertyPage.evaluate(() => {
              const labels = Array.from(document.querySelectorAll('h2'));
              for (let label of labels) {
                if (label.textContent.trim().toLowerCase().includes('määrä')) {
                  console.log('Found "Määrä" label');
                  let nextElement = label.nextElementSibling;
                  if (nextElement && nextElement.tagName.toLowerCase() === 'p') {
                    let spans = Array.from(nextElement.querySelectorAll('span'));
                    let areaValue = spans.map(span => span.textContent.trim()).join(' ');
                    return areaValue; 
                  }
                }
              }
              return null;
            });
            
            const body = pAddInfo + area;

            listings.push({ title,pToA, p_address, pYOC, pAddInfo, area, body, link });

            console.log(`Title: ${title}`);
            console.log(`Address: ${p_address}`);
            console.log(`Year: ${pYOC}`);
            console.log(`category: ${pToA}`);
            console.log(`classification: ${pAddInfo}`);
            console.log(`Area: ${area}`);
            console.log(`Body: ${body}`);

            let time = Math.floor(Date.now() / 1000); // Store timestamp in seconds
            let date_new = new Date();
                    // store date in ISO 8601 format
                    let date = date_new.toISOString(); 
            const vendor="Materiaalitori";
            const sourceType="Announcements";
            const url=link;

   
            const listing = new Listing({ url,title, pToA, pYOC, p_address, date, time, vendor,sourceType,pAddInfo, });
                    //console.log(listing);
                    try {
                    await listing.save();
                    console.log("Listing saved to database:", listing);
                } catch (error) {
                    console.error("Error saving listing:", error);
                }

        } catch (error) {
            console.error(`Error processing link: ${link}`, error);
        }

        await propertyPage.close();
    }

    console.log('Listings:', listings);
    await browser.close();
}

scrapeListings().catch(err => console.error('Error scraping the page:', err));
connectToMongoDb();