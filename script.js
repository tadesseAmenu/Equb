// script.js - Equb App v2.8
// Logo on Welcome + Profile Pic in Export/Import + Centered UI

let state = loadState();
let authMode = 'login';

function el(id) { return document.getElementById(id); }
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[s]);
}
function toDateOnlyString(date) { return new Date(date).toISOString().slice(0, 10); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// ---------- Toast ----------
function showToast(message, type = 'success') {
  const container = el('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="emoji">${type === 'success' ? 'Success' : 'Error'}</span> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
function alert(message) { showToast(message, 'error'); }
function success(message) { showToast(message, 'success'); }

// ---------- Profile Picture ----------
function uploadProfilePic(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = el('profile-pic');
    img.src = e.target.result;
    img.style.display = 'block';
    el('profile-pic-placeholder').style.display = 'none';
    if (state.user) {
      state.user.profilePic = e.target.result;  // Save Base64 to state
      saveState();
      success(getText('uploadPhoto') + ' updated!');
    }
  };
  reader.readAsDataURL(file);
}

// ---------- State ----------
function getDefaultState() {
  return { _version: 2, user: null, equbs: [], currentEqubId: null, history: [], activity: [] };
}
function loadState() {
  try {
    const raw = localStorage.getItem('equbState');
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return getDefaultState();
    parsed.equbs = (parsed.equbs || []).map(e => ({
      ...e,
      contributions: e.contributions || [],
      payoutHistory: e.payoutHistory || [],
      members: e.members || [],
      activity: e.activity || [],
    }));
    parsed.history = parsed.history || [];
    parsed.activity = parsed.activity || [];
    return parsed;
  } catch (err) {
    console.error('Load failed:', err);
    return getDefaultState();
  }
}
function saveState() {
  try { localStorage.setItem('equbState', JSON.stringify(state)); }
  catch (err) { console.error('Save failed:', err); }
}

// ---------- Translation Helper ----------
function getText(key) {
  const lang = state.user?.language || 'en';
  const am = {
    welcomeTitle: "እቁብ", welcomeSub: "የህብረተሰብ ቁጠባ፣ አብረን።", getStarted: "ጀምር",
    selectEqub: "እቁብ ምረጥ", goal: "ግብ፡ {0} ብር", members: "አባላት፡ {0}/{1}",
    contribution: "አስተዋጽኦ፡ {0} ብር", progress: "{0}% ተጠናቀቀ", status: "ሁኔታ፡ {0}",
    round: "ዙር፡ {0} ከ {1}", todayPayments: "የዛሬ ክፍያዎች ({0})", paid: "ተከፍሏል", notPaid: "አልተከፈለም",
    myEqubs: "የእኔ እቁቦች", noEqubs: "እቁብ የለም — ፍጠር ወይም ተቀላቀል", createEqub: "እቁብ ፍጠር", joinEqub: "እቁብ ተቀላቀል",
    membersTitle: "አባላት", noMembers: "አባላት የሉም", invite: "ጋብዝ",
    activity: "እንቅስቃሴ", noActivity: "እንቅስቃሴ የለም",
    login: "ግባ", signup: "ተመዝገብ", name: "ስም", email: "ኢሜይል", password: "የይለፍ ቃል", confirm: "ደግሞ",
    submit: "አስገባ", switchTo: "ወደ {0} ቀይር", memberSince: "አባል ከ {0}", uploadPhoto: "ፎቶ ስቀል",
    language: "ቋንቋ", pin: "ፒን", logout: "ውጣ", history: "ታሪክ", noHistory: "ታሪክ የለም",
    createTitle: "እቁብ ፍጠር", freq: "ድግግሞሽ", target: "የአባላት ቁጥር", goalAmt: "ግብ (ብር)", contrib: "አስተዋጽኦ", startDate: "መጀመሪያ", create: "ፍጠር", cancel: "ሰርዝ",
    editTitle: "እቁብ አስተካክል", save: "አስቀምጥ", joinTitle: "እቁብ ተቀላቀል", joinCode: "ኮድ አስገባ", join: "ተቀላቀል",
    inviteTitle: "ጋብዝ", shareCode: "ኮድ አጋራ", copy: "ቅዳ", close: "ዝጋ",
    contributeTitle: "አስተዋጽኦ", selectMember: "አባል ምረጥ", amount: "መጠን (ብር)",
    exportBtn: "እቁብ ላክ", importBtn: "እቁብ አስገባ"
  };
  if (lang === 'am' && am[key]) {
    return am[key].replace(/\{(\d+)\}/g, (_, i) => arguments[i + 1] ?? '');
  }
  const en = {
    welcomeTitle: "Equb", welcomeSub: "Community Savings, Together.", getStarted: "Get Started",
    selectEqub: "Select an Equb", goal: "Goal: {0} ETB", members: "Members: {0}/{1}",
    contribution: "Contribution: {0} ETB each", progress: "{0}% of goal reached", status: "Status: {0}",
    round: "Round: {0} of {1}", todayPayments: "Today's Payments ({0})", paid: "Paid", notPaid: "Not Paid",
    myEqubs: "My Equbs", noEqubs: "No Equbs yet — create or join one", createEqub: "Create Equb", joinEqub: "Join Equb",
    membersTitle: "Members", noMembers: "No members yet", invite: "Invite",
    activity: "Activity Feed", noActivity: "No activity yet",
    login: "Login", signup: "Signup", name: "Name (Signup only)", email: "Email or Phone", password: "Password", confirm: "Confirm Password",
    submit: "Submit", switchTo: "Switch to {0}", memberSince: "Member since {0}", uploadPhoto: "Upload Photo",
    language: "Language", pin: "PIN/Biometrics", logout: "Logout", history: "History", noHistory: "No history yet",
    createTitle: "Create Equb", freq: "Frequency", target: "Target Members", goalAmt: "Goal Amount (ETB)", contrib: "Contribution (editable)", startDate: "Start Date", create: "Create", cancel: "Cancel",
    editTitle: "Edit Equb", save: "Save", joinTitle: "Join Equb", joinCode: "Enter Code (EQ-XXXX-2025)", join: "Join",
    inviteTitle: "Invite to Equb", shareCode: "Share this code:", copy: "Copy Code", close: "Close",
    contributeTitle: "Contribute", selectMember: "Select Member", amount: "Amount (ETB)",
    exportBtn: "Export Current Equb", importBtn: "Import Equb"
  };
  let text = en[key] || key;
  for (let i = 1; i < arguments.length; i++) {
    text = text.replace(`{${i-1}}`, arguments[i]);
  }
  return text;
}

// ---------- Export Current Equb + Profile Pic ----------
function exportCurrentEqub() {
  const equb = getCurrentEqub();
  if (!equb) return alert(getText('selectEqub'));

  const { creatorId, admins, ...safeEqub } = equb;
  const exportData = {
    _exportedEqub: true,
    equb: safeEqub,
    user: state.user ? {
      name: state.user.name,
      profilePic: state.user.profilePic || null  // INCLUDED
    } : null,
    exportedAt: new Date().toISOString()
  };

  const data = JSON.stringify(exportData, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `equb-${equb.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  success(`${getText('exportBtn')}: ${equb.name}`);
}

function importEqub(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported._exportedEqub || !imported.equb) throw new Error('Invalid export file');

      const equb = imported.equb;
      equb.id = generateId();
      equb.code = generateUniqueCode();
      equb.creatorId = state.user?.id || null;
      equb.admins = state.user ? [{ id: state.user.id, name: state.user.name }] : [];
      equb.members = equb.members.map(m => ({
        ...m,
        id: m.id || generateId(),
        name: m.name || 'Unknown'
      }));

      state.equbs.push(equb);
      state.currentEqubId = equb.id;

      // RESTORE PROFILE PIC IF PRESENT
      if (imported.user?.profilePic && state.user) {
        state.user.profilePic = imported.user.profilePic;
      }

      saveState();
      success(`${getText('importBtn')}: ${equb.name}`);
      showPage('home');
    } catch (err) {
      alert(getText('importBtn') + ' error: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ---------- Activity & History (Cleaned) ----------
function pushActivity(message, equbId = null) {
  let cleanMsg = String(message)
    .replace(/&quot;.*&quot;/g, '')
    .replace(/\(code: .*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanMsg) return;

  const entry = { date: new Date().toISOString(), message: cleanMsg, equbId };
  state.activity.push(entry);
  state.history.push({ date: entry.date, message: cleanMsg });
  saveState();
  updateActivity();
  updateHome();
}

// ---------- Navigation ----------
function showPage(page) {
  if (!state.user && !['welcome', 'profile'].includes(page)) page = 'profile';
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const pageEl = el(page + '-page');
  if (pageEl) pageEl.style.display = 'block';
  const nav = el('nav-bar');
  if (nav) nav.style.display = state.user ? 'flex' : 'none';
  updateNavActive(page);

  if (page === 'home') updateHome();
  if (page === 'myequbs') updateMyEqubs();
  if (page === 'members') updateMembers();
  if (page === 'activity') updateActivity();
  if (page === 'profile') updateProfile();
}
function updateNavActive(page) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
}

// ---------- Modals ----------
function showModal(id) {
  const modal = el(id + '-modal');
  if (!modal) return;
  modal.classList.add('active');
  const input = modal.querySelector('input, select');
  if (input) input.focus();
  if (id === 'contribute') populateContributionMembers();
  if (id === 'invite') showInviteCode();
}
function closeModal(id) {
  const modal = el(id + '-modal');
  if (modal) modal.classList.remove('active');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
});

// ---------- Equb Management ----------
function generateUniqueCode() {
  let code;
  do { code = `EQ-${Math.random().toString(36).slice(2,6).toUpperCase()}-${new Date().getFullYear()}`; }
  while (state.equbs.some(e => e.code === code));
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
  const name = el('create-equb-name').value.trim();
  const frequency = el('create-equb-frequency').value;
  const target = parseInt(el('create-target-members').value);
  const goal = parseFloat(el('create-goal-amount').value);
  const contribution = parseFloat(el('create-contribution-amount').value);
  const startDate = el('create-start-date').value;

  if (!name || !frequency || isNaN(target) || target < 2 || isNaN(goal) || goal <= 0 || isNaN(contribution) || contribution <= 0 || !startDate) {
    return alert('Please fill all fields with valid values.');
  }

  const id = generateId();
  const code = generateUniqueCode();
  const newEqub = {
    id, code, name, frequency, creatorId: state.user.id,
    admins: [{ id: state.user.id, name: state.user.name }],
    members: [{ id: state.user.id, name: state.user.name, joinedAt: new Date().toISOString() }],
    goalAmount: goal, contributionAmount: contribution, targetMembers: target,
    startDate, status: 'forming', contributions: [], payoutOrder: [], payoutHistory: [],
    currentPayoutIndex: 0, progress: 0, activity: []
  };

  state.equbs.push(newEqub);
  state.currentEqubId = id;
  pushActivity(`${getText('createTitle')} ${name}`, id);
  closeModal('create-equb');
  success(getText('createTitle') + '!');
  showPage('home');
}
function openEditEqub(equbId) {
  const equb = state.equbs.find(e => e.id === equbId);
  if (!equb || equb.creatorId !== state.user.id) return alert('Only the creator can edit this Equb.');
  el('edit-equb-name').value = equb.name;
  el('edit-equb-frequency').value = equb.frequency;
  el('edit-target-members').value = equb.targetMembers;
  el('edit-goal-amount').value = equb.goalAmount;
  el('edit-contribution-amount').value = equb.contributionAmount;
  el('edit-start-date').value = equb.startDate;
  state.editingEqubId = equbId;
  showModal('edit-equb');
}
function saveEditEqub() {
  const equb = state.equbs.find(e => e.id === state.editingEqubId);
  if (!equb || equb.creatorId !== state.user.id) return;
  const name = el('edit-equb-name').value.trim();
  const frequency = el('edit-equb-frequency').value;
  const target = parseInt(el('edit-target-members').value);
  const goal = parseFloat(el('edit-goal-amount').value);
  const contribution = parseFloat(el('edit-contribution-amount').value);
  const startDate = el('edit-start-date').value;

  if (!name || !frequency || isNaN(target) || target < 2 || isNaN(goal) || goal <= 0 || isNaN(contribution) || contribution <= 0 || !startDate) {
    return alert('Please fill all fields with valid values.');
  }

  equb.name = name;
  equb.frequency = frequency;
  equb.targetMembers = target;
  equb.goalAmount = goal;
  equb.contributionAmount = contribution;
  equb.startDate = startDate;

  pushActivity(`${getText('editTitle')} ${name}`, equb.id);
  saveState();
  closeModal('edit-equb');
  success(getText('editTitle') + ' updated!');
  updateMyEqubs();
  if (state.currentEqubId === equb.id) updateHome();
}
function deleteEqub(equbId) {
  const equb = state.equbs.find(e => e.id === equbId);
  if (!equb || equb.creatorId !== state.user.id || !confirm('Delete this Equb?')) return;
  state.equbs = state.equbs.filter(e => e.id !== equbId);
  if (state.currentEqubId === equbId) state.currentEqubId = null;
  pushActivity(`Deleted ${equb.name}`);
  saveState();
  success('Equb deleted.');
  updateMyEqubs();
}
function joinEqub() {
  if (!state.user) return alert(getText('login') + ' required');
  const code = el('equb-code').value.trim().toUpperCase();
  const equb = state.equbs.find(e => e.code === code);
  if (!equb) return alert('Invalid code');
  if (equb.status === 'completed') return alert('Equb completed');
  if (equb.members.length >= equb.targetMembers) return alert('Equb full');
  if (equb.members.some(m => m.id === state.user.id)) return alert('Already joined');

  equb.members.push({ id: state.user.id, name: state.user.name, joinedAt: new Date().toISOString() });
  if (equb.members.length === equb.targetMembers) {
    equb.status = 'active';
    equb.payoutOrder = shuffleArray(equb.members.map(m => ({ ...m })));
  }
  pushActivity(`${state.user.name} joined`, equb.id);
  state.currentEqubId = equb.id;
  saveState();
  closeModal('join-equb');
  success('Joined Equb!');
  showPage('home');
}
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Contribution ----------
function populateContributionMembers() {
  const select = el('contribution-member');
  if (!select) return;
  select.innerHTML = '<option value="">Select Member</option>';
  const equb = getCurrentEqub();
  if (!equb) return;
  equb.members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = escapeHtml(m.name);
    select.appendChild(opt);
  });
}
function contribute() {
  const memberId = el('contribution-member').value;
  const amount = parseFloat(el('contribute-amount').value);
  const equb = getCurrentEqub();
  if (!equb || !memberId || isNaN(amount) || amount <= 0) return alert('Invalid input');
  if (amount !== equb.contributionAmount) {
    return alert(`Must contribute exactly ${equb.contributionAmount.toFixed(2)} ETB`);
  }
  const today = toDateOnlyString(new Date());
  const alreadyPaid = equb.contributions.some(c => c.userId === memberId && toDateOnlyString(c.date) === today);
  if (equb.frequency === 'daily' && alreadyPaid) return alert('Already contributed today');

  const member = equb.members.find(m => m.id === memberId);
  equb.contributions.push({ amount, userId: memberId, date: new Date().toISOString() });
  equb.activity.push(`${member.name} paid ${amount} ETB`);
  pushActivity(`${member.name} paid ${amount} ETB`, equb.id);

  const total = equb.contributions.reduce((s, c) => s + c.amount, 0);
  equb.progress = Math.min(100, (total / equb.goalAmount) * 100);
  saveState();
  closeModal('contribute');
  success(`${member.name} paid!`);
  updateHome();
  updateMembers();
}

// ---------- Auth ----------
function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  el('auth-title').textContent = getText(authMode);
  el('auth-name').style.display = authMode === 'signup' ? 'block' : 'none';
  el('auth-confirm').style.display = authMode === 'signup' ? 'block' : 'none';
  el('auth-switch').textContent = getText('switchTo', getText(authMode === 'login' ? 'signup' : 'login'));
}
function authAction() {
  const email = el('auth-email').value.trim();
  const password = el('auth-password').value;
  if (!email || !password) return alert(getText('email') + ' and ' + getText('password') + ' required');
  if (authMode === 'signup') {
    const name = el('auth-name').value.trim();
    const confirm = el('auth-confirm').value;
    if (!name || password !== confirm) return alert(getText('name') + ' and matching passwords required');
  }
  state.user = {
    id: generateId(),
    name: authMode === 'signup' ? el('auth-name').value.trim() : email.split('@')[0],
    email,
    createdAt: new Date().toISOString(),
    language: 'en',
    security: { pinEnabled: false, biometricsEnabled: false },
    profilePic: null  // Initialize
  };
  pushActivity(`${state.user.name} ${authMode === 'login' ? 'logged in' : 'signed up'}`);
  success(`Welcome, ${state.user.name}!`);
  showPage('myequbs');
}
function logout() {
  state.user = null;
  saveState();
  success(getText('logout'));
  showPage('welcome');
}
function setLanguage(lang) {
  if (state.user) { state.user.language = lang; saveState(); success(getText('language') + ' updated'); }
}
function setSecurity(enabled) {
  if (state.user) { state.user.security.pinEnabled = enabled; saveState(); }
}

// ---------- UI Updates ----------
function getCurrentEqub() { return state.equbs.find(e => e.id === state.currentEqubId) || null; }

function updateHome() {
  const equb = getCurrentEqub();
  if (!equb) {
    el('equb-name').textContent = getText('selectEqub');
    return;
  }

  el('equb-name').textContent = escapeHtml(equb.name);
  el('home-goal-amount').textContent = equb.goalAmount.toLocaleString();
  el('members-count').textContent = equb.members.length;
  el('home-target-members').textContent = equb.targetMembers;
  el('home-contribution-amount').textContent = equb.contributionAmount.toLocaleString();

  const percent = equb.progress;
  const circumference = 565;
  const offset = circumference - (percent / 100) * circumference;
  const fg = document.querySelector('.progress-fg');
  if (fg) fg.style.strokeDashoffset = offset;

  el('progress-percent').textContent = percent.toFixed(0) + '%';
  const collected = equb.contributions.reduce((s, c) => s + c.amount, 0);
  const remaining = equb.goalAmount - collected;
  el('progress-remaining').textContent = remaining.toLocaleString() + ' ETB left';

  el('status').textContent = getText('status', equb.status);
  el('current-round').textContent = (equb.payoutHistory.length || 0) + 1;
  el('total-rounds').textContent = equb.targetMembers;

  const dailyDiv = el('daily-payments');
  if (equb.frequency === 'daily' && dailyDiv) {
    dailyDiv.style.display = 'block';
    el('current-date').textContent = new Date().toLocaleDateString();
    const list = el('payments-list');
    list.innerHTML = '';
    const today = toDateOnlyString(new Date());
    equb.members.forEach(m => {
      const paid = equb.contributions.some(c => c.userId === m.id && toDateOnlyString(c.date) === today);
      const div = document.createElement('div');
      div.className = 'payment-status';
      div.innerHTML = `<span>${escapeHtml(m.name)}</span>
                       <span class="${paid ? 'paid' : 'not-paid'}">
                         ${paid ? getText('paid') : getText('notPaid')}
                       </span>`;
      list.appendChild(div);
    });
  } else if (dailyDiv) { dailyDiv.style.display = 'none'; }
}

function updateMembers() {
  const list = el('member-list');
  const empty = el('no-members');
  list.innerHTML = '';
  const equb = getCurrentEqub();
  if (!equb || !equb.members.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  equb.members.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'glass-card';
    card.innerHTML = `<p style="font-weight:600">${escapeHtml(m.name)}</p><p>Payout Order: #${i + 1}</p>`;
    if (equb.frequency === 'daily') {
      const today = toDateOnlyString(new Date());
      const paid = equb.contributions.some(c => c.userId === m.id && toDateOnlyString(c.date) === today);
      const missed = computeMemberMissedDays(equb, m);
      if (paid) card.innerHTML += `<p class="payment-status"><span>${getText('paid')}</span></p>`;
      else if (missed > 0) {
        const amt = (missed * equb.contributionAmount).toFixed(2);
        card.innerHTML += `<p class="payment-status not-paid">Missed ${missed} day${missed>1?'s':''} — ${amt} ETB</p>`;
      } else card.innerHTML += `<p class="payment-status not-paid">${getText('notPaid')} today</p>`;
    } else {
      card.innerHTML += `<p>Joined: ${new Date(m.joinedAt).toLocaleDateString()}</p>`;
    }
    list.appendChild(card);
  });
}
function computeMemberMissedDays(equb, member) {
  if (equb.frequency !== 'daily') return 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const contribs = equb.contributions.filter(c => c.userId === member.id);
  const last = contribs.length ? new Date(contribs.sort((a,b) => new Date(b.date) - new Date(a.date))[0].date) : null;
  if (last && toDateOnlyString(last) === toDateOnlyString(today)) return 0;
  const join = new Date(member.joinedAt); join.setHours(0,0,0,0);
  const start = new Date(equb.startDate); start.setHours(0,0,0,0);
  const baseline = new Date(Math.max(join, start, last || 0));
  baseline.setHours(0,0,0,0);
  return baseline > yesterday ? 0 : daysBetween(baseline, yesterday);
}
function daysBetween(start, end) {
  const s = new Date(start); s.setHours(0,0,0,0);
  const e = new Date(end); e.setHours(0,0,0,0);
  return Math.max(0, Math.floor((e - s) / 86400000));
}
function updateActivity() {
  const feed = el('activity-feed');
  const empty = el('no-activity');
  feed.innerHTML = '';
  let items = state.activity.slice();
  const equb = getCurrentEqub();
  if (equb) items = items.filter(a => a.equbId === equb.id || a.equbId === null);
  items.sort((a,b) => new Date(b.date) - new Date(a.date));
  if (!items.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  items.forEach(a => {
    const card = document.createElement('div');
    card.className = 'glass-card';
    const date = new Date(a.date).toLocaleString();
    card.innerHTML = `<p><strong>${date}</strong><br>${escapeHtml(a.message)}</p>`;
    feed.appendChild(card);
  });
}
function updateProfile() {
  const auth = el('auth-card');
  const profile = el('profile-card');
  const history = el('history-card');
  const settings = el('settings-card');
  const logout = el('logout-button');

  if (!state.user) {
    auth.classList.remove('hidden');
    [profile, history, settings, logout].forEach(el => el?.classList.add('hidden'));
    toggleAuthMode();
  } else {
    auth.classList.add('hidden');
    [profile, history, settings, logout].forEach(el => el?.classList.remove('hidden'));
    el('profile-name').textContent = escapeHtml(state.user.name);
    el('member-since').textContent = new Date(state.user.createdAt).getFullYear();
    el('language').value = state.user.language;

    const img = el('profile-pic');
    const placeholder = el('profile-pic-placeholder');
    if (state.user.profilePic) {
      img.src = state.user.profilePic;
      img.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      img.style.display = 'none';
      placeholder.style.display = 'flex';
    }

    const histList = el('history-list');
    const noHist = el('no-history');
    histList.innerHTML = '';
    if (!state.history.length) { noHist.style.display = 'block'; return; }
    noHist.style.display = 'none';
    state.history.slice().sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(h => {
      const div = document.createElement('div');
      div.style.margin = '8px 0';
      div.style.padding = '8px 0';
      div.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
      div.innerHTML = `<small style="opacity:0.7;">${new Date(h.date).toLocaleDateString()} ${new Date(h.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small><br>${escapeHtml(h.message)}`;
      histList.appendChild(div);
    });
  }
}
function updateMyEqubs() {
  const list = el('equb-list');
  const empty = el('no-equbs');
  list.innerHTML = '';
  if (!state.equbs.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  state.equbs.forEach(equb => {
    const card = document.createElement('div');
    card.className = 'glass-card';
    card.onclick = () => { state.currentEqubId = equb.id; saveState(); showPage('home'); };
    card.innerHTML = `<h3>${escapeHtml(equb.name)}</h3><p>Status: ${equb.status}</p><p>Progress: ${equb.progress.toFixed(0)}%</p>`;

    if (equb.creatorId === state.user?.id) {
      const edit = document.createElement('button');
      edit.className = 'glass-button small';
      edit.textContent = getText('editTitle').split(' ')[0];
      edit.onclick = e => { e.stopPropagation(); openEditEqub(equb.id); };
      card.appendChild(edit);

      const del = document.createElement('button');
      del.className = 'glass-button small';
      del.textContent = 'Delete';
      del.onclick = e => { e.stopPropagation(); deleteEqub(equb.id); };
      card.appendChild(del);
    }

    const view = document.createElement('button');
    view.className = 'glass-button small';
    view.textContent = 'View';
    view.onclick = e => { e.stopPropagation(); state.currentEqubId = equb.id; saveState(); showPage('home'); };
    card.appendChild(view);

    list.appendChild(card);
  });
}
function showInviteCode() {
  const equb = getCurrentEqub();
  if (equb && el('invite-code')) el('invite-code').textContent = equb.code;
}
function copyInviteCode() {
  const code = el('invite-code')?.textContent;
  if (code) {
    navigator.clipboard.writeText(code).then(() => success(getText('copy') + '!')).catch(() => alert('Copy failed'));
  }
}

function createParticles(n) {
  const bg = document.querySelector('.background');
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.width = p.style.height = `${Math.random() * 3 + 1}px`;
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDelay = `${Math.random() * 10}s`;
    p.style.animationDuration = `${Math.random() * 5 + 5}s`;
    bg.appendChild(p);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  createParticles(30);
  showPage(state.user ? 'myequbs' : 'welcome');
});