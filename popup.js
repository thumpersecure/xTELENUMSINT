/**
 * TELESPOT-NUMSINT - Phone Number Intelligence Search
 * Generates multiple phone number formats and searches Google for OSINT
 * v1.4.0 - Persistent state, stability fixes, enhanced extraction
 */

document.addEventListener('DOMContentLoaded', () => {
  const { sleep, allSettledMapLimit } = window.TelespotConcurrency || {};
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
  let openedTabIds = [];
  let searchWindowId = null;
  let extractedPatterns = {
    names: {},
    usernames: {},
    emails: {},
    locations: {},
    phones: {},
    other: {}
  };

  // ─────────────────────────────────────────────────────────────
  // PERSISTENCE: Save & restore state via chrome.storage.local
  // ─────────────────────────────────────────────────────────────

  const STORAGE_KEY = 'telespot_state';

  // Debounce helper to avoid excessive writes
  let saveTimeout = null;
  function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveState, 300);
  }

  function saveState() {
    const state = {
      phoneInput: phoneInput.value,
      countryCode: countryCode.value,
      searchMode: searchMode.value,
      smartOperator: smartOperator.value,
      windowMode: windowMode.value,
      searchResults: searchResults,
      currentFormats: currentFormats,
      generatedReportText: generatedReportText,
      openedTabIds: openedTabIds,
      searchWindowId: searchWindowId,
      extractedPatterns: extractedPatterns,
      namesFound: namesFound.value,
      usernamesFound: usernamesFound.value,
      emailsFound: emailsFound.value,
      locationsFound: locationsFound.value,
      otherPatterns: otherPatterns.value,
      reportHTML: reportContent.innerHTML,
      uiState: {
        formatsVisible: !formatsPreview.classList.contains('hidden'),
        resultsVisible: !resultsSection.classList.contains('hidden'),
        summaryVisible: !summarySection.classList.contains('hidden'),
        reportSectionVisible: !reportSection.classList.contains('hidden'),
        copyBtnVisible: !copyReportBtn.classList.contains('hidden'),
        rescanVisible: !rescanBtn.classList.contains('hidden'),
        summaryHTML: summaryContent.innerHTML,
        progressWidth: progressFill.style.width,
        progressText: progressText.textContent,
        searchBtnText: searchBtn.innerHTML,
        searchBtnDisabled: false
      },
      savedAt: Date.now()
    };

    chrome.storage.local.set({ [STORAGE_KEY]: state });
  }

  async function restoreState() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const state = result[STORAGE_KEY];
      if (!state) return;

      // Discard state older than 24 hours
      if (Date.now() - state.savedAt > 86400000) {
        chrome.storage.local.remove(STORAGE_KEY);
        return;
      }

      // Restore form inputs
      phoneInput.value = state.phoneInput || '';
      countryCode.value = state.countryCode || '1';
      searchMode.value = state.searchMode || 'individual';
      smartOperator.value = state.smartOperator || 'OR';
      windowMode.value = state.windowMode || 'newWindow';

      // Restore internal state
      searchResults = state.searchResults || [];
      currentFormats = state.currentFormats || [];
      generatedReportText = state.generatedReportText || '';
      openedTabIds = state.openedTabIds || [];
      searchWindowId = state.searchWindowId || null;
      extractedPatterns = state.extractedPatterns || {
        names: {}, usernames: {}, emails: {},
        locations: {}, phones: {}, other: {}
      };

      // Restore textarea content
      namesFound.value = state.namesFound || '';
      usernamesFound.value = state.usernamesFound || '';
      emailsFound.value = state.emailsFound || '';
      locationsFound.value = state.locationsFound || '';
      otherPatterns.value = state.otherPatterns || '';

      // Restore report
      if (state.reportHTML) {
        reportContent.innerHTML = state.reportHTML;
      }

      // Restore UI visibility state
      const ui = state.uiState;
      if (ui) {
        if (ui.formatsVisible && currentFormats.length > 0) {
          displayFormats(currentFormats);
        }
        if (ui.resultsVisible) {
          resultsSection.classList.remove('hidden');
          progressFill.style.width = ui.progressWidth || '0%';
          progressText.textContent = ui.progressText || '';
        }
        if (ui.summaryVisible) {
          summarySection.classList.remove('hidden');
          summaryContent.innerHTML = ui.summaryHTML || '';
        }
        if (ui.reportSectionVisible) {
          reportSection.classList.remove('hidden');
        }
        if (ui.copyBtnVisible) {
          copyReportBtn.classList.remove('hidden');
        }
        if (ui.rescanVisible) {
          rescanBtn.classList.remove('hidden');
        }
        if (ui.searchBtnText && searchResults.length > 0) {
          searchBtn.innerHTML = '<span class="btn-icon">&#128269;</span> Search Again';
        }
      }

      // Restore count badges
      updateCountBadge(namesCount, parseTextareaInput(namesFound.value).length, extractedPatterns.names);
      updateCountBadge(usernamesCount, parseTextareaInput(usernamesFound.value).length, extractedPatterns.usernames);
      updateCountBadge(emailsCount, parseTextareaInput(emailsFound.value).length, extractedPatterns.emails);
      updateCountBadge(locationsCount, parseTextareaInput(locationsFound.value).length, extractedPatterns.locations);
      const combinedOther = { ...extractedPatterns.phones, ...extractedPatterns.other };
      updateCountBadge(otherCount, parseTextareaInput(otherPatterns.value).length, combinedOther);

      // Validate that tracked tabs still exist
      await cleanupStaleTabs();

      updateSmartOptionsVisibility();
    } catch (e) {
      console.error('Error restoring state:', e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TAB CLEANUP: Remove stale tab IDs that no longer exist
  // ─────────────────────────────────────────────────────────────

  async function cleanupStaleTabs() {
    if (openedTabIds.length === 0) return;

    if (typeof allSettledMapLimit === 'function') {
      const settled = await allSettledMapLimit(
        openedTabIds,
        8,
        (tabId) => chrome.tabs.get(tabId)
      );
      openedTabIds = settled
        .map((r, idx) => (r && r.status === 'fulfilled' ? openedTabIds[idx] : null))
        .filter(Boolean);
    } else {
      const validIds = [];
      for (const tabId of openedTabIds) {
        try {
          await chrome.tabs.get(tabId);
          validIds.push(tabId);
        } catch {
          // Tab no longer exists
        }
      }
      openedTabIds = validIds;
    }

    // Validate search window still exists
    if (searchWindowId !== null) {
      try {
        await chrome.windows.get(searchWindowId);
      } catch {
        searchWindowId = null;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
    }).catch(() => {
      showToast('Copy failed', true);
    });
  }

  function showToast(message, isError = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─────────────────────────────────────────────────────────────
  // PHONE NUMBER PARSING & FORMAT GENERATION
  // ─────────────────────────────────────────────────────────────

  function parsePhoneNumber(input) {
    return input.replace(/\D/g, '');
  }

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
    } else if (phoneDigits.length === 8) {
      // 8-digit: treat as area(2) + exchange(3) + subscriber(3) padded
      areaCode = '0' + phoneDigits.slice(0, 2);
      exchange = phoneDigits.slice(2, 5);
      subscriber = phoneDigits.slice(5, 8) + '0';
    } else if (phoneDigits.length === 9) {
      // 9-digit: treat as area(3) + exchange(3) + subscriber(3) padded
      areaCode = phoneDigits.slice(0, 3);
      exchange = phoneDigits.slice(3, 6);
      subscriber = phoneDigits.slice(6, 9) + '0';
    } else {
      // Fewer than 7 digits - pad with zeros
      const padded = phoneDigits.padEnd(10, '0');
      areaCode = padded.slice(0, 3);
      exchange = padded.slice(3, 6);
      subscriber = padded.slice(6, 10);
    }

    const fullNumber = areaCode + exchange + subscriber;
    const fullWithCountry = country + fullNumber;

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

  // ─────────────────────────────────────────────────────────────
  // FORMAT DISPLAY & STATUS
  // ─────────────────────────────────────────────────────────────

  function displayFormats(formats) {
    formatsList.innerHTML = '';

    formats.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'format-item';
      div.id = `format-${index}`;
      div.innerHTML = `
        <span class="format-number">${index + 1}.</span>
        <span class="format-value">${escapeHtml(item.format)}</span>
        <button class="copy-btn" title="Copy to clipboard">&#128203;</button>
        <span class="format-status pending" id="status-${index}">&#9675;</span>
      `;
      formatsList.appendChild(div);

      div.querySelector('.copy-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.format);
      });
    });

    formatsPreview.classList.remove('hidden');
  }

  function updateFormatStatus(index, status) {
    const statusEl = document.getElementById(`status-${index}`);
    if (!statusEl) return;

    statusEl.className = `format-status ${status}`;
    switch (status) {
      case 'searching':
        statusEl.textContent = '\u25D0';
        break;
      case 'complete':
        statusEl.textContent = '\u2713';
        break;
      case 'error':
        statusEl.textContent = '\u2717';
        break;
      default:
        statusEl.textContent = '\u25CB';
    }
  }

  function updateProgress(completed, total) {
    const percent = (completed / total) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${completed} / ${total} searches completed`;
  }

  // ─────────────────────────────────────────────────────────────
  // SEARCH EXECUTION
  // ─────────────────────────────────────────────────────────────

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
        // Verify window still exists before adding tab to it
        try {
          await chrome.windows.get(searchWindowId);
        } catch {
          // Window was closed, create a new one
          const newWindow = await chrome.windows.create({
            url: searchUrl,
            focused: false,
            type: 'normal'
          });
          searchWindowId = newWindow.id;
          tab = newWindow.tabs[0];
        }
        if (!tab) {
          tab = await chrome.tabs.create({
            url: searchUrl,
            windowId: searchWindowId,
            active: false
          });
        }
      } else {
        tab = await chrome.tabs.create({
          url: searchUrl,
          active: false
        });
      }

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

      debouncedSave();
      return { success: true, tabId: tab.id };
    } catch (error) {
      console.error('Search error:', error);
      if (index !== null) {
        updateFormatStatus(index, 'error');
      }
      return { success: false, error: error.message };
    }
  }

  async function runIndividualSearches(formats) {
    searchResults = [];
    openedTabIds = [];
    searchWindowId = null;
    resultsSection.classList.remove('hidden');
    summarySection.classList.add('hidden');
    reportSection.classList.add('hidden');

    const total = formats.length;
    let completed = 0;

    const useNewWindow = windowMode.value === 'newWindow';
    const maxConcurrency = useNewWindow ? 3 : 4;

    updateProgress(0, total);

    // If opening in a new window, create the first tab/window deterministically
    // so the remaining tabs can safely target the same window.
    if (useNewWindow && formats.length > 0) {
      await performSearch(formats[0].format, 0);
      completed = 1;
      updateProgress(completed, total);
    }

    const startIndex = useNewWindow ? 1 : 0;
    const remaining = formats.slice(startIndex).map((f, i) => ({
      format: f.format,
      index: startIndex + i
    }));

    if (remaining.length > 0 && typeof allSettledMapLimit === 'function') {
      await allSettledMapLimit(
        remaining,
        maxConcurrency,
        async (item, pos) => {
          if (typeof sleep === 'function') {
            await sleep(Math.min(900, pos * 120)); // small stagger to avoid bursty opens
          }
          return performSearch(item.format, item.index);
        },
        {
          onSettled: () => {
            completed++;
            updateProgress(completed, total);
          }
        }
      );
    } else {
      for (let i = startIndex; i < formats.length; i++) {
        await performSearch(formats[i].format, i);
        completed++;
        updateProgress(completed, total);
        if (typeof sleep === 'function' && i < formats.length - 1) {
          await sleep(250);
        }
      }
    }

    showSummary(formats, 'individual');
  }

  async function runSmartSearch(formats) {
    searchResults = [];
    openedTabIds = [];
    searchWindowId = null;
    resultsSection.classList.remove('hidden');
    summarySection.classList.add('hidden');
    reportSection.classList.add('hidden');

    const operator = smartOperator.value;
    const combinedQuery = formats.map(f => f.format).join(` ${operator} `);

    formats.forEach((_, i) => updateFormatStatus(i, 'searching'));

    updateProgress(0, 1);
    await performSearch(combinedQuery, null);
    updateProgress(1, 1);

    formats.forEach((_, i) => updateFormatStatus(i, 'complete'));

    showSummary(formats, 'smart');
  }

  // ─────────────────────────────────────────────────────────────
  // SUMMARY DISPLAY
  // ─────────────────────────────────────────────────────────────

  function showSummary(formats, mode) {
    const successCount = searchResults.filter(r => r.status === 'opened').length;
    const expectedCount = mode === 'smart' ? 1 : formats.length;
    const errorCount = expectedCount - successCount;

    const modeText = mode === 'smart'
      ? `Smart Search (${smartOperator.value})`
      : 'Individual Searches';

    const windowText = windowMode.value === 'newWindow' ? 'New Window' : 'Current Window';

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

    debouncedSave();
  }

  // ─────────────────────────────────────────────────────────────
  // PATTERN SCANNING
  // ─────────────────────────────────────────────────────────────

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

    // Cleanup stale tabs before scanning
    await cleanupStaleTabs();

    let tabsToScan = [];

    if (openedTabIds.length > 0) {
      tabsToScan = openedTabIds;
      scanStatusText.textContent = `Scanning ${tabsToScan.length} extension tabs...`;
    } else {
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

    const maxScanConcurrency = 4;
    const total = tabsToScan.length;

    const scanOneTab = async (tabId) => {
      // Try injecting content script first in case tab was opened before extension loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });
      } catch {
        // Content script may already be injected, that's fine
      }

      // sendMessage can fail if the tab isn't ready yet; retry once.
      let lastErr = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await chrome.tabs.sendMessage(tabId, { action: 'extractPatterns' });
          if (response && response.success) {
            processExtractedData(response.data, tabId);
            return true;
          }
          return false;
        } catch (err) {
          lastErr = err;
          if (typeof sleep === 'function') await sleep(200);
        }
      }
      if (lastErr) throw lastErr;
      return false;
    };

    if (typeof allSettledMapLimit === 'function') {
      await allSettledMapLimit(
        tabsToScan,
        maxScanConcurrency,
        async (tabId, idx) => {
          if (typeof sleep === 'function') {
            await sleep(Math.min(600, idx * 60)); // small stagger to reduce contention
          }
          return scanOneTab(tabId);
        },
        {
          onSettled: (result) => {
            if (result && result.status === 'fulfilled' && result.value === true) {
              scannedCount++;
            } else {
              errorCount++;
            }
            scanStatusText.textContent = `Scanned ${scannedCount + errorCount} of ${total} tabs...`;
          }
        }
      );
    } else {
      for (const tabId of tabsToScan) {
        try {
          scanStatusText.textContent = `Scanning tab ${scannedCount + errorCount + 1} of ${total}...`;
          const ok = await scanOneTab(tabId);
          if (ok) scannedCount++;
          else errorCount++;
        } catch (error) {
          console.error(`Error scanning tab ${tabId}:`, error);
          errorCount++;
        }
      }
    }

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
    debouncedSave();
  }

  // ─────────────────────────────────────────────────────────────
  // PATTERN PROCESSING (refactored from duplicated code)
  // ─────────────────────────────────────────────────────────────

  function mergePatternCategory(target, items, tabId) {
    if (!items) return;
    items.forEach(item => {
      if (!target[item]) {
        target[item] = { count: 0, tabs: [] };
      }
      if (!target[item].tabs.includes(tabId)) {
        target[item].count++;
        target[item].tabs.push(tabId);
      }
    });
  }

  function processExtractedData(data, tabId) {
    mergePatternCategory(extractedPatterns.names, data.names, tabId);
    mergePatternCategory(extractedPatterns.usernames, data.usernames, tabId);
    mergePatternCategory(extractedPatterns.emails, data.emails, tabId);
    mergePatternCategory(extractedPatterns.locations, data.locations, tabId);
    mergePatternCategory(extractedPatterns.phones, data.phones, tabId);
    mergePatternCategory(extractedPatterns.other, data.other, tabId);
  }

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

  function populatePatternFields() {
    const sortedNames = sortByFrequency(extractedPatterns.names);
    namesFound.value = sortedNames.join('\n');
    updateCountBadge(namesCount, sortedNames.length, extractedPatterns.names);

    const sortedUsernames = sortByFrequency(extractedPatterns.usernames);
    usernamesFound.value = sortedUsernames.join('\n');
    updateCountBadge(usernamesCount, sortedUsernames.length, extractedPatterns.usernames);

    const sortedEmails = sortByFrequency(extractedPatterns.emails);
    emailsFound.value = sortedEmails.join('\n');
    updateCountBadge(emailsCount, sortedEmails.length, extractedPatterns.emails);

    const sortedLocations = sortByFrequency(extractedPatterns.locations);
    locationsFound.value = sortedLocations.join('\n');
    updateCountBadge(locationsCount, sortedLocations.length, extractedPatterns.locations);

    const combinedOther = { ...extractedPatterns.phones, ...extractedPatterns.other };
    const sortedOther = sortByFrequency(combinedOther);
    otherPatterns.value = sortedOther.join('\n');
    updateCountBadge(otherCount, sortedOther.length, combinedOther);

    showToast('Patterns extracted!');
  }

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

  // ─────────────────────────────────────────────────────────────
  // REPORT GENERATION
  // ─────────────────────────────────────────────────────────────

  function parseTextareaInput(text) {
    return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  }

  function generateReport() {
    const phone = phoneInput.value.trim();
    const country = countryCode.value;
    const mode = searchMode.value;
    const timestamp = new Date().toLocaleString();

    const names = parseTextareaInput(namesFound.value);
    const usernames = parseTextareaInput(usernamesFound.value);
    const emails = parseTextareaInput(emailsFound.value);
    const locations = parseTextareaInput(locationsFound.value);
    const other = parseTextareaInput(otherPatterns.value);

    const separateByPriority = (items) => {
      const high = items.filter(i => i.startsWith('['));
      const normal = items.filter(i => !i.startsWith('['));
      return { high, normal };
    };

    const emailPriority = separateByPriority(emails);
    const locationPriority = separateByPriority(locations);

    generatedReportText = `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
                    TELESPOT-NUMSINT PATTERN REPORT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Generated: ${timestamp}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
SEARCH PARAMETERS
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Target Number:  ${phone}
Country Code:   +${country}
Search Mode:    ${mode === 'smart' ? `Smart Search (${smartOperator.value})` : 'Individual (10 tabs)'}
Tabs Opened:    ${searchResults.length}
Tabs Scanned:   ${openedTabIds.length || 'N/A'}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
FORMAT VARIATIONS SEARCHED
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${currentFormats.map((f, i) => `  ${String(i + 1).padStart(2, '0')}. ${f.format}`).join('\n')}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
NAMES FOUND (${names.length})
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${names.length > 0 ? names.map(n => `  \u25CF ${n}`).join('\n') : '  (No names found)'}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
USERNAMES FOUND (${usernames.length})
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${usernames.length > 0 ? usernames.map(u => `  \u25CF ${u}`).join('\n') : '  (No usernames found)'}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
EMAILS FOUND (${emails.length})
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${emailPriority.high.length > 0 ? '  HIGH PRIORITY (multi-tab matches):\n' + emailPriority.high.map(e => `    \u2605 ${e}`).join('\n') + '\n' : ''}${emailPriority.normal.length > 0 ? '  Other:\n' + emailPriority.normal.map(e => `    \u25CF ${e}`).join('\n') : ''}${emails.length === 0 ? '  (No emails found)' : ''}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
LOCATIONS FOUND (${locations.length})
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${locationPriority.high.length > 0 ? '  HIGH PRIORITY (multi-tab matches):\n' + locationPriority.high.map(l => `    \u2605 ${l}`).join('\n') + '\n' : ''}${locationPriority.normal.length > 0 ? '  Other:\n' + locationPriority.normal.map(l => `    \u25CF ${l}`).join('\n') : ''}${locations.length === 0 ? '  (No locations found)' : ''}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
OTHER PATTERNS (${other.length})
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${other.length > 0 ? other.map(o => `  \u25CF ${o}`).join('\n') : '  (No other patterns found)'}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
                         END OF REPORT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
`.trim();

    const formatSection = (title, items, emptyMsg) => {
      if (items.length === 0) {
        return `<div class="section-title">${title} (0)</div><div class="no-data">${emptyMsg}</div>`;
      }
      return `<div class="section-title">${title} (${items.length})</div>${items.map(i => {
        const isHighPriority = i.startsWith('[');
        return `<div class="pattern-item ${isHighPriority ? 'high-priority' : ''}">${isHighPriority ? '\u2605' : '\u25CF'} ${escapeHtml(i)}</div>`;
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

    copyReportBtn.classList.remove('hidden');

    showToast('Report generated!');
    debouncedSave();
  }

  function copyReport() {
    if (generatedReportText) {
      copyToClipboard(generatedReportText);
    } else {
      showToast('Generate report first', true);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN SEARCH HANDLER
  // ─────────────────────────────────────────────────────────────

  async function handleSearch() {
    const phone = phoneInput.value.trim();

    if (!phone) {
      phoneInput.focus();
      phoneInput.classList.add('input-error');
      showToast('Enter a phone number', true);
      setTimeout(() => phoneInput.classList.remove('input-error'), 2000);
      return;
    }

    const digits = parsePhoneNumber(phone);

    if (digits.length < 7) {
      phoneInput.classList.add('input-error');
      showToast('Need at least 7 digits', true);
      setTimeout(() => phoneInput.classList.remove('input-error'), 2000);
      return;
    }

    const country = countryCode.value;
    const formats = generateFormats(digits, country);
    currentFormats = formats;

    displayFormats(formats);

    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span class="btn-icon">\u23F3</span> Searching...';

    const mode = searchMode.value;
    if (mode === 'smart') {
      await runSmartSearch(formats);
    } else {
      await runIndividualSearches(formats);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────────────────────────

  function updateSmartOptionsVisibility() {
    if (searchMode.value === 'smart') {
      smartOptions.classList.remove('hidden');
    } else {
      smartOptions.classList.add('hidden');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────────────────────

  searchBtn.addEventListener('click', handleSearch);

  phoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });

  searchMode.addEventListener('change', () => {
    updateSmartOptionsVisibility();
    debouncedSave();
  });

  generateReportBtn.addEventListener('click', generateReport);
  copyReportBtn.addEventListener('click', copyReport);
  scanTabsBtn.addEventListener('click', scanTabs);

  rescanBtn.addEventListener('click', () => {
    rescanBtn.classList.add('hidden');
    scanTabs();
  });

  // Save state when user modifies any input
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
    debouncedSave();
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
    debouncedSave();
  });

  windowMode.addEventListener('change', debouncedSave);
  smartOperator.addEventListener('change', debouncedSave);

  // Save when user edits pattern textareas
  namesFound.addEventListener('input', debouncedSave);
  usernamesFound.addEventListener('input', debouncedSave);
  emailsFound.addEventListener('input', debouncedSave);
  locationsFound.addEventListener('input', debouncedSave);
  otherPatterns.addEventListener('input', debouncedSave);

  // ─────────────────────────────────────────────────────────────
  // INITIALIZE
  // ─────────────────────────────────────────────────────────────

  phoneInput.placeholder = '555-555-1234';
  updateSmartOptionsVisibility();

  // Restore previous session state
  restoreState();
});
