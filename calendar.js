'use strict';

const LoomCalendar = (() => {
  const monthLabel = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fullDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeZone: 'UTC' });
  const shortDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' });
  const isoDay = date => date.toISOString().slice(0, 10);
  const parseDay = value => new Date(value + 'T00:00:00Z');

  function dateAt(year, month, day = 1) {
    const date = new Date(0);
    date.setUTCFullYear(year, month, day);
    return date;
  }

  function mount(trigger, panel, { dates, initialDate, onSelect }) {
    let available = new Set(dates);
    let selected = initialDate;
    let cursor = parseDay(selected ?? dates[0] ?? isoDay(new Date()));
    const value = trigger.querySelector('[data-date-value]');
    const caption = panel.querySelector('[data-calendar-month]');
    const grid = panel.querySelector('[data-calendar-days]');
    const previous = panel.querySelector('[data-calendar-prev]');
    const next = panel.querySelector('[data-calendar-next]');
    const yearForm = panel.querySelector('form');
    const yearField = yearForm.querySelector('select');
    const status = panel.querySelector('[data-calendar-status]');
    const monthSelect = panel.querySelector('[data-calendar-month-select]');
    const monthName = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' });
    const monthKeys = () => [...new Set([...available].sort().map(day => day.slice(0, 7)))];

    function updateValue() {
      value.textContent = selected ? shortDate.format(parseDay(selected)) : 'Elegir fecha';
    }

    function position() {
      if (!panel.matches(':popover-open')) return;
      const rect = trigger.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        panel.hidePopover();
        return;
      }
      const gutter = 8;
      const { clientWidth, clientHeight } = document.documentElement;
      const left = Math.max(gutter, Math.min(rect.left, clientWidth - panel.offsetWidth - gutter));
      const top = rect.bottom + panel.offsetHeight + gutter * 2 <= clientHeight
        ? rect.bottom + gutter : Math.max(gutter, Math.min(rect.top - panel.offsetHeight - gutter, clientHeight - panel.offsetHeight - gutter));
      panel.style.setProperty('--calendar-x', left + 'px');
      panel.style.setProperty('--calendar-y', top + 'px');
    }

    function render(focusDay = false) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      caption.textContent = monthLabel.format(cursor);
      const keys = monthKeys();
      const key = isoDay(cursor).slice(0, 7);
      const current = keys.indexOf(key);
      yearField.replaceChildren(...[...new Set(keys.map(key => key.slice(0, 4)))].map(year => new Option(year, year)));
      yearField.value = year;
      const months = keys.filter(key => Number(key.slice(0, 4)) === year);
      monthSelect.replaceChildren(...months.map(key => {
        const index = Number(key.slice(5)) - 1;
        return new Option(monthName.format(dateAt(year, index)), index);
      }));
      monthSelect.value = month;
      previous.disabled = current <= 0;
      next.disabled = current < 0 || current >= keys.length - 1;
      const first = dateAt(year, month);
      const offset = (first.getUTCDay() + 6) % 7;
      const count = dateAt(year, month + 1, 0).getUTCDate();
      const elements = [];
      for (let i = 0; i < offset; i++) elements.push(document.createElement('span'));
      let covered = 0;
      let focused;
      for (let day = 1; day <= count; day++) {
        const date = dateAt(year, month, day);
        const key = isoDay(date);
        const enabled = available.has(key);
        covered += Number(enabled);
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = day;
        button.dataset.date = key;
        button.setAttribute('aria-label', fullDate.format(date) + (enabled ? ', con datos' : ', sin datos para ese día'));
        button.setAttribute('aria-pressed', String(selected === key));
        button.dataset.available = String(enabled);
        button.disabled = !enabled;
        button.tabIndex = enabled && day === cursor.getUTCDate() ? 0 : -1;
        if (button.tabIndex === 0) focused = button;
        elements.push(button);
      }
      grid.replaceChildren(...elements);
      focused ??= grid.querySelector('button:enabled');
      if (focused) focused.tabIndex = 0;
      status.textContent = (covered < count ? 'Cobertura parcial · ' : '') + `${covered} de ${count} días disponibles`;
      position();
      if (focusDay) focused?.focus({ preventScroll: true });
    }

    function moveToMonth(key, focus = false) {
      if (!key) return;
      const day = [...available].sort().find(day => day.startsWith(key));
      if (!day) return;
      cursor = parseDay(day);
      render(focus);
    }
    function moveMonth(step, focus = false) {
      const keys = monthKeys();
      moveToMonth(keys[keys.indexOf(isoDay(cursor).slice(0, 7)) + step], focus);
    }

    trigger.addEventListener('click', () => {
      if (!panel.matches(':popover-open')) {
        cursor = parseDay(selected ?? isoDay(cursor));
        render();
      }
    });
    panel.addEventListener('toggle', () => {
      const open = panel.matches(':popover-open');
      trigger.setAttribute('aria-expanded', String(open));
      if (open) {
        position();
        grid.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
      }
    });
    previous.addEventListener('click', () => moveMonth(-1));
    next.addEventListener('click', () => moveMonth(1));
    yearForm.addEventListener('submit', event => event.preventDefault());
    yearField.addEventListener('change', () => moveToMonth(monthKeys().find(key => key.startsWith(yearField.value))));
    monthSelect.addEventListener('change', () => moveToMonth(yearField.value + '-' + String(Number(monthSelect.value) + 1).padStart(2, '0')));
    grid.addEventListener('click', event => {
      const key = event.target.closest('button[data-date]')?.dataset.date;
      if (!available.has(key)) return;
      const changed = selected !== key;
      selected = key;
      updateValue();
      panel.hidePopover();
      trigger.focus({ preventScroll: true });
      if (changed) onSelect(key);
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        panel.hidePopover();
        trigger.focus({ preventScroll: true });
        return;
      }
      const key = event.target.dataset.date;
      if (!key) return;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (!Object.hasOwn(offsets, event.key) && event.key !== 'PageUp' && event.key !== 'PageDown') return;
      event.preventDefault();
      const from = parseDay(key);
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        moveMonth(event.key === 'PageUp' ? -1 : 1, true);
      } else {
        from.setUTCDate(from.getUTCDate() + offsets[event.key]);
        const step = Math.sign(offsets[event.key]);
        const sorted = [...available].sort();
        let day = isoDay(from);
        if (!available.has(day)) day = step > 0 ? sorted.find(value => value >= day) : sorted.findLast(value => value <= day);
        if (day) { cursor = parseDay(day); render(true); }
      }
    });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { passive: true, capture: true });
    trigger.closest('details')?.addEventListener('toggle', position);

    updateValue();
    return {
      setSelectedDate(date) {
        selected = date;
        cursor = parseDay(date);
        updateValue();
        if (panel.matches(':popover-open')) panel.hidePopover();
      },
      setAvailableDates(nextDates) {
        available = new Set(nextDates);
        updateValue();
        if (panel.matches(':popover-open')) render();
      }
    };
  }

  return { mount };
})();
