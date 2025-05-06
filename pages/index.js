const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const app = express();

// Load configuration
const config = require('./config.json');

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Cache settings
const CACHE_TIME = 60 * 1000; // 1 minute
const CACHE_DIR = path.join(__dirname, 'cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Headers configuration with basic auth
const HEADERS = {
    'Icy-MetaData': '1',
    'Accept-Encoding': 'identity',
    'Host': new URL(config.baseUrl).hostname,
    'Connection': 'Keep-Alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
};

async function extractDomain(fullUrl) {
    try {
        const response = await axios({
            method: 'get',
            url: fullUrl,
            headers: HEADERS,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });
    } catch (error) {
        if (error.response?.status === 302) {
            return error.response.headers.location;
        }
        console.error(`Error extracting domain from ${fullUrl}:`, error.message);
        return false;
    }
    return false;
}

// Middleware for device limit check
function checkDeviceLimit(req, res, next) {
    req.session.active_devices = req.session.active_devices || 0;

    if (req.session.active_devices >= 20) {
        return res.status(429).json({
            error: "Maximum number of devices reached",
            code: 429
        });
    }
    next();
}

// Dynamic endpoint handler
function createEndpointHandler(type) {
    return async (req, res) => {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({
                error: "ID parameter is required",
                code: 400
            });
        }

        const cacheKey = `${type}_${id}`;
        const cacheFile = path.join(CACHE_DIR, `${cacheKey}.cache`);
        const contentPath = config.paths[type];
        const fullUrl = `${config.baseUrl}${contentPath}/${id}.${type === 'live' ? 'ts' : 'mp4'}`;

        try {
            let domain;
            
            // Check cache first
            if (fs.existsSync(cacheFile) && 
                (Date.now() - fs.statSync(cacheFile).mtimeMs < CACHE_TIME)) {
                domain = fs.readFileSync(cacheFile, 'utf8');
            } else {
                domain = await extractDomain(fullUrl);
                if (domain) {
                    fs.writeFileSync(cacheFile, domain);
                }
            }

            if (!domain) {
                return res.status(502).json({
                    error: "Unable to retrieve streaming URL",
                    code: 502
                });
            }

            req.session.active_devices++;
            return res.redirect(domain);
            
        } catch (error) {
            console.error(`${type} endpoint error:`, error);
            return res.status(500).json({
                error: "Internal server error",
                code: 500
            });
        }
    };
}

// Register endpoints
app.get('/live', checkDeviceLimit, createEndpointHandler('live'));
app.get('/movies', checkDeviceLimit, createEndpointHandler('movies'));
app.get('/series', checkDeviceLimit, createEndpointHandler('series'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Available endpoints:');
        console.log(`  GET /live?id=ID`);
        console.log(`  GET /movies?id=ID`);
        console.log(`  GET /series?id=ID`);
    });
}
