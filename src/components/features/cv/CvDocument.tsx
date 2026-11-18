import React, { CSSProperties } from 'react';
import { CvData, CV_LABELS, PLATFORM_URL } from '../../../lib/cv/cvData';
import { isContactPhone, telUrl, whatsappUrl } from '../../../lib/utils/contact';

export interface CvAssets { logoSrc?: string; avatarSrc?: string }

export const CV_DOCUMENT_RESET = `.prolink-cv,.prolink-cv *{box-sizing:border-box;margin:0;padding:0;font-family:ProlinkCv,Arial,sans-serif;font-synthesis:none;} .prolink-cv a{color:inherit;text-decoration:none;} .prolink-cv img{display:block;max-width:none;} .prolink-cv{color:#172b4d;background:#fff;text-align:start;line-height:26px;font-size:13px;}`;

const textStyle: CSSProperties = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: '26px' };
const linkStyle: CSSProperties = { color: '#0a66c2', textDecoration: 'none', overflowWrap: 'anywhere', fontSize: '12px', lineHeight: '24px', display: 'inline-block' };

function CvAnchor({ href, children, style }: { href: string; children: React.ReactNode; style?: CSSProperties }) {
  return <a data-cv-href={href} href={href} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, ...style }}>{children}</a>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div data-cv-block data-cv-keep style={{ paddingTop: '18px', paddingBottom: '8px', color: '#0a66c2', borderBottom: '1px solid #dbe5ef', fontSize: '16px', lineHeight: '30px', fontWeight: 750 }}>{children}</div>;
}

function Description({ text }: { text: string }) {
  if (!text) return null;
  return <div data-cv-block style={{ ...textStyle, paddingTop: '4px', paddingBottom: '6px' }}>{text}</div>;
}

function DateRange({ start, end }: { start: string; end: string }) {
  if (!start && !end) return null;
  return <span style={{ fontSize: '11px', color: '#5b6b7f', whiteSpace: 'nowrap', lineHeight: '24px' }}>{[start, end].filter(Boolean).join(' — ')}</span>;
}

export function CvFooter({ data, assets, page = 1, total = 1 }: { data: CvData; assets: CvAssets; page?: number; total?: number }) {
  const labels = CV_LABELS[data.settings.language];
  return <div className="prolink-cv" dir={data.settings.language === 'ar' ? 'rtl' : 'ltr'} style={{ width: '794px', height: '48px', padding: '8px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #dbe5ef', fontSize: '10px', lineHeight: '20px' }}>
    <CvAnchor href={PLATFORM_URL} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', lineHeight: '20px' }}>
      {assets.logoSrc && <img src={assets.logoSrc} alt="عمل" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '6px' }} />}
      <span>{labels.footerBrand}</span>
    </CvAnchor>
    <span style={{ color: '#5b6b7f', fontSize: '10px' }}>{labels.page(page, total)}</span>
  </div>;
}

export function CvDocument({ data, assets = {} }: { data: CvData; assets?: CvAssets }) {
  const labels = CV_LABELS[data.settings.language];
  const { personal, settings } = data;
  const phone = settings.showPhone && isContactPhone(personal.phone) ? personal.phone : '';
  return <div className="prolink-cv" dir={settings.language === 'ar' ? 'rtl' : 'ltr'} lang={settings.language} style={{ width: '794px', padding: '32px 40px 20px', minHeight: '240px' }}>
    <style>{CV_DOCUMENT_RESET}</style>
    <div data-cv-block style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', borderTop: '6px solid #0a66c2', paddingTop: '22px', paddingBottom: '16px' }}>
      <div style={{ flex: '1', minWidth: '0px' }}>
        <div style={{ fontWeight: 800, fontSize: '30px', lineHeight: '48px', overflowWrap: 'anywhere' }}>{personal.fullName || labels.documentTitle}</div>
        {personal.title && <div style={{ color: '#0a66c2', fontSize: '18px', fontWeight: 600, lineHeight: '32px', paddingTop: '4px', overflowWrap: 'anywhere' }}>{personal.title}</div>}
        {personal.location && <div style={{ color: '#5b6b7f', fontSize: '12px', lineHeight: '26px', paddingTop: '6px', overflowWrap: 'anywhere' }}>{personal.location}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '18px', rowGap: '2px', paddingTop: '6px' }}>
          {phone && <><CvAnchor href={telUrl(phone)}><span dir="ltr">{phone}</span></CvAnchor><CvAnchor href={whatsappUrl(phone)}>{labels.whatsapp}</CvAnchor></>}
          {settings.showEmail && personal.email && <CvAnchor href={`mailto:${encodeURI(personal.email)}`}><span dir="ltr">{personal.email}</span></CvAnchor>}
          {personal.website && <CvAnchor href={personal.website}><span dir="ltr">{personal.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span></CvAnchor>}
        </div>
      </div>
      {settings.showPhoto && assets.avatarSrc && <img src={assets.avatarSrc} alt={personal.fullName} style={{ width: '104px', height: '120px', flexShrink: 0, objectFit: 'cover', borderRadius: '8px' }} />}
    </div>
    {data.summary && <><SectionTitle>{labels.summary}</SectionTitle><Description text={data.summary} /></>}
    {data.experiences.length > 0 && <>
      <SectionTitle>{labels.experience}</SectionTitle>
      {data.experiences.map(e => <div key={e.id} style={{ paddingTop: '10px' }}>
        <div data-cv-block data-cv-keep={e.description ? true : undefined} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px' }}>
          <div style={{ minWidth: '0px', flex: '1', overflowWrap: 'anywhere' }}>
            {e.role && <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: '28px' }}>{e.role}</div>}
            {(e.company || e.location) && <div style={{ color: '#5b6b7f', fontSize: '12px', lineHeight: '24px' }}>{[e.company, e.location].filter(Boolean).join(' · ')}</div>}
          </div>
          <DateRange start={e.start} end={e.current ? labels.present : e.end} />
        </div>
        <Description text={e.description} />
      </div>)}
    </>}
    {data.education.length > 0 && <>
      <SectionTitle>{labels.education}</SectionTitle>
      {data.education.map(e => <div key={e.id} style={{ paddingTop: '10px' }}>
        <div data-cv-block data-cv-keep={e.description ? true : undefined} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px' }}>
          <div style={{ minWidth: '0px', flex: '1', overflowWrap: 'anywhere' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: '28px' }}>{[e.degree, e.field].filter(Boolean).join(' — ')}</div>
            {e.school && <div style={{ color: '#5b6b7f', fontSize: '12px', lineHeight: '24px' }}>{e.school}</div>}
          </div>
          <DateRange start={e.start} end={e.end} />
        </div>
        <Description text={e.description} />
      </div>)}
    </>}
    {data.skills.length > 0 && <>
      <SectionTitle>{labels.skills}</SectionTitle>
      <div data-cv-block style={{ paddingTop: '10px', paddingBottom: '4px', ...textStyle }}>{data.skills.join('  ·  ')}</div>
    </>}
    {data.languages.length > 0 && <>
      <SectionTitle>{labels.languages}</SectionTitle>
      {data.languages.map(l => <div data-cv-block key={l.id} style={{ lineHeight: '28px', paddingTop: '4px' }}><span style={{ fontWeight: 600 }}>{l.name}</span>{l.level && <span style={{ color: '#5b6b7f' }}> — {labels.levels[l.level]}</span>}</div>)}
    </>}
    {data.certifications.length > 0 && <>
      <SectionTitle>{labels.certifications}</SectionTitle>
      {data.certifications.map(c => <div key={c.id} data-cv-block style={{ paddingTop: '8px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ minWidth: '0px', flex: '1', overflowWrap: 'anywhere' }}><div style={{ fontWeight: 600, lineHeight: '28px' }}>{c.name}</div>{c.issuer && <div style={{ color: '#5b6b7f', fontSize: '12px', lineHeight: '24px' }}>{c.issuer}</div>}</div>
        <DateRange start={c.year} end="" />
      </div>)}
    </>}
    {data.links.length > 0 && <>
      <SectionTitle>{labels.links}</SectionTitle>
      {data.links.map(l => <div key={l.id} data-cv-block style={{ paddingTop: '6px', paddingBottom: '2px' }}><CvAnchor href={l.url}>{l.label ? `${l.label} — ` : ''}<span dir="ltr">{l.url}</span></CvAnchor></div>)}
    </>}
  </div>;
}
