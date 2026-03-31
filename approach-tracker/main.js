// ===================== TAB ROUTING + ORCHESTRATION =====================
import { state, updateLastUpdated } from './shared.js';
import { initGlobe }      from './tabs/globe.js';
import { initThisWeek }   from './tabs/this-week.js';
import { initSizeSpeed }  from './tabs/size-speed.js';
import { initSchedule }   from './tabs/schedule.js';
import { initImpactRisk } from './tabs/impact-risk.js';

const TAB_INITS = {
  'globe':        initGlobe,
  'this-week':    initThisWeek,
  'size-speed':   initSizeSpeed,
  'schedule':     initSchedule,
  'impact-risk':  initImpactRisk,
};

const initialized = {};

function activateTab(name) {
  // Update button states
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === name)
  );
  // Update panel visibility
  document.querySelectorAll('.tab-panel').forEach(panel =>
    panel.classList.remove('active')
  );
  const panel = document.getElementById(`tab-${name}`);
  if (panel) panel.classList.add('active');

  // Init once
  if (!initialized[name] && TAB_INITS[name]) {
    initialized[name] = true;
    TAB_INITS[name](state);
  }
}

// Tab click handlers
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

// Refresh button — clear caches and re-init active tab
document.getElementById('refresh-btn').addEventListener('click', () => {
  state.feedCache = null;
  state.feedFetchedAt = null;
  state.scheduleCache = null;
  Object.keys(initialized).forEach(k => delete initialized[k]);
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'globe';
  activateTab(activeTab);
});

// Keep "last updated" text fresh every 30 s
setInterval(updateLastUpdated, 30_000);

// Boot on the Globe tab
activateTab('globe');
