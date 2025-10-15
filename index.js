import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";

const app = express();

// ----------------------------
// 🧩 Middleware
// ----------------------------
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ----------------------------
// 🌐 Health Check Route (GET /)
// ----------------------------
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

// ----------------------------
// 🚀 Main Route (POST /submit-dls)
// ----------------------------
app.post("/submit-dls", async (req, res) => {
  const fields = req.body.fields || {};
  console.log("📥 Received fields:", JSON.stringify(fields, null, 2));

  let browser;
  try {
    // ----------------------------
    // 🧠 Launch Puppeteer
    // ----------------------------
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    console.log("🌍 Navigating to DLS website...");
    await page.goto("https://maps.dls.gov.jo/dlsweb/", {
      waitUntil: "networkidle2",
    });

    // ⏳ Replace waitForTimeout() → new Promise()
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ----------------------------
    // 🧩 Try to fill form fields (optional)
    // ----------------------------
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
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log(`⚠️ Selector not found for ${key}`);
        }
      } catch (err) {
        console.log(`⚠️ Could not set ${key}: ${err.message}`);
      }
    }

    // ----------------------------
    // 🗺️ Wait for map or render
    // ----------------------------
    console.log("🕐 Waiting for map to load...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ----------------------------
    // 📸 Capture Screenshot
    // ----------------------------
    const screenshot = await page.screenshot({
      encoding: "base64",
      fullPage: true,
    });

    console.log("✅ Screenshot captured successfully!");

    // ----------------------------
    // 🎯 Return success response
    // ----------------------------
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

// ----------------------------
// 🖥️ Start Server
// ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
