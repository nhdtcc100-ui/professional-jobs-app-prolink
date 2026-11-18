import React, { CSSProperties } from 'react';
import { CvData, CV_LABELS, PLATFORM_URL } from '../../../lib/cv/cvData';
import { isContactPhone, telUrl, whatsappUrl } from '../../../lib/utils/contact';

export interface CvAssets { logoSrc?: string; avatarSrc?: string }

export const CV_DOCUMENT_RESET = `.prolink-cv,.prolink-cv *{box-sizing:border-box;margin:0;padding:0;font-family:ProlinkCv,Arial,sans-serif;font-synthesis:none;} .prolink-cv a{color:inherit;text-decoration:none;} .prolink-cv img{display:block;max-width:none;} .prolink-cv{color:#243449;background:#fff;text-align:start;line-height:23px;font-size:13.5px;}`;

const textStyle: CSSProperties = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: '23px' };
const linkStyle: CSSProperties = { color: '#0a66c2', textDecoration: 'none', overflowWrap: 'anywhere', fontSize: '12px', lineHeight: '22px', display: 'inline-block' };

function CvAnchor({ href, children, style }: { href: string; children: React.ReactNode; style?: CSSProperties }) {
  return <a data-cv-href={href} href={href} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, ...style }}>{children}</a>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ marginTop: '18px', marginBottom: '9px', paddingBottom: '5px', color: '#0a66c2', borderBottom: '1px solid #dbe5ef', fontSize: '15px', lineHeight: '26px', fontWeight: 750 }}>{children}</h2>;
}

function Description({ text }: { text: string }) {
  return text ? <p style={{ ...textStyle, paddingTop: '4px' }}>{text}</p> : null;
}

function DateRange({ start, end }: { start: string; end: string }) {
  return start || end ? <span style={{ color: '#526478', fontSize: '12px', lineHeight: '22px', overflowWrap: 'anywhere' }}>{[start, end].filter(Boolean).join(' — ')}</span> : null;
}

export function CvFooter({ data, assets }: { data: CvData; assets: CvAssets }) {
  const labels = CV_LABELS[data.settings.language];
  return <div className="prolink-cv" dir={data.settings.language === 'ar' ? 'rtl' : 'ltr'} style={{ width: '794px', height: '48px', padding: '8px 38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #dbe5ef', fontSize: '10px', lineHeight: '20px' }}>
    <CvAnchor href={PLATFORM_URL} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', lineHeight: '20px' }}>
      {assets.logoSrc && <img src={assets.logoSrc} alt="عمل" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '6px' }} />}
      <span>{labels.footerBrand}</span>
    </CvAnchor>
    <span style={{ color: '#526478', fontSize: '10px' }}>{labels.page(1, 1)}</span>
  </div>;
}

export function CvDocument({ data, assets = {} }: { data: CvData; assets?: CvAssets }) {
  const labels = CV_LABELS[data.settings.language];
  const { personal, settings } = data;
  const phone = settings.showPhone && isContactPhone(personal.phone) ? personal.phone : '';
  const hasSidebar = Boolean(data.skills.length || data.languages.length || data.certifications.length || data.links.length);
  return <article className="prolink-cv" dir={settings.language === 'ar' ? 'rtl' : 'ltr'} lang={settings.language} style={{ width: '794px', padding: '34px 38px 22px', minHeight: '240px' }}>
    <style>{CV_DOCUMENT_RESET}</style>
    <header style={{ display: 'flex', gap: '22px', alignItems: 'flex-start', borderTop: '4px solid #0a66c2', borderBottom: '1px solid #dbe5ef', paddingTop: '18px', paddingBottom: '14px' }}>
      <div style={{ flex: '1', minWidth: '0px' }}>
        <h1 style={{ fontWeight: 800, fontSize: '28px', lineHeight: '44px', color: '#172b4d', overflowWrap: 'anywhere' }}>{personal.fullName || labels.documentTitle}</h1>
        {personal.title && <p style={{ color: '#0a66c2', fontSize: '16px', fontWeight: 600, lineHeight: '28px', overflowWrap: 'anywhere' }}>{personal.title}</p>}
        {personal.location && <p style={{ color: '#526478', fontSize: '12px', lineHeight: '24px', paddingTop: '3px', overflowWrap: 'anywhere' }}>{personal.location}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '14px', rowGap: '2px', paddingTop: '4px' }}>
          {phone && <><CvAnchor href={telUrl(phone)}><span dir="ltr">{phone}</span></CvAnchor><CvAnchor href={whatsappUrl(phone)}>{labels.whatsapp}</CvAnchor></>}
          {settings.showEmail && personal.email && <CvAnchor href={`mailto:${encodeURI(personal.email)}`}><span dir="ltr">{personal.email}</span></CvAnchor>}
          {personal.website && <CvAnchor href={personal.website}><span dir="ltr">{personal.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span></CvAnchor>}
        </div>
      </div>
      {settings.showPhoto && assets.avatarSrc && <img src={assets.avatarSrc} alt={personal.fullName} style={{ width: '80px', height: '96px', flexShrink: 0, objectFit: 'cover', borderRadius: '6px' }} />}
    </header>
    {data.summary && <section><SectionTitle>{labels.summary}</SectionTitle><Description text={data.summary} /></section>}
    <div style={{ display: 'grid', gridTemplateColumns: hasSidebar && (data.experiences.length || data.education.length) ? 'minmax(0, 1.9fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', columnGap: '26px' }}>
      {(data.experiences.length > 0 || data.education.length > 0) && <div style={{ minWidth: 0 }}>
        {data.experiences.length > 0 && <section>
          <SectionTitle>{labels.experience}</SectionTitle>
          {data.experiences.map((e, index) => <div key={e.id} style={{ paddingTop: index ? '12px' : '0' }}>
            {e.role && <h3 style={{ fontSize: '14px', fontWeight: 700, lineHeight: '25px', overflowWrap: 'anywhere' }}>{e.role}</h3>}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 12px' }}>
              {(e.company || e.location) && <span style={{ color: '#526478', fontSize: '12px', lineHeight: '22px', overflowWrap: 'anywhere' }}>{[e.company, e.location].filter(Boolean).join(' · ')}</span>}
              <DateRange start={e.start} end={e.current ? labels.present : e.end} />
            </div>
            <Description text={e.description} />
          </div>)}
        </section>}
        {data.education.length > 0 && <section>
          <SectionTitle>{labels.education}</SectionTitle>
          {data.education.map((e, index) => <div key={e.id} style={{ paddingTop: index ? '10px' : '0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, lineHeight: '25px', overflowWrap: 'anywhere' }}>{[e.degree, e.field].filter(Boolean).join(' — ')}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 12px' }}>
              {e.school && <span style={{ color: '#526478', fontSize: '12px', lineHeight: '22px', overflowWrap: 'anywhere' }}>{e.school}</span>}
              <DateRange start={e.start} end={e.end} />
            </div>
            <Description text={e.description} />
          </div>)}
        </section>}
      </div>}
      {hasSidebar && <div style={{ minWidth: 0 }}>
        {data.skills.length > 0 && <section>
          <SectionTitle>{labels.skills}</SectionTitle>
          <p style={textStyle}>{data.skills.join(' · ')}</p>
        </section>}
        {data.languages.length > 0 && <section>
          <SectionTitle>{labels.languages}</SectionTitle>
          {data.languages.map(l => <p key={l.id} style={{ ...textStyle, paddingBottom: '3px' }}><span style={{ fontWeight: 600 }}>{l.name}</span>{l.level && <span style={{ color: '#526478', fontSize: '12px' }}> — {labels.levels[l.level]}</span>}</p>)}
        </section>}
        {data.certifications.length > 0 && <section>
          <SectionTitle>{labels.certifications}</SectionTitle>
          {data.certifications.map((c, index) => <div key={c.id} style={{ paddingTop: index ? '8px' : '0', overflowWrap: 'anywhere' }}>
            <p style={{ fontWeight: 600, lineHeight: '23px' }}>{c.name}</p>
            <p style={{ color: '#526478', fontSize: '12px', lineHeight: '22px' }}>{[c.issuer, c.year].filter(Boolean).join(' · ')}</p>
          </div>)}
        </section>}
        {data.links.length > 0 && <section>
          <SectionTitle>{labels.links}</SectionTitle>
          {data.links.map(l => <p key={l.id} style={{ paddingBottom: '4px' }}><CvAnchor href={l.url}>{l.label || <span dir="ltr">{l.url.replace(/^https?:\/\//, '')}</span>}</CvAnchor></p>)}
        </section>}
      </div>}
    </div>
  </article>;
}
