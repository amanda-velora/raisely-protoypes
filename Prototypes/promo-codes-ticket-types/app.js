(function () {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function money(n) {
    const v = Math.round(Number(n) * 100) / 100;
    return '$' + v.toFixed(2);
  }

  const SEED_TYPES = [
    {
      id: 'tt-standard',
      ticketName: 'Standard Ticket',
      displayName: 'Standard admission',
      price: 10,
      maxQty: 500,
      sold: 42,
    },
    {
      id: 'tt-early',
      ticketName: 'Early Bird Ticket',
      displayName: 'Early Bird',
      price: 8,
      maxQty: 200,
      sold: 156,
    },
    {
      id: 'tt-employee',
      ticketName: 'Employee Ticket',
      displayName: 'Staff',
      price: 5,
      maxQty: 50,
      sold: 12,
    },
  ];

  const SEED_BUNDLES = [
    { id: 'bd-vip', name: 'VIP Bundle', ticketIds: ['tt-standard', 'tt-early'] },
  ];

  const SEED_PROMOS = [
    {
      id: 'pm-seed',
      code: 'EARLYBIRD',
      discountType: 'percent',
      discountValue: 10,
      quantityLabel: 'Unlimited',
      activeWhen: 'always',
      appliesTo: 'types',
      typeIds: ['tt-standard'],
      bundleIds: [],
    },
    {
      id: 'pm-vip',
      code: 'VIPSAVE',
      discountType: 'percent',
      discountValue: 15,
      quantityLabel: 'Unlimited',
      activeWhen: 'always',
      appliesTo: 'bundles',
      typeIds: [],
      bundleIds: ['bd-vip'],
    },
  ];

  let state = {
    mode: 'admin',
    setupTab: 'types',
    ticketTypes: SEED_TYPES.map((t) => ({ ...t })),
    bundles: SEED_BUNDLES.map((b) => ({ ...b, ticketIds: [...b.ticketIds] })),
    promos: SEED_PROMOS.map((p) => ({
      ...p,
      typeIds: [...p.typeIds],
      bundleIds: [...p.bundleIds],
    })),
    cart: { 'tt-employee': 1 },
    bundleCart: { 'bd-vip': 1 },
    checkoutPromoInput: 'VIPSAVE',
    appliedPromoCode: null,
    checkoutError: null,
    ticketModalOpen: false,
    bundleModalOpen: false,
    ticketForm: {
      ticketName: '',
      displayName: '',
      price: '',
      maxQty: '',
      ticketNameError: '',
    },
    bundleForm: { name: '', ticketIds: [], nameError: '' },
    promoDraft: {
      code: '',
      discountType: 'percent',
      discountValue: '',
      quantityLabel: 'Unlimited',
      activeWhen: 'always',
      appliesTo: 'all',
      typeIds: [],
      bundleIds: [],
    },
    multiOpen: null,
    promoSearchTypes: '',
    promoSearchBundles: '',
  };

  function setMode(mode) {
    state.mode = mode;
    render();
  }

  function setSetupTab(tab) {
    state.setupTab = tab;
    state.multiOpen = null;
    render();
  }

  /** Cart lines: bundle purchases first, then standalone ticket quantities. */
  function buildCheckoutLines() {
    const lines = [];
    state.bundles.forEach((bundle) => {
      const bQty = state.bundleCart[bundle.id] || 0;
      if (bQty <= 0) return;
      bundle.ticketIds.forEach((tid) => {
        const t = state.ticketTypes.find((x) => x.id === tid);
        if (!t) return;
        lines.push({
          ticket: t,
          qty: bQty,
          lineTotal: t.price * bQty,
          source: 'bundle',
          bundleId: bundle.id,
        });
      });
    });
    state.ticketTypes.forEach((t) => {
      const qty = state.cart[t.id] || 0;
      if (qty <= 0) return;
      lines.push({
        ticket: t,
        qty,
        lineTotal: t.price * qty,
        source: 'standalone',
        bundleId: null,
      });
    });
    return lines;
  }

  /** Whether this cart line may receive a discount for this promo’s scope. */
  function lineEligibleForDiscount(line, promo) {
    if (promo.appliesTo === 'all') return true;
    if (promo.appliesTo === 'types') {
      return (promo.typeIds || []).includes(line.ticket.id);
    }
    if (promo.appliesTo === 'bundles') {
      return (
        line.source === 'bundle' && (promo.bundleIds || []).includes(line.bundleId)
      );
    }
    return false;
  }

  function promoRejectMessage(result) {
    const pk = result.rejectKind;
    const p = result.promo;
    if (pk === 'empty') {
      return 'Add tickets to your cart before applying a promo code.';
    }
    if (pk === 'no-bundle' && p) {
      const names = (p.bundleIds || [])
        .map((id) => {
          const b = state.bundles.find((x) => x.id === id);
          return b ? b.name : '';
        })
        .filter(Boolean);
      if (names.length === 1) {
        return (
          'This code only applies when you add “' +
          names[0] +
          '” as a bundle at checkout. Buying the same ticket types on their own does not qualify—add the bundle, then apply the code.'
        );
      }
      if (names.length > 1) {
        return (
          'This code only applies when you add one of these bundles to your order: ' +
          names.join(', ') +
          '. Individual ticket lines alone do not qualify.'
        );
      }
      return 'This code only applies when a qualifying bundle is in your cart.';
    }
    if (pk === 'no-types' && p) {
      return (
        'This code applies only to selected ticket types. None of the tickets in your cart are eligible yet—add a qualifying ticket or remove this code.'
      );
    }
    return 'This code doesn’t apply to the tickets in your cart.';
  }

  function promoAppliesToLabel(p) {
    if (p.appliesTo === 'all') return 'All ticket types';
    if (p.appliesTo === 'types') {
      const n = (p.typeIds || []).length;
      return n === 1 ? '1 ticket type' : n + ' ticket types';
    }
    const names = (p.bundleIds || [])
      .map((id) => {
        const b = state.bundles.find((x) => x.id === id);
        return b ? b.name : '';
      })
      .filter(Boolean);
    if (names.length === 1) return names[0];
    return names.join(', ') || '—';
  }

  function discountLabel(p) {
    if (p.discountType === 'percent') return p.discountValue + '%';
    return money(p.discountValue);
  }

  function computeCheckout(appliedCode) {
    const lines = buildCheckoutLines();
    const subtotal = lines.reduce((s, L) => s + L.lineTotal, 0);

    if (!appliedCode) {
      return {
        subtotal,
        discount: 0,
        total: subtotal,
        lines,
        scenario: 'no-promo',
        lineDiscounts: [],
      };
    }

    if (lines.length === 0) {
      return {
        subtotal: 0,
        discount: 0,
        total: 0,
        lines,
        scenario: 'rejected',
        rejectKind: 'empty',
        lineDiscounts: [],
        promo: null,
      };
    }

    const promo = state.promos.find(
      (p) => p.code.toUpperCase() === String(appliedCode).trim().toUpperCase()
    );
    if (!promo) {
      return {
        subtotal,
        discount: 0,
        total: subtotal,
        lines,
        scenario: 'invalid',
        lineDiscounts: [],
      };
    }

    const hasEligible = lines.some((L) => lineEligibleForDiscount(L, promo));
    let rejectKind = null;
    if (!hasEligible) {
      if (promo.appliesTo === 'bundles') rejectKind = 'no-bundle';
      else if (promo.appliesTo === 'types') rejectKind = 'no-types';
      else rejectKind = 'no-types';
      return {
        subtotal,
        discount: 0,
        total: subtotal,
        lines,
        scenario: 'rejected',
        rejectKind,
        promo,
        lineDiscounts: [],
      };
    }

    const lineDiscounts = [];
    let discount = 0;
    const hasIneligible = lines.some((L) => !lineEligibleForDiscount(L, promo));

    if (promo.discountType === 'percent') {
      lines.forEach((L) => {
        if (!lineEligibleForDiscount(L, promo)) {
          lineDiscounts.push({
            ticket: L.ticket,
            discount: 0,
            eligible: false,
          });
          return;
        }
        const d = Math.round(L.lineTotal * (promo.discountValue / 100) * 100) / 100;
        discount += d;
        lineDiscounts.push({
          ticket: L.ticket,
          discount: d,
          eligible: true,
        });
      });
    } else {
      const eligLines = lines.filter((L) => lineEligibleForDiscount(L, promo));
      const eligSum = eligLines.reduce((s, L) => s + L.lineTotal, 0);
      const rawCap = eligSum <= 0 ? 0 : Math.min(promo.discountValue, eligSum);
      lines.forEach((L) => {
        if (!lineEligibleForDiscount(L, promo)) {
          lineDiscounts.push({
            ticket: L.ticket,
            discount: 0,
            eligible: false,
          });
          return;
        }
        if (eligSum <= 0) {
          lineDiscounts.push({
            ticket: L.ticket,
            discount: 0,
            eligible: true,
          });
          return;
        }
        const d = Math.round((L.lineTotal / eligSum) * rawCap * 100) / 100;
        lineDiscounts.push({
          ticket: L.ticket,
          discount: d,
          eligible: true,
        });
      });
      discount = lineDiscounts.reduce((s, x) => s + x.discount, 0);
      const drift = Math.round((rawCap - discount) * 100) / 100;
      if (drift !== 0) {
        const adj = lineDiscounts.find((x) => x.eligible);
        if (adj) adj.discount = Math.round((adj.discount + drift) * 100) / 100;
        discount = lineDiscounts.reduce((s, x) => s + x.discount, 0);
      }
    }

    const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
    let scenario = 'eligible-only';
    if (hasIneligible && hasEligible) scenario = 'mixed';

    return {
      subtotal,
      discount,
      total,
      lines,
      scenario,
      promo,
      lineDiscounts,
    };
  }

  function mixedCartCopy(result) {
    const p = result.promo;
    let eligPhrase = '';
    if (p.appliesTo === 'all') {
      eligPhrase = 'all ticket types';
    } else if (p.appliesTo === 'types') {
      const names = [];
      (p.typeIds || []).forEach((id) => {
        const t = state.ticketTypes.find((x) => x.id === id);
        if (t) names.push(t.ticketName);
      });
      eligPhrase =
        names.length <= 2
          ? names.join(' and ')
          : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
    } else {
      const bnames = (p.bundleIds || [])
        .map((id) => {
          const b = state.bundles.find((x) => x.id === id);
          return b ? b.name : '';
        })
        .filter(Boolean);
      eligPhrase =
        bnames.length > 0
          ? 'ticket types in ' + (bnames.length === 1 ? bnames[0] : bnames.join(', '))
          : 'selected bundles';
    }

    const ineligInCart = result.lines
      .filter((L) => !lineEligibleForDiscount(L, p))
      .map((L) => {
        const base = L.ticket.ticketName;
        if (p.appliesTo === 'bundles' && L.source === 'standalone') {
          return base + ' (not purchased as the bundle)';
        }
        return base;
      });
    const ineligStr =
      ineligInCart.length === 1
        ? ineligInCart[0] + " isn't eligible"
        : ineligInCart.slice(0, -1).join(', ') +
          ', and ' +
          ineligInCart[ineligInCart.length - 1] +
          " aren't eligible";

    return (
      esc(p.code) +
      ' applies to ' +
      esc(eligPhrase) +
      ' only. Your ' +
      esc(ineligStr) +
      ', so it won’t be discounted.'
    );
  }

  function openTicketModal() {
    state.ticketModalOpen = true;
    state.ticketForm = {
      ticketName: '',
      displayName: '',
      price: '',
      maxQty: '',
      ticketNameError: '',
    };
    render();
  }

  function closeTicketModal() {
    state.ticketModalOpen = false;
    render();
  }

  function updateTicketForm(field, value) {
    state.ticketForm[field] = value;
    if (field === 'ticketName') {
      const dup = state.ticketTypes.some(
        (t) => t.ticketName.trim().toLowerCase() === String(value).trim().toLowerCase()
      );
      state.ticketForm.ticketNameError = dup ? 'Ticket name must be unique' : '';
    }
    render();
  }

  function saveTicketModal() {
    const f = state.ticketForm;
    const name = f.ticketName.trim();
    const dup = state.ticketTypes.some((t) => t.ticketName.trim().toLowerCase() === name.toLowerCase());
    if (!name || dup) {
      state.ticketForm.ticketNameError = dup ? 'Ticket name must be unique' : 'Ticket name is required';
      render();
      return;
    }
    const price = parseFloat(f.price) || 0;
    const maxQty = parseInt(f.maxQty, 10) || 100;
    state.ticketTypes.push({
      id: 'tt-' + Math.random().toString(36).slice(2, 8),
      ticketName: name,
      displayName: f.displayName.trim() || name,
      price,
      maxQty,
      sold: 0,
    });
    state.ticketModalOpen = false;
    render();
  }

  function openBundleModal() {
    state.bundleModalOpen = true;
    state.bundleForm = { name: '', ticketIds: [], nameError: '' };
    render();
  }

  function closeBundleModal() {
    state.bundleModalOpen = false;
    render();
  }

  function toggleBundleTicket(id) {
    const ix = state.bundleForm.ticketIds.indexOf(id);
    if (ix >= 0) state.bundleForm.ticketIds.splice(ix, 1);
    else state.bundleForm.ticketIds.push(id);
    render();
  }

  function updateBundleName(v) {
    state.bundleForm.name = v;
    const dup = state.bundles.some(
      (b) => b.name.trim().toLowerCase() === String(v).trim().toLowerCase()
    );
    state.bundleForm.nameError = dup ? 'Bundle name must be unique' : '';
    render();
  }

  function saveBundleModal() {
    const f = state.bundleForm;
    const name = f.name.trim();
    const dup = state.bundles.some((b) => b.name.trim().toLowerCase() === name.toLowerCase());
    if (!name || dup) {
      state.bundleForm.nameError = dup ? 'Bundle name must be unique' : 'Bundle name is required';
      render();
      return;
    }
    if (f.ticketIds.length === 0) {
      state.bundleForm.nameError = 'Select at least one ticket type';
      render();
      return;
    }
    const newId = 'bd-' + Math.random().toString(36).slice(2, 8);
    state.bundles.push({
      id: newId,
      name,
      ticketIds: [...f.ticketIds],
    });
    state.bundleCart[newId] = 0;
    state.bundleModalOpen = false;
    render();
  }

  function updatePromoDraft(field, value) {
    state.promoDraft[field] = value;
    if (field === 'appliesTo') {
      state.promoDraft.typeIds = [];
      state.promoDraft.bundleIds = [];
      state.multiOpen = null;
    }
    render();
  }

  function togglePromoType(id) {
    const ix = state.promoDraft.typeIds.indexOf(id);
    if (ix >= 0) state.promoDraft.typeIds.splice(ix, 1);
    else state.promoDraft.typeIds.push(id);
    render();
  }

  function togglePromoBundle(id) {
    const ix = state.promoDraft.bundleIds.indexOf(id);
    if (ix >= 0) state.promoDraft.bundleIds.splice(ix, 1);
    else state.promoDraft.bundleIds.push(id);
    render();
  }

  function savePromoForm() {
    const d = state.promoDraft;
    const code = d.code.trim();
    if (!code) {
      render();
      return;
    }
    if (d.appliesTo === 'types' && d.typeIds.length === 0) return;
    if (d.appliesTo === 'bundles' && d.bundleIds.length === 0) return;

    const discountValue = parseFloat(d.discountValue);
    if (Number.isNaN(discountValue) || discountValue <= 0) return;

    state.promos.push({
      id: 'pm-' + Math.random().toString(36).slice(2, 8),
      code: code.toUpperCase(),
      discountType: d.discountType,
      discountValue,
      quantityLabel: d.quantityLabel.trim() || 'Unlimited',
      activeWhen: d.activeWhen,
      appliesTo: d.appliesTo,
      typeIds: [...d.typeIds],
      bundleIds: [...d.bundleIds],
    });

    state.promoDraft = {
      code: '',
      discountType: 'percent',
      discountValue: '',
      quantityLabel: 'Unlimited',
      activeWhen: 'always',
      appliesTo: 'all',
      typeIds: [],
      bundleIds: [],
    };
    state.promoSearchTypes = '';
    state.promoSearchBundles = '';
    render();
  }

  function cartInc(id, delta) {
    state.checkoutError = null;
    const q = state.cart[id] || 0;
    state.cart[id] = Math.max(0, q + delta);
    render();
  }

  function bundleInc(bundleId, delta) {
    state.checkoutError = null;
    const q = state.bundleCart[bundleId] || 0;
    state.bundleCart[bundleId] = Math.max(0, q + delta);
    render();
  }

  function bundleUnitPrice(bundleId) {
    const b = state.bundles.find((x) => x.id === bundleId);
    if (!b) return 0;
    return b.ticketIds.reduce((sum, tid) => {
      const t = state.ticketTypes.find((x) => x.id === tid);
      return sum + (t ? t.price : 0);
    }, 0);
  }

  function applyCheckoutPromo() {
    const code = state.checkoutPromoInput.trim();
    state.checkoutError = null;
    if (!code) return;

    const promo = state.promos.find(
      (p) => p.code.toUpperCase() === code.toUpperCase()
    );
    if (!promo) {
      state.checkoutError = 'Promo code not found.';
      state.appliedPromoCode = null;
      render();
      return;
    }

    const result = computeCheckout(code);
    if (result.scenario === 'rejected') {
      state.checkoutError = promoRejectMessage(result);
      state.appliedPromoCode = null;
      render();
      return;
    }

    state.appliedPromoCode = promo.code;
    state.checkoutError = null;
    render();
  }

  function removeCheckoutPromo() {
    state.appliedPromoCode = null;
    state.checkoutError = null;
    render();
  }

  function renderSidebar() {
    return `
    <aside class="sidebar" aria-label="Main navigation">
      <div class="sidebar__top-row">
        <img src="assets/raisely-logo.png" alt="Raisely" class="sidebar__logo">
        <div class="sidebar__search">
          <i class="fa-regular fa-magnifying-glass"></i>
          <span>Search</span>
        </div>
      </div>
      <div class="sidebar__campaign" role="presentation">
        <i class="fa-regular fa-chevron-left" aria-hidden="true"></i>
        <span>Spring Gala 2026</span>
      </div>
      <nav class="sidebar__nav" aria-label="Campaign">
        ${['Dashboard', 'Pages', 'Blog', 'Design', 'Messages', 'Profiles', 'Donations', 'Tickets', 'Reports', 'Settings']
          .map((label) => {
            const key = label.toLowerCase();
            const active = key === 'tickets' ? ' sidebar__item--active r-nav-item--active' : '';
            let block = `<div class="sidebar__item r-nav-item${active}" role="presentation">${esc(label)}</div>`;
            if (key === 'tickets') {
              block += `<div class="sidebar__subnav" aria-label="Tickets">
                <button type="button" class="r-nav-item r-nav-item--active" style="border:none;background:none;width:100%;text-align:left;cursor:default;">Setup</button>
              </div>`;
            }
            return block;
          })
          .join('')}
      </nav>
      <div class="sidebar__footer">
        <a class="sidebar__view-site" href="javascript:void(0)">
          View your site <i class="fa-regular fa-arrow-up-right-from-square"></i>
        </a>
      </div>
      <div class="sidebar__status">
        <span class="sidebar__status-dot" aria-hidden="true"></span>
        Payments disabled
      </div>
      <div class="sidebar__user">
        <div class="sidebar__avatar r-avatar">AA</div>
        <div>
          <div class="sidebar__username">Alex Admin</div>
          <div class="sidebar__switch"><i class="fa-regular fa-repeat"></i> Switch Account</div>
        </div>
      </div>
    </aside>`;
  }

  function renderSetupTabs() {
    const tabs = [
      { key: '_noop1', label: 'Ticket Settings', wired: false },
      { key: 'types', label: 'Ticket Types', wired: true },
      { key: '_noop2', label: 'Attendee Fields', wired: false },
      { key: 'promo', label: 'Promo Codes', wired: true },
      { key: '_noop3', label: 'Ticket Form', wired: false },
    ];
    return `
      <div class="setup-tabs" role="tablist">
        ${tabs
          .map((t) => {
            if (!t.wired) {
              return `<button type="button" class="r-pill" disabled style="opacity:0.45;cursor:not-allowed;">${esc(t.label)}</button>`;
            }
            const active = state.setupTab === t.key ? ' r-pill--active' : '';
            return `<button type="button" class="r-pill${active}" role="tab" aria-selected="${state.setupTab === t.key}"
              onclick="window.ProtoTickets.setSetupTab('${t.key}')">${esc(t.label)}</button>`;
          })
          .join('')}
      </div>`;
  }

  function renderTicketTypesPanel() {
    return `
      <div class="proto-actions">
        <button type="button" class="r-btn r-btn--primary" onclick="window.ProtoTickets.openTicketModal()">Add Ticket Type</button>
        <button type="button" class="r-btn r-btn--secondary" onclick="window.ProtoTickets.openBundleModal()">Create Ticket Bundle</button>
      </div>

      <div class="card">
        <div class="card__heading">Bundles</div>
        <p class="card__desc text-muted" style="margin-bottom:12px;">Sell multiple ticket types together at checkout.</p>
        ${
          state.bundles.length === 0
            ? '<p class="text-muted">No bundles yet.</p>'
            : `<div class="proto-table-wrap">
            <table class="proto-table">
              <thead><tr><th>Bundle</th><th>Includes</th></tr></thead>
              <tbody>
                ${state.bundles
                  .map((b) => {
                    const names = b.ticketIds
                      .map((id) => {
                        const t = state.ticketTypes.find((x) => x.id === id);
                        return t ? t.ticketName : id;
                      })
                      .join(', ');
                    return `<tr><td>${esc(b.name)}</td><td>${esc(names)}</td></tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>`
        }
      </div>

      <div class="card">
        <div class="card__heading">Ticket types</div>
        <p class="card__desc text-muted" style="margin-bottom:12px;">Prices and availability for this ticketed event.</p>
        <div class="proto-table-wrap">
          <table class="proto-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Sold</th>
              </tr>
            </thead>
            <tbody>
              ${state.ticketTypes
                .map(
                  (t) => `
                <tr>
                  <td>${esc(t.ticketName)}</td>
                  <td>${money(t.price)}</td>
                  <td>${t.sold} / ${t.maxQty}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderMultiSelectTypes() {
    const d = state.promoDraft;
    const q = state.promoSearchTypes.trim().toLowerCase();
    const filtered = state.ticketTypes.filter((t) =>
      !q ? true : t.ticketName.toLowerCase().includes(q)
    );
    const open = state.multiOpen === 'types';

    return `
      <div class="promo-multiselect">
        <button type="button" class="r-field__input promo-multiselect__trigger" onclick="event.stopPropagation(); window.ProtoTickets.toggleMulti('types')">
          ${d.typeIds.length ? esc(d.typeIds.length + ' selected') : 'Select ticket types…'}
        </button>
        ${
          open
            ? `<div class="promo-multiselect__panel" onclick="event.stopPropagation()">
            <div class="promo-multiselect__search">
              <div class="r-field" style="margin:0;">
                <label class="r-field__label">Search</label>
                <input id="pc-search-types" class="r-field__input" placeholder="Filter…" value="${esc(state.promoSearchTypes)}"
                  onclick="event.stopPropagation()"
                  oninput="window.ProtoTickets.setPromoSearchTypes(this.value)">
              </div>
            </div>
            <div class="promo-multiselect__list">
              ${filtered
                .map((t) => {
                  const sel = d.typeIds.includes(t.id);
                  return `<button type="button" class="promo-multiselect__option${sel ? ' promo-multiselect__option--selected' : ''}"
                    onclick="window.ProtoTickets.togglePromoType('${t.id}'); event.stopPropagation();">${esc(t.ticketName)}</button>`;
                })
                .join('')}
            </div>
          </div>`
            : ''
        }
        <div class="promo-multiselect__chips">
          ${d.typeIds
            .map((id) => {
              const t = state.ticketTypes.find((x) => x.id === id);
              if (!t) return '';
              return `<button type="button" class="r-pill r-pill--selected" onclick="window.ProtoTickets.togglePromoType('${t.id}')">${esc(t.ticketName)} <i class="fa-regular fa-xmark" aria-hidden="true"></i></button>`;
            })
            .join('')}
        </div>
      </div>`;
  }

  function renderMultiSelectBundles() {
    const d = state.promoDraft;
    const q = state.promoSearchBundles.trim().toLowerCase();
    const filtered = state.bundles.filter((b) =>
      !q ? true : b.name.toLowerCase().includes(q)
    );
    const open = state.multiOpen === 'bundles';

    return `
      <div class="promo-multiselect">
        <button type="button" class="r-field__input promo-multiselect__trigger" onclick="event.stopPropagation(); window.ProtoTickets.toggleMulti('bundles')">
          ${d.bundleIds.length ? esc(d.bundleIds.length + ' selected') : 'Select bundles…'}
        </button>
        ${
          open
            ? `<div class="promo-multiselect__panel" onclick="event.stopPropagation()">
            <div class="promo-multiselect__search">
              <div class="r-field" style="margin:0;">
                <label class="r-field__label">Search</label>
                <input id="pc-search-bundles" class="r-field__input" placeholder="Filter…" value="${esc(state.promoSearchBundles)}"
                  onclick="event.stopPropagation()"
                  oninput="window.ProtoTickets.setPromoSearchBundles(this.value)">
              </div>
            </div>
            <div class="promo-multiselect__list">
              ${filtered
                .map((b) => {
                  const sel = d.bundleIds.includes(b.id);
                  return `<button type="button" class="promo-multiselect__option${sel ? ' promo-multiselect__option--selected' : ''}"
                    onclick="window.ProtoTickets.togglePromoBundle('${b.id}'); event.stopPropagation();">${esc(b.name)}</button>`;
                })
                .join('')}
            </div>
          </div>`
            : ''
        }
        <div class="promo-multiselect__chips">
          ${d.bundleIds
            .map((id) => {
              const b = state.bundles.find((x) => x.id === id);
              if (!b) return '';
              return `<button type="button" class="r-pill r-pill--selected" onclick="window.ProtoTickets.togglePromoBundle('${b.id}')">${esc(b.name)} <i class="fa-regular fa-xmark" aria-hidden="true"></i></button>`;
            })
            .join('')}
        </div>
      </div>`;
  }

  function renderPromoPanel() {
    const d = state.promoDraft;
    const addDisabled =
      !d.code.trim() ||
      Number.isNaN(parseFloat(d.discountValue)) ||
      parseFloat(d.discountValue) <= 0 ||
      (d.appliesTo === 'types' && d.typeIds.length === 0) ||
      (d.appliesTo === 'bundles' && d.bundleIds.length === 0);

    return `
      <p class="card__desc" style="margin-bottom:20px;">
        Add promo codes supporters can apply at checkout. Codes can apply to your whole event or only to specific ticket types or bundles.
        Unlike legacy “whole order” promos, scoped codes reduce only eligible ticket lines—buyers always see which tickets received a discount.
      </p>

      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div class="card__heading" style="margin-bottom:0;">New Promo Code</div>
          <button type="button" class="r-btn r-btn--secondary" style="padding:4px 12px;font-size:12px;" onclick="window.ProtoTickets.resetPromoDraft()">Cancel</button>
        </div>

        <div class="r-field">
          <label class="r-field__label" for="pc-code">Code</label>
          <input id="pc-code" class="r-field__input" value="${esc(d.code)}"
            oninput="window.ProtoTickets.updatePromoDraft('code', this.value)">
        </div>

        <div class="promo-form-grid" style="margin-top:16px;">
          <div class="r-field">
            <label class="r-field__label">Type of discount</label>
            <select id="pc-discount-type" class="r-field__input" onchange="window.ProtoTickets.updatePromoDraft('discountType', this.value)">
              <option value="percent"${d.discountType === 'percent' ? ' selected' : ''}>Percentage</option>
              <option value="fixed"${d.discountType === 'fixed' ? ' selected' : ''}>Fixed amount</option>
            </select>
          </div>
          <div class="r-field">
            <label class="r-field__label">Discount per transaction</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <input id="pc-discount-value" class="r-field__input" style="flex:1;" inputmode="decimal" placeholder="${d.discountType === 'percent' ? '10' : '5.00'}"
                value="${esc(d.discountValue)}"
                oninput="window.ProtoTickets.updatePromoDraft('discountValue', this.value)">
              <span class="text-muted">${d.discountType === 'percent' ? '%' : '$'}</span>
            </div>
            <p class="text-muted" style="font-size:11px;margin-top:6px;">
              ${
                d.appliesTo === 'all'
                  ? 'Applied across eligible ticket lines (full cart when all types are eligible).'
                  : 'Calculated only on ticket lines that match your scope below.'
              }
            </p>
          </div>
        </div>

        <div class="r-field promo-form-grid--full" style="margin-top:16px;">
          <label class="r-field__label">Quantity</label>
          <input id="pc-quantity" class="r-field__input" value="${esc(d.quantityLabel)}"
            oninput="window.ProtoTickets.updatePromoDraft('quantityLabel', this.value)">
        </div>

        <div class="r-field" style="margin-top:16px;">
          <label class="r-field__label">When is this discount active?</label>
          <select id="pc-active-when" class="r-field__input" onchange="window.ProtoTickets.updatePromoDraft('activeWhen', this.value)">
            <option value="always"${d.activeWhen === 'always' ? ' selected' : ''}>Always</option>
            <option value="scheduled"${d.activeWhen === 'scheduled' ? ' selected' : ''}>Scheduled window</option>
          </select>
        </div>
        <div class="r-field">
          <label class="r-field__label">Discount start / end</label>
          <select class="r-field__input" disabled><option>Always on</option></select>
        </div>

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border-light);">
          <div class="card__heading" style="margin-bottom:12px;">Applies to</div>
          <div class="applies-to-stack">
            <label class="radio-card${d.appliesTo === 'all' ? ' radio-card--selected' : ''}" onclick="window.ProtoTickets.updatePromoDraft('appliesTo','all')">
              <input type="radio" name="applies" ${d.appliesTo === 'all' ? 'checked' : ''}>
              <span class="radio-card__indicator"></span>
              <span class="radio-card__content">
                <span class="radio-card__title">All ticket types</span>
                <span class="radio-card__desc">Same as classic behaviour: every ticket line can be discounted.</span>
              </span>
            </label>
            <label class="radio-card${d.appliesTo === 'types' ? ' radio-card--selected' : ''}" onclick="window.ProtoTickets.updatePromoDraft('appliesTo','types')">
              <input type="radio" name="applies" ${d.appliesTo === 'types' ? 'checked' : ''}>
              <span class="radio-card__indicator"></span>
              <span class="radio-card__content">
                <span class="radio-card__title">Selected ticket types</span>
                <span class="radio-card__desc">Choose one or more ticket types.</span>
              </span>
            </label>
            <label class="radio-card${d.appliesTo === 'bundles' ? ' radio-card--selected' : ''}" onclick="window.ProtoTickets.updatePromoDraft('appliesTo','bundles')">
              <input type="radio" name="applies" ${d.appliesTo === 'bundles' ? 'checked' : ''}>
              <span class="radio-card__indicator"></span>
              <span class="radio-card__content">
                <span class="radio-card__title">Selected bundles</span>
                <span class="radio-card__desc">Discount applies to ticket types included in the bundles you select.</span>
              </span>
            </label>
          </div>

          ${
            d.appliesTo === 'all'
              ? `<p class="text-muted" style="font-size:12px;margin-top:12px;">Applies to every ticket type in this campaign.</p>`
              : ''
          }
          ${
            d.appliesTo === 'types'
              ? `<div style="margin-top:12px;">
              <label class="r-field__label">Ticket types</label>
              ${renderMultiSelectTypes()}
            </div>`
              : ''
          }
          ${
            d.appliesTo === 'bundles'
              ? `<div style="margin-top:12px;">
              <label class="r-field__label">Bundles</label>
              ${renderMultiSelectBundles()}
              <p class="text-muted" style="font-size:12px;margin-top:8px;">This promo code applies to ticket types included in the selected bundle(s).</p>
            </div>`
              : ''
          }

          <p class="text-muted" style="font-size:12px;margin-top:16px;">
            Discount applies only to eligible ticket line items. Ineligible tickets will not be discounted.
          </p>
        </div>

        <p class="text-muted" style="font-size:11px;margin-top:20px;">
          After a code has been used at checkout you can’t delete it—you can still edit quantity and dates.
        </p>

        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
          <button type="button" class="r-btn r-btn--secondary" onclick="window.ProtoTickets.resetPromoDraft()">Cancel</button>
          <button type="button" class="r-btn r-btn--primary" ${addDisabled ? 'disabled' : ''} onclick="window.ProtoTickets.savePromoForm()">Add</button>
        </div>
      </div>

      <div class="card">
        <div class="card__heading">Saved promo codes</div>
        <div class="proto-table-wrap">
          <table class="proto-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Applies to</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              ${state.promos
                .map(
                  (p) => `
                <tr>
                  <td>${esc(p.code)}</td>
                  <td>${esc(discountLabel(p))}</td>
                  <td>${esc(promoAppliesToLabel(p))}</td>
                  <td>${esc(p.activeWhen === 'always' ? 'Always' : 'Scheduled')}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderTicketModal() {
    if (!state.ticketModalOpen) return '';
    const f = state.ticketForm;
    const dup =
      !!f.ticketName.trim() &&
      state.ticketTypes.some(
        (t) => t.ticketName.trim().toLowerCase() === f.ticketName.trim().toLowerCase()
      );

    return `
      <div class="r-modal-overlay" style="z-index:var(--r-z-modal);" onclick="if(event.target===this) window.ProtoTickets.closeTicketModal()">
        <div class="r-modal modal-scroll" style="max-width:480px;width:92%;" onclick="event.stopPropagation()">
          <div class="card__heading" style="margin-bottom:16px;">New Ticket Type</div>
          <div class="r-field">
            <label class="r-field__label">Ticket Name</label>
            <input id="tm-ticket-name" class="r-field__input" value="${esc(f.ticketName)}"
              oninput="window.ProtoTickets.updateTicketForm('ticketName', this.value)">
            ${f.ticketNameError || dup ? `<div class="r-field__error">${esc(f.ticketNameError || 'Ticket name must be unique')}</div>` : ''}
          </div>
          <div class="r-field">
            <label class="r-field__label">Ticket Display Name</label>
            <input id="tm-display-name" class="r-field__input" value="${esc(f.displayName)}"
              oninput="window.ProtoTickets.updateTicketForm('displayName', this.value)">
          </div>
          <div class="r-field">
            <label class="r-field__label">Price</label>
            <input id="tm-price" class="r-field__input" inputmode="decimal" value="${esc(f.price)}"
              oninput="window.ProtoTickets.updateTicketForm('price', this.value)">
          </div>
          <div class="r-field">
            <label class="r-field__label">Max Quantity</label>
            <input id="tm-max-qty" class="r-field__input" inputmode="numeric" value="${esc(f.maxQty)}"
              oninput="window.ProtoTickets.updateTicketForm('maxQty', this.value)">
          </div>
          <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;">
            <button type="button" class="r-btn r-btn--secondary" onclick="window.ProtoTickets.closeTicketModal()">Cancel</button>
            <button type="button" class="r-btn r-btn--primary" ${dup || !f.ticketName.trim() ? 'disabled' : ''}
              onclick="window.ProtoTickets.saveTicketModal()">Save Ticket</button>
          </div>
        </div>
      </div>`;
  }

  function renderBundleModal() {
    if (!state.bundleModalOpen) return '';
    const f = state.bundleForm;
    const dup =
      f.name.trim() &&
      state.bundles.some((b) => b.name.trim().toLowerCase() === f.name.trim().toLowerCase());
    const saveDisabled = !f.name.trim() || dup || f.ticketIds.length === 0;

    return `
      <div class="r-modal-overlay" style="z-index:var(--r-z-modal);" onclick="if(event.target===this) window.ProtoTickets.closeBundleModal()">
        <div class="r-modal modal-scroll" style="max-width:480px;width:92%;" onclick="event.stopPropagation()">
          <div class="card__heading" style="margin-bottom:16px;">Create Ticket Bundle</div>
          <div class="r-field">
            <label class="r-field__label">Bundle Name</label>
            <input id="bm-bundle-name" class="r-field__input" value="${esc(f.name)}"
              oninput="window.ProtoTickets.updateBundleName(this.value)">
            ${f.nameError ? `<div class="r-field__error">${esc(f.nameError)}</div>` : ''}
          </div>
          <div class="r-field">
            <label class="r-field__label">Included ticket types</label>
            <div class="bundle-checklist">
              ${state.ticketTypes
                .map((t) => {
                  const checked = f.ticketIds.includes(t.id) ? ' checked' : '';
                  return `<label><input type="checkbox"${checked} onchange="window.ProtoTickets.toggleBundleTicket('${t.id}')"> ${esc(t.ticketName)}</label>`;
                })
                .join('')}
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;">
            <button type="button" class="r-btn r-btn--secondary" onclick="window.ProtoTickets.closeBundleModal()">Cancel</button>
            <button type="button" class="r-btn r-btn--primary" ${saveDisabled ? 'disabled' : ''}
              onclick="window.ProtoTickets.saveBundleModal()">Save bundle</button>
          </div>
        </div>
      </div>`;
  }

  function renderAdminMain() {
    return `
      <div class="view-pills" role="group" aria-label="Prototype mode">
        <button type="button" class="view-pill view-pill--active" onclick="window.ProtoTickets.setMode('admin')">Admin settings</button>
        <button type="button" class="view-pill" onclick="window.ProtoTickets.setMode('checkout')">Checkout preview</button>
      </div>
      <h1 class="main__title">Tickets Setup</h1>
      ${renderSetupTabs()}
      ${state.setupTab === 'types' ? renderTicketTypesPanel() : ''}
      ${state.setupTab === 'promo' ? renderPromoPanel() : ''}
    `;
  }

  function renderCheckoutMain() {
    const applied = state.appliedPromoCode;
    const result = computeCheckout(applied);
    const promoInput = state.checkoutPromoInput;

    let callout = '';
    if (applied && result.scenario === 'mixed') {
      callout = `
        <div class="checkout-callout">
          <div class="checkout-callout__title">Code applied to eligible tickets</div>
          <div class="checkout-callout__body">${mixedCartCopy(result)}</div>
        </div>`;
    }

    let errorCallout = '';
    if (state.checkoutError) {
      errorCallout = `
        <div class="checkout-callout checkout-callout--error">
          <div class="checkout-callout__body">${esc(state.checkoutError)}</div>
        </div>`;
    }

    const discountRow =
      result.discount > 0
        ? `
      <div class="checkout-summary__row">
        <span>
          Discount (eligible tickets only)
          <span class="r-tooltip-wrap" tabindex="0" style="margin-left:4px;">
            <span class="r-tooltip-trigger">?</span>
            <span class="r-tooltip" role="tooltip">Only ticket lines that match this promo’s scope receive a discount. Bundle-scoped codes require the bundle to be in your cart.</span>
          </span>
        </span>
        <span style="color:var(--green);">−${money(result.discount)}</span>
      </div>
      ${
        result.lineDiscounts && result.lineDiscounts.length
          ? `<div class="checkout-summary__breakdown">
          ${result.lineDiscounts
            .map((x, i) => {
              const L = result.lines[i];
              let label = esc(x.ticket.ticketName);
              if (L && L.source === 'bundle' && L.bundleId) {
                const bn = state.bundles.find((b) => b.id === L.bundleId);
                if (bn) label = label + ' · ' + esc(bn.name);
              } else if (L && L.source === 'standalone') {
                label = label + ' · Individual ticket';
              }
              if (!x.eligible && x.discount === 0) {
                return `<div>${label}: $0 discount (not eligible)</div>`;
              }
              if (x.discount > 0) {
                return `<div>${label}: −${money(x.discount)}</div>`;
              }
              return '';
            })
            .filter(Boolean)
            .join('')}
        </div>`
          : ''
      }`
        : '';

    return `
      <div class="view-pills" role="group" aria-label="Prototype mode">
        <button type="button" class="view-pill" onclick="window.ProtoTickets.setMode('admin')">Admin settings</button>
        <button type="button" class="view-pill view-pill--active" onclick="window.ProtoTickets.setMode('checkout')">Checkout preview</button>
      </div>
      <h1 class="main__title">Checkout preview</h1>
      <p class="card__desc" style="margin-bottom:20px;">Buyer-facing cart. Bundles are purchased as a single line item; other tickets are added individually. Try <strong>VIPSAVE</strong> (15% off the VIP Bundle only—requires the bundle in your cart) or <strong>EARLYBIRD</strong> (10% off Standard Ticket, including Standard bought inside a bundle). Remove the bundle and apply VIPSAVE to see the error state.</p>

      <div class="checkout-layout">
        <div class="checkout-lines">
          <div class="checkout-section-label">Bundles</div>
          ${
            state.bundles.length === 0
              ? '<p class="text-muted" style="margin:0 0 var(--space-4);">No bundles configured.</p>'
              : state.bundles
                  .map((bundle) => {
                    const qty = state.bundleCart[bundle.id] || 0;
                    const unit = bundleUnitPrice(bundle.id);
                    const includes = bundle.ticketIds
                      .map((tid) => {
                        const t = state.ticketTypes.find((x) => x.id === tid);
                        return t ? t.ticketName : '';
                      })
                      .filter(Boolean)
                      .join(', ');
                    const nested =
                      qty > 0
                        ? `<div class="checkout-bundle-nested" aria-label="Included in this bundle">
                        ${bundle.ticketIds
                          .map((tid) => {
                            const t = state.ticketTypes.find((x) => x.id === tid);
                            if (!t) return '';
                            return `<div class="checkout-bundle-nested__row">
                              <span>${esc(t.displayName || t.ticketName)} × ${qty}</span>
                              <span>${money(t.price * qty)}</span>
                            </div>`;
                          })
                          .join('')}
                      </div>`
                        : '';
                    return `
              <div class="card checkout-bundle-card checkout-line">
                <div style="flex:1;min-width:200px;">
                  <div class="checkout-line__title">${esc(bundle.name)}</div>
                  <div class="checkout-line__price">${money(unit)} per bundle · Includes ${esc(includes)}</div>
                  ${nested}
                </div>
                <div class="checkout-stepper">
                  <button type="button" class="r-btn r-btn--secondary r-btn--icon" aria-label="Decrease" onclick="window.ProtoTickets.bundleInc('${bundle.id}',-1)"><i class="fa-regular fa-minus"></i></button>
                  <span class="checkout-stepper__qty">${qty}</span>
                  <button type="button" class="r-btn r-btn--secondary r-btn--icon" aria-label="Increase" onclick="window.ProtoTickets.bundleInc('${bundle.id}',1)"><i class="fa-regular fa-plus"></i></button>
                </div>
              </div>`;
                  })
                  .join('')
          }

          <div class="checkout-section-label">Individual tickets</div>
          ${state.ticketTypes
            .map((t) => {
              const qty = state.cart[t.id] || 0;
              return `
              <div class="card checkout-line">
                <div class="checkout-line__meta">
                  <div class="checkout-line__title">${esc(t.displayName || t.ticketName)}</div>
                  <div class="checkout-line__price">${money(t.price)} each</div>
                </div>
                <div class="checkout-stepper">
                  <button type="button" class="r-btn r-btn--secondary r-btn--icon" aria-label="Decrease" onclick="window.ProtoTickets.cartInc('${t.id}',-1)"><i class="fa-regular fa-minus"></i></button>
                  <span class="checkout-stepper__qty">${qty}</span>
                  <button type="button" class="r-btn r-btn--secondary r-btn--icon" aria-label="Increase" onclick="window.ProtoTickets.cartInc('${t.id}',1)"><i class="fa-regular fa-plus"></i></button>
                </div>
              </div>`;
            })
            .join('')}

          <div class="card">
            <div class="r-field" style="margin-bottom:0;">
              <label class="r-field__label">Promo code</label>
              ${
                applied
                  ? `<div class="promo-row-applied">
                  <span class="r-pill r-pill--active">${esc(applied)}</span>
                  <button type="button" class="r-btn r-btn--secondary" style="font-size:12px;padding:4px 12px;" onclick="window.ProtoTickets.removeCheckoutPromo()">Remove</button>
                </div>`
                  : `<div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <input id="ck-promo-input" class="r-field__input" style="flex:1;min-width:160px;" value="${esc(promoInput)}"
                    oninput="window.ProtoTickets.setCheckoutPromoInput(this.value)"
                    placeholder="Enter code">
                  <button type="button" class="r-btn r-btn--primary" onclick="window.ProtoTickets.applyCheckoutPromo()">Apply</button>
                </div>`
              }
            </div>
            ${callout}
            ${errorCallout}
          </div>
        </div>

        <div class="checkout-summary">
          <div class="checkout-summary__row">
            <span>Subtotal</span>
            <span>${money(result.subtotal)}</span>
          </div>
          ${discountRow}
          <div class="checkout-summary__row checkout-summary__row--total">
            <span>Total</span>
            <span>${money(result.total)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function resetPromoDraft() {
    state.promoDraft = {
      code: '',
      discountType: 'percent',
      discountValue: '',
      quantityLabel: 'Unlimited',
      activeWhen: 'always',
      appliesTo: 'all',
      typeIds: [],
      bundleIds: [],
    };
    state.promoSearchTypes = '';
    state.promoSearchBundles = '';
    render();
  }

  function toggleMulti(key) {
    state.multiOpen = state.multiOpen === key ? null : key;
    render();
  }

  function setPromoSearchTypes(v) {
    state.promoSearchTypes = v;
    render();
  }

  function setPromoSearchBundles(v) {
    state.promoSearchBundles = v;
    render();
  }

  function setCheckoutPromoInput(v) {
    state.checkoutPromoInput = v;
    render();
  }

  function syncCheckoutPromoEligibility() {
    if (state.mode !== 'checkout' || !state.appliedPromoCode) return;
    const r = computeCheckout(state.appliedPromoCode);
    if (r.scenario === 'rejected') {
      state.appliedPromoCode = null;
      state.checkoutError = promoRejectMessage(r);
    }
  }

  /** Full re-render destroys focused inputs; restore focus + caret after DOM swap. */
  function captureFocusSnapshot() {
    const el = document.activeElement;
    if (!el || !el.id) return null;
    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return null;
    const snap = { id: el.id };
    if (
      (tag === 'INPUT' || tag === 'TEXTAREA') &&
      typeof el.selectionStart === 'number' &&
      el.selectionStart !== null
    ) {
      snap.start = el.selectionStart;
      snap.end = el.selectionEnd;
    }
    return snap;
  }

  /** Main/sidebar are recreated each render; persist scroll offsets so the page does not jump. */
  function captureScrollSnapshot() {
    const main = document.querySelector('.main');
    const sidebar = document.querySelector('.sidebar');
    return {
      main: main ? main.scrollTop : 0,
      sidebar: sidebar ? sidebar.scrollTop : 0,
      windowY:
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        0,
    };
  }

  function clampScroll(el, y) {
    if (!el) return 0;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    return Math.max(0, Math.min(y, max));
  }

  /** Restore scroll first, then focus with preventScroll so focus() does not scroll the viewport. */
  function restoreScrollAndFocus(scrollSnap, focusSnap) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollSnap) {
          const main = document.querySelector('.main');
          if (main) main.scrollTop = clampScroll(main, scrollSnap.main);

          const sidebar = document.querySelector('.sidebar');
          if (sidebar) sidebar.scrollTop = clampScroll(sidebar, scrollSnap.sidebar);

          if (scrollSnap.windowY > 0) {
            window.scrollTo(0, scrollSnap.windowY);
          }
        }

        if (!focusSnap || !focusSnap.id) return;
        const el = document.getElementById(focusSnap.id);
        if (!el) return;
        el.focus({ preventScroll: true });
        if (focusSnap.start != null && typeof el.setSelectionRange === 'function') {
          try {
            const end = focusSnap.end != null ? focusSnap.end : focusSnap.start;
            el.setSelectionRange(focusSnap.start, end);
          } catch (e) {
            /* e.g. wrong input type */
          }
        }
      });
    });
  }

  function render() {
    const app = document.getElementById('app');
    if (!app) return;

    const focusSnap = captureFocusSnapshot();
    const scrollSnap = captureScrollSnapshot();

    syncCheckoutPromoEligibility();

    const mainClass = 'main' + (state.mode === 'checkout' ? ' main--checkout' : '');
    const mainInner =
      state.mode === 'admin' ? renderAdminMain() : renderCheckoutMain();

    app.innerHTML =
      renderSidebar() +
      `<main class="${mainClass}">${mainInner}</main>` +
      renderTicketModal() +
      renderBundleModal();

    document.title =
      state.mode === 'checkout'
        ? 'Checkout preview — Promo prototype'
        : 'Tickets Setup — Promo prototype';

    restoreScrollAndFocus(scrollSnap, focusSnap);
  }

  window.ProtoTickets = {
    setMode,
    setSetupTab,
    openTicketModal,
    closeTicketModal,
    updateTicketForm,
    saveTicketModal,
    openBundleModal,
    closeBundleModal,
    toggleBundleTicket,
    updateBundleName,
    saveBundleModal,
    updatePromoDraft,
    togglePromoType,
    togglePromoBundle,
    savePromoForm,
    resetPromoDraft,
    toggleMulti,
    setPromoSearchTypes,
    setPromoSearchBundles,
    cartInc,
    bundleInc,
    applyCheckoutPromo,
    removeCheckoutPromo,
    setCheckoutPromoInput,
  };

  render();

  document.addEventListener('click', function (e) {
    if (state.multiOpen && !e.target.closest('.promo-multiselect')) {
      state.multiOpen = null;
      render();
    }
  });
})();
