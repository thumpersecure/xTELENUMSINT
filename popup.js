/**
 * TELESPOT-NUMSINT - Phone Number Intelligence Search
 * Generates multiple phone number formats and searches Google for OSINT
 * v1.3.0 - Auto pattern extraction with cross-tab analysis
 */

document.addEventListener('DOMContentLoaded', () => {
  // Element references
  const phoneInput = document.getElementById('phoneInput');
  const countryCode = document.getElementById('countryCode');
  const searchMode = document.getElementById('searchMode');
  const smartOperator = document.getElementById('smartOperator');
  const smartOptions = document.getElementById('smartOptions');
  const windowMode = document.getElementById('windowMode');
  const searchBtn = document.getElementById('searchBtn');
  const formatsPreview = document.getElementById('formatsPreview');
  const formatsList = document.getElementById('formatsList');
  const resultsSection = document.getElementById('resultsSection');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const summarySection = document.getElementById('summarySection');
  const summaryContent = document.getElementById('summaryContent');
  const reportSection = document.getElementById('reportSection');
  const reportContent = document.getElementById('reportContent');
  const generateReportBtn = document.getElementById('generateReportBtn');
  const copyReportBtn = document.getElementById('copyReportBtn');
  const scanTabsBtn = document.getElementById('scanTabsBtn');
  const rescanBtn = document.getElementById('rescanBtn');
  const scanStatus = document.getElementById('scanStatus');
  const scanStatusText = document.getElementById('scanStatusText');
  const namesFound = document.getElementById('namesFound');
  const usernamesFound = document.getElementById('usernamesFound');
  const emailsFound = document.getElementById('emailsFound');
  const locationsFound = document.getElementById('locationsFound');
  const otherPatterns = document.getElementById('otherPatterns');
  const namesCount = document.getElementById('namesCount');
  const usernamesCount = document.getElementById('usernamesCount');
  const emailsCount = document.getElementById('emailsCount');
  const locationsCount = document.getElementById('locationsCount');
  const otherCount = document.getElementById('otherCount');

  // State
  let searchResults = [];
  let currentFormats = [];
  let generatedReportText = '';
  let openedTabIds = [];  // Track tabs opened by this extension
  let searchWindowId = null;  // Track if we opened a new window
  let extractedPatterns = {
    names: {},      // { pattern: { count: n, tabs: [tabIds] } }
    usernames: {},
    emails: {},
    locations: {},
    phones: {},
    other: {}
  };

  // Copy text to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
    }).catch(() => {
      showToast('Copy failed', true);
    });
  }

  // Show toast notification
  function showToast(message, isError = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
  }

  // Parse phone number - extract only digits
  function parsePhoneNumber(input) {
    return input.replace(/\D/g, '');
  }

  // Generate 10 search formats based on the phone number
  function generateFormats(phoneDigits, country) {
    let areaCode, exchange, subscriber;

    if (phoneDigits.length >= 10) {
      const last10 = phoneDigits.slice(-10);
      areaCode = last10.slice(0, 3);
      exchange = last10.slice(3, 6);
      subscriber = last10.slice(6, 10);
    } else if (phoneDigits.length === 7) {
      areaCode = '555';
      exchange = phoneDigits.slice(0, 3);
      subscriber = phoneDigits.slice(3, 7);
    } else {
      areaCode = phoneDigits.slice(0, 3) || '555';
      exchange = phoneDigits.slice(3, 6) || '555';
      subscriber = phoneDigits.slice(6, 10) || '1234';
    }

    const fullNumber = areaCode + exchange + subscriber;
    const fullWithCountry = country + fullNumber;

    // 10 formats - adjusted per user feedback
    return [
      {
        format: `+${fullWithCountry}`,
        description: 'International format (unquoted)'
      },
      {
        format: `(${areaCode}) ${exchange}-${subscriber}`,
        description: 'US format with parens (unquoted)'
      },
      {
        format: `"(${areaCode}) ${exchange}-${subscriber}"`,
        description: 'US format with parens (quoted)'
      },
      {
        format: `"${country} (${areaCode}) ${exchange}-${subscriber}"`,
        description: 'Full US format with country (quoted)'
      },
      {
        format: `("${areaCode}-${exchange}-${subscriber}")`,
        description: 'Dashed format (parentheses + quoted)'
      },
      {
        format: `${areaCode}-${exchange}-${subscriber}`,
        description: 'Dashed format (unquoted)'
      },
      {
        format: `"${areaCode}-${exchange}-${subscriber}"`,
        description: 'Dashed format (quoted)'
      },
      {
        format: `(${fullNumber})`,
        description: 'Digits only (parentheses)'
      },
      {
        format: `"${fullNumber}"`,
        description: 'Digits only (quoted)'
      },
      {
        format: `"+${country} (${areaCode}) ${exchange}-${subscriber}"`,
        description: 'Full international format (quoted)'
      }
    ];
  }

  // Display formats in the preview section
  function displayFormats(formats) {
    formatsList.innerHTML = '';

    formats.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'format-item';
      div.id = `format-${index}`;
      div.innerHTML = `
        <span class="format-number">${index + 1}.</span>
        <span class="format-value">${escapeHtml(item.format)}</span>
        <button class="copy-btn" data-format="${escapeHtml(item.format)}" title="Copy to clipboard">&#128203;</button>
        <span class="format-status pending" id="status-${index}">○</span>
      `;
      formatsList.appendChild(div);

      div.querySelector('.copy-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.format);
      });
    });

    formatsPreview.classList.remove('hidden');
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Update format status indicator
  function updateFormatStatus(index, status) {
    const statusEl = document.getElementById(`status-${index}`);
    if (!statusEl) return;

    statusEl.className = `format-status ${status}`;
    switch (status) {
      case 'searching':
        statusEl.textContent = '◐';
        break;
      case 'complete':
        statusEl.textContent = '✓';
        break;
      case 'error':
        statusEl.textContent = '✗';
        break;
      default:
        statusEl.textContent = '○';
    }
  }

  // Update progress bar
  function updateProgress(completed, total) {
    const percent = (completed / total) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${completed} / ${total} searches completed`;
  }

  // Perform Google search - now supports new window mode
  async function performSearch(query, index = null) {
    if (index !== null) {
      updateFormatStatus(index, 'searching');
    }

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    try {
      let tab;
      const useNewWindow = windowMode.value === 'newWindow';

      if (useNewWindow && searchWindowId === null) {
        // Create new window for first tab
        const newWindow = await chrome.windows.create({
          url: searchUrl,
          focused: false,
          type: 'normal'
        });
        searchWindowId = newWindow.id;
        tab = newWindow.tabs[0];
      } else if (useNewWindow && searchWindowId !== null) {
        // Add tab to existing search window
        tab = await chrome.tabs.create({
          url: searchUrl,
          windowId: searchWindowId,
          active: false
        });
      } else {
        // Add to current window
        tab = await chrome.tabs.create({
          url: searchUrl,
          active: false
        });
      }

      // Track this tab
      openedTabIds.push(tab.id);

      searchResults.push({
        index,
        query,
        tabId: tab.id,
        url: searchUrl,
        status: 'opened'
      });

      if (index !== null) {
        updateFormatStatus(index, 'complete');
      }
      return { success: true, tabId: tab.id };
    } catch (error) {
      console.error(`Search error:`, error);
      if (index !== null) {
        updateFormatStatus(index, 'error');
      }
      return { success: false, error: error.message };
    }
  }

  // Run individual searches for each format
  async function runIndividualSearches(formats) {
    searchResults = [];
    openedTabIds = [];
    searchWindowId = null;
    resultsSection.classList.remove('hidden');
    summarySection.classList.add('hidden');
    reportSection.classList.add('hidden');

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < formats.length; i++) {
      await performSearch(formats[i].format, i);
      updateProgress(i + 1, formats.length);

      if (i < formats.length - 1) {
        await delay(500);
      }
    }

    showSummary(formats, 'individual');
  }

  // Run smart search (all formats combined)
  async function runSmartSearch(formats) {
    searchResults = [];
    openedTabIds = [];
    searchWindowId = null;
    resultsSection.classList.remove('hidden');
    summarySection.classList.add('hidden');
    reportSection.classList.add('hidden');

    const operator = smartOperator.value;
    const combinedQuery = formats.map(f => f.format).join(` ${operator} `);

    // Mark all as searching
    formats.forEach((_, i) => updateFormatStatus(i, 'searching'));

    updateProgress(0, 1);
    await performSearch(combinedQuery, null);
    updateProgress(1, 1);

    // Mark all as complete
    formats.forEach((_, i) => updateFormatStatus(i, 'complete'));

    showSummary(formats, 'smart');
  }

  // Display search summary
  function showSummary(formats, mode) {
    const successCount = searchResults.filter(r => r.status === 'opened').length;
    const expectedCount = mode === 'smart' ? 1 : formats.length;
    const errorCount = expectedCount - successCount;

    let modeText = mode === 'smart'
      ? `Smart Search (${smartOperator.value})`
      : 'Individual Searches';

    let windowText = windowMode.value === 'newWindow' ? 'New Window' : 'Current Window';

    summaryContent.innerHTML = `
      <div class="summary-stat">
        <span class="stat-label">Search Mode</span>
        <span class="stat-value">${modeText}</span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Tab Location</span>
        <span class="stat-value">${windowText}</span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Formats Used</span>
        <span class="stat-value">${formats.length}</span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Tabs Opened</span>
        <span class="stat-value ${successCount === expectedCount ? 'high' : 'medium'}">${successCount}</span>
      </div>
      ${errorCount > 0 ? `
      <div class="summary-stat">
        <span class="stat-label">Errors</span>
        <span class="stat-value low">${errorCount}</span>
      </div>
      ` : ''}
      <div class="summary-stat">
        <span class="stat-label">Status</span>
        <span class="stat-value ${successCount === expectedCount ? 'high' : 'medium'}">
          ${successCount === expectedCount ? 'Complete' : 'Partial'}
        </span>
      </div>
    `;

    summarySection.classList.remove('hidden');
    reportSection.classList.remove('hidden');
    searchBtn.disabled = false;
    searchBtn.innerHTML = '<span class="btn-icon">&#128269;</span> Search Again';
  }

  // Scan tabs for patterns
  async function scanTabs() {
    scanTabsBtn.disabled = true;
    scanStatus.classList.remove('hidden', 'complete', 'error');
    scanStatusText.textContent = 'Scanning tabs...';

    // Reset extracted patterns
    extractedPatterns = {
      names: {},
      usernames: {},
      emails: {},
      locations: {},
      phones: {},
      other: {}
    };

    // Determine which tabs to scan
    let tabsToScan = [];

    if (openedTabIds.length > 0) {
      // Scan only tabs opened by this extension
      tabsToScan = openedTabIds;
      scanStatusText.textContent = `Scanning ${tabsToScan.length} extension tabs...`;
    } else {
      // No tabs opened yet - scan all Google tabs
      const allTabs = await chrome.tabs.query({ url: 'https://www.google.com/*' });
      tabsToScan = allTabs.map(t => t.id);
      scanStatusText.textContent = `Scanning ${tabsToScan.length} Google tabs...`;
    }

    if (tabsToScan.length === 0) {
      scanStatus.classList.add('error');
      scanStatusText.textContent = 'No tabs to scan. Run a search first!';
      scanTabsBtn.disabled = false;
      return;
    }

    let scannedCount = 0;
    let errorCount = 0;

    for (const tabId of tabsToScan) {
      try {
        scanStatusText.textContent = `Scanning tab ${scannedCount + 1} of ${tabsToScan.length}...`;

        // Send message to content script
        const response = await chrome.tabs.sendMessage(tabId, { action: 'extractPatterns' });

        if (response && response.success) {
          // Process extracted data
          processExtractedData(response.data, tabId);
          scannedCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error scanning tab ${tabId}:`, error);
        errorCount++;
      }
    }

    // Update UI with results
    if (scannedCount > 0) {
      populatePatternFields();
      scanStatus.classList.add('complete');
      scanStatusText.textContent = `Scanned ${scannedCount} tabs. ${errorCount > 0 ? `${errorCount} errors.` : 'Patterns extracted!'}`;
      rescanBtn.classList.remove('hidden');
    } else {
      scanStatus.classList.add('error');
      scanStatusText.textContent = 'Could not scan tabs. Make sure pages are loaded.';
    }

    scanTabsBtn.disabled = false;
  }

  // Process extracted data from a single tab
  function processExtractedData(data, tabId) {
    // Names
    if (data.names) {
      data.names.forEach(name => {
        if (!extractedPatterns.names[name]) {
          extractedPatterns.names[name] = { count: 0, tabs: [] };
        }
        if (!extractedPatterns.names[name].tabs.includes(tabId)) {
          extractedPatterns.names[name].count++;
          extractedPatterns.names[name].tabs.push(tabId);
        }
      });
    }

    // Usernames
    if (data.usernames) {
      data.usernames.forEach(username => {
        if (!extractedPatterns.usernames[username]) {
          extractedPatterns.usernames[username] = { count: 0, tabs: [] };
        }
        if (!extractedPatterns.usernames[username].tabs.includes(tabId)) {
          extractedPatterns.usernames[username].count++;
          extractedPatterns.usernames[username].tabs.push(tabId);
        }
      });
    }

    // Emails
    if (data.emails) {
      data.emails.forEach(email => {
        if (!extractedPatterns.emails[email]) {
          extractedPatterns.emails[email] = { count: 0, tabs: [] };
        }
        if (!extractedPatterns.emails[email].tabs.includes(tabId)) {
          extractedPatterns.emails[email].count++;
          extractedPatterns.emails[email].tabs.push(tabId);
        }
      });
    }

    // Locations
    if (data.locations) {
      data.locations.forEach(location => {
        if (!extractedPatterns.locations[location]) {
          extractedPatterns.locations[location] = { count: 0, tabs: [] };
        }
        if (!extractedPatterns.locations[location].tabs.includes(tabId)) {
          extractedPatterns.locations[location].count++;
          extractedPatterns.locations[location].tabs.push(tabId);
        }
      });
    }

    // Phone numbers
    if (data.phones) {
      data.phones.forEach(phone => {
        if (!extractedPatterns.phones[phone]) {
          extractedPatterns.phones[phone] = { count: 0, tabs: [] };
        }
        if (!extractedPatterns.phones[phone].tabs.includes(tabId)) {
          extractedPatterns.phones[phone].count++;
          extractedPatterns.phones[phone].tabs.push(tabId);
        }
      });
    }

    // Other patterns
    if (data.other) {
      data.other.forEach(item => {
        if (!extractedPatterns.other[item]) {
          extractedPatterns.other[item] = { count: 0, tabs: [] };
        }
        if (!extractedPatterns.other[item].tabs.includes(tabId)) {
          extractedPatterns.other[item].count++;
          extractedPatterns.other[item].tabs.push(tabId);
        }
      });
    }
  }

  // Sort patterns by frequency (multi-tab = higher priority)
  function sortByFrequency(patternObj) {
    return Object.entries(patternObj)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([pattern, data]) => {
        if (data.count > 1) {
          return `[${data.count}x] ${pattern}`;
        }
        return pattern;
      });
  }

  // Populate pattern fields with extracted data
  function populatePatternFields() {
    // Names - sorted by frequency
    const sortedNames = sortByFrequency(extractedPatterns.names);
    namesFound.value = sortedNames.join('\n');
    updateCountBadge(namesCount, sortedNames.length, extractedPatterns.names);

    // Usernames - sorted by frequency
    const sortedUsernames = sortByFrequency(extractedPatterns.usernames);
    usernamesFound.value = sortedUsernames.join('\n');
    updateCountBadge(usernamesCount, sortedUsernames.length, extractedPatterns.usernames);

    // Emails - sorted by frequency (priority: multi-tab first)
    const sortedEmails = sortByFrequency(extractedPatterns.emails);
    emailsFound.value = sortedEmails.join('\n');
    updateCountBadge(emailsCount, sortedEmails.length, extractedPatterns.emails);

    // Locations - sorted by frequency
    const sortedLocations = sortByFrequency(extractedPatterns.locations);
    locationsFound.value = sortedLocations.join('\n');
    updateCountBadge(locationsCount, sortedLocations.length, extractedPatterns.locations);

    // Other patterns (phones + social + businesses)
    const combinedOther = { ...extractedPatterns.phones, ...extractedPatterns.other };
    const sortedOther = sortByFrequency(combinedOther);
    otherPatterns.value = sortedOther.join('\n');
    updateCountBadge(otherCount, sortedOther.length, combinedOther);

    showToast('Patterns extracted!');
  }

  // Update count badge with priority indicator
  function updateCountBadge(badgeEl, count, patternObj) {
    if (!badgeEl) return;

    const multiTabCount = Object.values(patternObj).filter(p => p.count > 1).length;

    if (count === 0) {
      badgeEl.textContent = '';
      badgeEl.className = 'count-badge';
    } else if (multiTabCount > 0) {
      badgeEl.textContent = `${count} (${multiTabCount} priority)`;
      badgeEl.className = 'count-badge high-priority';
    } else {
      badgeEl.textContent = count;
      badgeEl.className = 'count-badge';
    }
  }

  // Parse textarea input into array of non-empty lines
  function parseTextareaInput(text) {
    return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  }

  // Generate pattern analysis report
  function generateReport() {
    const phone = phoneInput.value.trim();
    const country = countryCode.value;
    const mode = searchMode.value;
    const timestamp = new Date().toLocaleString();

    // Get pattern inputs
    const names = parseTextareaInput(namesFound.value);
    const usernames = parseTextareaInput(usernamesFound.value);
    const emails = parseTextareaInput(emailsFound.value);
    const locations = parseTextareaInput(locationsFound.value);
    const other = parseTextareaInput(otherPatterns.value);

    // Separate high-priority (multi-tab) from regular
    const separateByPriority = (items) => {
      const high = items.filter(i => i.startsWith('['));
      const normal = items.filter(i => !i.startsWith('['));
      return { high, normal };
    };

    const emailPriority = separateByPriority(emails);
    const locationPriority = separateByPriority(locations);

    // Generate plain text report for copying
    generatedReportText = `
════════════════════════════════════════════════════════════════
                    TELESPOT-NUMSINT PATTERN REPORT
════════════════════════════════════════════════════════════════
Generated: ${timestamp}

─────────────────────────────────────────────────────────────────
SEARCH PARAMETERS
─────────────────────────────────────────────────────────────────
Target Number:  ${phone}
Country Code:   +${country}
Search Mode:    ${mode === 'smart' ? `Smart Search (${smartOperator.value})` : 'Individual (10 tabs)'}
Tabs Opened:    ${searchResults.length}
Tabs Scanned:   ${openedTabIds.length || 'N/A'}

─────────────────────────────────────────────────────────────────
FORMAT VARIATIONS SEARCHED
─────────────────────────────────────────────────────────────────
${currentFormats.map((f, i) => `  ${String(i + 1).padStart(2, '0')}. ${f.format}`).join('\n')}

─────────────────────────────────────────────────────────────────
NAMES FOUND (${names.length})
─────────────────────────────────────────────────────────────────
${names.length > 0 ? names.map(n => `  ● ${n}`).join('\n') : '  (No names found)'}

─────────────────────────────────────────────────────────────────
USERNAMES FOUND (${usernames.length})
─────────────────────────────────────────────────────────────────
${usernames.length > 0 ? usernames.map(u => `  ● ${u}`).join('\n') : '  (No usernames found)'}

─────────────────────────────────────────────────────────────────
EMAILS FOUND (${emails.length})
─────────────────────────────────────────────────────────────────
${emailPriority.high.length > 0 ? '  HIGH PRIORITY (multi-tab matches):\n' + emailPriority.high.map(e => `    ★ ${e}`).join('\n') + '\n' : ''}${emailPriority.normal.length > 0 ? '  Other:\n' + emailPriority.normal.map(e => `    ● ${e}`).join('\n') : ''}${emails.length === 0 ? '  (No emails found)' : ''}

─────────────────────────────────────────────────────────────────
LOCATIONS FOUND (${locations.length})
─────────────────────────────────────────────────────────────────
${locationPriority.high.length > 0 ? '  HIGH PRIORITY (multi-tab matches):\n' + locationPriority.high.map(l => `    ★ ${l}`).join('\n') + '\n' : ''}${locationPriority.normal.length > 0 ? '  Other:\n' + locationPriority.normal.map(l => `    ● ${l}`).join('\n') : ''}${locations.length === 0 ? '  (No locations found)' : ''}

─────────────────────────────────────────────────────────────────
OTHER PATTERNS (${other.length})
─────────────────────────────────────────────────────────────────
${other.length > 0 ? other.map(o => `  ● ${o}`).join('\n') : '  (No other patterns found)'}

════════════════════════════════════════════════════════════════
                         END OF REPORT
════════════════════════════════════════════════════════════════
`.trim();

    // Generate HTML display
    const formatSection = (title, items, emptyMsg) => {
      if (items.length === 0) {
        return `<div class="section-title">${title} (0)</div><div class="no-data">${emptyMsg}</div>`;
      }
      return `<div class="section-title">${title} (${items.length})</div>${items.map(i => {
        const isHighPriority = i.startsWith('[');
        return `<div class="pattern-item ${isHighPriority ? 'high-priority' : ''}">${isHighPriority ? '★' : '●'} ${escapeHtml(i)}</div>`;
      }).join('')}`;
    };

    reportContent.innerHTML = `
      <div class="generated-report">
        <div class="report-title">TELESPOT-NUMSINT PATTERN REPORT</div>
        <div style="text-align:center;color:#666;font-size:10px;margin-bottom:12px;">${timestamp}</div>

        <div class="section-title">TARGET</div>
        <div class="pattern-item">${escapeHtml(phone)} (+${country})</div>

        ${formatSection('NAMES FOUND', names, 'No names found')}
        ${formatSection('USERNAMES FOUND', usernames, 'No usernames found')}
        ${formatSection('EMAILS FOUND', emails, 'No emails found')}
        ${formatSection('LOCATIONS FOUND', locations, 'No locations found')}
        ${formatSection('OTHER PATTERNS', other, 'No other patterns found')}
      </div>
    `;

    // Show copy button
    copyReportBtn.classList.remove('hidden');

    showToast('Report generated!');
  }

  // Copy full report to clipboard
  function copyReport() {
    if (generatedReportText) {
      copyToClipboard(generatedReportText);
    } else {
      showToast('Generate report first', true);
    }
  }

  // Main search handler
  async function handleSearch() {
    const phone = phoneInput.value.trim();

    if (!phone) {
      phoneInput.focus();
      phoneInput.style.borderColor = '#ff3d00';
      setTimeout(() => {
        phoneInput.style.borderColor = '';
      }, 2000);
      return;
    }

    const digits = parsePhoneNumber(phone);

    if (digits.length < 7) {
      phoneInput.style.borderColor = '#ff3d00';
      setTimeout(() => {
        phoneInput.style.borderColor = '';
      }, 2000);
      return;
    }

    const country = countryCode.value;
    const formats = generateFormats(digits, country);
    currentFormats = formats;

    displayFormats(formats);

    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span class="btn-icon">⏳</span> Searching...';

    const mode = searchMode.value;
    if (mode === 'smart') {
      await runSmartSearch(formats);
    } else {
      await runIndividualSearches(formats);
    }
  }

  // Toggle smart options visibility
  function updateSmartOptionsVisibility() {
    if (searchMode.value === 'smart') {
      smartOptions.classList.remove('hidden');
    } else {
      smartOptions.classList.add('hidden');
    }
  }

  // Event listeners
  searchBtn.addEventListener('click', handleSearch);

  phoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });

  searchMode.addEventListener('change', updateSmartOptionsVisibility);

  generateReportBtn.addEventListener('click', generateReport);
  copyReportBtn.addEventListener('click', copyReport);

  // Scan tabs button
  scanTabsBtn.addEventListener('click', scanTabs);

  // Re-scan button
  rescanBtn.addEventListener('click', () => {
    rescanBtn.classList.add('hidden');
    scanTabs();
  });

  // Live preview of formats as user types
  phoneInput.addEventListener('input', () => {
    const phone = phoneInput.value.trim();
    const digits = parsePhoneNumber(phone);

    if (digits.length >= 7) {
      const country = countryCode.value;
      const formats = generateFormats(digits, country);
      currentFormats = formats;
      displayFormats(formats);
    } else {
      formatsPreview.classList.add('hidden');
    }
  });

  countryCode.addEventListener('change', () => {
    const phone = phoneInput.value.trim();
    const digits = parsePhoneNumber(phone);

    if (digits.length >= 7) {
      const country = countryCode.value;
      const formats = generateFormats(digits, country);
      currentFormats = formats;
      displayFormats(formats);
    }
  });

  // Initialize
  phoneInput.placeholder = '555-555-1234';
  updateSmartOptionsVisibility();
});
