// Follow-up days are entered from the patient's agreed plan, never inferred from scores.
export const PROM_KEY = 'kr_patient_reported_measures_v1';
export const FOLLOWUP_KEY = 'kr_questionnaire_followups_v1';
export const QUESTIONNAIRE_NAMES = {koos_jr: 'KOOS JR', oxford_knee: 'Oxford Knee Score'};
const dateNumber = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const time = Date.parse(value + 'T12:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? Math.floor(time / 864e5) : null;
};
export function followupDate(operationDate, day) {
  const start = dateNumber(operationDate);
  if (start === null || !Number.isInteger(day) || day < 0 || day > 3650) return null;
  return new Date((start + day) * 864e5).toISOString().slice(0, 10);
}
export function readFollowups(storage = localStorage) {
  const rows = JSON.parse(storage.getItem(FOLLOWUP_KEY) || '[]');
  if (!Array.isArray(rows)) throw Error('Saved follow-ups could not be read. They have not been overwritten.');
  return rows;
}
export function scopedFollowups(rows, patientId, operationDate) {
  return rows.filter(r => r && typeof r.id === 'string' && r.id && r.patient_id === patientId && r.operation_date === operationDate &&
    followupDate(operationDate, r.day) && QUESTIONNAIRE_NAMES[r.instrument] && ['left', 'right'].includes(r.side))
    .map(r => ({...r, date: followupDate(operationDate, r.day)})).sort((a, b) => a.day - b.day);
}
export function saveFollowup(input, {patientId, operationDate, storage = localStorage, idFactory = () => crypto.randomUUID()} = {}) {
  if (!patientId?.trim() || dateNumber(operationDate) === null) throw Error('Set your patient details and operation date in Settings first.');
  const day = input.day === '' || input.day == null || typeof input.day === 'boolean' ? NaN : Number(input.day);
  if (!followupDate(operationDate, day)) throw Error('Enter a whole day after surgery from 0 to 3650. Surgery is day 0.');
  if (!QUESTIONNAIRE_NAMES[input.instrument]) throw Error('Choose a questionnaire.');
  if (!['left', 'right'].includes(input.side)) throw Error('Choose the knee for this follow-up.');
  const rows = readFollowups(storage);
  if (scopedFollowups(rows, patientId, operationDate).some(r => r.day === day && r.instrument === input.instrument && r.side === input.side)) throw Error('This questionnaire is already planned for that knee and day.');
  const record = {id: idFactory(), patient_id: patientId, operation_date: operationDate, day, instrument: input.instrument, side: input.side};
  storage.setItem(FOLLOWUP_KEY, JSON.stringify([...rows, record]));
  return {...record, date: followupDate(operationDate, day)};
}
export function removeFollowup(id, {patientId, operationDate, storage = localStorage} = {}) {
  const rows = readFollowups(storage);
  storage.setItem(FOLLOWUP_KEY, JSON.stringify(rows.filter(r => !(r.id === id && r.patient_id === patientId && r.operation_date === operationDate))));
}
export function followupEvents(rows, results, {patientId, operationDate, today} = {}) {
  return scopedFollowups(rows, patientId, operationDate).map(event => {
    const result = results.filter(r => r.followup_id === event.id && r.patient_id === patientId && r.operation_date === operationDate &&
      r.instrument === event.instrument && r.side === event.side && r.questionnaire_completed === true && dateNumber(r.date) !== null && r.date <= today &&
      Number.isFinite(r.score) && r.score >= 0 && r.score <= (r.instrument === 'koos_jr' ? 100 : 48)).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    return {...event, title: QUESTIONNAIRE_NAMES[event.instrument], result, status: result ? 'Result saved' : event.date < today ? 'Past due · no result saved' : event.date === today ? 'Due today' : 'Planned'};
  });
}
export const followupLink = event => `?view=patient-measures&followup=${encodeURIComponent(event.id)}#${event.result ? 'questionnaire-history' : 'questionnaire-result'}`;

export function calendarFollowups({storage = localStorage, ...scope} = {}) {
  try {
    const results = JSON.parse(storage.getItem(PROM_KEY) || '[]');
    if (!Array.isArray(results)) throw Error('Saved questionnaire results could not be read.');
    return {events: followupEvents(readFollowups(storage), results, scope), error: ''};
  } catch {
    return {events: [], error: 'Questionnaire reminders could not be loaded on this device.'};
  }
}
