# TELESPOT-NUMSINT

**Phone Number OSINT Chrome Extension**

A browser extension that automates phone number reconnaissance by generating multiple format variations and searching Google with smart search capabilities.

![Telespot](Telespot-Graphic.png)

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select this folder

That's it! Click the extension icon to start.

## Features

- **10 Format Variations** - Automatically generates international, dashed, parentheses, quoted formats
- **Smart Search** - Combine all formats into one search with OR/AND operators
- **Individual Search** - Open 10 separate tabs for thorough investigation
- **25+ Country Codes** - Support for US, UK, EU, Asia, and more
- **Copy to Clipboard** - Quickly copy any format variation
- **Pattern Report** - Generate analysis reports after searches
- **Progress Tracking** - Real-time progress bar and status indicators
- **Dark Theme** - Easy on the eyes

## How to Use

1. Enter a phone number (any format works)
2. Select the country code
3. Choose search mode:
   - **Individual** - Opens 10 tabs (one per format)
   - **Smart Search** - Combines all formats with OR/AND
4. Click "Search All Formats"
5. Review results in opened tabs
6. Click "Generate Pattern Report" for analysis notes

## Search Modes

### Individual Mode
Opens 10 separate Google tabs, one for each phone number format. Best for thorough investigation where you want to see results for each format separately.

### Smart Search Mode
Combines all 10 formats into a single Google search query using either:
- **OR** - Finds pages containing ANY of the formats
- **AND** - Finds pages containing ALL of the formats

## Supported Countries

| Americas | Europe | Asia-Pacific | Other |
|----------|--------|--------------|-------|
| +1 US/Canada | +44 UK | +81 Japan | +7 Russia |
| +52 Mexico | +49 Germany | +86 China | +27 South Africa |
| +55 Brazil | +33 France | +91 India | +971 UAE |
| +54 Argentina | +39 Italy | +82 South Korea | +966 Saudi Arabia |
| +57 Colombia | +34 Spain | +61 Australia | +20 Egypt |
| | +31 Netherlands | +65 Singapore | +234 Nigeria |
| | +48 Poland | +63 Philippines | |
| | +46 Sweden | +66 Thailand | |
| | +41 Switzerland | +84 Vietnam | |

## Legal Notice

This tool is designed for **lawful OSINT research** only:
- Operates only on publicly accessible information
- No authentication bypass
- No paywall evasion
- For security research, investigations, and educational purposes

## Part of the Telespot Ecosystem

- **Telespot** - Python CLI tool
- **TeleSpotter** - High-performance Rust implementation
- **TeleSpotXX** - Real-time web platform
- **TELESPOT-NUMSINT** - This Chrome extension

## License

GPLv3 - See [LICENSE](LICENSE) for details.
