import puppeteer from "puppeteer";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("https://www.iplt20.com/stats/", { timeout: 60000 });
    await page.setViewport({ width: 1080, height: 1024 });

    const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

    const scrapeSeasonData = async (season, statCategory) => {
      try {
        await page.waitForSelector(".cSBListItems.seasonFilterItems", {
          timeout: 60000,
        });
        console.log("Season filter found");

        const seasonClicked = await page.evaluate((season) => {
          const seasonElement = Array.from(
            document.querySelectorAll(".cSBListItems.seasonFilterItems")
          ).find((el) => el.getAttribute("data-val") === season);
          if (seasonElement) {
            seasonElement.click();
            return true;
          }
          return false;
        }, season);

        if (!seasonClicked) {
          console.log(`Season element for ${season} not found`);
          throw new Error(`Season element for ${season} not found`);
        }

        await delay(5000);

        await page.waitForSelector(
          ".cSBListItems.batters.ng-binding.ng-scope",
          { timeout: 60000 }
        );
        console.log("Stat category filter found");

        const statCategoryClicked = await page.evaluate((statCategory) => {
          const statCategoryElement = Array.from(
            document.querySelectorAll(
              ".cSBListItems.batters.ng-binding.ng-scope"
            )
          ).find((el) => el.innerText.trim().includes(statCategory));
          if (statCategoryElement) {
            statCategoryElement.click();
            return true;
          }
          return false;
        }, statCategory);

        if (!statCategoryClicked) {
          console.log(`Stat category element for ${statCategory} not found`);
          throw new Error(
            `Stat category element for ${statCategory} not found`
          );
        }

        await delay(5000);

        await page.waitForSelector(".statsTable > tbody > tr", {
          timeout: 60000,
        });
        console.log("Stats table rows found");

        const stats = await page.evaluate(() => {
          const rows = document.querySelectorAll(".statsTable > tbody > tr");
          const statsArr = [];
          rows.forEach((row, index) => {
            if (index < 10) {
              const cols = row.querySelectorAll("td.ng-binding");
              let playerName = "";
              try {
                playerName = cols[1]
                  ?.querySelector(".st-ply > a > .ng-binding")
                  ?.textContent.trim();
              } catch (e) {
                console.error("Error extracting player name:", e);
              }
              const playerStat = {
                position: cols[0]?.textContent.trim(),
                player: playerName,
                runs: cols[5]?.textContent.trim(),
                fours: cols[12]?.textContent.trim(),
                sixes: cols[13]?.textContent.trim(),
                centuries: cols[10]?.textContent.trim(),
                fifties: cols[11]?.textContent.trim(),
              };
              statsArr.push(playerStat);
            }
          });
          return statsArr;
        });
        return { season, statCategory, stats };
      } catch (error) {
        console.error(
          `Error scraping data for season: ${season}, category: ${statCategory}`,
          error
        );
        throw error;
      }
    };

    const allSeasonsData = [];

    const seasons = ["2024", "2023", "2022", "2021", "2019"];
    const statCategories = [
      "Most Fours",
      "Most Sixes",
      "Orange Cap",
      "Most Centuries",
      "Most Fifties",
    ];

    for (const season of seasons) {
      for (const statCategory of statCategories) {
        console.log(
          `Scraping data for season: ${season}, category: ${statCategory}`
        );
        try {
          const seasonData = await scrapeSeasonData(season, statCategory);
          allSeasonsData.push(seasonData);
        } catch (error) {
          console.error(
            `Failed to scrape data for season: ${season}, category: ${statCategory}`,
            error
          );
        }
      }
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const filePath = `${__dirname}/data.json`;
    await fs.writeFile(filePath, JSON.stringify(allSeasonsData, null, 2));
    console.log(`Data successfully written to ${filePath}`);
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
})();
