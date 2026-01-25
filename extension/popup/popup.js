// TabTab Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('enableToggle');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusDot = statusIndicator?.querySelector('.status-dot');
  const statusText = statusIndicator?.querySelector('.status-text');
  
  // App context elements
  const appName = document.getElementById('appName');
  const appIcon = document.getElementById('appIcon');
  const toneValue = document.getElementById('toneValue');
  const editToneBtn = document.getElementById('editToneBtn');
  const toneEditRow = document.getElementById('toneEditRow');
  const toneInput = document.getElementById('toneInput');
  const saveToneBtn = document.getElementById('saveToneBtn');
  const cancelToneBtn = document.getElementById('cancelToneBtn');
  
  // App configuration
  const APP_CONFIG = {
    discord: { name: 'Discord', icon: '🎮', defaultTone: 'Casual, friendly' },
    linkedin: { name: 'LinkedIn', icon: '💼', defaultTone: 'Professional, polished' },
    slack: { name: 'Slack', icon: '💬', defaultTone: 'Casual, collaborative' },
    twitter: { name: 'Twitter/X', icon: '🐦', defaultTone: 'Concise, engaging' },
    none: { name: 'No app detected', icon: '🌐', defaultTone: 'Neutral' }
  };
  
  let currentApp = 'none';
  let customTones = {};

  // Load current state
  chrome.storage.sync.get(['enabled', 'customTones'], (result) => {
    // Default to enabled if not set
    const isEnabled = result.enabled !== false;
    toggle.checked = isEnabled;
    updateStatusDisplay(isEnabled);
    
    // Load custom tones
    customTones = result.customTones || {};
    
    // Detect current app
    detectCurrentApp();
  });

  // Handle toggle change
  toggle.addEventListener('change', () => {
    const isEnabled = toggle.checked;
    
    chrome.storage.sync.set({ enabled: isEnabled }, () => {
      updateStatusDisplay(isEnabled);
    });
  });

  function updateStatusDisplay(isEnabled) {
    if (!statusIndicator) return;
    
    if (isEnabled) {
      statusIndicator.classList.remove('disabled');
      statusIndicator.classList.add('active');
      if (statusText) statusText.textContent = 'Active';
    } else {
      statusIndicator.classList.remove('active');
      statusIndicator.classList.add('disabled');
      if (statusText) statusText.textContent = 'Disabled';
    }
  }
  
  // Detect which app is currently active based on tab URL
  function detectCurrentApp() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const url = tabs[0].url;
        
        if (url.includes('discord.com')) {
          currentApp = 'discord';
        } else if (url.includes('linkedin.com')) {
          currentApp = 'linkedin';
        } else if (url.includes('slack.com')) {
          currentApp = 'slack';
        } else if (url.includes('twitter.com') || url.includes('x.com')) {
          currentApp = 'twitter';
        } else {
          currentApp = 'none';
        }
        
        updateAppDisplay();
      }
    });
  }
  
  // Update the app context display
  function updateAppDisplay() {
    const config = APP_CONFIG[currentApp];
    appName.textContent = config.name;
    appIcon.textContent = config.icon;
    
    // Show custom tone if set, otherwise show default
    const tone = customTones[currentApp] || config.defaultTone;
    toneValue.textContent = tone;
  }
  
  // Edit button click handler
  editToneBtn.addEventListener('click', () => {
    const config = APP_CONFIG[currentApp];
    const currentTone = customTones[currentApp] || config.defaultTone;
    toneInput.value = currentTone;
    toneEditRow.style.display = 'flex';
    editToneBtn.style.display = 'none';
    toneInput.focus();
  });
  
  // Save button click handler
  saveToneBtn.addEventListener('click', () => {
    saveTone();
  });
  
  // Cancel button click handler
  cancelToneBtn.addEventListener('click', () => {
    cancelEdit();
  });
  
  // Handle Enter key in input
  toneInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveTone();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  });
  
  function saveTone() {
    const newTone = toneInput.value.trim();
    if (newTone) {
      customTones[currentApp] = newTone;
      chrome.storage.sync.set({ customTones }, () => {
        toneValue.textContent = newTone;
        cancelEdit();
      });
    } else {
      cancelEdit();
    }
  }
  
  function cancelEdit() {
    toneEditRow.style.display = 'none';
    editToneBtn.style.display = 'inline-flex';
  }
});
