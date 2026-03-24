/* ============================================================
   Makler Bot — Filter Mini App Logic
   Handles combo data loading, form interaction, and submission
   ============================================================ */

(function () {
  'use strict';

  // ── Telegram WebApp ──────────────────────────────────────
  const tg = window.Telegram?.WebApp;
  // Detect if we're actually inside Telegram (not just script loaded)
  const isInsideTelegram = !!(tg && tg.initData && tg.initData.length > 0);

  if (tg) {
    tg.ready();
    tg.expand();
  }

  // ── State ────────────────────────────────────────────────
  const state = {
    combos: {},
    selected: {
      type_id: null,
      type_name: null,
      category_id: null,
      category_name: null,
      building_type_id: null,
      building_type_name: null,
      location_id: null,
      location_name: null,
      metro_ids: [],
      metro_names: [],
      price_min: null,
      price_max: null,
      currency: 'AZN',
      rooms: [],
      room_names: [],
      repair_ids: [],
      repair_names: [],
      owner_type_id: null,
      owner_type_name: null,
    },
  };

  // ── Init ─────────────────────────────────────────────────
  function init() {
    loadCombos();
    renderAllSections();
    bindFormSubmit();
    bindCurrencyChips();
    bindPriceValidation();
  }

  // ── Load combo data from URL param ───────────────────────
  function loadCombos() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('d');
    if (raw) {
      try {
        const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const json = pako.inflate(bytes, { to: 'string' });
        state.combos = JSON.parse(json);
      } catch (e) {
        console.error('Failed to parse combo data:', e);
        state.combos = {};
      }
    }
    // Fallback defaults if no combo data
    if (!state.combos.operationTypes?.length) {
      state.combos.operationTypes = [
        { value: 1, label: 'Satılır' },
        { value: 2, label: 'Kirayə verilir' },
      ];
    }
    if (!state.combos.propertyTypes?.length) {
      state.combos.propertyTypes = [
        { value: 5, label: 'Mənzil' },
        { value: 2, label: 'Fərdi yaşayış evi' },
        { value: 3, label: 'Bağ evi' },
        { value: 4, label: 'Qeyri yaşayış sahəsi' },
        { value: 1, label: 'Torpaq' },
        { value: 6, label: 'Qaraj' },
      ];
    }
    if (!state.combos.roomCounts?.length) {
      state.combos.roomCounts = [
        { value: 1, label: '1 otaqlı' },
        { value: 3, label: '2 otaqlı' },
        { value: 5, label: '3 otaqlı' },
        { value: 7, label: '4 otaqlı' },
        { value: 9, label: '5+ otaqlı' },
      ];
    }
  }

  // ── Render all sections ──────────────────────────────────
  function renderAllSections() {
    renderRadioGroup('typeGroup', state.combos.operationTypes, 'type');
    renderRadioGroup('categoryGroup', state.combos.propertyTypes, 'category');

    const btypes = state.combos.buildingTypes || [];
    if (btypes.length) {
      document.getElementById('section-building-type').style.display = '';
      renderRadioGroup('buildingTypeGroup', btypes, 'building_type');
    }

    renderSearchableSelect('location', state.combos.regions || [], false);

    const metros = state.combos.metros || [];
    if (metros.length) {
      document.getElementById('section-metro').style.display = '';
      renderSearchableSelect('metro', metros, true);
    }

    renderChipGroup('roomsGroup', state.combos.roomCounts, 'rooms');

    const repairs = state.combos.repairRates || [];
    if (repairs.length) {
      document.getElementById('section-repair').style.display = '';
      renderChipGroup('repairGroup', repairs, 'repair');
    }

    const owners = state.combos.ownerTypes || [];
    if (owners.length) {
      document.getElementById('section-owner').style.display = '';
      renderRadioGroup('ownerGroup', owners, 'owner_type');
    }
  }

  // ── Radio Group (single select) ──────────────────────────
  function renderRadioGroup(containerId, items, key) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'radio-btn';
      btn.textContent = item.label || String(item.value);
      btn.dataset.value = item.value;
      btn.dataset.label = item.label || String(item.value);
      btn.addEventListener('click', () => {
        container.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.selected[key + '_id'] = item.value;
        state.selected[key + '_name'] = item.label || String(item.value);
        // Clear validation error on this section
        clearSectionError(container.closest('.form-section'));
      });
      container.appendChild(btn);
    });
  }

  // ── Chip Group (multi-select) ────────────────────────────
  function renderChipGroup(containerId, items, key) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach(item => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      const shortLabel = (item.label || String(item.value)).split(' ')[0];
      chip.textContent = shortLabel;
      chip.dataset.value = item.value;
      chip.dataset.label = item.label || String(item.value);
      chip.addEventListener('click', () => toggleChip(chip, item, key));
      container.appendChild(chip);
    });
  }

  function toggleChip(chip, item, key) {
    const ids = state.selected[key === 'rooms' ? 'rooms' : key + '_ids'];
    const names = state.selected[key === 'rooms' ? 'room_names' : key + '_names'];
    const val = item.value;
    const name = (item.label || String(item.value)).split(' ')[0];
    const idx = ids.indexOf(val);
    if (idx > -1) {
      ids.splice(idx, 1);
      const ni = names.indexOf(name);
      if (ni > -1) names.splice(ni, 1);
      chip.classList.remove('selected');
      chip.textContent = name;
    } else {
      ids.push(val);
      names.push(name);
      chip.classList.add('selected');
      chip.textContent = name;
    }
  }

  // ── Searchable Select ────────────────────────────────────
  function renderSearchableSelect(key, items, multi) {
    const searchInput = document.getElementById(key + 'Search');
    const listEl = document.getElementById(key + 'List');
    const tagEl = document.getElementById(key + (multi ? 'Tags' : 'Tag'));

    let highlightIdx = -1;

    function renderList(filter) {
      listEl.innerHTML = '';
      const q = (filter || '').toLowerCase().trim();
      const filtered = q
        ? items.filter(it => (it.label || '').toLowerCase().includes(q))
        : items;

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'dropdown-empty';
        empty.textContent = 'Nəticə tapılmadı';
        listEl.appendChild(empty);
        return;
      }

      filtered.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.textContent = item.label || String(item.value);
        div.dataset.value = item.value;
        div.dataset.label = item.label || String(item.value);

        // Highlight selected
        if (multi) {
          if (state.selected[key + '_ids'].includes(item.value)) {
            div.classList.add('selected');
          }
        } else {
          if (state.selected[key + '_id'] === item.value) {
            div.classList.add('selected');
          }
        }

        div.addEventListener('click', () => {
          if (multi) {
            selectMulti(key, item, tagEl);
            div.classList.toggle('selected');
          } else {
            selectSingle(key, item, tagEl, searchInput, listEl);
          }
        });
        listEl.appendChild(div);
      });
    }

    searchInput.addEventListener('focus', () => {
      renderList(searchInput.value);
      listEl.classList.add('open');
      // Elevate parent section so dropdown renders above siblings
      const section = searchInput.closest('.form-section');
      if (section) section.classList.add('section-dropdown-open');
    });

    searchInput.addEventListener('input', () => {
      renderList(searchInput.value);
      if (!listEl.classList.contains('open')) listEl.classList.add('open');
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      const visibleItems = listEl.querySelectorAll('.dropdown-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightIdx = Math.min(highlightIdx + 1, visibleItems.length - 1);
        updateHighlight(visibleItems, highlightIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightIdx = Math.max(highlightIdx - 1, 0);
        updateHighlight(visibleItems, highlightIdx);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < visibleItems.length) {
          visibleItems[highlightIdx].click();
        }
      }
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#' + key + 'Select')) {
        listEl.classList.remove('open');
        highlightIdx = -1;
        // Remove section elevation
        const section = searchInput.closest('.form-section');
        if (section) section.classList.remove('section-dropdown-open');
      }
    });
  }

  function updateHighlight(items, idx) {
    items.forEach((el, i) => {
      el.classList.toggle('highlighted', i === idx);
      if (i === idx) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function selectSingle(key, item, tagEl, searchInput, listEl) {
    state.selected[key + '_id'] = item.value;
    state.selected[key + '_name'] = item.label || String(item.value);

    searchInput.value = '';
    listEl.classList.remove('open');

    tagEl.style.display = 'flex';
    tagEl.innerHTML = '';
    const tag = createTag(item.label || String(item.value), () => {
      state.selected[key + '_id'] = null;
      state.selected[key + '_name'] = null;
      tagEl.style.display = 'none';
      tagEl.innerHTML = '';
    });
    tagEl.appendChild(tag);
  }

  function selectMulti(key, item, tagEl) {
    const ids = state.selected[key + '_ids'];
    const names = state.selected[key + '_names'];
    const val = item.value;
    const label = item.label || String(item.value);
    const idx = ids.indexOf(val);

    if (idx > -1) {
      ids.splice(idx, 1);
      const ni = names.indexOf(label);
      if (ni > -1) names.splice(ni, 1);
    } else {
      ids.push(val);
      names.push(label);
    }
    renderTags(key, tagEl);
  }

  function renderTags(key, tagEl) {
    tagEl.innerHTML = '';
    const ids = state.selected[key + '_ids'];
    const names = state.selected[key + '_names'];
    names.forEach((name, i) => {
      const tag = createTag(name, () => {
        ids.splice(i, 1);
        names.splice(i, 1);
        renderTags(key, tagEl);
        // Re-render list to update checkmarks
        const listEl = document.getElementById(key + 'List');
        if (listEl.classList.contains('open')) {
          const searchInput = document.getElementById(key + 'Search');
          searchInput.dispatchEvent(new Event('input'));
        }
      });
      tagEl.appendChild(tag);
    });
  }

  function createTag(text, onRemove) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${escapeHtml(text)} <span class="tag-remove">×</span>`;
    tag.querySelector('.tag-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove();
    });
    return tag;
  }

  // ── Currency Chips ───────────────────────────────────────
  function bindCurrencyChips() {
    const chips = document.querySelectorAll('#currencyChips .chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        state.selected.currency = chip.dataset.value;
      });
    });
  }

  // ── Price Validation ─────────────────────────────────────
  function bindPriceValidation() {
    const minEl = document.getElementById('priceMin');
    const maxEl = document.getElementById('priceMax');

    function validate() {
      const min = parseFloat(minEl.value);
      const max = parseFloat(maxEl.value);
      maxEl.classList.remove('error');
      // Remove existing error hints
      const existing = maxEl.parentElement.querySelector('.error-hint');
      if (existing) existing.remove();

      if (!isNaN(min) && !isNaN(max) && max < min && max > 0) {
        maxEl.classList.add('error');
        const hint = document.createElement('div');
        hint.className = 'error-hint';
        hint.textContent = 'Maksimum minimumdan böyük olmalıdır';
        maxEl.parentElement.appendChild(hint);
      }
    }

    minEl.addEventListener('input', validate);
    maxEl.addEventListener('input', validate);
  }

  // ── Validation ───────────────────────────────────────────
  function validateForm() {
    let valid = true;
    let firstErrorSection = null;

    // Clear all previous section errors
    document.querySelectorAll('.form-section').forEach(s => clearSectionError(s));

    // Required: Operation Type
    if (state.selected.type_id == null) {
      const section = document.getElementById('section-type');
      showSectionError(section, 'Əməliyyat növü seçilməlidir');
      valid = false;
      if (!firstErrorSection) firstErrorSection = section;
    }

    // Required: Category
    if (state.selected.category_id == null) {
      const section = document.getElementById('section-category');
      showSectionError(section, 'Kateqoriya seçilməlidir');
      valid = false;
      if (!firstErrorSection) firstErrorSection = section;
    }

    // Price: max >= min
    const minVal = document.getElementById('priceMin').value;
    const maxVal = document.getElementById('priceMax').value;
    if (minVal && maxVal) {
      const min = parseFloat(minVal);
      const max = parseFloat(maxVal);
      if (!isNaN(min) && !isNaN(max) && max < min) {
        const section = document.getElementById('section-price');
        showSectionError(section, 'Maksimum qiymət minimumdan böyük olmalıdır');
        valid = false;
        if (!firstErrorSection) firstErrorSection = section;
      }
    }

    // Scroll to first error
    if (firstErrorSection) {
      firstErrorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Shake animation
      firstErrorSection.classList.add('shake');
      setTimeout(() => firstErrorSection.classList.remove('shake'), 500);
    }

    return valid;
  }

  function showSectionError(section, message) {
    section.classList.add('section-error');
    // Add error message if not already present
    let errorMsg = section.querySelector('.section-error-msg');
    if (!errorMsg) {
      errorMsg = document.createElement('div');
      errorMsg.className = 'section-error-msg';
      section.appendChild(errorMsg);
    }
    errorMsg.textContent = message;
  }

  function clearSectionError(section) {
    section.classList.remove('section-error');
    const msg = section.querySelector('.section-error-msg');
    if (msg) msg.remove();
  }

  // ── Form Submit ──────────────────────────────────────────
  function bindFormSubmit() {
    const form = document.getElementById('filterForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitFilter();
    });
  }

  function submitFilter() {
    // Collect prices into state before validation
    const minVal = document.getElementById('priceMin').value;
    const maxVal = document.getElementById('priceMax').value;
    state.selected.price_min = minVal ? parseFloat(minVal) : null;
    state.selected.price_max = maxVal ? parseFloat(maxVal) : null;

    // Validate required fields
    if (!validateForm()) {
      return;
    }

    // Only include currency if price is set
    if (state.selected.price_min == null && state.selected.price_max == null) {
      state.selected.currency = null;
    }

    // Build output — only include non-null, non-empty fields
    const output = {};
    for (const [k, v] of Object.entries(state.selected)) {
      if (v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      output[k] = v;
    }

    const json = JSON.stringify(output);
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');

    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';

    // Send via Telegram WebApp
    if (isInsideTelegram) {
      try {
        tg.sendData(json);
        // Telegram will close the webapp automatically
      } catch (e) {
        console.error('sendData failed:', e);
        showToast('❌ Göndərilə bilmədi. Yenidən cəhd edin.', 'error');
        submitBtn.disabled = false;
        btnText.style.display = '';
        btnLoader.style.display = 'none';
      }
    } else {
      // Dev mode / outside Telegram — show success feedback
      setTimeout(() => {
        console.log('Filter data (dev mode):', json);
        submitBtn.disabled = false;
        btnText.style.display = '';
        btnLoader.style.display = 'none';
        showToast('✅ Filtr məlumatları hazırdır (test rejimi)', 'success');
        // Show the data in console for debugging
        console.log('Payload:', JSON.parse(json));
      }, 500);
    }
  }

  // ── Toast Notification ───────────────────────────────────
  function showToast(message, type) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ── Utility ──────────────────────────────────────────────
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Boot ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
