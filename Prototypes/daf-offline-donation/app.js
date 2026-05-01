(function () {
  'use strict';

  var FAKE_PEOPLE = [
    { id: 'p1', name: 'Morgan Ellis', detail: 'Sydney · donor since 2021' },
    { id: 'p2', name: 'Priya Nair', detail: 'Melbourne · monthly supporter' },
    { id: 'p3', name: 'Campbell Trust Liaison', detail: 'Organisation contact' },
    { id: 'p4', name: 'Alex Morgan', detail: 'Brisbane · volunteer + donor' },
    { id: 'p5', name: 'Samira Okonkwo', detail: 'Perth · event attendee' },
    { id: 'p6', name: 'Wei Zhang', detail: 'Adelaide · major donor' },
  ];

  var overlay = document.getElementById('modal-overlay');
  var form = document.getElementById('add-donation-form');
  var dafCheck = document.getElementById('daf-grant-check');
  var dafDetails = document.getElementById('daf-details');
  var btnCancel = document.getElementById('btn-cancel');
  var btnCreateDonation = document.getElementById('btn-create-donation');
  var btnSaveAddAnother = document.getElementById('btn-save-add-another');
  var toastContainer = document.getElementById('toast-container');

  var dafOrg = document.getElementById('daf-org');
  var dafGrantId = document.getElementById('daf-grant-id');
  var dafPurpose = document.getElementById('daf-purpose');

  var personSearch = document.getElementById('person-search');
  var personList = document.getElementById('person-search-list');
  var personChips = document.getElementById('person-chips');
  var btnAddAnotherPerson = document.getElementById('btn-add-another-person');

  var dafDonorName = document.getElementById('daf-donor-name');
  var btnCreateContact = document.getElementById('btn-create-contact');
  var contactConfirm = document.getElementById('daf-contact-confirm');
  var contactConfirmText = document.getElementById('daf-contact-confirm-text');

  var selectedPeople = [];

  function showToast(message, variant) {
    variant = variant || 'success';
    var toast = document.createElement('div');
    toast.className = 'r-toast r-toast--' + variant;
    toast.setAttribute('role', 'status');
    var iconClass =
      variant === 'success'
        ? 'fa-regular fa-circle-check'
        : variant === 'error'
          ? 'fa-regular fa-circle-xmark'
          : 'fa-regular fa-circle-info';
    toast.innerHTML =
      '<i class="' +
      iconClass +
      '" aria-hidden="true"></i><span class="r-toast__message"></span>' +
      '<button type="button" class="r-toast__close" aria-label="Dismiss"><i class="fa-regular fa-xmark" aria-hidden="true"></i></button>';
    toast.querySelector('.r-toast__message').textContent = message;
    toast.querySelector('.r-toast__close').addEventListener('click', function () {
      toast.remove();
    });
    toastContainer.appendChild(toast);
    window.setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 4500);
  }

  function openModal() {
    overlay.classList.remove('is-hidden');
  }

  function closeModal() {
    overlay.classList.add('is-hidden');
  }

  function setDafSectionVisible(show) {
    dafDetails.hidden = !show;
    dafCheck.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (!show) {
      clearDafValidation();
      personList.hidden = true;
      personSearch.setAttribute('aria-expanded', 'false');
    }
  }

  function clearDafValidation() {
    [dafOrg, dafGrantId, dafPurpose].forEach(function (el) {
      if (!el) return;
      el.classList.remove('r-field__input--invalid');
      el.removeAttribute('aria-invalid');
    });
    ['daf-org-error', 'daf-grant-id-error', 'daf-purpose-error'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.hidden = true;
      }
    });
  }

  function validateDaf() {
    clearDafValidation();
    if (!dafCheck.checked) return true;

    var ok = true;
    function checkField(el, errId) {
      if (!el.value || !String(el.value).trim()) {
        ok = false;
        el.classList.add('r-field__input--invalid');
        el.setAttribute('aria-invalid', 'true');
        var err = document.getElementById(errId);
        if (err) err.hidden = false;
      }
    }

    checkField(dafOrg, 'daf-org-error');
    checkField(dafGrantId, 'daf-grant-id-error');
    checkField(dafPurpose, 'daf-purpose-error');

    if (!ok) {
      var firstInvalid = form.querySelector('.r-field__input--invalid');
      if (firstInvalid && typeof firstInvalid.scrollIntoView === 'function') {
        firstInvalid.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    return ok;
  }

  function renderPersonList(query) {
    personList.innerHTML = '';
    var q = (query || '').trim().toLowerCase();
    var matches = FAKE_PEOPLE.filter(function (p) {
      if (!q) return true;
      return (
        p.name.toLowerCase().indexOf(q) !== -1 ||
        p.detail.toLowerCase().indexOf(q) !== -1
      );
    });

    matches.forEach(function (p) {
      if (selectedPeople.some(function (s) { return s.id === p.id; })) return;

      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'daf-picker__item';
      btn.setAttribute('role', 'option');
      btn.dataset.id = p.id;
      btn.dataset.name = p.name;
      btn.innerHTML =
        '<span>' +
        escapeHtml(p.name) +
        '</span><span class="daf-picker__item-sub">' +
        escapeHtml(p.detail) +
        '</span>';
      btn.addEventListener('click', function () {
        addPerson({ id: p.id, name: p.name });
        personSearch.value = '';
        personList.hidden = true;
        personSearch.setAttribute('aria-expanded', 'false');
      });
      li.appendChild(btn);
      personList.appendChild(li);
    });

    var hasItems = personList.querySelectorAll('.daf-picker__item').length > 0;
    personList.hidden = !hasItems;
    personSearch.setAttribute('aria-expanded', hasItems ? 'true' : 'false');
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderChips() {
    personChips.innerHTML = '';
    selectedPeople.forEach(function (p) {
      var chip = document.createElement('span');
      chip.className = 'daf-chip';
      chip.dataset.id = p.id;
      chip.innerHTML =
        '<span>' +
        escapeHtml(p.name) +
        '</span><button type="button" class="daf-chip__remove" aria-label="Remove ' +
        escapeHtml(p.name) +
        '"><i class="fa-regular fa-xmark" aria-hidden="true"></i></button>';
      chip.querySelector('.daf-chip__remove').addEventListener('click', function () {
        selectedPeople = selectedPeople.filter(function (x) {
          return x.id !== p.id;
        });
        renderChips();
        renderPersonList(personSearch.value);
      });
      personChips.appendChild(chip);
    });
  }

  function addPerson(person) {
    if (selectedPeople.some(function (s) { return s.id === person.id; })) return;
    selectedPeople.push(person);
    renderChips();
    renderPersonList(personSearch.value);
  }

  function showContactConfirmation() {
    var name = (dafDonorName.value || '').trim();
    if (!name) {
      contactConfirm.hidden = true;
      return;
    }
    contactConfirmText.textContent = 'Will create new contact: ' + name;
    contactConfirm.hidden = false;
  }

  dafCheck.addEventListener('change', function () {
    setDafSectionVisible(dafCheck.checked);
  });

  personSearch.addEventListener('input', function () {
    renderPersonList(personSearch.value);
  });

  personSearch.addEventListener('focus', function () {
    renderPersonList(personSearch.value);
  });

  personList.addEventListener('mousedown', function (e) {
    e.preventDefault();
  });

  personSearch.addEventListener('blur', function () {
    window.setTimeout(function () {
      personList.hidden = true;
      personSearch.setAttribute('aria-expanded', 'false');
    }, 200);
  });

  btnAddAnotherPerson.addEventListener('click', function () {
    personSearch.focus();
    renderPersonList('');
    personList.hidden = false;
    personSearch.setAttribute('aria-expanded', 'true');
  });

  btnCreateContact.addEventListener('click', function () {
    showContactConfirmation();
  });

  dafDonorName.addEventListener('blur', function () {
    showContactConfirmation();
  });

  btnCancel.addEventListener('click', function () {
    closeModal();
  });

  btnCreateDonation.addEventListener('click', function () {
    openModal();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateDaf()) {
      showToast('Please complete the required DAF fields.', 'error');
      return;
    }
    showToast('Offline donation saved.');
  });

  btnSaveAddAnother.addEventListener('click', function () {
    if (!validateDaf()) {
      showToast('Please complete the required DAF fields.', 'error');
      return;
    }
    showToast('Donation saved. You can add another.');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && !overlay.classList.contains('is-hidden')) {
      closeModal();
    }
  });

  setDafSectionVisible(false);
})();
