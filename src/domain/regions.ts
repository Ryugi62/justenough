import type { Lang } from './lang';

// Province (시도) codes: the first two digits of the Korean legal-dong code (행정표준코드 법정동코드).
// District (시군구) codes are the first five digits, so a district code always starts with its province.

export const SIDO = {
  SEOUL: 11,
  BUSAN: 26,
  DAEGU: 27,
  INCHEON: 28,
  GWANGJU: 29,
  DAEJEON: 30,
  ULSAN: 31,
  SEJONG: 36,
  GYEONGGI: 41,
  CHUNGBUK: 43,
  CHUNGNAM: 44,
  JEONNAM: 46,
  GYEONGBUK: 47,
  GYEONGNAM: 48,
  JEJU: 50,
  GANGWON: 51,
  JEONBUK: 52,
} as const;

const NAMES: Record<number, string> = {
  11: '서울특별시',
  26: '부산광역시',
  27: '대구광역시',
  28: '인천광역시',
  29: '광주광역시',
  30: '대전광역시',
  31: '울산광역시',
  36: '세종특별자치시',
  41: '경기도',
  43: '충청북도',
  44: '충청남도',
  46: '전라남도',
  47: '경상북도',
  48: '경상남도',
  50: '제주특별자치도',
  51: '강원특별자치도',
  52: '전북특별자치도',
};

const NAMES_EN: Record<number, string> = {
  11: 'Seoul',
  26: 'Busan',
  27: 'Daegu',
  28: 'Incheon',
  29: 'Gwangju',
  30: 'Daejeon',
  31: 'Ulsan',
  36: 'Sejong',
  41: 'Gyeonggi-do',
  43: 'Chungcheongbuk-do',
  44: 'Chungcheongnam-do',
  46: 'Jeollanam-do',
  47: 'Gyeongsangbuk-do',
  48: 'Gyeongsangnam-do',
  50: 'Jeju',
  51: 'Gangwon',
  52: 'Jeonbuk',
};

// Districts used by the demo and the clause table (subset).
const DISTRICTS: Record<number, { ko: string; en: string }> = {
  11620: { ko: '서울 관악구', en: 'Gwanak-gu, Seoul' },
  11650: { ko: '서울 서초구', en: 'Seocho-gu, Seoul' },
  11680: { ko: '서울 강남구', en: 'Gangnam-gu, Seoul' },
  26110: { ko: '부산 중구', en: 'Jung-gu, Busan' },
  28110: { ko: '인천 중구', en: 'Jung-gu, Incheon' },
  41110: { ko: '경기 수원시', en: 'Suwon, Gyeonggi-do' },
};

export function sidoName(code: number, lang: Lang = 'ko'): string {
  if (lang === 'en') return NAMES_EN[code] ?? `province ${code}`;
  return NAMES[code] ?? `시도 ${code}`;
}

export function districtName(code: number, lang: Lang = 'ko'): string {
  const d = DISTRICTS[code];
  if (lang === 'en') return d?.en ?? `district ${code}`;
  return d?.ko ?? `시군구 ${code}`;
}

export function isKnownSido(code: number): boolean {
  return code in NAMES;
}

export function sidoOfDistrict(sigungu: number): number {
  return Math.floor(sigungu / 1000);
}
