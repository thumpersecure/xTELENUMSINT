/**
 * TELESPOT-NUMSINT - Phone Number Intelligence Search
 * Generates multiple phone number formats and searches Google for OSINT
 */

document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('phoneInput');
  const countryCode = document.getElementById('countryCode');
  const searchBtn = document.getElementById('searchBtn');
  const formatsPreview = document.getElementById('formatsPreview');
  const formatsList = document.getElementById('formatsList');
  const resultsSection = document.getElementById('resultsSection');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const summarySection = document.getElementById('summarySection');
  const summaryContent = document.getElementById('summaryContent');

  let searchResults = [];
  let currentSearchIndex = 0;

  // Parse phone number - extract only digits
  function parsePhoneNumber(input) {
    return input.replace(/\D/g, '');
  }

  // Generate 10 search formats based on the phone number
  // Example: 555-555-1234 with country code 1
  function generateFormats(phoneDigits, country) {
    // Ensure we have at least 10 digits for US format
    // If less, pad or handle gracefully
    let areaCode, exchange, subscriber;

    if (phoneDigits.length >= 10) {
      // Take last 10 digits (ignore country code if included)
      const last10 = phoneDigits.slice(-10);
      areaCode = last10.slice(0, 3);
      exchange = last10.slice(3, 6);
      subscriber = last10.slice(6, 10);
    } else if (phoneDigits.length === 7) {
      // No area code provided
      areaCode = '555'; // Default area code
      exchange = phoneDigits.slice(0, 3);
      subscriber = phoneDigits.slice(3, 7);
    } else {
      // Handle other lengths
      areaCode = phoneDigits.slice(0, 3) || '555';
      exchange = phoneDigits.slice(3, 6) || '555';
      subscriber = phoneDigits.slice(6, 10) || '1234';
    }

    const fullNumber = areaCode + exchange + subscriber;
    const fullWithCountry = country + fullNumber;

    // 10 formats matching the user's image
    return [
      {
        format: `+${fullWithCountry}`,
        description: 'International format (unquoted)'
      },
      {
        format: `"+${fullWithCountry}"`,
        description: 'International format (quoted)'
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
        format: `("${fullNumber}")`,
        description: 'Digits only (parentheses + quoted)'
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
        <span class="format-status pending" id="status-${index}">○</span>
      `;
      formatsList.appendChild(div);
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

  // Perform Google search for a format
  async function performSearch(format, index) {
    updateFormatStatus(index, 'searching');

    const query = encodeURIComponent(format);
    const searchUrl = `https://www.google.com/search?q=${query}`;

    try {
      // Open search in new tab
      const tab = await chrome.tabs.create({
        url: searchUrl,
        active: false
      });

      // Store result info
      searchResults.push({
        index,
        format,
        tabId: tab.id,
        url: searchUrl,
        status: 'opened'
      });

      updateFormatStatus(index, 'complete');
      return { success: true, tabId: tab.id };
    } catch (error) {
      console.error(`Search error for format ${index}:`, error);
      updateFormatStatus(index, 'error');
      return { success: false, error: error.message };
    }
  }

  // Run all searches sequentially with delay
  async function runAllSearches(formats) {
    searchResults = [];
    currentSearchIndex = 0;

    resultsSection.classList.remove('hidden');
    summarySection.classList.add('hidden');

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < formats.length; i++) {
      await performSearch(formats[i].format, i);
      updateProgress(i + 1, formats.length);

      // Small delay between searches to avoid rate limiting
      if (i < formats.length - 1) {
        await delay(500);
      }
    }

    // Show summary
    showSummary(formats);
  }

  // Display search summary
  function showSummary(formats) {
    const successCount = searchResults.filter(r => r.status === 'opened').length;
    const errorCount = formats.length - successCount;

    summaryContent.innerHTML = `
      <div class="summary-stat">
        <span class="stat-label">Total Searches</span>
        <span class="stat-value">${formats.length}</span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Tabs Opened</span>
        <span class="stat-value ${successCount === formats.length ? 'high' : 'medium'}">${successCount}</span>
      </div>
      ${errorCount > 0 ? `
      <div class="summary-stat">
        <span class="stat-label">Errors</span>
        <span class="stat-value low">${errorCount}</span>
      </div>
      ` : ''}
      <div class="summary-stat">
        <span class="stat-label">Status</span>
        <span class="stat-value ${successCount === formats.length ? 'high' : 'medium'}">
          ${successCount === formats.length ? 'Complete' : 'Partial'}
        </span>
      </div>
    `;

    summarySection.classList.remove('hidden');
    searchBtn.disabled = false;
    searchBtn.innerHTML = '<span class="btn-icon">&#128269;</span> Search Again';
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

    displayFormats(formats);

    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span class="btn-icon">⏳</span> Searching...';

    await runAllSearches(formats);
  }

  // Event listeners
  searchBtn.addEventListener('click', handleSearch);

  phoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });

  // Live preview of formats as user types
  phoneInput.addEventListener('input', () => {
    const phone = phoneInput.value.trim();
    const digits = parsePhoneNumber(phone);

    if (digits.length >= 7) {
      const country = countryCode.value;
      const formats = generateFormats(digits, country);
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
      displayFormats(formats);
    }
  });

  // Set example placeholder on load
  phoneInput.placeholder = '555-555-1234';
});
