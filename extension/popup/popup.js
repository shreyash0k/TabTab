// TabTab Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('enableToggle');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusDot = statusIndicator.querySelector('.status-dot');
  const statusText = statusIndicator.querySelector('.status-text');

  // Load current state
  chrome.storage.sync.get(['enabled'], (result) => {
    // Default to enabled if not set
    const isEnabled = result.enabled !== false;
    toggle.checked = isEnabled;
    updateStatusDisplay(isEnabled);
  });

  // Handle toggle change
  toggle.addEventListener('change', () => {
    const isEnabled = toggle.checked;
    
    chrome.storage.sync.set({ enabled: isEnabled }, () => {
      updateStatusDisplay(isEnabled);
    });
  });

  function updateStatusDisplay(isEnabled) {
    if (isEnabled) {
      statusIndicator.classList.remove('disabled');
      statusIndicator.classList.add('active');
      statusText.textContent = 'Active';
    } else {
      statusIndicator.classList.remove('active');
      statusIndicator.classList.add('disabled');
      statusText.textContent = 'Disabled';
    }
  }
});
