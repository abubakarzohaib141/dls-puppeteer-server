import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";

const app = express();

// ----------------------------------
// Middleware
// ----------------------------------
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ----------------------------------
// Health check route
// ----------------------------------
app.get("/", (req, res) => {
  res.send(`
    <h2>✅ DLS Puppeteer API is Live</h2>
    <p>Use <b>POST /submit-dls</b> to send form data for processing.</p>
    <p>Example JSON body:</p>
    <pre>{
  "fields": {
    "governorate": "محافظة العاصمة",
    "directorate": "اراضي عمان",
    "village": "اليادودة",
    "basin": "123",
    "sector": "جدول الأحياء (0)",
    "parcel": "00123"
  }
}</pre>
  `);
});

// ----------------------------------
// Puppeteer route
// ----------------------------------
app.post("/submit-dls", async (req, res) => {
  const fields = req.body.fields || {};
  console.log("📥 Received fields:", JSON.stringify(fields, null, 2));

  let browser;
  try {
    // 🚀 Launch Puppeteer with built-in Chromium
    browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    console.log("🌍 Navigating to DLS website...");
    await page.goto("https://maps.dls.gov.jo/dlsweb/", {
      waitUntil: "networkidle2",
    });

    // Wait 3s to let page load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Try filling fields (optional)
    const SELECTORS = {
      governorate: "#form-gov-select",
      directorate: "#form-directorate-select",
      village: "#form-village-select",
      basin: "#form-hode-select",
      sector: "#form-sector-select",
      parcel: "#form-parcel-select",
    };

    for (const [key, selector] of Object.entries(SELECTORS)) {
      const value = fields[key];
      if (!value) continue;

      try {
        const exists = await page.$(selector);
        if (exists) {
          console.log(`📝 Setting ${key}: ${value}`);
          await page.select(selector, value);
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          console.log(`⚠️ Selector not found for ${key}`);
        }
      } catch (err) {
        console.log(`⚠️ Could not set ${key}: ${err.message}`);
      }
    }

    console.log("🕐 Waiting for map to load...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Capture screenshot
    const screenshot = await page.screenshot({
      encoding: "base64",
      fullPage: true,
    });

    console.log("✅ Screenshot captured successfully!");

    res.json({
      success: true,
      message: "DLS form processed successfully!",
      fields,
      screenshot,
    });
  } catch (err) {
    console.error("❌ Puppeteer Error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Browser closed.");
    }
  }
});

// ----------------------------------
// Start server
// ----------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
