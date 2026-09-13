export const PROFILE_KEY = 'kr_patient_details_v1';

export function ageYears(birthDate, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return null;
  const valid = value => {
    const parsed = new Date(value + 'T12:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!valid(birthDate) || !valid(today) || birthDate > today) return null;
  return Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0);
}

function readProfiles(storage) {
  let profiles;
  try { profiles = JSON.parse(storage.getItem(PROFILE_KEY) || '[]'); } catch { throw Error('Saved patient details could not be read. They have not been overwritten.'); }
  if (!Array.isArray(profiles)) throw Error('Saved patient details could not be read. They have not been overwritten.');
  return profiles;
}

export function loadProfile(patientId, storage = localStorage) {
  return readProfiles(storage).find(p => p?.patient_id === patientId) || {patient_id: patientId, full_name: '', birth_date: ''};
}

export function saveProfile(patientId, {full_name = '', birth_date = ''}, {today, storage = localStorage} = {}) {
  if (!patientId?.trim()) throw Error('Enter a patient ID before saving patient details.');
  if (birth_date && ageYears(birth_date, today) === null) throw Error('Enter a valid date of birth no later than today.');
  const profiles = readProfiles(storage);
  const record = {patient_id: patientId, full_name: String(full_name).trim().slice(0, 160), birth_date};
  const index = profiles.findIndex(p => p?.patient_id === patientId);
  if (index < 0) profiles.push(record); else profiles[index] = record;
  storage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  return record;
}
