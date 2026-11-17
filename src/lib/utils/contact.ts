export const normalizeIraqiPhone = (raw: string): string => {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('00964')) d = d.slice(2);
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
}

export const openContactMenu = (detail: ContactMenuDetail): void => {
  window.dispatchEvent(new CustomEvent<ContactMenuDetail>('prolink:contact-menu', { detail }));
};