const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
app.use(express.json());

app.post('/render', async (req, res) => {
    const { preset_url } = req.body;
    if (!preset_url) return res.status(400).json({ error: 'URL preset kosong' });

    console.log('Memulai render untuk:', preset_url);
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.goto('https://am.zervida.my.id/runtime/preset.html', { waitUntil: 'networkidle2', timeout: 60000 });

        await page.evaluate(() => window.AM.stopDefaultLoad());
        await page.evaluate(async (url) => {
            await window.AM.loadPreset(url);
        }, preset_url);

        const videoBase64 = await page.evaluate(async () => {
            const result = await window.AM.renderVideo({ resolution: 720, fps: 30, quality: 'high' });
            return result.base64;
        });

        await browser.close();

        const buffer = Buffer.from(videoBase64.replace(/^data:video\/mp4;base64,/, ''), 'base64');
        fs.writeFileSync('output.mp4', buffer);

        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fs.createReadStream('output.mp4'));

        const upload = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders() });
        const videoUrl = upload.data.trim();

        fs.unlinkSync('output.mp4');
        res.json({ success: true, videoUrl });

    } catch (err) {
        if (browser) await browser.close();
        console.error('Error render:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Render API berjalan di port ${PORT}`));
         
