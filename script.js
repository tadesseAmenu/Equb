// script.js – Equb App v8.0 (Complete & Polished Edition)

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
    alert('Failed to save data. Storage might be full.');
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
    language: 'am',
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
  const lang = state.user?.language || 'am';

  const translations = {
    welcomeTitle: { en: "Equb", am: "እቁብ" },
    welcomeSub: { en: "Community Savings, Together.", am: "አብረን እንቆጥብ፣ አብረን እንዘምት!" },
    getStarted: { en: "Get Started", am: "ጀምር" },
    myEqubs: { en: "My Equbs", am: "የእኔ እቁቦች" },
    home: { en: "Home", am: "ዋና" },
    membersTitle: { en: "Members", am: "አባላት" },
    activity: { en: "Activity", am: "እንቅስቃሴ" },
    profile: { en: "Profile", am: "መለያ" },
    logout: { en: "Logout", am: "ውጣ" },

    selectEqub: { en: "Select an Equb", am: "እቁብ ምረጥ" },
    goal: { en: "Goal: {0} ETB", am: "ግብ፡ {0} ብር" },
    members: { en: "Members: {0}/{1}", am: "አባላት፡ {0}/{1}" },
    contribution: { en: "Contribution: {0} ETB", am: "አስተዋጽኦ፡ {0} ብር" },
    progress: { en: "{0}% of goal reached", am: "{0}% ተጠናቀቀ" },
    status: { en: "Status: {0}", am: "ሁኔታ፡ {0}" },
    round: { en: "Round: {0} of {1}", am: "ዙር፡ {0} ከ {1}" },
    todayPayments: { en: "Today's Payments ({0})", am: "የዛሬ ክፍያዎች ({0})" },
    paid: { en: "Paid", am: "ተከፍሏል" },
    notPaid: { en: "Not Paid", am: "አልተከፈለም" },

    noEqubs: { en: "No Equbs yet — create or join one", am: "እቁብ የለም — ፍጠር ወይም ተቀላቀል" },
    createEqub: { en: "Create Equb", am: "እቁብ ፍጠር" },
    joinEqub: { en: "Join Equb", am: "እቁብ ተቀላቀል" },

    noMembers: { en: "No members yet", am: "አባላት የሉም" },
    invite: { en: "Invite", am: "ጋብዝ" },

    noActivity: { en: "No activity yet", am: "እንቅስቃሴ የለም" },

    login: { en: "Login", am: "ግባ" },
    signup: { en: "Signup", am: "ተመዝገብ" },
    name: { en: "Name", am: "ስም" },
    email: { en: "Email", am: "ኢሜይል" },
    password: { en: "Password", am: "የይለፍ ቃል" },
    confirm: { en: "Confirm Password", am: "ደግሞ ተመዝገብ" },
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
    editTitle: { en: "Edit Equb", am: "እቁብ አስተካክል" },
    freq: { en: "Frequency", am: "ድግግሞሽ" },
    target: { en: "Target Members", am: "የአባላት ቁጥር" },
    goalAmt: { en: "Goal Amount (ETB)", am: "የግብ መጠን (ብር)" },
    contrib: { en: "Contribution (ETB)", am: "አስተዋጽኦ (ብር)" },
    startDate: { en: "Start Date", am: "መጀመሪያ ቀን" },
    create: { en: "Create", am: "ፍጠር" },
    save: { en: "Save", am: "አስቀምጥ" },
    cancel: { en: "Cancel", am: "ሰርዝ" },

    joinTitle: { en: "Join Equb", am: "እቁብ ተቀላቀል" },
    joinCode: { en: "Enter Code (EQ-XXXX-2025)", am: "ኮድ አስገባ (EQ-XXXX-2025)" },
    join: { en: "Join", am: "ተቀላቀል" },

    inviteTitle: { en: "Invite to Equb", am: "ወደ እቁብ ጋብዝ" },
    shareCode: { en: "Share this code:", am: "ይህን ኮድ አጋራ፡" },
    inviteMessage: { en: "Join the fun Equb with this code:", am: "ይህን ኮድ ተጠቅመህ ወደ እቁብ ጀብዱ ተቀላቀል፡" },
    copy: { en: "Copy", am: "ቅዳ" },
    close: { en: "Close", am: "ዝጋ" },

    contributeTitle: { en: "Contribute", am: "አስተዋጽኦ አድርግ" },
    selectMember: { en: "Select Member", am: "አባል ምረጥ" },
    amount: { en: "Amount (ETB)", am: "መጠን (ብር)" },

    exportBtn: { en: "Export Equb", am: "እቁብ ላክ" },
    importBtn: { en: "Import Equb", am: "እቁብ አስገባ" },

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

    removeMember: { en: "Remove", am: "አስወግድ" },
    templateSaved: { en: "Template saved!", am: "አብነት ተቀመጠ!" },
    darkMode: { en: "Dark Mode", am: "ጨለማ ሁነታ" },
    exportPDF: { en: "Export to PDF", am: "ወደ PDF ላክ" },
    qrJoin: { en: "Join via QR", am: "በQR ተቀላቀል" },
    today: { en: "Today", am: "ዛሬ" },
    yesterday: { en: "Yesterday", am: "ትናንት" },
    thisWeek: { en: "This Week", am: "በዚህ ሳምንት" },
    missedDays: { en: "Missed {0} days ({1} ETB)", am: "{0} ቀናት ተዘለለ ({1} ብር)" },
    youAreCreator: { en: "You are the creator", am: "አንተ ፈጣሪው ነህ" },
    youAreMember: { en: "You are a member", am: "አንተ አባል ነህ" },
    edit: { en: "Edit", am: "አስተካክል" },
    delete: { en: "Delete", am: "ሰርዝ" },
    view: { en: "View", am: "ተመልከት" },
    deleteConfirm: { en: "Delete this Equb?", am: "ይህን እቁብ ሰርዝ?" },
    phone: { en: "Phone Number", am: "ስልክ ቁጥር" },
    owner: { en: "(Owner)", am: "(ፈጣሪ)" },
    transferredOwnership: { en: "Transferred ownership to {0}", am: "ባለቤትነት ወደ {0} ተላለፈ" },
    memberRemoved: { en: "Member removed!", am: "አባል ተወግዷል!" },
    equbDeleted: { en: "Equb deleted!", am: "እቁብ ተሰርዟል!" },
    ownershipTransferred: { en: "Ownership transferred!", am: "ባለቤትነት ተላልፏል!" },
    payoutTitle: { en: "Payout Round", am: "ዙር ይክፈሉ" },
    payout: { en: "Payout", am: "ይክፈሉ" },
    selectRecipient: { en: "Select Recipient", am: "ተቀባይ ይምረጡ" },
    payoutSuccess: { en: "Payout done!", am: "ክፍያ ተጠናቀቀ!" },
    editPayoutOrder: { en: "Edit Payout Order", am: "የክፍያ ቅደም ተከተል ያርትዑ" },
    up: { en: "Up", am: "ወደ ላይ" },
    down: { en: "Down", am: "ወደ ታች" },
    dragToReorder: { en: "Drag to reorder", am: "ለማስተካከል ጎትት" }
  };

  const text = translations[key]?.[lang] || key;
  return text.replace(/\{(\d+)\}/g, (_, i) => args[i] ?? '');
}

/* ---------------------------------------------------------------------
   Language & Theme Management
   --------------------------------------------------------------------- */
function setLanguage(lang) {
  if (!state.user) return;
  state.user.language = lang;
  document.body.setAttribute('data-lang', lang);
  saveState();
  updateAllUI();
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
    case 'qr':
      showQRCode();
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

function calculateContribution() {
  const goalEl = el('create-goal-amount') || el('edit-goal-amount');
  const targetEl = el('create-target-members') || el('edit-target-members');
  const contribEl = el('create-contribution-amount') || el('edit-contribution-amount');
  
  if (!goalEl || !targetEl || !contribEl) return;
  
  const goal = parseFloat(goalEl.value) || 0;
  const target = parseInt(targetEl.value) || 0;
  
  if (goal > 0 && target >= 2 && (!contribEl.value || contribEl.value === '0')) {
    contribEl.value = (goal / target).toFixed(2);
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
  if (new Date(startDate) < new Date().setHours(0,0,0,0)) {
    return alert('Start date cannot be in the past');
  }

  const id = generateId();
  const code = generateUniqueCode();
  const newEqub = {
    id, code, name, frequency, creatorId: state.user.id,
    admins: [{ id: state.user.id, name: state.user.name }],
    members: [{ id: state.user.id, name: state.user.name, joinedAt: new Date().toISOString() }],
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
  success(getText('editTitle') + ' updated!');
  updateMyEqubs();
  if (state.currentEqubId === equb.id) updateHome();
}

function deleteEqub(equbId) {
  const equb = state.equbs.find(e => e.id === equbId);
  if (!equb || equb.creatorId !== state.user.id) return;
  
  if (!confirm(getText('deleteConfirm') || 'Delete this Equb?')) return;
  
  state.equbs = state.equbs.filter(e => e.id !== equbId);
  if (state.currentEqubId === equbId) state.currentEqubId = null;
  
  pushActivity(`Deleted "${equb.name}"`);
  saveState();
  success(getText('equbDeleted'));
  updateMyEqubs();
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
   Member Management
   --------------------------------------------------------------------- */
function addMember() {
  const nameInput = el('add-member-name');
  const name = nameInput?.value?.trim();
  const phone = el('add-member-phone')?.value?.trim();
  
  if (!name) return alert('Member name is required');
  if (!phone) return alert('Phone number is required');
  
  const equb = getCurrentEqub();
  if (!equb || equb.creatorId !== state.user.id) return alert(getText('onlyCreator'));
  if (equb.status === 'completed') return alert(getText('completed'));
  if (equb.members.length >= equb.targetMembers) return alert(getText('equbFull'));
  if (equb.members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    return alert('Member with this name already exists');
  }

  const newMember = { 
    id: generateId(), 
    name, 
    phone, 
    joinedAt: new Date().toISOString() 
  };
  
  equb.members.push(newMember);
  
  // Auto-activate if full
  if (equb.members.length === equb.targetMembers && equb.status === 'forming') {
    equb.status = 'active';
    equb.payoutOrder = shuffleArray(equb.members.map(m => ({ ...m })));
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
  const equb = getCurrentEqub();
  if (!equb || equb.creatorId !== state.user.id) return alert(getText('onlyCreator'));
  
  const member = equb.members.find(m => m.id === memberId);
  if (!member) return;
  
  if (!confirm(`Remove ${member.name} from this Equb?`)) return;
  
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
   Contribution Management
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
  const total = equb.contributionAmount + missed * equb.contributionAmount;
  
  if (el('required-amount')) el('required-amount').textContent = formatCurrency(total);
  if (el('missed-count')) el('missed-count').textContent = missed;
  if (el('required-amount-display')) el('required-amount-display').style.display = 'block';
  
  // Auto-fill amount field
  if (el('contribute-amount')) {
    el('contribute-amount').value = total.toFixed(2);
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
  
  if (Math.abs(amount - required) > 0.001) {
    return alert(getText('mustPayExact', formatCurrency(required)));
  }
  
  const today = toDateOnlyString(new Date());
  const alreadyPaid = (equb.contributions || []).some(c => 
    c.userId === memberId && toDateOnlyString(c.date) === today
  );
  
  if (equb.frequency === 'daily' && alreadyPaid) {
    return alert('Already paid today');
  }

  equb.contributions = equb.contributions || [];
  equb.contributions.push({ 
    amount, 
    userId: memberId, 
    date: new Date().toISOString() 
  });
  
  pushActivity(`${member.name} paid ${formatCurrency(amount)} ETB`, equb.id);

  // Update progress
  const total = equb.contributions.reduce((s, c) => s + (c.amount || 0), 0);
  equb.progress = equb.goalAmount ? Math.min(100, (total / equb.goalAmount) * 100) : 0;
  
  saveState();
  closeModal('contribute');
  success(getText('paidSuccess'));
  updateHome();
  updateMembers();

  // Celebrate goal completion
  if (equb.progress >= 100 && !equb.celebrated) {
    equb.celebrated = true;
    launchConfetti();
    success(getText('goalReached'));
  }
}

/* ---------------------------------------------------------------------
   Payment Cycle Calculations
   --------------------------------------------------------------------- */
function computeMemberMissedCycles(equb, member) {
  if (!equb || !member || equb.status !== 'active') return 0;
  
  const today = new Date(); 
  today.setHours(0,0,0,0);
  
  // Determine cycle interval based on frequency
  let cycleMs;
  switch (equb.frequency) {
    case 'daily': cycleMs = 24 * 60 * 60 * 1000; break;
    case 'weekly': cycleMs = 7 * 24 * 60 * 60 * 1000; break;
    case 'monthly': cycleMs = 30 * 24 * 60 * 60 * 1000; break;
    case 'yearly': cycleMs = 365 * 24 * 60 * 60 * 1000; break;
    default: return 0;
  }
  
  const memberContributions = (equb.contributions || [])
    .filter(c => c.userId === member.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const lastPayment = memberContributions.length ? 
    new Date(memberContributions[0].date) : 
    new Date(member.joinedAt);
  
  lastPayment.setHours(0,0,0,0);
  
  // Calculate missed cycles since last payment
  const msSinceLastPayment = today - lastPayment;
  const missedCycles = Math.floor(msSinceLastPayment / cycleMs);
  
  return Math.max(0, missedCycles);
}

/* ---------------------------------------------------------------------
   Payout Management
   --------------------------------------------------------------------- */
function populatePayoutRecipients() {
  const select = el('payout-recipient');
  if (!select) return;
  
  select.innerHTML = '<option value="">' + getText('selectRecipient') + '</option>';
  
  const equb = getCurrentEqub();
  if (!equb) return;
  
  // Find members who haven't received payout yet
  const eligible = (equb.members || []).filter(m => 
    !(equb.payoutHistory || []).some(p => p.recipientId === m.id)
  );
  
  eligible.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = escapeHtml(m.name);
    select.appendChild(opt);
  });
}

function performPayout() {
  const recipientId = el('payout-recipient')?.value;
  const equb = getCurrentEqub();
  
  if (!equb || equb.creatorId !== state.user?.id || !recipientId) {
    return alert('Invalid payout request');
  }
  
  const recipient = equb.members.find(m => m.id === recipientId);
  if (!recipient) return alert('Recipient not found');
  
  equb.payoutHistory = equb.payoutHistory || [];
  const round = equb.payoutHistory.length + 1;
  
  equb.payoutHistory.push({ 
    round, 
    recipientId, 
    recipientName: recipient.name,
    date: new Date().toISOString(),
    amount: equb.goalAmount / equb.targetMembers
  });
  
  pushActivity(
    `${recipient.name} received payout for round ${round} (${formatCurrency(equb.goalAmount / equb.targetMembers)} ETB)`, 
    equb.id
  );
  
  // Reset for next cycle
  equb.progress = 0;
  equb.contributions = [];
  equb.celebrated = false;
  
  // Complete equb if all members received payout
  if (equb.payoutHistory.length === equb.targetMembers) {
    equb.status = 'completed';
    pushActivity(`Equb "${equb.name}" completed!`, equb.id);
  }
  
  saveState();
  closeModal('payout');
  success(getText('payoutSuccess'));
  updateHome();
  updateMembers();
}

/* ---------------------------------------------------------------------
   Payout Order Management (Drag & Drop)
   --------------------------------------------------------------------- */
function populatePayoutOrderList() {
  const list = el('payout-order-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  const equb = getCurrentEqub();
  if (!equb) return;
  
  // Initialize payout order if not set
  equb.payoutOrder = equb.payoutOrder || shuffleArray(equb.members.map(m => ({ ...m })));
  
  equb.payoutOrder.forEach((member, index) => {
    const item = document.createElement('div');
    item.className = 'payout-order-item';
    item.draggable = true;
    item.dataset.index = index;
    item.dataset.memberId = member.id;
    
    item.innerHTML = `
      <span class="drag-handle" aria-label="${getText('dragToReorder')}">⋮⋮</span>
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
  if (msg.includes('edited') || /አስተካከለ/.test(msg)) return '✏️';
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
  
  return state.equbs.find(e =>
    e.id === state.currentEqubId &&
    (e.creatorId === state.user.id || 
     (Array.isArray(e.members) && e.members.some(m => m.id === state.user.id)))
  ) || null;
}

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
  setText('progress-remaining', `${formatCurrency(remaining)} ETB left`);

  setText('status', getText('status', getText(equb.status)));
  setText('current-round', String((equb.payoutHistory || []).length + 1));
  setText('total-rounds', String(equb.targetMembers || 0));

  // Update daily payments section
  const dailyDiv = el('daily-payments');
  if (equb.frequency === 'daily' && dailyDiv) {
    dailyDiv.style.display = 'block';
    setText('current-date', new Date().toLocaleDateString());
    
    const list = el('payments-list');
    if (list) {
      list.innerHTML = '';
      const today = toDateOnlyString(new Date());
      
      (equb.members || []).forEach(m => {
        const paid = (equb.contributions || []).some(c => 
          c.userId === m.id && toDateOnlyString(c.date) === today
        );
        
        const div = document.createElement('div');
        div.className = `payment-status ${paid ? 'paid' : 'not-paid'}`;
        div.innerHTML = `
          <span>${escapeHtml(m.name)}</span>
          <span>${paid ? getText('paid') : getText('notPaid')}</span>
        `;
        list.appendChild(div);
      });
    }
  } else if (dailyDiv) {
    dailyDiv.style.display = 'none';
  }
}

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
    
    let html = `
      <p style="font-weight:600">
        ${escapeHtml(member.name)} 
        ${isOwner ? `<small>${getText('owner')}</small>` : ''}
        ${hasPayout ? '💰' : ''}
      </p>
      <p>${getText('phone')}: ${escapeHtml(member.phone || '-')}</p>
      <p>${getText('editPayoutOrder')}: #${payoutOrderIndex + 1}</p>
    `;

    // Add payment status for daily equbs
    if (equb.frequency === 'daily') {
      const today = toDateOnlyString(new Date());
      const paid = (equb.contributions || []).some(c => 
        c.userId === member.id && toDateOnlyString(c.date) === today
      );
      const missed = computeMemberMissedCycles(equb, member);
      
      if (paid) {
        html += `<div class="payment-status paid">${getText('paid')}</div>`;
      } else if (missed > 0) {
        const amt = (missed * equb.contributionAmount);
        html += `<div class="payment-status not-paid">${getText('missedDays', missed, formatCurrency(amt))}</div>`;
      } else {
        html += `<div class="payment-status not-paid">${getText('notPaid')}</div>`;
      }
    } else {
      html += `<p>${getText('memberSince')}: ${new Date(member.joinedAt).toLocaleDateString()}</p>`;
    }

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
    const langSelect = el('language-select');
    if (langSelect) {
      langSelect.value = state.user.language || 'am';
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
  if (nameField) nameField.style.display = isSignup ? 'block' : 'none';
  if (confirmField) confirmField.style.display = isSignup ? 'block' : 'none';

  // Update switch button
  const switchBtn = el('auth-switch');
  if (switchBtn) {
    switchBtn.textContent = getText(isSignup ? 'login' : 'signup');
    switchBtn.onclick = () => setAuthMode(isSignup ? 'login' : 'signup');
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

function logout() {
  if (!confirm('Are you sure you want to logout?')) return;
  
  state.user = null;
  saveState();
  success('Logged out');
  showPage('welcome');
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
    setText('share-code', getText('inviteMessage'));
  }
}

function copyInviteCode() {
  const code = el('invite-code')?.textContent;
  if (!code) return;
  
  const shareData = {
    title: getText('inviteTitle'),
    text: `${getText('inviteMessage')} ${code}`,
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
   QR Code Generation
   --------------------------------------------------------------------- */
function showQRCode() {
  const equb = getCurrentEqub();
  if (!equb) return;
  
  const url = `${window.location.origin}${window.location.pathname}?join=${equb.code}`;
  
  if (window.QRCode) {
    const canvas = el('qr-canvas');
    if (canvas) {
      QRCode.toCanvas(canvas, url, { width: 200 }, err => {
        if (err) {
          console.error('QR generation failed:', err);
          fallbackQR(url);
        } else {
          showModal('qr');
        }
      });
    }
  } else {
    fallbackQR(url);
  }
}

function fallbackQR(url) {
  // Fallback: show URL in invite modal
  setText('invite-code', url);
  showModal('invite');
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
  
  success(`${getText('exportBtn')}: ${equb.name}`);
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

/* ---------------------------------------------------------------------
   PDF Export
   --------------------------------------------------------------------- */
function exportToPDF() {
  const equb = getCurrentEqub();
  if (!equb) return alert('No equb selected');

  if (!window.jspdf) {
    return alert('PDF library not loaded. Please check your internet connection.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');

  const margin = 15;
  let y = margin;

  // Header
  doc.setFillColor(56, 189, 248);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('E Q U B  -  Report', 105, 18, { align: 'center' });

  y = 40;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Equb Name: ${equb.name}`, margin, y);
  y += 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');

  const totalContributions = equb.contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const remaining = Math.max(0, equb.goalAmount - totalContributions);
  const progress = equb.goalAmount ? ((totalContributions / equb.goalAmount) * 100).toFixed(1) : '0.0';

  const summaryData = [
    ['Goal Amount', `${formatCurrency(equb.goalAmount)} ETB`],
    ['Total Collected', `${formatCurrency(totalContributions)} ETB`],
    ['Remaining', `${formatCurrency(remaining)} ETB`],
    ['Contribution per Member', `${formatCurrency(equb.contributionAmount)} ETB`],
    ['Target Members', `${equb.targetMembers}`],
    ['Current Members', `${equb.members.length}`],
    ['Progress', `${progress}%`],
    ['Status', getText(equb.status)]
  ];

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  summaryData.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(val), 120, y);
    y += 7;
  });

  y += 5;
  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.3);
  doc.line(margin, y, 210 - margin, y);
  y += 10;

  // Members table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Members Overview', margin, y);
  y += 8;

  doc.setFontSize(12);
  const headers = ['#', 'Name', 'Phone', 'Joined', 'Paid Today', 'Missed Days', 'Missed Amount'];
  const colWidths = [8, 40, 35, 30, 20, 20, 35];

  let x = margin;
  doc.setFont('helvetica', 'bold');
  headers.forEach((h, i) => {
    doc.text(h, x, y);
    x += colWidths[i];
  });
  y += 6;
  doc.setFont('helvetica', 'normal');

  const today = toDateOnlyString(new Date());
  const pageHeight = doc.internal.pageSize.getHeight();

  equb.members.forEach((m, i) => {
    const paid = equb.contributions.some(c => c.userId === m.id && toDateOnlyString(c.date) === today);
    const missed = computeMemberMissedCycles(equb, m);
    const missedAmt = missed * equb.contributionAmount;

    if (y > pageHeight - 20) {
      doc.addPage();
      y = margin + 5;
    }

    x = margin;
    const row = [
      String(i + 1),
      m.name,
      m.phone || '-',
      new Date(m.joinedAt).toLocaleDateString(),
      paid ? 'Yes' : 'No',
      String(missed),
      missedAmt ? formatCurrency(missedAmt) + ' ETB' : '-'
    ];

    row.forEach((cell, idx) => {
      doc.text(String(cell), x, y);
      x += colWidths[idx];
    });
    y += 7;
  });

  y += 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Exported by: ${state.user?.name || 'Unknown User'}`, margin, y);
  y += 5;
  doc.text(`Date: ${new Date().toLocaleString()}`, margin, y);

  // Add profile picture if available
  if (state.user?.profilePic) {
    try {
      doc.addImage(state.user.profilePic, 'JPEG', 170, 10, 25, 25);
    } catch (e) {
      console.warn('Profile image skipped:', e);
    }
  }

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(10);
  doc.setTextColor(56, 189, 248);
  doc.text('Generated by Equb App © 2025', 105, 285, { align: 'center' });

  doc.save(`Equb-${equb.name.replace(/\s+/g, '_')}-${toDateOnlyString(new Date())}.pdf`);
  success(getText('exportPDF'));
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
  if (state.user?.language) {
    document.body.setAttribute('data-lang', state.user.language);
  }

  // Update all text content
  document.querySelectorAll('[id]').forEach(element => {
    const id = element.id;
    if (id.startsWith('welcome-') || id.includes('title') || id.includes('Text')) {
      const key = id.replace(/-/g, '').replace('title', 'Title').replace('text', '');
      const text = getText(key);
      if (text && text !== key) {
        element.textContent = text;
      }
    }
  });

  // Update navigation text
  document.querySelectorAll('.nav-text').forEach((element, index) => {
    const texts = ['home', 'myEqubs', 'membersTitle', 'activity', 'profile'];
    if (texts[index]) {
      element.textContent = getText(texts[index]);
    }
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

  // Set up auto-calculation for contribution amount
  const goalInputs = ['create-goal-amount', 'edit-goal-amount', 'create-target-members', 'edit-target-members'];
  goalInputs.forEach(id => {
    const input = el(id);
    if (input) {
      input.addEventListener('input', calculateContribution);
    }
  });

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

  console.log('Equb App v8.0 initialized successfully');
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCurrentEqub,
    showToast,
    updateAllUI
  };
}

/* End of script.js v8.0 */
