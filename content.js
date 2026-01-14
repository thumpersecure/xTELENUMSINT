/**
 * TELESPOT-NUMSINT Content Script
 * Extracts patterns from Google search result pages
 */

(function() {
  // Pattern extraction functions

  // Extract potential names (Capitalized First Last patterns)
  function extractNames(text) {
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const matches = text.match(namePattern) || [];

    // Filter out common false positives
    const excludeList = [
      'Google Search', 'Sign In', 'Privacy Policy', 'Terms Service',
      'United States', 'New York', 'Los Angeles', 'San Francisco',
      'About Results', 'Search Results', 'More Results', 'Related Searches',
      'People Also', 'Did You', 'Showing Results'
    ];

    return [...new Set(matches)].filter(name => {
      return !excludeList.some(exclude => name.includes(exclude)) &&
             name.length > 4 && name.length < 50;
    });
  }

  // Extract usernames (@handles and user_name patterns)
  function extractUsernames(text) {
    const patterns = [
      /@([a-zA-Z0-9_]{2,30})\b/g,                    // @username
      /(?:user|profile|u|@)[\/:]([a-zA-Z0-9_-]{3,30})/gi,  // user/username, profile/username
      /\b([a-z]+[0-9]+[a-z0-9_]*)\b/gi,              // john123, user99
      /\b([a-z]+_[a-z0-9_]+)\b/gi                     // john_doe, user_name_123
    ];

    const usernames = new Set();

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const username = match[1] || match[0];
        if (username.length >= 3 && username.length <= 30) {
          // Add with @ prefix for consistency
          usernames.add(username.startsWith('@') ? username : username);
        }
      }
    });

    // Filter out common words
    const excludeWords = ['the', 'and', 'for', 'that', 'this', 'with', 'from', 'com', 'www', 'http', 'https'];
    return [...usernames].filter(u => !excludeWords.includes(u.toLowerCase()));
  }

  // Extract email addresses
  function extractEmails(text) {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = text.match(emailPattern) || [];
    return [...new Set(matches.map(e => e.toLowerCase()))];
  }

  // Extract locations (City, ST patterns and known cities)
  function extractLocations(text) {
    const patterns = [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/g,  // City, ST
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+)\b/g, // City, State
      /\b(\d{5}(?:-\d{4})?)\b/g  // ZIP codes
    ];

    const locations = new Set();

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        locations.add(match[0]);
      }
    });

    // Known major cities
    const cities = [
      'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
      'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin',
      'San Francisco', 'Seattle', 'Denver', 'Boston', 'Atlanta',
      'Miami', 'Las Vegas', 'Portland', 'Detroit', 'Minneapolis'
    ];

    cities.forEach(city => {
      const regex = new RegExp(`\\b${city}\\b`, 'gi');
      if (regex.test(text)) {
        locations.add(city);
      }
    });

    return [...locations];
  }

  // Extract phone numbers (to find related numbers)
  function extractPhoneNumbers(text) {
    const patterns = [
      /\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
      /\([0-9]{3}\)\s*[0-9]{3}[-.\s]?[0-9]{4}/g
    ];

    const phones = new Set();
    patterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(p => phones.add(p.trim()));
    });

    return [...phones];
  }

  // Extract other patterns (URLs, social profiles, businesses)
  function extractOtherPatterns(text) {
    const patterns = [];

    // Social media profile URLs
    const socialPatterns = [
      /(?:facebook\.com|fb\.com)\/[a-zA-Z0-9._-]+/gi,
      /twitter\.com\/[a-zA-Z0-9_]+/gi,
      /instagram\.com\/[a-zA-Z0-9._]+/gi,
      /linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi,
      /tiktok\.com\/@?[a-zA-Z0-9._]+/gi
    ];

    socialPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      patterns.push(...matches);
    });

    // Business indicators (LLC, Inc, Corp, etc)
    const businessPattern = /\b([A-Z][a-zA-Z\s&]+(?:LLC|Inc|Corp|Ltd|Co|Company|Services|Group)\.?)\b/g;
    let match;
    while ((match = businessPattern.exec(text)) !== null) {
      if (match[1].length > 5 && match[1].length < 60) {
        patterns.push(match[1].trim());
      }
    }

    return [...new Set(patterns)];
  }

  // Main extraction function
  function extractAllPatterns() {
    // Get text from search results area
    const searchResults = document.getElementById('search') ||
                         document.getElementById('rso') ||
                         document.body;

    const text = searchResults.innerText || searchResults.textContent || '';

    return {
      names: extractNames(text),
      usernames: extractUsernames(text),
      emails: extractEmails(text),
      locations: extractLocations(text),
      phones: extractPhoneNumbers(text),
      other: extractOtherPatterns(text),
      url: window.location.href,
      timestamp: Date.now()
    };
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractPatterns') {
      try {
        const patterns = extractAllPatterns();
        sendResponse({ success: true, data: patterns });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true; // Keep channel open for async response
  });

})();
