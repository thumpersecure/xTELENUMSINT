/**
 * TELESPOT-NUMSINT Content Script
 * Extracts patterns from Google search result pages
 * v1.4.0 - Improved filtering, reduced false positives
 */

(function() {

  // Extract potential names (Capitalized First Last patterns)
  function extractNames(text) {
    const namePattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+)\b/g;
    const matches = text.match(namePattern) || [];

    const excludeList = [
      'Google Search', 'Sign In', 'Privacy Policy', 'Terms Service',
      'United States', 'New York', 'Los Angeles', 'San Francisco',
      'About Results', 'Search Results', 'More Results', 'Related Searches',
      'People Also', 'Did You', 'Showing Results', 'All Rights',
      'Learn More', 'Read More', 'See More', 'View All',
      'Terms And', 'Cookie Policy', 'Safe Search', 'Google Maps',
      'Google Images', 'Shopping Results', 'Top Stories',
      'Web Results', 'Image Results', 'Video Results',
      'Chrome Web', 'Play Store', 'App Store'
    ];

    return [...new Set(matches)].filter(name => {
      return !excludeList.some(exclude => name.includes(exclude)) &&
             name.length > 4 && name.length < 40 &&
             name.split(/\s+/).length <= 4;
    });
  }

  // Extract usernames (@handles and profile URLs)
  function extractUsernames(text) {
    const patterns = [
      /@([a-zA-Z0-9_]{3,30})\b/g,
      /(?:user|profile|u)[\/:]([a-zA-Z0-9_-]{3,30})/gi
    ];

    const usernames = new Set();

    const excludeWords = new Set([
      'the', 'and', 'for', 'that', 'this', 'with', 'from', 'com', 'www',
      'http', 'https', 'html', 'page', 'search', 'google', 'gmail',
      'media', 'image', 'images', 'video', 'about', 'contact',
      'index', 'login', 'signup', 'account', 'settings', 'privacy',
      'terms', 'help', 'support', 'undefined', 'null', 'true', 'false'
    ]);

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const username = match[1] || match[0];
        if (username.length >= 3 && username.length <= 30 &&
            !excludeWords.has(username.toLowerCase()) &&
            !/^\d+$/.test(username)) {
          usernames.add(username);
        }
      }
    });

    return [...usernames];
  }

  // Extract email addresses
  function extractEmails(text) {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const matches = text.match(emailPattern) || [];

    const excludeDomains = ['example.com', 'test.com', 'email.com', 'domain.com', 'sentry.io'];

    return [...new Set(matches.map(e => e.toLowerCase()))].filter(email => {
      return !excludeDomains.some(d => email.endsWith(d));
    });
  }

  // Extract locations (City, ST patterns and known cities)
  function extractLocations(text) {
    const patterns = [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/g,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+)\b/g,
      /\b(\d{5}(?:-\d{4})?)\b/g
    ];

    const locations = new Set();

    // Exclude known false positive patterns
    const excludeLocationParts = [
      'Google', 'Search', 'Sign', 'About', 'More', 'View', 'Read',
      'Learn', 'Click', 'Terms', 'Privacy', 'Cookie'
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const loc = match[0];
        if (!excludeLocationParts.some(ex => loc.includes(ex))) {
          locations.add(loc);
        }
      }
    });

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

  // Extract other patterns (social profiles, businesses)
  function extractOtherPatterns(text) {
    const patterns = [];

    const socialPatterns = [
      /(?:facebook\.com|fb\.com)\/[a-zA-Z0-9._-]+/gi,
      /twitter\.com\/[a-zA-Z0-9_]+/gi,
      /x\.com\/[a-zA-Z0-9_]+/gi,
      /instagram\.com\/[a-zA-Z0-9._]+/gi,
      /linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi,
      /tiktok\.com\/@?[a-zA-Z0-9._]+/gi,
      /reddit\.com\/u(?:ser)?\/[a-zA-Z0-9_-]+/gi,
      /github\.com\/[a-zA-Z0-9_-]+/gi
    ];

    socialPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      patterns.push(...matches);
    });

    const businessPattern = /\b([A-Z][a-zA-Z\s&]{3,}(?:LLC|Inc|Corp|Ltd|Co|Company|Services|Group)\.?)\b/g;
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
    return true;
  });

})();
