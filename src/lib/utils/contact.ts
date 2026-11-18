export const normalizePhoneDigits = (raw: string): string => (raw || '').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, char =>
  String(char.charCodeAt(0) - (char >= '\u06f0' ? 0x06f0 : 0x0660))
);

export const isContactPhone = (raw: string): boolean => {
  const value = normalizePhoneDigits(raw).replace(/[\s()-]/g, '');
  return /^(?:(?:\+?964|00964|0)?7\d{9}|\+[1-9]\d{7,14}|00[1-9]\d{7,14})$/.test(value);
};

export const normalizeIraqiPhone = (raw: string): string => {
  let d = normalizePhoneDigits(raw).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '964' + d.slice(1);
  else if (d.startsWith('7') && d.length === 10) d = '964' + d;
  return d;
};

export const whatsappUrl = (phone: string): string =>
  `https://wa.me/${normalizeIraqiPhone(phone)}`;

export const telUrl = (phone: string): string =>
  `tel:+${normalizeIraqiPhone(phone)}`;

export interface ContactMenuDetail {
  phone?: string;
  name?: string;
  website?: string;
  cvUrl?: string;
  cvUserId?: string;
  cv?: import('../cv/cvData').CvSnapshot;
}

export const openContactMenu = (detail: ContactMenuDetail): void => {
  window.dispatchEvent(new CustomEvent<ContactMenuDetail>('prolink:contact-menu', { detail }));
};