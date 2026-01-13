/**
 * TELESPOT-NUMSINT - Phone Number Intelligence Search
 * Generates multiple phone number formats and searches Google for OSINT
 */

document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('phoneInput');
  const countryCode = document.getElementById('countryCode');
  const searchMode = document.getElementById('searchMode');
  const smartOperator = document.getElementById('smartOperator');
  const smartOptions = document.getElementById('smartOptions');
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
  const namesFound = document.getElementById('namesFound');
  const usernamesFound = document.getElementById('usernamesFound');
  const locationsFound = document.getElementById('locationsFound');
  const otherPatterns = document.getElementById('otherPatterns');

  let searchResults = [];
  let currentFormats = [];
  let generatedReportText = '';

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

  // Perform Google search
  async function performSearch(query, index = null) {
    if (index !== null) {
      updateFormatStatus(index, 'searching');
    }

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    try {
      const tab = await chrome.tabs.create({
        url: searchUrl,
        active: false
      });

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

    summaryContent.innerHTML = `
      <div class="summary-stat">
        <span class="stat-label">Search Mode</span>
        <span class="stat-value">${modeText}</span>
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
    const locations = parseTextareaInput(locationsFound.value);
    const other = parseTextareaInput(otherPatterns.value);

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

─────────────────────────────────────────────────────────────────
FORMAT VARIATIONS SEARCHED
─────────────────────────────────────────────────────────────────
${currentFormats.map((f, i) => `  ${String(i + 1).padStart(2, '0')}. ${f.format}`).join('\n')}

─────────────────────────────────────────────────────────────────
NAMES FOUND (${names.length})
─────────────────────────────────────────────────────────────────
${names.length > 0 ? names.map(n => `  ● ${n}`).join('\n') : '  (No names recorded)'}

─────────────────────────────────────────────────────────────────
USERNAMES FOUND (${usernames.length})
─────────────────────────────────────────────────────────────────
${usernames.length > 0 ? usernames.map(u => `  ● ${u}`).join('\n') : '  (No usernames recorded)'}

─────────────────────────────────────────────────────────────────
LOCATIONS FOUND (${locations.length})
─────────────────────────────────────────────────────────────────
${locations.length > 0 ? locations.map(l => `  ● ${l}`).join('\n') : '  (No locations recorded)'}

─────────────────────────────────────────────────────────────────
OTHER PATTERNS (${other.length})
─────────────────────────────────────────────────────────────────
${other.length > 0 ? other.map(o => `  ● ${o}`).join('\n') : '  (No other patterns recorded)'}

════════════════════════════════════════════════════════════════
                         END OF REPORT
════════════════════════════════════════════════════════════════
`.trim();

    // Generate HTML display
    const formatSection = (title, items, emptyMsg) => {
      if (items.length === 0) {
        return `<div class="section-title">${title} (0)</div><div class="no-data">${emptyMsg}</div>`;
      }
      return `<div class="section-title">${title} (${items.length})</div>${items.map(i => `<div class="pattern-item">● ${escapeHtml(i)}</div>`).join('')}`;
    };

    reportContent.innerHTML = `
      <div class="generated-report">
        <div class="report-title">TELESPOT-NUMSINT PATTERN REPORT</div>
        <div style="text-align:center;color:#666;font-size:10px;margin-bottom:12px;">${timestamp}</div>

        <div class="section-title">TARGET</div>
        <div class="pattern-item">${escapeHtml(phone)} (+${country})</div>

        ${formatSection('NAMES FOUND', names, 'No names recorded')}
        ${formatSection('USERNAMES FOUND', usernames, 'No usernames recorded')}
        ${formatSection('LOCATIONS FOUND', locations, 'No locations recorded')}
        ${formatSection('OTHER PATTERNS', other, 'No other patterns recorded')}
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
