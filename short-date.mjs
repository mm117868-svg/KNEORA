// Display a short year without changing the ISO dates used by recovery calculations.
export function shortDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return match ? `${match[3]}/${match[2]}/${match[1].slice(-2)}` : '';
}

export function parseShortDate(text, {today, previous = '', birthDate = false}) {
  if (!text.trim()) return '';
  const entered = text.trim().replace(/^(\d{2})(\d{2})(\d{2}|\d{4})$/, '$1/$2/$3');
  const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(entered);
  if (!match) throw Error('Enter the date as DD/MM/YY, for example 05/09/26.');
  const [, day, month, enteredYear] = match;
  const currentYear = Number(today.slice(0, 4));
  let year = Number(enteredYear);
  if (enteredYear.length === 2) {
    const previousYear = Number(previous.slice(0, 4));
    if (previousYear >= 100 && previousYear % 100 === year) year = previousYear;
    else {
      year += Math.floor(currentYear / 100) * 100;
      const candidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      if (birthDate ? candidate > today : year > currentYear + 50) year -= 100;
      if (!birthDate && year < currentYear - 50) year += 100;
    }
  }
  const iso = `${String(year).padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${iso}T12:00:00Z`);
  if (year < 100 || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso)
    throw Error('Enter a valid date as DD/MM/YY.');
  if (birthDate && iso > today) throw Error('Date of birth cannot be later than today.');
  return iso;
}

export function bindShortDate(native, text, options) {
  const sync = () => {text.value = shortDate(native.value); text.setCustomValidity('');};
  native.addEventListener('change', sync);
  text.addEventListener('input', event => {
    text.setCustomValidity('');
    // Advance over the separators while typing, without disrupting edits or backspace.
    if (event.isComposing || event.inputType?.startsWith('delete') || text.selectionStart !== text.value.length) return;
    const value=text.value;
    if (/^\d{2}$/.test(value) || /^\d{2}[/]\d{2}$/.test(value)) text.value=value+'/';
    else if (/^\d{5,8}$/.test(value)) text.value=value.slice(0,2)+'/'+value.slice(2,4)+'/'+value.slice(4);
  });
  text.addEventListener('change', () => {
    try {
      const value = parseShortDate(text.value, {...options(), previous: native.value});
      native.value = value;
      sync();
      native.dispatchEvent(new Event('change', {bubbles: true}));
    } catch (error) {
      text.setCustomValidity(error.message);
      text.reportValidity();
    }
  });
  sync();
  return sync;
}
