// script.js – Equb App v8.3 (COMPLETELY FIXED EDITION)

/* ---------------------------------------------------------------------
   Utility & Safe DOM helpers
   --------------------------------------------------------------------- */
function el(id) { 
  return document.getElementById(id) || null; 
}

function setText(id, text) { 
  const e = el(id); 
  if (e) e.textContent = text; 
}

function setHTML(id, html) { 
  const e = el(id); 
  if (e) e.innerHTML = html; 
}

function setValue(id, val) { 
  const e = el(id); 
  if (e) e.value = val; 
}

function show(id) { 
  const e = el(id); 
  if (e) e.style.display = ''; 
}

function hide(id) { 
  const e = el(id); 
  if (e) e.style.display = 'none'; 
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[s]);
}

function toDateOnlyString(date) { 
  return new Date(date).toISOString().slice(0, 10); 
}

function generateId() { 
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); 
}

function formatCurrency(amount) {
  return parseFloat(amount || 0).toLocaleString('en-ET', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* ---------------------------------------------------------------------
   State Management
   --------------------------------------------------------------------- */
let state = loadState();
let authMode = 'login';
let draggedItem = null;
let confirmationCallback = null;

function getDefaultState() {
  return { 
    _version: 8, 
    user: null, 
    equbs: [], 
    currentEqubId: null, 
    history: [], 
    activity: [], 
    templates: [] 
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem('equbState');
    if (!raw) return getDefaultState();
    
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return getDefaultState();

    // Migration from older versions
    const migrated = migrateState(parsed);
    
    const { user, ...safe } = migrated;
    return {
      ...getDefaultState(),
      ...safe,
      equbs: (safe.equbs || []).map(e => ({
        id: e.id || generateId(),
        code: e.code || generateUniqueCode(),
        name: e.name || 'Unnamed Equb',
        frequency: e.frequency || 'monthly',
        creatorId: e.creatorId,
        admins: e.admins || [],
        members: e.members || [],
        goalAmount: parseFloat(e.goalAmount) || 0,
        contributionAmount: parseFloat(e.contributionAmount) || 0,
        targetMembers: parseInt(e.targetMembers) || 0,
        startDate: e.startDate || new Date().toISOString().slice(0, 10),
        status: e.status || 'forming',
        contributions: e.contributions || [],
        payoutOrder: e.payoutOrder || [],
        payoutHistory: e.payoutHistory || [],
        currentPayoutIndex: parseInt(e.currentPayoutIndex) || 0,
        progress: parseFloat(e.progress) || 0,
        activity: e.activity || [],
        celebrated: Boolean(e.celebrated)
      })),
      history: safe.history || [],
      activity: safe.activity || [],
      templates: safe.templates || []
    };
  } catch (err) {
    console.error('Load failed:', err);
    return getDefaultState();
  }
}

function migrateState(parsed) {
  // Add migration logic for future versions
  if (!parsed._version || parsed._version < 8) {
    // Migrate from version 7 to 8
    parsed.equbs = (parsed.equbs || []).map(equb => ({
      ...equb,
      payoutOrder: equb.payoutOrder || (equb.members || []).map(m => ({ ...m }))
    }));
  }
  return parsed;
}

function backupState() {
  try {
    localStorage.setItem('equbStateBackup', JSON.stringify(state));
  } catch (err) {
    console.warn('Backup failed:', err);
  }
}

function saveState() {
  try {
    // Clean up data before saving
    const cleanState = {
      ...state,
      _lastSaved: new Date().toISOString()
    };
    localStorage.setItem('equbState', JSON.stringify(cleanState));
    backupState();
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Failed to save data. Storage might be full.', 'error');
  }
}

/* ---------------------------------------------------------------------
   Authentication & Security
   --------------------------------------------------------------------- */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function validateLogin(email, password) {
  const users = JSON.parse(localStorage.getItem('equbUsers') || '[]');
  const user = users.find(u => u.email === email);
  if (!user) return null;
  const inputHash = simpleHash(password + user.salt);
  return inputHash === user.passwordHash ? user : null;
}

function registerUser(name, email, password) {
  const users = JSON.parse(localStorage.getItem('equbUsers') || '[]');
  if (users.some(u => u.email === email)) {
    return { success: false, message: getText('emailExists') };
  }
  
  // Validate password strength
  if (password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters' };
  }

  const salt = Date.now().toString(36) + Math.random().toString(36);
  const passwordHash = simpleHash(password + salt);
  const newUser = {
    id: generateId(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    language: 'en',
    profilePic: null,
    theme: 'light'
  };
  
  users.push(newUser);
  localStorage.setItem('equbUsers', JSON.stringify(users));
  return { success: true, user: newUser };
}

/* ---------------------------------------------------------------------
   Toasts & Notifications
   --------------------------------------------------------------------- */
function showToast(message, type = 'success') {
  const container = el('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="emoji">${type === 'success' ? '✔' : '⚠'}</span>&nbsp;<span>${escapeHtml(String(message))}</span>`;
  
  container.appendChild(toast);
  
  // Auto-remove after delay
  setTimeout(() => {
    try { 
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
      }
    } catch (e) {}
  }, 3000);
}

function alert(message) { 
  showToast(message, 'error'); 
}

function success(message) { 
  showToast(message, 'success'); 
}

/* ---------------------------------------------------------------------
   Confirmation Dialog System
   --------------------------------------------------------------------- */
function showConfirmation(action, data = null) {
  const dialog = el('confirmation-dialog');
  const title = el('confirmation-title');
  const message = el('confirmation-message');
  const yesBtn = el('confirmation-yes');
  const noBtn = el('confirmation-no');
  
  if (!dialog || !title || !message || !yesBtn || !noBtn) return;
  
  // Set confirmation content based on action
  switch(action) {
    case 'logout':
      title.textContent = getText('confirm');
      message.textContent = getText('logoutConfirm');
      break;
    case 'deleteEqub':
      title.textContent = getText('confirm');
      message.textContent = getText('deleteConfirm');
      break;
    case 'removeMember':
      title.textContent = getText('confirm');
      message.textContent = getText('removeMemberConfirm');
      break;
    default:
      title.textContent = getText('confirm');
      message.textContent = getText('confirmAction');
  }
  
  // Set up confirmation callback
  confirmationCallback = (confirmed) => {
    if (confirmed) {
      switch(action) {
        case 'logout':
          performLogout();
          break;
        case 'deleteEqub':
          performDeleteEqub(data);
          break;
        case 'removeMember':
          performRemoveMember(data);
          break;
      }
    }
    hideConfirmation();
  };
  
  // Show dialog
  dialog.classList.remove('hidden');
  
  // Set up button handlers
  yesBtn.onclick = () => confirmationCallback(true);
  noBtn.onclick = () => confirmationCallback(false);
}

function hideConfirmation() {
  const dialog = el('confirmation-dialog');
  if (dialog) {
    dialog.classList.add('hidden');
  }
  confirmationCallback = null;
}

function performLogout() {
  state.user = null;
  saveState();
  success(getText('loggedOut'));
  showPage('welcome');
}

function performDeleteEqub(equbId) {
  const equb = state.equbs.find(e => e.id === equbId);
  if (!equb) return;
  
  state.equbs = state.equbs.filter(e => e.id !== equbId);
  if (state.currentEqubId === equbId) state.currentEqubId = null;
  
  pushActivity(`Deleted "${equb.name}"`);
  saveState();
  success(getText('equbDeleted'));
  updateMyEqubs();
}

function performRemoveMember(memberId) {
  const equb = getCurrentEqub();
  if (!equb) return;
  
  const member = equb.members.find(m => m.id === memberId);
  if (!member) return;
  
  const isSelf = memberId === state.user.id;
  
  // Remove member and their contributions
  equb.members = equb.members.filter(m => m.id !== memberId);
  equb.contributions = (equb.contributions || []).filter(c => c.userId !== memberId);
  
  pushActivity(`Removed ${member.name}`, equb.id);
  
  if (isSelf) {
    // Handle self-removal (creator leaving)
    if (equb.members.length > 0) {
      equb.creatorId = equb.members[0].id;
      pushActivity(getText('transferredOwnership', equb.members[0].name), equb.id);
      success(getText('ownershipTransferred'));
      state.currentEqubId = null;
    } else {
      // Delete equb if no members left
      state.equbs = state.equbs.filter(e => e.id !== equb.id);
      success(getText('equbDeleted'));
      saveState();
      showPage('myequbs');
      return;
    }
  } else {
    success(getText('memberRemoved'));
  }
  
  saveState();
  updateMembers();
  updateHome();
}

/* ---------------------------------------------------------------------
   Profile Management
   --------------------------------------------------------------------- */
function uploadProfilePic(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  
  // Validate file type and size
  if (!file.type.startsWith('image/')) {
    return alert('Please select an image file');
  }
  
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    return alert('Image must be less than 5MB');
  }

  const reader = new FileReader();
  reader.onload = e => {
    const img = el('profile-pic');
    if (img) { 
      img.src = e.target.result; 
      img.style.display = 'block'; 
    }
    
    const placeholder = el('profile-pic-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    
    if (state.user) {
      state.user.profilePic = e.target.result;
      saveState();
      success(getText('uploadPhoto') + ' updated!');
      updateProfile();
    }
  };
  
  reader.onerror = () => alert('Failed to read image file');
  reader.readAsDataURL(file);
}

/* ---------------------------------------------------------------------
   Translations (EN + AM)
   --------------------------------------------------------------------- */
function getText(key, ...args) {
  const lang = state.user?.language || document.body.getAttribute('data-lang') || 'en';

  const translations = {
    welcomeTitle: { en: "Equb", am: "እቁብ" },
    welcomeSub: { en: "Community Savings, Together.", am: "አብረን እንቆጥብ፣ አብረን እንዘምት!" },
    getStarted: { en: "Get Started", am: "ጀምር" },
    myEqubs: { en: "My Equbs", am: "የእኔ እቁቦች" },
    home: { en: "Home", am: "ዋና" },
    members: { en: "Members", am: "አባላት" },
    activity: { en: "Activity", am: "እንቅስቃሴ" },
    profile: { en: "Profile", am: "መለያ" },
    logout: { en: "Logout", am: "ውጣ" },
    logoutConfirm: { en: "Are you sure you want to logout?", am: "እርግጠኛ ነህ መውጣት ትፈልጋለህ?" },
    confirm: { en: "Confirm", am: "አረጋግጥ" },
    confirmAction: { en: "Are you sure you want to proceed?", am: "እርግጠኛ ነህ መቀጠል ትፈልጋለህ?" },

    selectEqub: { en: "Select an Equb", am: "እቁብ ምረጥ" },
    goal: { en: "Goal:", am: "ግብ፡" },
    ETB: { en: "ETB", am: "ብር" },
    ETBEach: { en: "ETB each", am: "ብር እያንዳንዳቸው" },
    contribution: { en: "Contribution:", am: "አስተዋጽኦ፡" },
    progress: { en: "{0}% of goal reached", am: "{0}% ተጠናቀቀ" },
    status: { en: "Status: {0}", am: "ሁኔታ፡ {0}" },
    round: { en: "Round:", am: "ዙር፡" },
    of: { en: "of", am: "ከ" },
    todayPayments: { en: "Today's Payments", am: "የዛሬ ክፍያዎች" },
    paid: { en: "Paid", am: "ተከፍሏል" },
    notPaid: { en: "Not Paid", am: "አልተከፈለም" },
    completeProgress: { en: "Complete 100% progress to enable payments", am: "ክፍያዎችን ለማንቃት 100% ያጠናቅቁ" },

    noEqubs: { en: "No Equbs yet — create or join one", am: "እቁብ የለም — ፍጠር ወይም ተቀላቀል" },
    createEqub: { en: "Create Equb", am: "እቁብ ፍጠር" },
    joinEqub: { en: "Join Equb", am: "እቁብ ተቀላቀል" },
    newEqub: { en: "New Equb", am: "አዲስ እቁብ" },

    noMembers: { en: "No members yet", am: "አባላት የሉም" },
    invite: { en: "Invite", am: "ጋብዝ" },

    noActivity: { en: "No activity yet", am: "እንቅስቃሴ የለም" },

    login: { en: "Login", am: "ግባ" },
    signup: { en: "Signup", am: "ተመዝገብ" },
    nameSignup: { en: "Name (Signup only)", am: "ስም (ለመመዝገብ ብቻ)" },
    emailPhone: { en: "Email or Phone", am: "ኢሜይል ወይም ስልክ" },
    password: { en: "Password", am: "የይለፍ ቃል" },
    confirmPassword: { en: "Confirm Password", am: "ደግሞ ተመዝገብ" },
    submit: { en: "Submit", am: "አስገባ" },
    switchTo: { en: "Switch to {0}", am: "ወደ {0} ቀይር" },
    emailExists: { en: "Email already registered", am: "ኢሜይል ተመዝግቧል" },
    passwordsNotMatch: { en: "Passwords do not match", am: "የይለፍ ቃላት አይዛመዱም" },

    memberSince: { en: "Member since {0}", am: "አባል ከ {0}" },
    uploadPhoto: { en: "Upload Photo", am: "ፎቶ ስቀል" },
    language: { en: "Language", am: "ቋንቋ" },
    history: { en: "History", am: "ታሪክ" },
    noHistory: { en: "No history yet", am: "ታሪክ የለም" },

    createTitle: { en: "Create Equb", am: "እቁብ ፍጠር" },
    editEqub: { en: "Edit Equb", am: "እቁብ አስተካክል" },
    frequency: { en: "Frequency", am: "ድግግሞሽ" },
    daily: { en: "Daily", am: "በየቀኑ" },
    weekly: { en: "Weekly", am: "በሳምንት" },
    monthly: { en: "Monthly", am: "በወር" },
    yearly: { en: "Yearly", am: "በዓመት" },
    targetMembers: { en: "Target Members", am: "የአባላት ቁጥር" },
    goalAmount: { en: "Goal Amount (ETB)", am: "የግብ መጠን (ብር)" },
    contributionAmount: { en: "Contribution (ETB)", am: "አስተዋጽኦ (ብር)" },
    startDate: { en: "Start Date", am: "መጀመሪያ ቀን" },
    create: { en: "Create", am: "ፍጠር" },
    save: { en: "Save", am: "አስቀምጥ" },
    cancel: { en: "Cancel", am: "ሰርዝ" },
    autoCalculation: { en: "Contribution will be auto-calculated as: Goal Amount ÷ Target Members", am: "አስተዋጽኦ እንደሚከተለው በራስ-ሰር ይሰላል: የግብ መጠን ÷ የአባላት ቁጥር" },

    joinTitle: { en: "Join Equb", am: "እቁብ ተቀላቀል" },
    joinCode: { en: "Enter Code (EQ-XXXX-2025)", am: "ኮድ አስገባ (EQ-XXXX-2025)" },
    join: { en: "Join", am: "ተቀላቀል" },

    inviteTitle: { en: "Invite to Equb", am: "ወደ እቁብ ጋብዝ" },
    shareCode: { en: "Share this code:", am: "ይህን ኮድ አጋራ፡" },
    copy: { en: "Copy", am: "ቅዳ" },
    close: { en: "Close", am: "ዝጋ" },

    contribute: { en: "Contribute", am: "አስተዋጽኦ አድርግ" },
    selectMember: { en: "Select Member", am: "አባል ምረጥ" },
    amount: { en: "Amount (ETB)", am: "መጠን (ብር)" },
    required: { en: "Required:", am: "የሚፈለገው፡" },
    missedDays: { en: "missed days", am: "የተባለሉ ቀናት" },
    pay: { en: "Pay", am: "ክፈል" },

    exportEqub: { en: "Export Current Equb", am: "አሁን ያለውን እቁብ ላክ" },
    importEqub: { en: "Import Equb", am: "እቁብ አስገባ" },

    forming: { en: "Forming", am: "በመፈጠር ላይ" },
    active: { en: "Active", am: "ንቁ" },
    completed: { en: "Completed", am: "ተጠናቀቀ" },

    invalidCode: { en: "Invalid code", am: "የተሳሳተ ኮድ" },
    equbFull: { en: "Equb is full", am: "እቁብ ሞልቷል" },
    alreadyJoined: { en: "You already joined", am: "ቀድሞ ተቀላቀለሃል" },
    onlyCreator: { en: "Only creator can do this", am: "ፈጣሪው ብቻ ይችላል" },
    mustPayExact: { en: "Must pay exactly {0} ETB", am: "በትክክል {0} ብር መክፈል አለብህ" },

    equbCreated: { en: "Equb created!", am: "እቁብ ተፈጠረ!" },
    joinedEqub: { en: "Joined Equb!", am: "ተቀላቀልክ!" },
    memberAdded: { en: "Member added!", am: "አባል ታክሏል!" },
    memberEdited: { en: "Member edited!", am: "አባል ተስተካክሏል!" },
    paidSuccess: { en: "Paid!", am: "ተከፍሏል!" },
    goalReached: { en: "Goal reached! 100%", am: "ግቡ ተደረሰ! 100%" },

    addMember: { en: "Add Member", am: "አባል ጨምር" },
    editMember: { en: "Edit Member", am: "አባል አስተካክል" },
    memberName: { en: "Member Name", am: "የአባል ስም" },
    phone: { en: "Phone Number", am: "ስልክ ቁጥር" },
    add: { en: "Add", am: "ጨምር" },
    removeMember: { en: "Remove", am: "አስወግድ" },
    removeMemberConfirm: { en: "Are you sure you want to remove this member?", am: "ይህን አባል ለማስወገድ እርግጠኛ ነዎት?" },
    templateSaved: { en: "Template saved!", am: "አብነት ተቀመጠ!" },
    darkMode: { en: "Dark Mode", am: "ጨለማ ሁነታ" },
    exportPDF: { en: "Export to PDF", am: "ወደ PDF ላክ" },
    today: { en: "Today", am: "ዛሬ" },
    yesterday: { en: "Yesterday", am: "ትናንት" },
    thisWeek: { en: "This Week", am: "በዚህ ሳምንት" },
    missedDaysCount: { en: "Missed {0} days ({1} ETB)", am: "{0} ቀናት ተዘለለ ({1} ብር)" },
    youAreCreator: { en: "You are the creator", am: "አንተ ፈጣሪው ነህ" },
    youAreMember: { en: "You are a member", am: "አንተ አባል ነህ" },
    edit: { en: "Edit", am: "አስተካክል" },
    delete: { en: "Delete", am: "ሰርዝ" },
    deleteConfirm: { en: "Delete this Equb?", am: "ይህን እቁብ ሰርዝ?" },
    view: { en: "View", am: "ተመልከት" },
    owner: { en: "(Owner)", am: "(ፈጣሪ)" },
    transferredOwnership: { en: "Transferred ownership to {0}", am: "ባለቤትነት ወደ {0} ተላለፈ" },
    memberRemoved: { en: "Member removed!", am: "አባል ተወግዷል!" },
    equbDeleted: { en: "Equb deleted!", am: "እቁብ ተሰርዟል!" },
    ownershipTransferred: { en: "Ownership transferred!", am: "ባለቤትነት ተላልፏል!" },
    loggedOut: { en: "Logged out", am: "ተወጣ" },
    payout: { en: "Payout", am: "ይክፈሉ" },
    selectRecipient: { en: "Select Recipient", am: "ተቀባይ ይምረጡ" },
    payoutSuccess: { en: "Payout done!", am: "ክፍያ ተጠናቀቀ!" },
    editPayoutOrder: { en: "Edit Payout Order", am: "የክፍያ ቅደም ተከተል ያርትዑ" },
    dragReorder: { en: "Drag items or use buttons to reorder", am: "ንጥሎችን ይጎትቱ ወይም ለማስተካከል ቁልፎችን ይጠቀሙ" },
    up: { en: "Up", am: "ወደ ላይ" },
    down: { en: "Down", am: "ወደ ታች" },
    explore: { en: "Explore", am: "ያስሱ" },
    settings: { en: "Settings", am: "ቅንብሮች" }
  };

  const text = translations[key]?.[lang] || key;
  return text.replace(/\{(\d+)\}/g, (_, i) => args[i] ?? '');
}

/* ---------------------------------------------------------------------
   Language & Theme Management
   --------------------------------------------------------------------- */
function setLanguage(lang) {
  if (state.user) {
    state.user.language = lang;
  }
  document.body.setAttribute('data-lang', lang);
  saveState();
  syncLanguageSelectors(lang);
  updateAllUI();
}

// FIXED: Language selector sync function
function syncLanguageSelectors(lang) {
  const selectors = ['welcome-language-select', 'auth-language-select', 'profile-language-select'];
  selectors.forEach(id => {
    const selector = el(id);
    if (selector) {
      selector.value = lang;
    }
  });
}

function toggleDarkMode(enabled) {
  if (!state.user) return;
  state.user.theme = enabled ? 'dark' : 'light';
  document.body.setAttribute('data-theme', state.user.theme);
  saveState();
}

/* ---------------------------------------------------------------------
   Navigation & UI Management
   --------------------------------------------------------------------- */
let currentPage = 'welcome';

function showPage(page) {
  currentPage = page;
  
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  
  // Show target page
  const pageEl = el(page + '-page');
  if (pageEl) pageEl.style.display = 'block';
  
  // Show/hide nav based on auth
  const nav = el('nav-bar');
  if (nav) nav.style.display = state.user ? 'flex' : 'none';
  
  updateNavActive(page);

  // Page-specific initialization
  switch(page) {
    case 'home':
      if (!getCurrentEqub()) showPage('myequbs');
      else updateHome();
      break;
    case 'myequbs':
      updateMyEqubs();
      break;
    case 'members':
      updateMembers();
      break;
    case 'activity':
      updateActivity();
      break;
    case 'profile':
      updateProfile();
      break;
  }
}

function updateNavActive(page) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
}

/* ---------------------------------------------------------------------
   Modal Management
   --------------------------------------------------------------------- */
function showModal(id) {
  const modal = el(id + '-modal');
  if (!modal) return;
  
  modal.classList.add('active');
  
  // Modal-specific initialization
  switch(id) {
    case 'contribute':
      populateContributionMembers();
      break;
    case 'invite':
      showInviteCode();
      break;
    case 'payout':
      populatePayoutRecipients();
      break;
    case 'edit-payout-order':
      populatePayoutOrderList();
      break;
  }
  
  // Focus first input
  const input = modal.querySelector('input, select, textarea, button');
  if (input) input.focus();
}

function closeModal(id) {
  const modal = el(id + '-modal');
  if (modal) modal.classList.remove('active');
}

// Close modals on escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    hideConfirmation();
  }
});

// Close modals on background click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

/* ---------------------------------------------------------------------
   Equb Management
   --------------------------------------------------------------------- */
function generateUniqueCode() {
  let code;
  do {
    code = `EQ-${Math.random().toString(36).slice(2,6).toUpperCase()}-${new Date().getFullYear()}`;
  } while (state.equbs.some(e => e.code === code));
  return code;
}

// FIXED: AUTO-CALCULATE CONTRIBUTION
function calculateContribution() {
  const goalEl = el('create-goal-amount');
  const targetEl = el('create-target-members');
  const contribEl = el('create-contribution-amount');
  
  if (!goalEl || !targetEl || !contribEl) return;
  
  const goal = parseFloat(goalEl.value) || 0;
  const target = parseInt(targetEl.value) || 0;
  
  if (goal > 0 && target >= 2) {
    const calculated = (goal / target).toFixed(2);
    contribEl.value = calculated;
  }
}

function createEqub() {
  if (!state.user) return alert(getText('login') + ' required');
  
  const name = el('create-equb-name')?.value?.trim();
  const frequency = el('create-equb-frequency')?.value;
  const target = parseInt(el('create-target-members')?.value);
  const goal = parseFloat(el('create-goal-amount')?.value);
  const contribution = parseFloat(el('create-contribution-amount')?.value);
  const startDate = el('create-start-date')?.value;

  // Validation
  if (!name) return alert('Equb name is required');
  if (!frequency) return alert('Frequency is required');
  if (isNaN(target) || target < 2) return alert('Target members must be at least 2');
  if (isNaN(goal) || goal <= 0) return alert('Goal amount must be positive');
  if (isNaN(contribution) || contribution <= 0) return alert('Contribution amount must be positive');
  if (!startDate) return alert('Start date is required');
  
  // FIX: Ensure start date is not in the past
  const selectedStartDate = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (selectedStartDate < today) {
    return alert('Start date cannot be in the past');
  }

  const id = generateId();
  const code = generateUniqueCode();
  const newEqub = {
    id, code, name, frequency, creatorId: state.user.id,
    admins: [{ id: state.user.id, name: state.user.name }],
    members: [{ 
      id: state.user.id, 
      name: state.user.name, 
      joinedAt: new Date().toISOString() 
    }],
    goalAmount: goal, 
    contributionAmount: contribution, 
    targetMembers: target,
    startDate, 
    status: 'forming', 
    contributions: [], 
    payoutOrder: [], 
    payoutHistory: [],
    currentPayoutIndex: 0, 
    progress: 0, 
    activity: [], 
    celebrated: false
  };

  state.equbs = state.equbs || [];
  state.equbs.push(newEqub);
  state.currentEqubId = id;
  
  pushActivity(`${getText('createTitle')} "${name}"`, id);
  saveState();
  closeModal('create-equb');
  success(getText('equbCreated'));
  showPage('home');
}

function openEditEqub(equbId) {
  const equb = state.equbs.find(e => e.id === equbId);
  if (!equb || equb.creatorId !== state.user.id) return alert(getText('onlyCreator'));
  
  setValue('edit-equb-name', equb.name);
  setValue('edit-equb-frequency', equb.frequency);
  setValue('edit-target-members', equb.targetMembers);
  setValue('edit-goal-amount', equb.goalAmount);
  setValue('edit-contribution-amount', equb.contributionAmount);
  setValue('edit-start-date', equb.startDate);
  
  state.editingEqubId = equbId;
  showModal('edit-equb');
}

function saveEditEqub() {
  const equb = state.equbs.find(e => e.id === state.editingEqubId);
  if (!equb || equb.creatorId !== state.user.id) return;
  
  const name = el('edit-equb-name')?.value?.trim();
  const frequency = el('edit-equb-frequency')?.value;
  const target = parseInt(el('edit-target-members')?.value);
  const goal = parseFloat(el('edit-goal-amount')?.value);
  const contribution = parseFloat(el('edit-contribution-amount')?.value);
  const startDate = el('edit-start-date')?.value;

  // Validation
  if (!name) return alert('Equb name is required');
  if (!frequency) return alert('Frequency is required');
  if (isNaN(target) || target < 2) return alert('Target members must be at least 2');
  if (isNaN(goal) || goal <= 0) return alert('Goal amount must be positive');
  if (isNaN(contribution) || contribution <= 0) return alert('Contribution amount must be positive');
  if (!startDate) return alert('Start date is required');

  equb.name = name;
  equb.frequency = frequency;
  equb.targetMembers = target;
  equb.goalAmount = goal;
  equb.contributionAmount = contribution;
  equb.startDate = startDate;

  pushActivity(`Edited "${name}"`, equb.id);
  saveState();
  closeModal('edit-equb');
  success(getText('editEqub') + ' updated!');
  updateMyEqubs();
  if (state.currentEqubId === equb.id) updateHome();
}

function deleteEqub(equbId) {
  showConfirmation('deleteEqub', equbId);
}

function joinEqub() {
  if (!state.user) return alert(getText('login') + ' required');
  
  const code = el('equb-code')?.value?.trim().toUpperCase();
  const equb = state.equbs.find(e => e.code === code);
  
  if (!equb) return alert(getText('invalidCode'));
  if (equb.status === 'completed') return alert(getText('completed'));
  if (equb.members.length >= equb.targetMembers) return alert(getText('equbFull'));
  if (equb.members.some(m => m.id === state.user.id)) return alert(getText('alreadyJoined'));

  equb.members.push({ 
    id: state.user.id, 
    name: state.user.name, 
    joinedAt: new Date().toISOString() 
  });
  
  // Auto-activate if full
  if (equb.members.length === equb.targetMembers && equb.status === 'forming') {
    equb.status = 'active';
    equb.payoutOrder = shuffleArray(equb.members.map(m => ({ ...m })));
  }
  
  pushActivity(`${state.user.name} joined`, equb.id);
  saveState();
  closeModal('join-equb');
  success(getText('joinedEqub'));
  showPage('home');
}

function shuffleArray(arr) {
  const a = Array.isArray(arr) ? [...arr] : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------------------------------------------------------------
   Member Management - FIXED
   --------------------------------------------------------------------- */
function addMember() {
  const nameInput = el('add-member-name');
  const name = nameInput?.value?.trim();
  const phone = el('add-member-phone')?.value?.trim();
  
  if (!name) return alert('Member name is required');
  if (!phone) return alert('Phone number is required');
  
  const equb = getCurrentEqub();
  if (!equb || equb.creatorId !== state.user.id) return alert(getText('onlyCreator'));
  
  // FIXED: Enhanced validation
  if (equb.status === 'completed') return alert(getText('completed'));
  if (equb.members.length >= equb.targetMembers) return alert(getText('equbFull'));
  if (equb.members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    return alert('Member with this name already exists');
  }
  if (equb.members.some(m => m.phone === phone)) {
    return alert('Member with this phone number already exists');
  }

  const newMember = { 
    id: generateId(), 
    name, 
    phone, 
    joinedAt: new Date().toISOString() 
  };
  
  equb.members.push(newMember);
  
  // FIXED: Enhanced auto-activation logic
  if (equb.members.length === equb.targetMembers && equb.status === 'forming') {
    equb.status = 'active';
    
    // Initialize payout order if not set
    if (!equb.payoutOrder || equb.payoutOrder.length === 0) {
      equb.payoutOrder = shuffleArray(equb.members.map(m => ({ ...m })));
    }
    
    pushActivity(`Equb "${equb.name}" is now active! All ${equb.targetMembers} members have joined.`, equb.id);
    success(`Equb is now active with ${equb.targetMembers} members! Start making contributions.`);
  } else if (equb.members.length < equb.targetMembers && equb.status === 'forming') {
    // Still forming - show remaining members needed
    const remaining = equb.targetMembers - equb.members.length;
    success(`Member added! ${remaining} more members needed to activate equb.`);
  }
  
  pushActivity(`${name} added by ${state.user.name}`, equb.id);
  saveState();
  closeModal('add-member');
  
  // Clear form
  if (nameInput) nameInput.value = '';
  if (el('add-member-phone')) el('add-member-phone').value = '';
  
  success(getText('memberAdded'));
  updateMembers();
  updateHome();
}

function openEditMember(memberId) {
  const equb = getCurrentEqub();
  if (!equb || equb.creatorId !== state.user.id) return alert(getText('onlyCreator'));
  
  const member = equb.members.find(m => m.id === memberId);
  if (!member) return;
  
  setValue('edit-member-name', member.name);
  setValue('edit-member-phone', member.phone || '');
  
  state.editingMemberId = memberId;
  showModal('edit-member');
}

function saveEditMember() {
  const equb = getCurrentEqub();
  if (!equb || equb.creatorId !== state.user.id) return;
  
  const name = el('edit-member-name')?.value?.trim();
  const phone = el('edit-member-phone')?.value?.trim();
  
  if (!name) return alert('Member name is required');
  if (!phone) return alert('Phone number is required');
  
  const member = equb.members.find(m => m.id === state.editingMemberId);
  if (!member) return;
  
  const oldName = member.name;
  member.name = name;
  member.phone = phone;
  
  pushActivity(`Edited ${oldName} to ${name}`, equb.id);
  saveState();
  closeModal('edit-member');
  success(getText('memberEdited'));
  updateMembers();
}

function removeMember(memberId) {
  showConfirmation('removeMember', memberId);
}

/* ---------------------------------------------------------------------
   Contribution Management - FIXED PAYMENT SYSTEM
   --------------------------------------------------------------------- */
function populateContributionMembers() {
  const select = el('contribution-member');
  if (!select) return;
  
  select.innerHTML = '<option value="">' + getText('selectMember') + '</option>';
  
  const equb = getCurrentEqub();
  if (!equb) return;
  
  (equb.members || []).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = escapeHtml(m.name);
    
    // Show payment status in dropdown
    const missed = computeMemberMissedCycles(equb, m);
    if (missed > 0) {
      opt.textContent += ` (${missed} missed - ${formatCurrency(missed * equb.contributionAmount)} ETB)`;
    }
    
    select.appendChild(opt);
  });
  
  // Auto-select current user if they're a member
  if (state.user) {
    const userMember = equb.members.find(m => m.id === state.user.id);
    if (userMember) select.value = state.user.id;
  }
  
  updateRequiredAmount();
}

function updateRequiredAmount() {
  const sel = el('contribution-member');
  const memberId = sel?.value;
  const equb = getCurrentEqub();
  
  if (!equb || !memberId) {
    if (el('required-amount-display')) el('required-amount-display').style.display = 'none';
    return;
  }
  
  const member = equb.members.find(m => m.id === memberId);
  const missed = computeMemberMissedCycles(equb, member);
  const totalRequired = equb.contributionAmount + missed * equb.contributionAmount;
  
  if (el('required-amount')) el('required-amount').textContent = formatCurrency(totalRequired);
  if (el('missed-count')) el('missed-count').textContent = missed;
  if (el('required-amount-display')) el('required-amount-display').style.display = 'block';
  
  // Auto-fill amount field with required amount
  if (el('contribute-amount')) {
    el('contribute-amount').value = totalRequired.toFixed(2);
    el('contribute-amount').placeholder = `Required: ${formatCurrency(totalRequired)} ETB`;
  }
}

function contribute() {
  const memberId = el('contribution-member')?.value;
  const amount = parseFloat(el('contribute-amount')?.value);
  const equb = getCurrentEqub();
  
  if (!equb || !memberId || isNaN(amount) || amount <= 0) {
    return alert('Please select a member and enter a valid amount');
  }
  
  const member = equb.members.find(m => m.id === memberId);
  if (!member) return alert('Member not found');
  
  const missed = computeMemberMissedCycles(equb, member);
  const required = equb.contributionAmount + missed * equb.contributionAmount;
  
  // Allow admin to accept any amount, but warn if less than required
  if (amount < required) {
    const confirmMsg = `You are paying ${formatCurrency(amount)} ETB, but ${member.name} owes ${formatCurrency(required)} ETB. Continue anyway?`;
    if (!confirm(confirmMsg)) return;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // FIXED: Check if already paid in current cycle for all frequencies
  const payoutHistory = equb.payoutHistory || [];
  const totalMembers = equb.targetMembers || 1;
  const currentCycle = Math.floor(payoutHistory.length / totalMembers);
  
  // Get contributions for current cycle only
  const currentCycleContributions = (equb.contributions || []).filter(c => {
    if (c.cycleUsed !== undefined) {
      return c.cycleUsed === currentCycle;
    }
    // For contributions without cycle tracking, only include if they are after the last payout
    if (payoutHistory.length > 0) {
      const lastPayoutDate = new Date(payoutHistory[payoutHistory.length - 1].date);
      const contributionDate = new Date(c.date);
      return contributionDate > lastPayoutDate;
    }
    // No payouts yet, include all contributions
    return true;
  });

  // Check for duplicate payments in current cycle based on frequency
  let alreadyPaid = false;
  
  switch (equb.frequency) {
    case 'daily':
      // For daily, check if paid today
      alreadyPaid = currentCycleContributions.some(c => 
        c.userId === memberId && toDateOnlyString(c.date) === toDateOnlyString(today)
      );
      break;
      
    case 'weekly':
      // For weekly, check if paid this week (same week number)
      const thisWeek = getWeekNumber(today);
      alreadyPaid = currentCycleContributions.some(c => {
        if (c.userId !== memberId) return false;
        const contributionDate = new Date(c.date);
        const contributionWeek = getWeekNumber(contributionDate);
        return contributionWeek === thisWeek;
      });
      break;
      
    case 'monthly':
      // For monthly, check if paid this month
      const thisMonth = today.getMonth();
      const thisYear = today.getFullYear();
      alreadyPaid = currentCycleContributions.some(c => {
        if (c.userId !== memberId) return false;
        const contributionDate = new Date(c.date);
        return contributionDate.getMonth() === thisMonth && 
               contributionDate.getFullYear() === thisYear;
      });
      break;
      
    case 'yearly':
      // For yearly, check if paid this year
      const thisYearOnly = today.getFullYear();
      alreadyPaid = currentCycleContributions.some(c => {
        if (c.userId !== memberId) return false;
        const contributionDate = new Date(c.date);
        return contributionDate.getFullYear() === thisYearOnly;
      });
      break;
  }
  
  if (alreadyPaid) {
    const frequencyText = getText(equb.frequency);
    return alert(`${member.name} has already paid this ${frequencyText.toLowerCase()} in the current cycle`);
  }

  equb.contributions = equb.contributions || [];
  
  // Set cycle tracking for new contributions
  const newContribution = { 
    amount, 
    userId: memberId, 
    date: new Date().toISOString(),
    memberName: member.name,
    cycleUsed: currentCycle // Track which cycle this contribution belongs to
  };
  
  equb.contributions.push(newContribution);
  
  pushActivity(`${member.name} paid ${formatCurrency(amount)} ETB`, equb.id);

  // Update progress based on ACTUAL total collected vs goal
  updateEqubProgress(equb);
  
  saveState();
  closeModal('contribute');
  success(getText('paidSuccess'));
  updateHome();
  updateMembers();

  // Celebrate goal completion only when ALL members have paid their required amounts
  if (equb.progress >= 100 && !equb.celebrated) {
    const allPaidUp = checkAllMembersPaidUp(equb);
    if (allPaidUp) {
      equb.celebrated = true;
      launchConfetti();
      success(getText('goalReached'));
    }
  }
}



// FIXED: Enhanced progress calculation for proper payout cycles with COMPLETE RESET
function updateEqubProgress(equb) {
  if (!equb) return;
  
  // Calculate current cycle based on payout history
  const payoutHistory = equb.payoutHistory || [];
  const totalMembers = equb.targetMembers || 1;
  const currentCycle = Math.floor(payoutHistory.length / totalMembers);
  
  // Calculate total collected in CURRENT CYCLE only
  let totalCollectedThisCycle = 0;
  
  // Only count contributions from the current cycle
  const currentCycleContributions = (equb.contributions || []).filter(c => {
    if (c.cycleUsed !== undefined) {
      return c.cycleUsed === currentCycle;
    }
    // For contributions without cycle tracking, only include if they are after the last payout
    if (payoutHistory.length > 0) {
      const lastPayoutIndex = payoutHistory.length - 1;
      const lastPayoutDate = new Date(payoutHistory[lastPayoutIndex].date);
      const contributionDate = new Date(c.date);
      return contributionDate > lastPayoutDate;
    }
    // No payouts yet, include all contributions
    return true;
  });
  
  totalCollectedThisCycle = currentCycleContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  
  // Progress is based on current cycle collections vs goal
  equb.progress = equb.goalAmount ? Math.min(100, (totalCollectedThisCycle / equb.goalAmount) * 100) : 0;
  
  // Status logic
  if (equb.status === 'completed') {
    // Once completed, stay completed
    return;
  }
  
  // Auto-activate equb if we reach target members AND have at least one payment
  if (equb.status === 'forming' && 
      equb.members.length >= equb.targetMembers && 
      totalCollectedThisCycle > 0) {
    equb.status = 'active';
    pushActivity(`🎊 Equb "${equb.name}" is now active! All members joined and payments started.`, equb.id);
  }
  
  // MARK: Auto-start new round after completing a full rotation (after every full round of payouts)
  const totalPayouts = payoutHistory.length;
  if (totalPayouts > 0 && totalPayouts % totalMembers === 0 && equb.status === 'active') {
    // Reset for new round: reshuffle payout order, reset current index, reset celebrated flag
    equb.payoutOrder = shuffleArray(equb.members.map(m => ({ ...m })));
    equb.currentPayoutIndex = 0;
    equb.celebrated = false; // Allow celebration for new round
    
    // Only reset progress if it's not already 0 (prevents multiple resets)
    if (equb.progress > 0) {
      equb.progress = 0; // Explicitly reset progress for new round start
      pushActivity(`🔄 New round started for "${equb.name}"! Payout order refreshed and progress reset to 0%.`, equb.id);
      success('New round started! Continue contributing for the next cycle.');
    } else {
      pushActivity(`🔄 New round ready for "${equb.name}"! Payout order refreshed.`, equb.id);
    }
  }
}

/* ---------------------------------------------------------------------
   Helper Function for Week Numbers
   --------------------------------------------------------------------- */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// FIXED: Enhanced check if all members are paid up
function checkAllMembersPaidUp(equb) {
  if (!equb || !equb.members || equb.members.length === 0) return false;
  
  // For completed equbs, all members are considered paid up
  if (equb.status === 'completed') return true;
  
  // For forming equbs, all members are considered "paid up" since no cycles have started
  if (equb.status === 'forming') return true;
  
  // For active equbs, check if all members have no missed payments
  if (equb.status === 'active') {
    const allMembersPaid = equb.members.every(member => {
      const missed = computeMemberMissedCycles(equb, member);
      return missed === 0;
    });
    
    return allMembersPaid;
  }
  
  return false;
}

function updateRequiredAmount() {
  const sel = el('contribution-member');
  const memberId = sel?.value;
  const equb = getCurrentEqub();
  
  if (!equb || !memberId) {
    if (el('required-amount-display')) el('required-amount-display').style.display = 'none';
    return;
  }
  
  const member = equb.members.find(m => m.id === memberId);
  const missed = computeMemberMissedCycles(equb, member);
  const totalRequired = equb.contributionAmount + missed * equb.contributionAmount;
  
  if (el('required-amount')) el('required-amount').textContent = formatCurrency(totalRequired);
  if (el('missed-count')) el('missed-count').textContent = missed;
  if (el('required-amount-display')) el('required-amount-display').style.display = 'block';
  
  // Auto-fill amount field with required amount
  if (el('contribute-amount')) {
    el('contribute-amount').value = totalRequired.toFixed(2);
    el('contribute-amount').placeholder = `Required: ${formatCurrency(totalRequired)} ETB`;
  }
}

function contribute() {
  const memberId = el('contribution-member')?.value;
  const amount = parseFloat(el('contribute-amount')?.value);
  const equb = getCurrentEqub();
  
  if (!equb || !memberId || isNaN(amount) || amount <= 0) {
    return alert('Please select a member and enter a valid amount');
  }
  
  const member = equb.members.find(m => m.id === memberId);
  if (!member) return alert('Member not found');
  
  const missed = computeMemberMissedCycles(equb, member);
  const required = equb.contributionAmount + missed * equb.contributionAmount;
  
  // Allow admin to accept any amount, but warn if less than required
  if (amount < required) {
    const confirmMsg = `You are paying ${formatCurrency(amount)} ETB, but ${member.name} owes ${formatCurrency(required)} ETB. Continue anyway?`;
    if (!confirm(confirmMsg)) return;
  }
  
  const today = toDateOnlyString(new Date());
  
  // Check if already paid today for daily equbs - ONLY IN CURRENT CYCLE
  if (equb.frequency === 'daily') {
    const payoutHistory = equb.payoutHistory || [];
    const totalMembers = equb.targetMembers || 1;
    const currentCycle = Math.floor(payoutHistory.length / totalMembers);
    
    // Get contributions for current cycle only
    const currentCycleContributions = (equb.contributions || []).filter(c => {
      if (c.cycleUsed !== undefined) {
        return c.cycleUsed === currentCycle;
      }
      // For contributions without cycle tracking, only include if they are after the last payout
      if (payoutHistory.length > 0) {
        const lastPayoutDate = new Date(payoutHistory[payoutHistory.length - 1].date);
        const contributionDate = new Date(c.date);
        return contributionDate > lastPayoutDate;
      }
      // No payouts yet, include all contributions
      return true;
    });
    
    const alreadyPaid = currentCycleContributions.some(c => 
      c.userId === memberId && toDateOnlyString(c.date) === today
    );
    
    if (alreadyPaid) {
      return alert(`${member.name} has already paid today in the current cycle`);
    }
  }

  equb.contributions = equb.contributions || [];
  
  // Set cycle tracking for new contributions
  const payoutHistory = equb.payoutHistory || [];
  const totalMembers = equb.targetMembers || 1;
  const currentCycle = Math.floor(payoutHistory.length / totalMembers);
  
  const newContribution = { 
    amount, 
    userId: memberId, 
    date: new Date().toISOString(),
    memberName: member.name,
    cycleUsed: currentCycle // Track which cycle this contribution belongs to
  };
  
  equb.contributions.push(newContribution);
  
  pushActivity(`${member.name} paid ${formatCurrency(amount)} ETB`, equb.id);

  // Update progress based on ACTUAL total collected vs goal
  updateEqubProgress(equb);
  
  saveState();
  closeModal('contribute');
  success(getText('paidSuccess'));
  updateHome();
  updateMembers();

  // Celebrate goal completion only when ALL members have paid their required amounts
  if (equb.progress >= 100 && !equb.celebrated) {
    const allPaidUp = checkAllMembersPaidUp(equb);
    if (allPaidUp) {
      equb.celebrated = true;
      launchConfetti();
      success(getText('goalReached'));
    }
  }
}

// FIXED: Enhanced progress calculation for proper payout cycles
function updateEqubProgress(equb) {
  if (!equb) return;
  
  // FIXED: Calculate current cycle based on payout history
  const payoutHistory = equb.payoutHistory || [];
  const totalMembers = equb.targetMembers || 1;
  const currentCycle = Math.floor(payoutHistory.length / totalMembers);
  
  // FIXED: Calculate total collected in CURRENT CYCLE only
  let totalCollectedThisCycle = 0;
  
  // Only count contributions from the current cycle
  const currentCycleContributions = (equb.contributions || []).filter(c => {
    if (c.cycleUsed !== undefined) {
      return c.cycleUsed === currentCycle;
    }
    // For contributions without cycle tracking, only include if they are after the last payout
    if (payoutHistory.length > 0) {
      const lastPayoutIndex = payoutHistory.length - 1;
      const lastPayoutDate = new Date(payoutHistory[lastPayoutIndex].date);
      const contributionDate = new Date(c.date);
      return contributionDate > lastPayoutDate;
    }
    // No payouts yet, include all contributions
    return true;
  });
  
  totalCollectedThisCycle = currentCycleContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  
  // FIXED: Progress is based on current cycle collections vs goal
  equb.progress = equb.goalAmount ? Math.min(100, (totalCollectedThisCycle / equb.goalAmount) * 100) : 0;
  
  // FIXED: Status logic
  if (equb.status === 'completed') {
    // Once completed, stay completed
    return;
  }
  
  // Auto-activate equb if we reach target members AND have at least one payment
  if (equb.status === 'forming' && 
      equb.members.length >= equb.targetMembers && 
      totalCollectedThisCycle > 0) {
    equb.status = 'active';
    pushActivity(`🎊 Equb "${equb.name}" is now active! All members joined and payments started.`, equb.id);
  }
  
  // REMOVED: Auto-complete logic to allow multiple rounds/cycles
  // const totalPayouts = payoutHistory.length;
  // 
  // // Complete equb after all members receive one payout each
  // if (totalPayouts >= totalMembers && equb.status !== 'completed') {
  //   equb.status = 'completed';
  //   equb.progress = 100; // Show 100% when completed
  //   pushActivity(`🏆 Equb "${equb.name}" completed! All members have received their payouts.`, equb.id);
  // }
  
  // NEW: Auto-start new round after completing a full rotation (reset for next cycle)
  const totalPayouts = payoutHistory.length;
  if (totalPayouts > 0 && totalPayouts % totalMembers === 0 && equb.status === 'active') {
    // Reset for new round: reshuffle payout order, reset current index, reset celebrated flag
    equb.payoutOrder = shuffleArray(equb.members.map(m => ({ ...m })));
    equb.currentPayoutIndex = 0;
    equb.celebrated = false; // Allow celebration for new round
    pushActivity(`🔄 New round started for "${equb.name}"! Payout order refreshed.`, equb.id);
    success('New round started! Continue contributing.');
  }
}

// FIXED: Enhanced check if all members are paid up
function checkAllMembersPaidUp(equb) {
  if (!equb || !equb.members || equb.members.length === 0) return false;
  
  // For completed equbs, all members are considered paid up
  if (equb.status === 'completed') return true;
  
  // For forming equbs, all members are considered "paid up" since no cycles have started
  if (equb.status === 'forming') return true;
  
  // For active equbs, check if all members have no missed payments
  if (equb.status === 'active') {
    const allMembersPaid = equb.members.every(member => {
      const missed = computeMemberMissedCycles(equb, member);
      return missed === 0;
    });
    
    return allMembersPaid;
  }
  
  return false;
}

function updateRequiredAmount() {
  const sel = el('contribution-member');
  const memberId = sel?.value;
  const equb = getCurrentEqub();
  
  if (!equb || !memberId) {
    if (el('required-amount-display')) el('required-amount-display').style.display = 'none';
    return;
  }
  
  const member = equb.members.find(m => m.id === memberId);
  const missed = computeMemberMissedCycles(equb, member);
  const totalRequired = equb.contributionAmount + missed * equb.contributionAmount;
  
  if (el('required-amount')) el('required-amount').textContent = formatCurrency(totalRequired);
  if (el('missed-count')) el('missed-count').textContent = missed;
  if (el('required-amount-display')) el('required-amount-display').style.display = 'block';
  
  // Auto-fill amount field with required amount
  if (el('contribute-amount')) {
    el('contribute-amount').value = totalRequired.toFixed(2);
    el('contribute-amount').placeholder = `Required: ${formatCurrency(totalRequired)} ETB`;
  }
}

function contribute() {
  const memberId = el('contribution-member')?.value;
  const amount = parseFloat(el('contribute-amount')?.value);
  const equb = getCurrentEqub();
  
  if (!equb || !memberId || isNaN(amount) || amount <= 0) {
    return alert('Please select a member and enter a valid amount');
  }
  
  const member = equb.members.find(m => m.id === memberId);
  if (!member) return alert('Member not found');
  
  const missed = computeMemberMissedCycles(equb, member);
  const required = equb.contributionAmount + missed * equb.contributionAmount;
  
  // Allow admin to accept any amount, but warn if less than required
  if (amount < required) {
    const confirmMsg = `You are paying ${formatCurrency(amount)} ETB, but ${member.name} owes ${formatCurrency(required)} ETB. Continue anyway?`;
    if (!confirm(confirmMsg)) return;
  }
  
  const today = toDateOnlyString(new Date());
  
  // FIXED: Check if already paid today for daily equbs - ONLY IN CURRENT CYCLE
  if (equb.frequency === 'daily') {
    const payoutHistory = equb.payoutHistory || [];
    const totalMembers = equb.targetMembers || 1;
    const currentCycle = Math.floor(payoutHistory.length / totalMembers);
    
    // Get contributions for current cycle only
    const currentCycleContributions = (equb.contributions || []).filter(c => {
      if (c.cycleUsed !== undefined) {
        return c.cycleUsed === currentCycle;
      }
      // For contributions without cycle tracking, only include if they are after the last payout
      if (payoutHistory.length > 0) {
        const lastPayoutDate = new Date(payoutHistory[payoutHistory.length - 1].date);
        const contributionDate = new Date(c.date);
        return contributionDate > lastPayoutDate;
      }
      // No payouts yet, include all contributions
      return true;
    });
    
    const alreadyPaid = currentCycleContributions.some(c => 
      c.userId === memberId && toDateOnlyString(c.date) === today
    );
    
    if (alreadyPaid) {
      return alert(`${member.name} has already paid today in the current cycle`);
    }
  }

  equb.contributions = equb.contributions || [];
  
  // FIXED: Set cycle tracking for new contributions
  const payoutHistory = equb.payoutHistory || [];
  const totalMembers = equb.targetMembers || 1;
  const currentCycle = Math.floor(payoutHistory.length / totalMembers);
  
  const newContribution = { 
    amount, 
    userId: memberId, 
    date: new Date().toISOString(),
    memberName: member.name,
    cycleUsed: currentCycle // Track which cycle this contribution belongs to
  };
  
  equb.contributions.push(newContribution);
  
  pushActivity(`${member.name} paid ${formatCurrency(amount)} ETB`, equb.id);

  // Update progress based on ACTUAL total collected vs goal
  updateEqubProgress(equb);
  
  saveState();
  closeModal('contribute');
  success(getText('paidSuccess'));
  updateHome();
  updateMembers();

  // Celebrate goal completion only when ALL members have paid their required amounts
  if (equb.progress >= 100 && !equb.celebrated) {
    const allPaidUp = checkAllMembersPaidUp(equb);
    if (allPaidUp) {
      equb.celebrated = true;
      launchConfetti();
      success(getText('goalReached'));
    }
  }
}
// FIXED: Enhanced progress calculation for proper payout cycles
function updateEqubProgress(equb) {
  if (!equb) return;
  
  // FIXED: Calculate current cycle based on payout history
  const payoutHistory = equb.payoutHistory || [];
  const totalMembers = equb.targetMembers || 1;
  const currentCycle = Math.floor(payoutHistory.length / totalMembers);
  
  // FIXED: Calculate total collected in CURRENT CYCLE only
  let totalCollectedThisCycle = 0;
  
  // Only count contributions from the current cycle
  const currentCycleContributions = (equb.contributions || []).filter(c => {
    if (c.cycleUsed !== undefined) {
      return c.cycleUsed === currentCycle;
    }
    // For contributions without cycle tracking, only include if they are after the last payout
    if (payoutHistory.length > 0) {
      const lastPayoutIndex = payoutHistory.length - 1;
      const lastPayoutDate = new Date(payoutHistory[lastPayoutIndex].date);
      const contributionDate = new Date(c.date);
      return contributionDate > lastPayoutDate;
    }
    // No payouts yet, include all contributions
    return true;
  });
  
  totalCollectedThisCycle = currentCycleContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  
  // FIXED: Progress is based on current cycle collections vs goal
  equb.progress = equb.goalAmount ? Math.min(100, (totalCollectedThisCycle / equb.goalAmount) * 100) : 0;
  
  // FIXED: Status logic
  if (equb.status === 'completed') {
    // Once completed, stay completed
    return;
  }
  
  // Auto-activate equb if we reach target members AND have at least one payment
  if (equb.status === 'forming' && 
      equb.members.length >= equb.targetMembers && 
      totalCollectedThisCycle > 0) {
    equb.status = 'active';
    pushActivity(`🎊 Equb "${equb.name}" is now active! All members joined and payments started.`, equb.id);
  }
  
  // FIXED: Auto-complete logic - complete after each member gets one full payout
  const totalPayouts = payoutHistory.length;
  
  // Complete equb after all members receive one payout each
  if (totalPayouts >= totalMembers && equb.status !== 'completed') {
    equb.status = 'completed';
    equb.progress = 100; // Show 100% when completed
    pushActivity(`🏆 Equb "${equb.name}" completed! All members have received their payouts.`, equb.id);
  }
}

// FIXED: Enhanced check if all members are paid up
function checkAllMembersPaidUp(equb) {
  if (!equb || !equb.members || equb.members.length === 0) return false;
  
  // For completed equbs, all members are considered paid up
  if (equb.status === 'completed') return true;
  
  // For forming equbs, all members are considered "paid up" since no cycles have started
  if (equb.status === 'forming') return true;
  
  // For active equbs, check if all members have no missed payments
  if (equb.status === 'active') {
    const allMembersPaid = equb.members.every(member => {
      const missed = computeMemberMissedCycles(equb, member);
      return missed === 0;
    });
    
    return allMembersPaid;
  }
  
  return false;
}

/* ---------------------------------------------------------------------
   Payment Cycle Calculations - IMPROVED WITH ROUND RESET SUPPORT
   --------------------------------------------------------------------- */
function computeMemberMissedCycles(equb, member) {
  if (!equb || !member || equb.status !== 'active') return 0;
  
  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  
  // FIXED: Get current cycle based on payout history
  const payoutHistory = equb.payoutHistory || [];
  const totalMembers = equb.targetMembers || 1;
  const currentCycle = Math.floor(payoutHistory.length / totalMembers);
  
  // Find the start date for current cycle
  let cycleStartDate;
  if (payoutHistory.length > 0) {
    const cycleStartIndex = currentCycle * totalMembers;
    if (cycleStartIndex < payoutHistory.length) {
      cycleStartDate = new Date(payoutHistory[cycleStartIndex].date);
    } else {
      // Current cycle hasn't started yet, use the date after last payout
      const lastPayoutIndex = payoutHistory.length - 1;
      cycleStartDate = new Date(payoutHistory[lastPayoutIndex].date);
      cycleStartDate.setDate(cycleStartDate.getDate() + 1);
    }
  } else {
    // No payouts yet, use equb start date
    cycleStartDate = new Date(equb.startDate);
  }
  
  cycleStartDate.setHours(0, 0, 0, 0);
  
  // If cycle start date is in the future, no cycles missed
  if (cycleStartDate > today) {
    return 0;
  }
  
  // Get member's contributions for current cycle only
  const currentCycleContributions = (equb.contributions || []).filter(c => {
    if (c.cycleUsed !== undefined) {
      return c.cycleUsed === currentCycle;
    }
    // Fallback: contributions after cycle start date
    const contributionDate = new Date(c.date);
    return contributionDate >= cycleStartDate && c.userId === member.id;
  });
  
  // Calculate cycles from cycle start to yesterday (not including today)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Calculate total expected cycles based on frequency
  let totalExpectedCycles = 0;
  
  switch (equb.frequency) {
    case 'daily':
      totalExpectedCycles = Math.max(0, Math.floor((yesterday - cycleStartDate) / (24 * 60 * 60 * 1000)) + 1);
      break;
      
    case 'weekly':
      // Count weeks from cycle start to yesterday
      const weeksDiff = Math.floor((yesterday - cycleStartDate) / (7 * 24 * 60 * 60 * 1000));
      totalExpectedCycles = Math.max(0, weeksDiff + 1);
      break;
      
    case 'monthly':
      // Count months from cycle start to yesterday
      const startYear = cycleStartDate.getFullYear();
      const startMonth = cycleStartDate.getMonth();
      const endYear = yesterday.getFullYear();
      const endMonth = yesterday.getMonth();
      
      totalExpectedCycles = Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);
      break;
      
    case 'yearly':
      // Count years from cycle start to yesterday
      totalExpectedCycles = Math.max(0, yesterday.getFullYear() - cycleStartDate.getFullYear() + 1);
      break;
      
    default:
      return 0;
  }
  
  // Calculate paid cycles in current cycle
  const paidCycles = currentCycleContributions.length;
  
  // Missed cycles = total expected cycles - paid cycles
  const missedCycles = Math.max(0, totalExpectedCycles - paidCycles);
  
  return missedCycles;
}



// HELPER: Shuffle array for random payout order
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
// MANUAL RESET: Function to manually reset payments for new cycle (admin use)
function resetPaymentsForNewCycle() {
  const equb = getCurrentEqub();
  if (!equb || equb.creatorId !== state.user?.id) return;
  
  if (confirm('Reset all payments for new cycle? This will start fresh collection.')) {
    // Mark all contributions as from previous cycles
    const payoutHistory = equb.payoutHistory || [];
    const totalMembers = equb.targetMembers || 1;
    const currentCycle = Math.floor(payoutHistory.length / totalMembers);
    
    equb.contributions.forEach(contribution => {
      if (contribution.cycleUsed === undefined) {
        contribution.cycleUsed = currentCycle - 1; // Mark as previous cycle
      }
    });
    
    equb.progress = 0;
    equb.celebrated = false;
    
    pushActivity('Payments reset for new cycle', equb.id);
    saveState();
    updateHome();
    updateMembers();
    
    success('Payments reset! Ready for new cycle collections.');
  }
}
/* ---------------------------------------------------------------------
   Payout Management - UPDATED
   --------------------------------------------------------------------- */
function populatePayoutRecipients() {
  const select = el('payout-recipient');
  if (!select) return;
  
  select.innerHTML = '<option value="">' + getText('selectRecipient') + '</option>';
  
  const equb = getCurrentEqub();
  if (!equb) return;
  
  // FIXED: PAYOUT ORDER LOOPING LOGIC
  const allMembers = equb.members || [];
  const payoutHistory = equb.payoutHistory || [];
  const totalMembers = equb.targetMembers || 1;
  
  // Find members who haven't received payout in current cycle
  const currentCycleStart = payoutHistory.length - (payoutHistory.length % totalMembers);
  const currentCyclePayouts = payoutHistory.slice(currentCycleStart);
  const paidMemberIds = currentCyclePayouts.map(p => p.recipientId);
  
  const eligibleMembers = allMembers.filter(m => !paidMemberIds.includes(m.id));
  
  if (eligibleMembers.length === 0) {
    // All members have been paid in current cycle
    select.innerHTML += '<option value="">All members paid in current cycle</option>';
    
    // FIXED: Auto-reset for next cycle if all members paid
    if (payoutHistory.length > 0 && payoutHistory.length % totalMembers === 0) {
      // This should trigger automatically when the last payout is processed
      console.log('All members paid in cycle - ready for next cycle');
    }
  } else {
    eligibleMembers.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = escapeHtml(m.name);
      
      // Show if this member is next in payout order
      const payoutOrder = equb.payoutOrder || [];
      const orderIndex = payoutOrder.findIndex(p => p.id === m.id);
      if (orderIndex >= 0) {
        opt.textContent += ` (#${orderIndex + 1} in order)`;
      }
      
      select.appendChild(opt);
    });
  }
}


/* ---------------------------------------------------------------------
   Payout Management - FIXED PAYMENT RESET
   --------------------------------------------------------------------- */
function performPayout() {
  const recipientId = el('payout-recipient')?.value;
  const equb = getCurrentEqub();
  
  if (!equb || equb.creatorId !== state.user?.id || !recipientId) {
    return alert('Invalid payout request');
  }

  const recipient = equb.members.find(m => m.id === recipientId);
  if (!recipient) return alert('Member not found');

  // Validation - must be at 100% progress
  if (equb.progress < 100) {
    return alert(`Progress must be 100% to process payout. Current progress: ${equb.progress.toFixed(1)}%`);
  }

  if (!checkAllMembersPaidUp(equb)) {
    const unpaidCount = equb.members.filter(m => computeMemberMissedCycles(equb, m) > 0).length;
    return alert(`${unpaidCount} members have unpaid contributions`);
  }

  if (equb.status !== 'active') {
    return alert('Equb must be active');
  }

  // Check if recipient already received payout in current cycle
  const payoutHistory = equb.payoutHistory || [];
  const totalMembers = equb.targetMembers || 1;
  const currentCycleStart = payoutHistory.length - (payoutHistory.length % totalMembers);
  const currentCyclePayouts = payoutHistory.slice(currentCycleStart);
  const alreadyPaid = currentCyclePayouts.some(p => p.recipientId === recipientId);
  
  if (alreadyPaid) {
    return alert(`${recipient.name} has already received a payout in this cycle`);
  }

  // Payout the FULL goal amount to one member
  const payoutAmount = equb.goalAmount;

  equb.payoutHistory = equb.payoutHistory || [];
  const round = equb.payoutHistory.length + 1;

  equb.payoutHistory.push({ 
    round, 
    recipientId, 
    recipientName: recipient.name,
    date: new Date().toISOString(),
    amount: payoutAmount
  });

  pushActivity(
    `${recipient.name} received FULL payout of ${formatCurrency(payoutAmount)} ETB for round ${round}`, 
    equb.id
  );

  // CRITICAL: Calculate current cycle and reset for next round
  const totalPayouts = equb.payoutHistory.length;
  const completedCycle = Math.floor((totalPayouts - 1) / totalMembers);
  
  console.log(`Payout #${totalPayouts}, Completed Cycle: ${completedCycle}`);

  // MARK 1: Reset progress to 0% for the NEXT cycle
  equb.progress = 0;
  equb.celebrated = false;

  // MARK 2: Clear contributions that were used in the completed cycle
  const contributionsToKeep = equb.contributions.filter(c => 
    c.cycleUsed === undefined || c.cycleUsed < completedCycle
  );
  
  console.log(`Clearing contributions for new cycle. Before: ${equb.contributions.length}, After: ${contributionsToKeep.length}`);
  
  equb.contributions = contributionsToKeep;

  // MARK 3: Auto-complete logic after all members receive one payout
  if (totalPayouts >= totalMembers && equb.status !== 'completed') {
    equb.status = 'completed';
    equb.progress = 100;
    success(`🎉 ${recipient.name} received ${formatCurrency(payoutAmount)} ETB! Equb completed - all ${totalMembers} members have received payouts.`);
    pushActivity(`🏆 Equb "${equb.name}" completed! All members have received their full payouts.`, equb.id);
  } else if (totalPayouts % totalMembers === 0) {
    // MARK 4: Completed a full cycle (all members paid once) - RESET FOR NEW CYCLE
    const cycleNumber = Math.floor(totalPayouts / totalMembers);
    
    success(`🎉 ${recipient.name} received ${formatCurrency(payoutAmount)} ETB! Cycle ${cycleNumber} completed. Starting fresh cycle ${cycleNumber + 1}.`);
    pushActivity(`✅ Completed full payout cycle ${cycleNumber}! All ${totalMembers} members have received payouts. Starting fresh cycle ${cycleNumber + 1}.`, equb.id);
    
    // MARK 5: Reset payout order for new cycle
    equb.payoutOrder = shuffleArray(equb.members.map(m => ({ ...m })));
    equb.currentPayoutIndex = 0;
    
    // Reset any member tracking for new cycle
    equb.members.forEach(member => {
      member._lastPaymentCycle = cycleNumber;
    });
  } else {
    const currentPayoutNumber = (totalPayouts % totalMembers);
    success(`💰 ${recipient.name} received ${formatCurrency(payoutAmount)} ETB! Progress reset to 0% for payout ${currentPayoutNumber + 1}/${totalMembers}.`);
  }
  
  saveState();
  closeModal('payout');
  updateHome();
  updateMembers();
}

/* ---------------------------------------------------------------------
   Payout Order Management (Drag & Drop) - FIXED MISSING FUNCTIONS
   --------------------------------------------------------------------- */
function populatePayoutOrderList() {
  const list = el('payout-order-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  const equb = getCurrentEqub();
  if (!equb) return;
  
  // Initialize payout order if not set or needs update
  if (!equb.payoutOrder || equb.payoutOrder.length !== equb.members.length) {
    equb.payoutOrder = shuffleArray(equb.members.map(m => ({ ...m })));
  }
  
  // Ensure payout order only contains current members
  const currentMemberIds = equb.members.map(m => m.id);
  equb.payoutOrder = equb.payoutOrder.filter(member => 
    currentMemberIds.includes(member.id)
  );
  
  // Add any missing members
  equb.members.forEach(member => {
    if (!equb.payoutOrder.some(m => m.id === member.id)) {
      equb.payoutOrder.push({ ...member });
    }
  });
  
  equb.payoutOrder.forEach((member, index) => {
    const item = document.createElement('div');
    item.className = 'payout-order-item';
    item.draggable = true;
    item.dataset.index = index;
    item.dataset.memberId = member.id;
    
    item.innerHTML = `
      <span class="drag-handle" aria-label="${getText('dragReorder')}">⋮⋮</span>
      <span class="order-number">${index + 1}</span>
      <span class="member-name">${escapeHtml(member.name)}</span>
      <div class="payout-order-controls">
        <button class="glass-button small" onclick="movePayoutOrder(${index}, ${index - 1})" ${index === 0 ? 'disabled' : ''}>
          ${getText('up')}
        </button>
        <button class="glass-button small" onclick="movePayoutOrder(${index}, ${index + 1})" ${index === equb.payoutOrder.length - 1 ? 'disabled' : ''}>
          ${getText('down')}
        </button>
      </div>
    `;
    
    // Drag and drop event handlers
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
    
    list.appendChild(item);
  });
}

// Drag and drop handlers
function handleDragStart(e) {
  draggedItem = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
  this.classList.add('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  e.stopPropagation();
  if (draggedItem !== this) {
    const list = el('payout-order-list');
    const items = Array.from(list.children);
    const fromIndex = items.indexOf(draggedItem);
    const toIndex = items.indexOf(this);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      movePayoutOrder(fromIndex, toIndex);
    }
  }
  return false;
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  draggedItem = null;
}

function movePayoutOrder(fromIndex, toIndex) {
  const equb = getCurrentEqub();
  if (!equb || toIndex < 0 || toIndex >= equb.payoutOrder.length) return;
  
  const [item] = equb.payoutOrder.splice(fromIndex, 1);
  equb.payoutOrder.splice(toIndex, 0, item);
  
  populatePayoutOrderList();
  saveState();
}

function savePayoutOrder() {
  const equb = getCurrentEqub();
  if (!equb) return;
  
  pushActivity('Payout order updated', equb.id);
  saveState();
  closeModal('edit-payout-order');
  success('Payout order saved!');
  updateMembers();
}

/* ---------------------------------------------------------------------
   Enhanced Home Page Display - FIXED
   --------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   Enhanced Home Page Display - FIXED
   --------------------------------------------------------------------- */
function updateHome() {
  const equb = getCurrentEqub();
  if (!equb) {
    setText('equb-name', getText('selectEqub'));
    return;
  }

  setText('equb-name', escapeHtml(equb.name || ''));
  setText('home-goal-amount', formatCurrency(equb.goalAmount));
  setText('members-count', String((equb.members || []).length || 0));
  setText('home-target-members', String(equb.targetMembers || 0));
  setText('home-contribution-amount', formatCurrency(equb.contributionAmount));

  // Update progress circle
  const fg = document.querySelector('.progress-fg');
  let percent = Number(equb.progress) || 0;
  if (fg) {
    const r = parseFloat(fg.getAttribute('r')) || 90;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (percent / 100) * circumference;
    fg.style.strokeDasharray = `${circumference}`;
    fg.style.strokeDashoffset = `${offset}`;
  }

  setText('progress-percent', (percent.toFixed(0) + '%'));
  
  const collected = (equb.contributions || []).reduce((s, c) => s + (c.amount || 0), 0);
  const remaining = Math.max(0, (equb.goalAmount || 0) - collected);
  setText('progress-remaining', `${formatCurrency(remaining)} ${getText('ETB')} left`);

  // Enhanced status determination with round tracking
  let statusText;
  const totalPayouts = equb.payoutHistory?.length || 0;
  const totalMembers = equb.targetMembers || 1;
  const currentCycle = Math.floor(totalPayouts / totalMembers);
  const currentPayoutInCycle = totalPayouts % totalMembers;
  
  if (equb.status === 'completed') {
    statusText = getText('completed');
  } else if (equb.status === 'active') {
    const allPaidUp = checkAllMembersPaidUp(equb);
    
    // Check if we're between cycles (just completed a payout cycle)
    const isBetweenCycles = totalPayouts > 0 && totalPayouts % totalMembers === 0;
    
    if (percent >= 100 && allPaidUp) {
      statusText = 'Ready for Payout';
    } else if (isBetweenCycles) {
      statusText = `Active - Cycle ${currentCycle + 1} Ready`;
    } else {
      statusText = `Active - Cycle ${currentCycle + 1}`;
    }
  } else {
    // Forming status - not enough members or no payments yet
    statusText = getText('forming');
  }

  setText('status', getText('status', statusText));

  // Enhanced Round calculation - show current cycle and payout number
  const currentPayoutNumber = currentPayoutInCycle + 1;
  const totalRoundsInCycle = totalMembers;

  setText('current-round', `${currentPayoutNumber}`);
  setText('total-rounds', String(totalRoundsInCycle));
  setText('current-cycle', `Cycle ${currentCycle + 1}`);

  // Payment gating logic
  const paymentNotice = el('payment-notice');
  const contributeBtn = el('contribute-button');
  const payoutBtn = el('payout-button');
  
  // Always enable contribute button if equb is active or forming
  if (contributeBtn) {
    const canContribute = equb.status === 'active' || equb.status === 'forming';
    contributeBtn.disabled = !canContribute;
    contributeBtn.style.pointerEvents = canContribute ? 'auto' : 'none';
    contributeBtn.style.opacity = canContribute ? '1' : '0.5';
  }
  
  // Enhanced Payout button logic
  if (payoutBtn) {
    const allPaidUp = checkAllMembersPaidUp(equb);
    const canPayout = (
      equb.creatorId === state.user?.id &&      // Only creator can payout
      percent >= 100 &&                         // 100% progress reached
      allPaidUp &&                             // All members paid up
      equb.status === 'active' &&              // Equb is active
      equb.members.length >= equb.targetMembers // All member slots filled
    );
    
    if (canPayout) {
      payoutBtn.disabled = false;
      payoutBtn.style.pointerEvents = 'auto';
      payoutBtn.style.opacity = '1';
      if (paymentNotice) paymentNotice.style.display = 'none';
    } else {
      payoutBtn.disabled = true;
      payoutBtn.style.pointerEvents = 'none';
      payoutBtn.style.opacity = '0.5';
      
      // Show appropriate notice
      if (paymentNotice) {
        paymentNotice.style.display = 'block';
        if (equb.status !== 'active') {
          paymentNotice.textContent = 'Equb must be active to process payouts';
        } else if (percent < 100) {
          paymentNotice.textContent = getText('completeProgress');
        } else if (!allPaidUp) {
          const unpaidCount = equb.members.filter(m => computeMemberMissedCycles(equb, m) > 0).length;
          paymentNotice.textContent = `${unpaidCount} members have unpaid contributions`;
        } else if (equb.creatorId !== state.user?.id) {
          paymentNotice.textContent = 'Only the equb creator can process payouts';
        } else {
          paymentNotice.style.display = 'none';
        }
      }
    }
  }
  
  // CRITICAL FIX: Update payment status section for ALL frequencies
  updatePaymentStatus(equb);
}


/* ---------------------------------------------------------------------
   Enhanced Payment Status Display for All Frequencies
   --------------------------------------------------------------------- */
function updatePaymentStatus(equb) {
  const paymentDiv = el('payment-status-section');
  if (!paymentDiv) return;
  
  // Show payment status for ALL frequencies
  paymentDiv.style.display = 'block';
  
  let periodText = '';
  switch (equb.frequency) {
    case 'daily': 
      periodText = getText('today'); 
      break;
    case 'weekly': 
      periodText = getText('thisWeek'); 
      break;
    case 'monthly': 
      periodText = 'this month'; 
      break;
    case 'yearly': 
      periodText = 'this year'; 
      break;
  }
  
  setText('current-period', `${periodText.charAt(0).toUpperCase() + periodText.slice(1)}`);
  
  const list = el('payments-list');
  if (list) {
    list.innerHTML = '';
    const today = new Date();
    
    // FIXED: Get current cycle based on payout history
    const payoutHistory = equb.payoutHistory || [];
    const totalMembers = equb.targetMembers || 1;
    const currentCycle = Math.floor(payoutHistory.length / totalMembers);
    
    // FIXED: Get contributions for CURRENT cycle only
    const currentCycleContributions = (equb.contributions || []).filter(c => {
      if (c.cycleUsed !== undefined) {
        return c.cycleUsed === currentCycle;
      }
      // For contributions without cycle tracking, only include if they are after the last payout
      if (payoutHistory.length > 0) {
        const lastPayoutDate = new Date(payoutHistory[payoutHistory.length - 1].date);
        const contributionDate = new Date(c.date);
        return contributionDate > lastPayoutDate;
      }
      // No payouts yet, include all contributions
      return true;
    });

    (equb.members || []).forEach(m => {
      // Check if member has paid in current period based on frequency
      let paidThisPeriod = false;
      
      switch (equb.frequency) {
        case 'daily':
          paidThisPeriod = currentCycleContributions.some(c => 
            c.userId === m.id && toDateOnlyString(c.date) === toDateOnlyString(today)
          );
          break;
          
        case 'weekly':
          const thisWeek = getWeekNumber(today);
          paidThisPeriod = currentCycleContributions.some(c => {
            if (c.userId !== m.id) return false;
            const contributionDate = new Date(c.date);
            const contributionWeek = getWeekNumber(contributionDate);
            return contributionWeek === thisWeek;
          });
          break;
          
        case 'monthly':
          const thisMonth = today.getMonth();
          const thisYear = today.getFullYear();
          paidThisPeriod = currentCycleContributions.some(c => {
            if (c.userId !== m.id) return false;
            const contributionDate = new Date(c.date);
            return contributionDate.getMonth() === thisMonth && 
                   contributionDate.getFullYear() === thisYear;
          });
          break;
          
        case 'yearly':
          const thisYearOnly = today.getFullYear();
          paidThisPeriod = currentCycleContributions.some(c => {
            if (c.userId !== m.id) return false;
            const contributionDate = new Date(c.date);
            return contributionDate.getFullYear() === thisYearOnly;
          });
          break;
      }
      
      // Calculate missed cycles only for current cycle
      const missed = computeMemberMissedCyclesCurrentCycle(equb, m, currentCycle);
      const totalOwed = missed * equb.contributionAmount;
      
      const div = document.createElement('div');
      div.className = `payment-status ${paidThisPeriod ? 'paid' : 'not-paid'}`;
      
      let statusText = paidThisPeriod ? getText('paid') : getText('notPaid');
      if (missed > 0 && !paidThisPeriod) {
        statusText += ` (${getText('missedDaysCount', missed, formatCurrency(totalOwed))})`;
      }
      
      div.innerHTML = `
        <span class="member-name">${escapeHtml(m.name)}</span>
        <span class="status">${statusText}</span>
      `;
      list.appendChild(div);
    });
  }
}


// Calculate missed cycles only for the current payout cycle
function computeMemberMissedCyclesCurrentCycle(equb, member, currentCycle) {
  if (!equb || !member || equb.status !== 'active') return 0;
  
  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  
  // Find the start date for current cycle
  const payoutHistory = equb.payoutHistory || [];
  let cycleStartDate;
  
  if (payoutHistory.length > 0) {
    // Start from the beginning of current cycle
    const cycleStartIndex = currentCycle * (equb.targetMembers || 1);
    if (cycleStartIndex < payoutHistory.length) {
      cycleStartDate = new Date(payoutHistory[cycleStartIndex].date);
    } else {
      // Current cycle hasn't started yet, use today
      cycleStartDate = new Date();
    }
  } else {
    // No payouts yet, use equb start date
    cycleStartDate = new Date(equb.startDate);
  }
  
  cycleStartDate.setHours(0, 0, 0, 0);
  
  // If the cycle start date is in the future, no cycles missed
  if (cycleStartDate > today) {
    return 0;
  }
  
  // Get member's contributions for current cycle only
  const currentCycleContributions = (equb.contributions || []).filter(c => {
    if (c.cycleUsed !== undefined) {
      return c.cycleUsed === currentCycle;
    }
    // Fallback: contributions after cycle start date
    const contributionDate = new Date(c.date);
    return contributionDate >= cycleStartDate && c.userId === member.id;
  });
  
  // Calculate cycles from cycle start to yesterday (not including today)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Calculate total expected cycles based on frequency
  let totalExpectedCycles = 0;
  
  switch (equb.frequency) {
    case 'daily':
      totalExpectedCycles = Math.max(0, Math.floor((yesterday - cycleStartDate) / (24 * 60 * 60 * 1000)) + 1);
      break;
      
    case 'weekly':
      const weeksDiff = Math.floor((yesterday - cycleStartDate) / (7 * 24 * 60 * 60 * 1000));
      totalExpectedCycles = Math.max(0, weeksDiff + 1);
      break;
      
    case 'monthly':
      const startYear = cycleStartDate.getFullYear();
      const startMonth = cycleStartDate.getMonth();
      const endYear = yesterday.getFullYear();
      const endMonth = yesterday.getMonth();
      
      totalExpectedCycles = Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);
      break;
      
    case 'yearly':
      totalExpectedCycles = Math.max(0, yesterday.getFullYear() - cycleStartDate.getFullYear() + 1);
      break;
      
    default:
      return 0;
  }
  
  // Calculate paid cycles in current cycle
  const paidCycles = currentCycleContributions.length;
  
  // Missed cycles = total expected cycles - paid cycles
  const missedCycles = Math.max(0, totalExpectedCycles - paidCycles);
  
  return missedCycles;
}

// Update daily payments display - FIXED
function updateDailyPayments(equb) {
  const dailyDiv = el('daily-payments');
  if (!dailyDiv) return;
  
  if (equb.frequency === 'daily') {
    dailyDiv.style.display = 'block';
    setText('current-date', new Date().toLocaleDateString());
    
    const list = el('payments-list');
    if (list) {
      list.innerHTML = '';
      const today = toDateOnlyString(new Date());
      
      // FIXED: Get current cycle based on payout history
      const payoutHistory = equb.payoutHistory || [];
      const totalMembers = equb.targetMembers || 1;
      const currentCycle = Math.floor(payoutHistory.length / totalMembers);
      
      console.log('Current Cycle:', currentCycle, 'Total Payouts:', payoutHistory.length);
      
      // FIXED: Get contributions for CURRENT cycle only
      const currentCycleContributions = (equb.contributions || []).filter(c => {
        // Only include contributions that are marked for current cycle
        // OR contributions without cycle marking (for backward compatibility)
        if (c.cycleUsed !== undefined) {
          return c.cycleUsed === currentCycle;
        }
        // For contributions without cycle tracking, only include if they are after the last payout
        if (payoutHistory.length > 0) {
          const lastPayoutDate = new Date(payoutHistory[payoutHistory.length - 1].date);
          const contributionDate = new Date(c.date);
          return contributionDate > lastPayoutDate;
        }
        // No payouts yet, include all contributions
        return true;
      });

      console.log('Total Contributions:', equb.contributions.length, 'Current Cycle Contributions:', currentCycleContributions.length);

      (equb.members || []).forEach(m => {
        // FIXED: Check if member has paid TODAY in the CURRENT CYCLE only
        const paidToday = currentCycleContributions.some(c => 
          c.userId === m.id && toDateOnlyString(c.date) === today
        );
        
        // Calculate missed days only for current cycle
        const missed = computeMemberMissedCyclesCurrentCycle(equb, m, currentCycle);
        const totalOwed = missed * equb.contributionAmount;
        
        const div = document.createElement('div');
        div.className = `payment-status ${paidToday ? 'paid' : 'not-paid'}`;
        
        let statusText = paidToday ? getText('paid') : getText('notPaid');
        if (missed > 0 && !paidToday) {
          statusText += ` (${missed} missed - ${formatCurrency(totalOwed)} ETB)`;
        }
        
        div.innerHTML = `
          <span class="member-name">${escapeHtml(m.name)}</span>
          <span class="status">${statusText}</span>
        `;
        list.appendChild(div);
      });
    }
  } else {
    dailyDiv.style.display = 'none';
  }
}
// Calculate missed cycles only for the current payout cycle
function computeMemberMissedCyclesCurrentCycle(equb, member, currentCycle) {
  if (!equb || !member || equb.status !== 'active') return 0;
  
  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  
  // Determine cycle interval based on frequency
  let cycleMs;
  switch (equb.frequency) {
    case 'daily': cycleMs = 24 * 60 * 60 * 1000; break;
    case 'weekly': cycleMs = 7 * 24 * 60 * 60 * 1000; break;
    case 'monthly': cycleMs = 30 * 24 * 60 * 60 * 1000; break;
    case 'yearly': cycleMs = 365 * 24 * 60 * 60 * 1000; break;
    default: return 0;
  }
  
  // Find the start date for current cycle
  const payoutHistory = equb.payoutHistory || [];
  let cycleStartDate;
  
  if (payoutHistory.length > 0) {
    // Start from the beginning of current cycle
    const cycleStartIndex = currentCycle * (equb.targetMembers || 1);
    if (cycleStartIndex < payoutHistory.length) {
      cycleStartDate = new Date(payoutHistory[cycleStartIndex].date);
    } else {
      // Current cycle hasn't started yet, use today
      cycleStartDate = new Date();
    }
  } else {
    // No payouts yet, use equb start date
    cycleStartDate = new Date(equb.startDate);
  }
  
  cycleStartDate.setHours(0, 0, 0, 0);
  
  // If the cycle start date is in the future, no cycles missed
  if (cycleStartDate > today) {
    return 0;
  }
  
  // Get member's contributions for current cycle only
  const currentCycleContributions = (equb.contributions || []).filter(c => {
    if (c.cycleUsed !== undefined) {
      return c.cycleUsed === currentCycle;
    }
    // Fallback: contributions after cycle start date
    const contributionDate = new Date(c.date);
    return contributionDate >= cycleStartDate && c.userId === member.id;
  });
  
  // Calculate cycles from cycle start to yesterday (not including today)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Calculate total expected cycles from cycle start date to yesterday
  const totalExpectedCycles = Math.max(0, Math.floor((yesterday - cycleStartDate) / cycleMs) + 1);
  
  // Calculate paid cycles in current cycle
  const paidCycles = currentCycleContributions.length;
  
  // Missed cycles = total expected cycles - paid cycles
  const missedCycles = Math.max(0, totalExpectedCycles - paidCycles);
  
  return missedCycles;
}

/* ---------------------------------------------------------------------
   Enhanced Members Display - FIXED
   --------------------------------------------------------------------- */
function updateMembers() {
  const list = el('member-list');
  const empty = el('no-members');
  if (!list) return;
  
  list.innerHTML = '';
  const equb = getCurrentEqub();
  
  if (!equb || !(equb.members || []).length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  
  if (empty) empty.style.display = 'none';

  (equb.members || []).forEach((member, index) => {
    const card = document.createElement('div');
    card.className = 'glass-card';
    
    const isOwner = member.id === equb.creatorId;
    const hasPayout = (equb.payoutHistory || []).some(p => p.recipientId === member.id);
    const payoutOrderIndex = equb.payoutOrder?.findIndex(m => m.id === member.id) ?? index;
    const missed = computeMemberMissedCycles(equb, member);
    const totalOwed = missed * equb.contributionAmount;
    const isFullyPaid = missed === 0;
    
    // Enhanced status display
    let paymentStatus = '';
    if (equb.frequency === 'daily') {
      const today = toDateOnlyString(new Date());
      const paidToday = (equb.contributions || []).some(c => 
        c.userId === member.id && toDateOnlyString(c.date) === today
      );
      
      if (paidToday) {
        paymentStatus = `<div class="payment-status paid">${getText('paid')} today</div>`;
      } else if (missed > 0) {
        paymentStatus = `<div class="payment-status not-paid">${getText('missedDaysCount', missed, formatCurrency(totalOwed))}</div>`;
      } else {
        paymentStatus = `<div class="payment-status not-paid">${getText('notPaid')} today</div>`;
      }
    } else {
      // For non-daily equbs, show overall payment status
      const totalContributions = (equb.contributions || []).filter(c => c.userId === member.id).length;
      const paymentStatusClass = isFullyPaid ? 'paid' : 'not-paid';
      const paymentStatusText = isFullyPaid ? 'Up to date' : `${getText('missedDaysCount', missed, formatCurrency(totalOwed))}`;
      
      paymentStatus = `
        <p>Payments made: ${totalContributions}</p>
        <div class="payment-status ${paymentStatusClass}">${paymentStatusText}</div>
      `;
    }
    
    let html = `
      <p style="font-weight:600">
        ${escapeHtml(member.name)} 
        ${isOwner ? `<small>${getText('owner')}</small>` : ''}
        ${hasPayout ? '💰' : ''}
      </p>
      <p>${getText('phone')}: ${escapeHtml(member.phone || '-')}</p>
      <p>${getText('editPayoutOrder')}: #${payoutOrderIndex + 1}</p>
      ${paymentStatus}
      <p>${getText('memberSince')}: ${new Date(member.joinedAt).toLocaleDateString()}</p>
    `;

    card.innerHTML = html;

    // Add action buttons for creator
    if (equb.creatorId === state.user?.id) {
      const buttonRow = document.createElement('div');
      buttonRow.className = 'button-row';

      const editBtn = document.createElement('button');
      editBtn.className = 'glass-button small';
      editBtn.textContent = getText('edit');
      editBtn.onclick = (e) => { e.stopPropagation(); openEditMember(member.id); };
      buttonRow.appendChild(editBtn);

      // Quick pay button for members with missed payments
      if (missed > 0) {
        const quickPayBtn = document.createElement('button');
        quickPayBtn.className = 'glass-button small';
        quickPayBtn.style.background = '#22c55e';
        quickPayBtn.textContent = `Pay ${formatCurrency(totalOwed + equb.contributionAmount)}`;
        quickPayBtn.onclick = (e) => { 
          e.stopPropagation(); 
          quickPayMember(member.id); 
        };
        buttonRow.appendChild(quickPayBtn);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'glass-button small';
      removeBtn.style.background = '#ef4444';
      removeBtn.textContent = getText('removeMember');
      removeBtn.onclick = (e) => { e.stopPropagation(); removeMember(member.id); };
      buttonRow.appendChild(removeBtn);

      card.appendChild(buttonRow);
    }

    list.appendChild(card);
  });

  // Update action buttons
  const addBtnContainer = document.querySelector('#members-page .action-buttons');
  if (addBtnContainer) {
    addBtnContainer.innerHTML = '';
    
    if (equb.creatorId === state.user?.id) {
      const addBtn = document.createElement('button');
      addBtn.className = 'glass-button';
      addBtn.textContent = getText('addMember');
      addBtn.onclick = () => showModal('add-member');
      addBtnContainer.appendChild(addBtn);
    }
    
    const inviteBtn = document.createElement('button');
    inviteBtn.className = 'glass-button secondary';
    inviteBtn.textContent = getText('invite');
    inviteBtn.onclick = () => showModal('invite');
    addBtnContainer.appendChild(inviteBtn);
    
    const editOrderBtn = document.createElement('button');
    editOrderBtn.className = 'glass-button secondary';
    editOrderBtn.textContent = getText('editPayoutOrder');
    editOrderBtn.onclick = () => showModal('edit-payout-order');
    addBtnContainer.appendChild(editOrderBtn);
  }
}

// FIXED: Quick pay function for admins
function quickPayMember(memberId) {
  const equb = getCurrentEqub();
  if (!equb || equb.creatorId !== state.user?.id) return;
  
  const member = equb.members.find(m => m.id === memberId);
  if (!member) return;
  
  const missed = computeMemberMissedCycles(equb, member);
  const totalRequired = equb.contributionAmount + missed * equb.contributionAmount;
  
  // Auto-fill the contribution form
  setValue('contribution-member', memberId);
  setValue('contribute-amount', totalRequired.toFixed(2));
  
  // Show the contribute modal
  showModal('contribute');
}

/* ---------------------------------------------------------------------
   Activity & History Management
   --------------------------------------------------------------------- */
function pushActivity(message, equbId = null) {
  const cleanMsg = String(message)
    .replace(/&quot;.*&quot;/g, '')
    .replace(/\(code: .*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  if (!cleanMsg) return;

  const entry = { 
    date: new Date().toISOString(), 
    message: cleanMsg, 
    equbId, 
    userId: state.user?.id || null 
  };
  
  state.activity = state.activity || [];
  state.history = state.history || [];
  
  state.activity.push(entry);
  state.history.push({ 
    date: entry.date, 
    message: cleanMsg, 
    userId: state.user?.id || null 
  });
  
  // Keep only last 100 activities
  if (state.activity.length > 100) {
    state.activity = state.activity.slice(-100);
  }
  
  saveState();
  
  // Update UI if relevant page is active
  try { updateActivity(); } catch (e) {}
  try { updateHome(); } catch (e) {}
}

function getActivityEmoji(message) {
  const msg = (message || '').toString().toLowerCase();
  if (msg.includes('created') || /ፍጠር/.test(msg)) return '🎉';
  if (msg.includes('joined') || /ተቀላቀል/.test(msg)) return '👏';
  if (msg.includes('paid') || /ከፈለ/.test(msg)) return '💰';
  if (msg.includes('payout') || /ደረሰ/.test(msg)) return '🏆';
  if (msg.includes('added') || /ጨመረ/.test(msg)) return '➕';
  if (msg.includes('edited') || /አስተካክለ/.test(msg)) return '✏️';
  if (msg.includes('removed') || /አስወገደ/.test(msg)) return '➖';
  if (msg.includes('deleted')) return '🗑️';
  if (msg.includes('transferred')) return '🔄';
  return 'ℹ️';
}

/* ---------------------------------------------------------------------
   UI Update Functions
   --------------------------------------------------------------------- */
function getCurrentEqub() {
  if (!state.user) return null;
  if (!state.equbs || !state.currentEqubId) return null;
  
  const equb = state.equbs.find(e => e.id === state.currentEqubId);
  
  // Check if user is creator OR member of this equb
  if (equb && (equb.creatorId === state.user.id || 
      (Array.isArray(equb.members) && equb.members.some(m => m.id === state.user.id)))) {
    return equb;
  }
  
  return null;
}

function updateActivity() {
  const feed = el('activity-feed');
  const empty = el('no-activity');
  if (!feed) return;
  
  feed.innerHTML = '';

  const equb = getCurrentEqub();
  if (!equb) {
    if (empty) empty.style.display = 'block';
    return;
  }

  // Get activities for current equb
  let items = (state.activity || [])
    .filter(a => a.equbId === equb.id)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!items.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  
  if (empty) empty.style.display = 'none';

  // Group activities by date
  const groups = {};
  const now = new Date(); 
  now.setHours(0,0,0,0);
  
  items.forEach(item => {
    const date = new Date(item.date); 
    date.setHours(0,0,0,0);
    const diff = Math.floor((now - date) / 86400000);
    
    let label;
    if (diff === 0) label = getText('today');
    else if (diff === 1) label = getText('yesterday');
    else if (diff <= 7) label = getText('thisWeek');
    else label = date.toLocaleDateString();
    
    if (!groups[label]) groups[label] = [];
    groups[label].push({ ...item, fullDate: new Date(item.date) });
  });

  // Render grouped activities
  Object.keys(groups).forEach(label => {
    const section = document.createElement('div');
    section.style.marginBottom = '20px';
    
    const labelEl = document.createElement('div');
    labelEl.className = 'section-label';
    labelEl.style.cssText = 'font-weight:600; margin-bottom:10px; opacity:0.8; font-size:0.9em;';
    labelEl.textContent = label;
    section.appendChild(labelEl);

    groups[label].forEach(activity => {
      const card = document.createElement('div');
      card.className = 'glass-activity-card';
      const emoji = getActivityEmoji(activity.message);
      const time = activity.fullDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      card.innerHTML = `
        <span class="icon emoji">${emoji}</span>
        <div class="activity-text" style="flex:1;">
          ${escapeHtml(activity.message)}<br>
          <small style="opacity:0.7;">${time}</small>
        </div>
      `;
      section.appendChild(card);
    });

    feed.appendChild(section);
  });
}

function updateMyEqubs() {
  const list = el('equb-list');
  const empty = el('no-equbs');
  if (!list) return;
  
  list.innerHTML = '';

  if (!state.user) {
    if (empty) empty.style.display = 'block';
    return;
  }

  const userEqubs = (state.equbs || []).filter(e =>
    e.creatorId === state.user.id ||
    (Array.isArray(e.members) && e.members.some(m => m.id === state.user.id))
  );

  if (!userEqubs.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  
  if (empty) empty.style.display = 'none';

  userEqubs.forEach(equb => {
    const isCreator = equb.creatorId === state.user.id;
    const card = document.createElement('div');
    card.className = 'glass-card';
    card.style.cursor = 'pointer';
    card.onclick = () => { 
      state.currentEqubId = equb.id; 
      saveState(); 
      showPage('home'); 
    };

    const statusText = getText('status') + ': ' + getText(equb.status);
    card.innerHTML = `
      <h3>${escapeHtml(equb.name)}</h3>
      <p>${escapeHtml(statusText)}</p>
      <p>${getText('progress', equb.progress.toFixed(0))}</p>
      <p style="font-size:0.8em; opacity:0.7;">
        ${isCreator ? getText('youAreCreator') : getText('youAreMember')}
      </p>
    `;

    // Add action buttons
    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row';

    if (isCreator) {
      const editBtn = document.createElement('button');
      editBtn.className = 'glass-button small';
      editBtn.textContent = getText('edit');
      editBtn.onclick = e => { e.stopPropagation(); openEditEqub(equb.id); };
      buttonRow.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'glass-button small';
      delBtn.textContent = getText('delete');
      delBtn.style.background = '#ef4444';
      delBtn.onclick = e => { e.stopPropagation(); deleteEqub(equb.id); };
      buttonRow.appendChild(delBtn);
    }

    const viewBtn = document.createElement('button');
    viewBtn.className = 'glass-button small';
    viewBtn.textContent = getText('view');
    viewBtn.onclick = e => { e.stopPropagation(); state.currentEqubId = equb.id; saveState(); showPage('home'); };
    buttonRow.appendChild(viewBtn);

    card.appendChild(buttonRow);
    list.appendChild(card);
  });
}

function updateProfile() {
  const auth = el('auth-card');
  const profile = el('profile-card');
  const historyCard = el('history-card');
  const logoutBtn = el('logout-button');
  const settings = el('settings-card');

  if (!state.user) {
    // Show auth, hide profile sections
    if (auth) auth.classList.remove('hidden');
    [profile, historyCard, logoutBtn, settings].forEach(x => { 
      if (x) x.classList.add('hidden'); 
    });
    setAuthMode('login');
  } else {
    // Show profile, hide auth
    if (auth) auth.classList.add('hidden');
    [profile, historyCard, logoutBtn, settings].forEach(x => { 
      if (x) x.classList.remove('hidden'); 
    });

    setText('profile-name', escapeHtml(state.user.name || ''));
    setText('member-since', getText('memberSince', new Date(state.user.createdAt).getFullYear()));

    // Update profile picture
    const img = el('profile-pic');
    const placeholder = el('profile-pic-placeholder');
    if (state.user.profilePic && img) {
      img.src = state.user.profilePic;
      img.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    } else {
      if (img) img.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
    }

    // Update language selector
    const langSelect = el('profile-language-select');
    if (langSelect) {
      langSelect.value = state.user.language || 'en';
      langSelect.onchange = () => setLanguage(langSelect.value);
    }

    // Update dark mode toggle
    const darkToggle = el('dark-mode-toggle');
    if (darkToggle) {
      darkToggle.checked = state.user.theme === 'dark';
      darkToggle.onchange = (e) => toggleDarkMode(e.target.checked);
    }

    // Update history
    const histList = el('history-list');
    const noHist = el('no-history');
    if (!histList) return;
    
    histList.innerHTML = '';
    const userHistory = (state.history || []).filter(h => h.userId === state.user.id);
    
    if (!userHistory.length) {
      if (noHist) noHist.style.display = 'block';
      return;
    }
    
    if (noHist) noHist.style.display = 'none';

    userHistory
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(history => {
        const div = document.createElement('div');
        div.style.cssText = 'margin:8px 0; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1);';
        
        const dateStr = new Date(history.date);
        div.innerHTML = `
          <small style="opacity:0.7;">
            ${dateStr.toLocaleDateString()} 
            ${dateStr.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </small><br>
          <span class="emoji">${getActivityEmoji(history.message)}</span> 
          ${escapeHtml(history.message)}
        `;
        histList.appendChild(div);
      });
  }
}

/* ---------------------------------------------------------------------
   Authentication UI
   --------------------------------------------------------------------- */
function setAuthMode(mode) {
  authMode = mode === 'signup' ? 'signup' : 'login';
  const isSignup = authMode === 'signup';

  // Update UI elements
  setText('auth-title', getText(authMode));
  
  const nameField = el('auth-name');
  const confirmField = el('auth-confirm');
  const confirmLabel = document.querySelector('label[for="auth-confirm"]');
  
  // FIXED: Show/hide name and confirm password fields properly
  if (nameField) nameField.style.display = isSignup ? 'block' : 'none';
  if (confirmField) confirmField.style.display = isSignup ? 'block' : 'none';
  if (confirmLabel) confirmLabel.style.display = isSignup ? 'block' : 'none';

  // Update switch button
  const switchBtn = el('auth-switch');
  if (switchBtn) {
    switchBtn.textContent = getText(isSignup ? 'login' : 'signup');
  }
}

function toggleAuthMode() {
  setAuthMode(authMode === 'login' ? 'signup' : 'login');
}

function authAction() {
  const email = el('auth-email')?.value?.trim()?.toLowerCase();
  const password = el('auth-password')?.value;
  
  if (!email || !password) return alert('Email and password required');

  if (authMode === 'signup') {
    const name = el('auth-name')?.value?.trim();
    const confirm = el('auth-confirm')?.value;
    
    if (!name) return alert('Name required');
    if (password !== confirm) return alert(getText('passwordsNotMatch'));
    
    const result = registerUser(name, email, password);
    if (!result.success) return alert(result.message);
    
    state.user = result.user;
    success(`Welcome, ${state.user.name}!`);
  } else {
    const user = validateLogin(email, password);
    if (!user) return alert('Invalid email or password');
    
    state.user = user;
    success(`Welcome back, ${state.user.name || ''}!`);
  }

  // Clear form fields
  if (el('auth-email')) el('auth-email').value = '';
  if (el('auth-password')) el('auth-password').value = '';
  if (el('auth-name')) el('auth-name').value = '';
  if (el('auth-confirm')) el('auth-confirm').value = '';

  saveState();
  showPage('myequbs');
}

/* ---------------------------------------------------------------------
   Invite & Sharing
   --------------------------------------------------------------------- */
function showInviteCode() {
  const equb = getCurrentEqub();
  if (equb && el('invite-code')) {
    setText('invite-code', equb.code);
  }
  if (el('share-code')) {
    setText('share-code', getText('shareCode'));
  }
}

function copyInviteCode() {
  const code = el('invite-code')?.textContent;
  if (!code) return;
  
  const shareData = {
    title: getText('inviteTitle'),
    text: `${getText('shareCode')} ${code}`,
    url: `${window.location.origin}${window.location.pathname}?join=${code}`
  };
  
  if (navigator.share) {
    navigator.share(shareData)
      .then(() => success('Shared!'))
      .catch(() => fallbackCopy(code));
  } else {
    fallbackCopy(code);
  }
}

function fallbackCopy(code) {
  navigator.clipboard.writeText(code)
    .then(() => success(getText('copy') + '!'))
    .catch(() => {
      // Last resort - create temporary input
      const tempInput = document.createElement('input');
      tempInput.value = code;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      success(getText('copy') + '!');
    });
}

/* ---------------------------------------------------------------------
   Export/Import Functionality
   --------------------------------------------------------------------- */
function exportCurrentEqub() {
  const equb = getCurrentEqub();
  if (!equb || equb.creatorId !== state.user?.id) return alert(getText('onlyCreator'));
  
  // Remove sensitive data
  const { creatorId, admins, ...safeEqub } = equb;
  const exportData = { 
    _exportedEqub: true, 
    _version: 8,
    equb: safeEqub, 
    user: state.user ? { 
      name: state.user.name, 
      profilePic: state.user.profilePic 
    } : null, 
    exportedAt: new Date().toISOString() 
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `equb-${equb.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  success(`${getText('exportEqub')}: ${equb.name}`);
}

function importEqub(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported._exportedEqub || !imported.equb) {
        throw new Error('Invalid Equb file');
      }
      
      const equb = imported.equb;
      
      // Validate and prepare imported equb
      equb.id = generateId();
      equb.code = generateUniqueCode();
      equb.creatorId = state.user.id;
      equb.admins = [{ id: state.user.id, name: state.user.name }];
      
      // Process members
      equb.members = (equb.members || []).map(m => ({
        ...m,
        id: m.id || generateId(),
        name: m.name || 'Unknown Member'
      }));
      
      // Ensure required arrays
      equb.payoutOrder = equb.payoutOrder || [];
      equb.contributions = equb.contributions || [];
      equb.payoutHistory = equb.payoutHistory || [];
      equb.activity = equb.activity || [];
      
      state.equbs.push(equb);
      state.currentEqubId = equb.id;
      
      // Import profile picture if available
      if (imported.user?.profilePic) {
        state.user.profilePic = imported.user.profilePic;
      }
      
      saveState();
      success(`${getText('importBtn')}: ${equb.name}`);
      showPage('home');
      
    } catch (err) {
      console.error('Import failed:', err);
      alert(getText('importBtn') + ' error: ' + err.message);
    }
  };
  
  reader.onerror = () => alert('Failed to read file');
  reader.readAsText(file);
}
// Function to convert image to base64 for PDF
function imageToBase64(img) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    
    try {
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    } catch (error) {
      reject(error);
    }
  });
}

/* ---------------------------------------------------------------------
   PDF Export - Professional Clean Design
   --------------------------------------------------------------------- */
async function exportToPDF() {
  const equb = getCurrentEqub();
  if (!equb) return alert('No equb selected');

  if (!window.jspdf) {
    return alert('PDF library not loaded. Please check your internet connection.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');

  // Clean color scheme
  const primaryColor = [59, 130, 246];
  const secondaryColor = [139, 92, 246];
  const successColor = [16, 185, 129];
  const warningColor = [245, 158, 11];
  const dangerColor = [239, 68, 68];
  const textColor = [31, 41, 55];
  const lightGray = [243, 244, 246];
  const borderColor = [229, 231, 235];
  
  const margin = 15;
  let y = margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - (margin * 2);

  // ===== ENHANCED HEADER WITH EMBEDDED LOGO =====
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  try {
    // Try to use the logo from HTML first
    const logoElement = document.querySelector('.welcome-logo');
    
    if (logoElement && logoElement.src && !logoElement.src.includes('data:')) {
      console.log('Trying to use HTML logo:', logoElement.src);
      
      // Create a test image to check if we can load it
      const testImg = new Image();
      testImg.crossOrigin = 'Anonymous';
      testImg.onload = function() {
        try {
          // Try to convert to base64
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = testImg.width;
          canvas.height = testImg.height;
          ctx.drawImage(testImg, 0, 0);
          const logoData = canvas.toDataURL('image/png');
          
          // Add logo to PDF
          doc.addImage(logoData, 'PNG', margin, 8, 20, 20);
        } catch (e) {
          console.log('Canvas conversion failed, using embedded logo');
          addEmbeddedLogo(doc, margin);
        }
      };
      
      testImg.onerror = function() {
        console.log('Image load failed, using embedded logo');
        addEmbeddedLogo(doc, margin);
      };
      
      testImg.src = logoElement.src;
    } else {
      // Use embedded logo
      addEmbeddedLogo(doc, margin);
    }
    
    // Title positioned next to logo
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('EQUB MANAGEMENT REPORT', margin + 25, 15);
    
    // Equb name subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(equb.name, margin + 25, 22);
    
    // Report type and date
    doc.setFontSize(8);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin + 25, 28);
    
  } catch (error) {
    console.log('Logo loading failed:', error);
    addEmbeddedLogo(doc, margin);
    
    // Still add the text
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('EQUB MANAGEMENT REPORT', margin + 25, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(equb.name, margin + 25, 22);
    doc.setFontSize(8);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin + 25, 28);
  }

  y = 45;

  // ===== EQUB BASIC INFORMATION SECTION =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Equb Overview', margin, y);
  
  y += 8;

  // Enhanced equb details in a clean table format
  const equbDetails = [
    ['Equb Name', equb.name],
    ['Status', equb.status.charAt(0).toUpperCase() + equb.status.slice(1)],
    ['Frequency', equb.frequency.charAt(0).toUpperCase() + equb.frequency.slice(1)],
    ['Start Date', new Date(equb.startDate).toLocaleDateString()],
    ['Equb Code', equb.code],
    ['Created By', state.user?.name || 'Unknown']
  ];

  doc.setFontSize(9);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  
  equbDetails.forEach(([label, value], index) => {
    if (y > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      y = margin;
    }
    
    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(margin, y, contentWidth, 7, 'F');
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(label + ':', margin + 3, y + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(String(value), margin + 40, y + 5);
    
    y += 7;
  });

  y += 12;

  // ===== FINANCIAL SUMMARY SECTION =====
  const totalContributions = equb.contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const remaining = Math.max(0, equb.goalAmount - totalContributions);
  const progress = equb.goalAmount ? ((totalContributions / equb.goalAmount) * 100).toFixed(1) : '0.0';
  const totalPayouts = equb.payoutHistory?.length || 0;
  const totalDistributed = equb.payoutHistory?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Financial Summary', margin, y);
  y += 8;

  // Financial metrics in 2-column layout
  const financialData = [
    { 
      label: 'Goal Amount', 
      value: `${formatCurrency(equb.goalAmount)} ETB`,
      color: primaryColor
    },
    { 
      label: 'Total Collected', 
      value: `${formatCurrency(totalContributions)} ETB`,
      color: successColor
    },
    { 
      label: 'Remaining to Goal', 
      value: `${formatCurrency(remaining)} ETB`,
      color: remaining > 0 ? warningColor : successColor
    },
    { 
      label: 'Progress', 
      value: `${progress}%`,
      color: progress >= 100 ? successColor : primaryColor
    },
    { 
      label: 'Total Distributed', 
      value: `${formatCurrency(totalDistributed)} ETB`,
      color: secondaryColor
    },
    { 
      label: 'Payouts Completed', 
      value: `${totalPayouts}`,
      color: textColor
    }
  ];

  const cardWidth = (contentWidth - 10) / 2;
  const cardHeight = 16;
  
  financialData.forEach((item, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = margin + (col * (cardWidth + 10));
    const cardY = y + (row * (cardHeight + 8));
    
    // Clean card design
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'S');
    
    // Colored accent bar at top
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(x, cardY, cardWidth, 3, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(item.label, x + 5, cardY + 8);
    
    doc.setFontSize(9);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.value, x + 5, cardY + 13);
  });

  y += (Math.ceil(financialData.length / 2) * (cardHeight + 8)) + 15;

  // ===== MEMBERS PERFORMANCE SECTION =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Members Performance', margin, y);
  y += 10;

  const headers = ['Name', 'Phone', 'Status', 'Missed', 'Balance', 'Payouts'];
  const colWidths = [40, 35, 22, 18, 25, 20];
  
  // Clean table header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, y, contentWidth, 7, 'F');
  
  let x = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  
  headers.forEach((header, i) => {
    doc.text(header, x + (colWidths[i] / 2), y + 4.5, { align: 'center' });
    x += colWidths[i];
  });

  y += 7;

  const today = toDateOnlyString(new Date());
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);

  equb.members.forEach((member, index) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = margin;
      
      // Repeat header on new page
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, y, contentWidth, 7, 'F');
      
      x = margin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      headers.forEach((header, i) => {
        doc.text(header, x + (colWidths[i] / 2), y + 4.5, { align: 'center' });
        x += colWidths[i];
      });
      y += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    }

    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(margin, y, contentWidth, 6, 'F');
    }

    const paidToday = equb.contributions.some(c => 
      c.userId === member.id && toDateOnlyString(c.date) === today
    );
    const missed = computeMemberMissedCycles(equb, member);
    const balance = missed * equb.contributionAmount;
    const isCreator = member.id === equb.creatorId;
    const payoutCount = equb.payoutHistory?.filter(p => p.recipientId === member.id).length || 0;

    x = margin;
    
    const rowData = [
      member.name + (isCreator ? ' (Owner)' : ''),
      member.phone || '-',
      paidToday ? 'Paid' : 'Pending',
      String(missed),
      balance > 0 ? `-${formatCurrency(balance)}` : 'Clear',
      String(payoutCount)
    ];

    rowData.forEach((cell, colIndex) => {
      const isNumeric = colIndex === 3 || colIndex === 5;
      const align = isNumeric ? 'center' : 'left';
      const padding = colIndex === 0 ? 3 : (isNumeric ? 0 : 3);
      
      // Color coding for status and balances
      if (colIndex === 2) {
        doc.setTextColor(
          paidToday ? successColor[0] : warningColor[0], 
          paidToday ? successColor[1] : warningColor[1], 
          paidToday ? successColor[2] : warningColor[2]
        );
      } else if (colIndex === 4 && balance > 0) {
        doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
      } else {
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      }
      
      doc.text(String(cell), x + padding, y + 3.5, { align });
      x += colWidths[colIndex];
    });

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    y += 6;
  });

  y += 10;

  // ===== PAYOUT HISTORY SECTION =====
  if (equb.payoutHistory && equb.payoutHistory.length > 0) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('Payout History', margin, y);
    y += 8;

    const payoutHeaders = ['Round', 'Recipient', 'Date', 'Amount'];
    const payoutColWidths = [15, 55, 35, 35];
    
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(margin, y, contentWidth, 6, 'F');
    
    x = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    
    payoutHeaders.forEach((header, i) => {
      doc.text(header, x + (payoutColWidths[i] / 2), y + 3.5, { align: 'center' });
      x += payoutColWidths[i];
    });

    y += 6;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    equb.payoutHistory
      .sort((a, b) => b.round - a.round)
      .forEach((payout, index) => {
        if (y > pageHeight - 15) {
          doc.addPage();
          y = margin;
          
          doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          doc.rect(margin, y, contentWidth, 6, 'F');
          
          x = margin;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(255, 255, 255);
          payoutHeaders.forEach((header, i) => {
            doc.text(header, x + (payoutColWidths[i] / 2), y + 3.5, { align: 'center' });
            x += payoutColWidths[i];
          });
          y += 6;
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        }

        if (index % 2 === 0) {
          doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
          doc.rect(margin, y, contentWidth, 5, 'F');
        }

        x = margin;
        const payoutData = [
          String(payout.round),
          payout.recipientName,
          new Date(payout.date).toLocaleDateString(),
          `${formatCurrency(payout.amount)} ETB`
        ];

        payoutData.forEach((cell, colIndex) => {
          const align = colIndex === 0 ? 'center' : 'left';
          doc.text(String(cell), x + 3, y + 3, { align });
          x += payoutColWidths[colIndex];
        });

        y += 5;
      });

    y += 10;
  }

  // ===== PROFESSIONAL FOOTER =====
  const footerY = doc.internal.pageSize.getHeight() - 10;
  
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  
  const generatedBy = `Generated by: ${state.user?.name || 'Unknown User'}`;
  const generatedDate = `Date: ${new Date().toLocaleDateString()}`;
  const pageNumber = `Page: ${doc.internal.getNumberOfPages()}`;
  
  doc.text(generatedBy, margin, footerY - 3);
  doc.text('Equb Management System © 2025', pageWidth / 2, footerY - 3, { align: 'center' });
  doc.text(`${generatedDate} | ${pageNumber}`, pageWidth - margin, footerY - 3, { align: 'right' });

  // ===== SAVE PDF =====
  const fileName = `Equb_${equb.name.replace(/[^\w\s]/gi, '_')}_Report_${toDateOnlyString(new Date())}.pdf`;
  
  setTimeout(() => {
    doc.save(fileName);
    success(getText('exportPDF'));
  }, 100);
}


function addEmbeddedLogo(doc, margin) {
  try {
    // Try this raw URL (main branch)
    const logoUrl = 'https://raw.githubusercontent.com/tadesseAmenu/Equb/main/logo.png';
    
    // Add your GitHub hosted logo to PDF
    doc.addImage(logoUrl, 'PNG', margin, 8, 20 , 20);
    
    console.log('Your GitHub logo loaded successfully!');
    
  } catch (error) {
    console.log('GitHub logo failed, using fallback:', error);
    createEqubFallbackLogo(doc, margin);
  }
}

/* ---------------------------------------------------------------------
   Confetti Animation
   --------------------------------------------------------------------- */
function launchConfetti() {
  const canvas = el('confetti-canvas');
  if (!canvas) return;
  
  canvas.style.display = 'block';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const confetti = [];
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];
  const total = Math.min(300, Math.max(60, Math.floor(window.innerWidth / 3)));

  for (let i = 0; i < total; i++) {
    confetti.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      r: Math.random() * 4 + 1,
      d: Math.random() * 300,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngle: 0
    });
  }

  let animationFrame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let active = false;
    
    confetti.forEach(c => {
      c.tiltAngle += 0.1;
      c.tilt = Math.sin(c.tiltAngle) * 15;
      c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2;
      c.x += Math.sin(c.d);

      if (c.y <= canvas.height) {
        active = true;
        
        ctx.beginPath();
        ctx.lineWidth = c.r;
        ctx.strokeStyle = c.color;
        ctx.moveTo(c.x + c.tilt + c.r / 2, c.y);
        ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r / 2);
        ctx.stroke();
      }
    });

    if (active) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      canvas.style.display = 'none';
    }
  }

  draw();
  
  
  // Auto-cleanup
  setTimeout(() => {
    try { 
      cancelAnimationFrame(animationFrame); 
      canvas.style.display = 'none';
    } catch (e) {}
  }, 5000);
}

/* ---------------------------------------------------------------------
   Particles Background
   --------------------------------------------------------------------- */
let particlesCreated = false;

function createParticles(n = 30) {
  if (particlesCreated) return;
  particlesCreated = true;
  
  const container = el('particles');
  if (!container) return;
  
  // Limit particles on mobile
  const limit = window.innerWidth < 600 ? Math.min(n, 15) : n;
  
  for (let i = 0; i < limit; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    
    // Random size and position
    const size = Math.random() * 3 + 1;
    p.style.width = p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100 + 100}%`;
    p.style.animationDelay = `${Math.random() * 10}s`;
    p.style.animationDuration = `${Math.random() * 5 + 5}s`;
    
    // Size classes for different animations
    if (size < 1.5) p.classList.add('pxs');
    else if (size < 2.5) p.classList.add('psm');
    else p.classList.add('plg');
    
    container.appendChild(p);
  }
}

/* ---------------------------------------------------------------------
   URL Join Handling
   --------------------------------------------------------------------- */
function handleURLJoin() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('join');
  
  if (code && state.user) {
    if (el('equb-code')) el('equb-code').value = code;
    
    // Small delay to ensure UI is ready
    setTimeout(() => {
      joinEqub();
      // Clean URL
      history.replaceState(null, '', window.location.pathname);
    }, 100);
  }
}

/* ---------------------------------------------------------------------
   Template Management
   --------------------------------------------------------------------- */
function saveTemplate() {
  const name = el('template-name')?.value?.trim();
  if (!name) return alert('Enter template name');
  
  const equb = getCurrentEqub();
  if (!equb) return alert('No equb selected');
  
  const template = {
    id: generateId(),
    name,
    frequency: equb.frequency,
    targetMembers: equb.targetMembers,
    goalAmount: equb.goalAmount,
    contributionAmount: equb.contributionAmount
  };
  
  state.templates.push(template);
  saveState();
  
  if (el('template-name')) el('template-name').value = '';
  success(getText('templateSaved'));
}

/* ---------------------------------------------------------------------
   Global UI Refresh
   --------------------------------------------------------------------- */
function updateAllUI() {
  // Apply theme
  if (state.user?.theme) {
    document.body.setAttribute('data-theme', state.user.theme);
  } else {
    document.body.removeAttribute('data-theme');
  }

  // Apply language
  const currentLang = state.user?.language || 'en';
  document.body.setAttribute('data-lang', currentLang);

  // Update all text content with proper language handling
  document.querySelectorAll('[data-key]').forEach(element => {
    const key = element.getAttribute('data-key');
    const translated = getText(key);
    if (translated && translated !== key) {
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.placeholder = translated;
      } else {
        element.textContent = translated;
      }
    }
  });

  // Update select options based on language
  document.querySelectorAll('select.form-field').forEach(select => {
    Array.from(select.options).forEach(option => {
      const key = option.textContent.trim();
      const translated = getText(key);
      if (translated && translated !== key) {
        option.textContent = translated;
      }
    });
  });

  // Refresh all page content
  try { updateProfile(); } catch (e) { console.warn('updateProfile failed', e); }
  try { updateMyEqubs(); } catch (e) { console.warn('updateMyEqubs failed', e); }
  
  const currentEqub = getCurrentEqub();
  if (currentEqub) {
    try { updateHome(); } catch (e) { console.warn('updateHome failed', e); }
    try { updateMembers(); } catch (e) { console.warn('updateMembers failed', e); }
    try { updateActivity(); } catch (e) { console.warn('updateActivity failed', e); }
  }
}

/* ---------------------------------------------------------------------
   Initialization
   --------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Create background particles
  createParticles(50);

  // Apply saved theme
  if (state.user?.theme) {
    document.body.setAttribute('data-theme', state.user.theme);
  }

  // Set up dark mode toggle
  const dm = el('dark-mode-toggle');
  if (dm) {
    dm.checked = state.user?.theme === 'dark';
    dm.addEventListener('change', e => toggleDarkMode(e.target.checked));
  }

  // Set up file uploads
  const upload = el('upload-pic');
  if (upload) upload.addEventListener('change', uploadProfilePic);

  const importFile = el('import-file');
  if (importFile) importFile.addEventListener('change', importEqub);

  // Set up contribution member selection
  const contribSelect = el('contribution-member');
  if (contribSelect) contribSelect.addEventListener('change', updateRequiredAmount);

  // FIXED: AUTO-CALCULATION FOR CONTRIBUTION AMOUNT
  const goalInputs = ['create-goal-amount', 'create-target-members'];
  goalInputs.forEach(id => {
    const input = el(id);
    if (input) {
      input.addEventListener('input', calculateContribution);
    }
  });

  // FIXED: LANGUAGE SELECTORS
  const languageSelectors = ['welcome-language-select', 'auth-language-select', 'profile-language-select'];
  languageSelectors.forEach(id => {
    const selector = el(id);
    if (selector) {
      selector.value = state.user?.language || 'en';
      selector.addEventListener('change', (e) => {
        setLanguage(e.target.value);
      });
    }
  });

  // Set up confirmation dialog buttons
  const yesBtn = el('confirmation-yes');
  const noBtn = el('confirmation-no');
  if (yesBtn) yesBtn.onclick = () => confirmationCallback && confirmationCallback(true);
  if (noBtn) noBtn.onclick = () => confirmationCallback && confirmationCallback(false);

  // Initialize auth UI
  setAuthMode('login');

  // Render initial UI state
  updateAllUI();

  // Show appropriate initial page
  if (state.user) {
    showPage('myequbs');
  } else {
    showPage('welcome');
  }

  // Handle join codes from URL
  handleURLJoin();

  // Add resize handler for responsive adjustments
  window.addEventListener('resize', () => {
    const canvas = el('confetti-canvas');
    if (canvas && canvas.style.display === 'block') {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });

  console.log('Equb App v8.3 initialized successfully - All fixes applied');
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCurrentEqub,
    showToast,
    updateAllUI
  };
}

/* End of script.js v8.3 - FIXED EDITION */
