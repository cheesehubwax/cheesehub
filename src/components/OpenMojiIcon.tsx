import type { FC } from 'react';
import svg1 from 'openmoji/color/svg/1F3E0.svg';
import svg2 from 'openmoji/color/svg/26A1.svg';
import svg3 from 'openmoji/color/svg/26D4.svg';
import svg4 from 'openmoji/color/svg/1F331.svg';
import svg5 from 'openmoji/color/svg/1F3DB.svg';
import svg6 from 'openmoji/color/svg/1F4A7.svg';
import svg7 from 'openmoji/color/svg/1F510.svg';
import svg8 from 'openmoji/color/svg/1F6D2.svg';
import svg9 from 'openmoji/color/svg/1F3A7.svg';
import svg10 from 'openmoji/color/svg/1F504.svg';
import svg11 from 'openmoji/color/svg/1F465.svg';
import svg12 from 'openmoji/color/svg/2795.svg';
import svg13 from 'openmoji/color/svg/1F50C.svg';
import svg14 from 'openmoji/color/svg/1F9C0.svg';
import svg15 from 'openmoji/color/svg/1F4D0.svg';
import svg16 from 'openmoji/color/svg/1F534.svg';
import svg17 from 'openmoji/color/svg/26A0.svg';
import svg18 from 'openmoji/color/svg/1F525.svg';
import svg19 from 'openmoji/color/svg/2716.svg';
import svg20 from 'openmoji/color/svg/1F4C8.svg';
import svg21 from 'openmoji/color/svg/2705.svg';
import svg22 from 'openmoji/color/svg/23F0.svg';
import svg23 from 'openmoji/color/svg/1F3C6.svg';
import svg24 from 'openmoji/color/svg/1F5BC.svg';
import svg25 from 'openmoji/color/svg/1F4B0.svg';
import svg26 from 'openmoji/color/svg/1F4DC.svg';
import svg27 from 'openmoji/color/svg/26CF.svg';
import svg28 from 'openmoji/color/svg/270D.svg';
import svg29 from 'openmoji/color/svg/1F4E2.svg';
import svg30 from 'openmoji/color/svg/1F570.svg';
import svg31 from 'openmoji/color/svg/1F48E.svg';
import svg32 from 'openmoji/color/svg/1F3E6.svg';
import svg33 from 'openmoji/color/svg/2B50.svg';
import svg34 from 'openmoji/color/svg/1F4C5.svg';
import svg35 from 'openmoji/color/svg/1F550.svg';
import svg36 from 'openmoji/color/svg/1F4B5.svg';
import svg37 from 'openmoji/color/svg/1F389.svg';
import svg38 from 'openmoji/color/svg/1F4B8.svg';
import svg39 from 'openmoji/color/svg/1F512.svg';
import svg40 from 'openmoji/color/svg/23F3.svg';
import svg41 from 'openmoji/color/svg/1F6E1.svg';
import svg42 from 'openmoji/color/svg/1F4E6.svg';
import svg43 from 'openmoji/color/svg/1F32E.svg';
import svg44 from 'openmoji/color/svg/1F5A5.svg';
import svg45 from 'openmoji/color/svg/1F4E1.svg';
import svg46 from 'openmoji/color/svg/1F464.svg';
import svg47 from 'openmoji/color/svg/274C.svg';
import svg48 from 'openmoji/color/svg/1F5DE.svg';
import svg49 from 'openmoji/color/svg/1F50D.svg';
import svg50 from 'openmoji/color/svg/1F4C2.svg';
import svg51 from 'openmoji/color/svg/1F45B.svg';

export const openMojiMap: Record<string, string> = {
  "🏠": svg1,
  "⚡": svg2,
  "⛔": svg3,
  "🌱": svg4,
  "🏛": svg5,
  "💧": svg6,
  "🔐": svg7,
  "🛒": svg8,
  "🎧": svg9,
  "🔄": svg10,
  "👥": svg11,
  "➕": svg12,
  "🔌": svg13,
  "🧀": svg14,
  "📐": svg15,
  "🔴": svg16,
  "⚠": svg17,
  "🔥": svg18,
  "✖": svg19,
  "📈": svg20,
  "✅": svg21,
  "⏰": svg22,
  "🏆": svg23,
  "🖼": svg24,
  "💰": svg25,
  "📜": svg26,
  "⛏": svg27,
  "✍": svg28,
  "📢": svg29,
  "🕰": svg30,
  "💎": svg31,
  "🏦": svg32,
  "⭐": svg33,
  "📅": svg34,
  "🕐": svg35,
  "💵": svg36,
  "🎉": svg37,
  "💸": svg38,
  "🔒": svg39,
  "⏳": svg40,
  "🛡": svg41,
  "📦": svg42,
  "🌮": svg43,
  "🖥": svg44,
  "📡": svg45,
  "👤": svg46,
  "❌": svg47,
  "🗞": svg48,
  "🔍": svg49,
  "📂": svg50,
};

export interface OpenMojiIconProps {
  emoji: string;
  size?: number;
  className?: string;
  alt?: string;
}

export const OpenMojiIcon: FC<OpenMojiIconProps> = ({ emoji, size = 24, className, alt }) => {
  const normalized = emoji.replace(/\uFE0F/g, '');
  const src = openMojiMap[normalized] || openMojiMap[emoji];
  if (!src) {
    return <span className={className}>{emoji}</span>;
  }
  return (
    <img
      src={src}
      alt={alt || emoji}
      className={className}
      style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}
      loading="lazy"
    />
  );
};
