/** What we asked DigiLocker for, kept in sessionStorage across the round trip to their site. */
export const DIGILOCKER_PENDING = 'sm-digilocker-pending';

export interface DigiLockerPending {
  state: string; // echoed back by DigiLocker; must match, or we ignore the redirect
  applicationId: string;
  docType: string;
  back: string; // page to return to once the document is attached
}

export function readPending(): DigiLockerPending | null {
  try {
    return JSON.parse(sessionStorage.getItem(DIGILOCKER_PENDING) ?? 'null') as DigiLockerPending | null;
  } catch {
    return null;
  }
}
