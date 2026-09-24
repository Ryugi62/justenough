// Real eligibility clauses from Korean public notices (retrieved Sept 2026) and the circuit policy
// each one becomes. Anything a policy cannot express is listed in `notCovered` — never dropped silently.
import { birthRangeFor, parseYMD, type YMD } from './dates';
import type { EligibilityPolicy } from './eligibility';
import { SIDO, sidoOfDistrict } from './regions';

export interface ClausePredicates {
  minAge?: number;
  maxAge?: number;
  sido?: number;
  sigungu?: number;
  student?: boolean;
  unemployed?: boolean;
  maxIncomePct?: number;
}

export interface NoticeClause {
  id: string;
  program: string;
  /** Verbatim eligibility sentence (markup removed). */
  quote: string;
  sourceUrl: string;
  retrieved: string;
  /** Date the age is evaluated on. When the notice gives none, the application deadline. */
  referenceDate: string;
  predicates: ClausePredicates;
  notCovered: string[];
  /** English gloss for the demo's English mode (the Korean quote stays the verbatim source). */
  en: { program: string; quote: string; notCovered: string[] };
}

export const NOTICE_CLAUSES: readonly NoticeClause[] = [
  {
    id: 'defense-ai-2026',
    program: '2026 국방 AI 경진대회 (일반 부문)',
    quote: '일반인 (대한민국 국적의 청년, 만 19~34세)',
    sourceUrl: 'https://www.campuspick.com/contest/view?id=35999',
    retrieved: '2026-09-24',
    referenceDate: '2026-09-30',
    predicates: { minAge: 19, maxAge: 34 },
    notCovered: ['국적: 발급기관이 내국인에게만 증명을 발급하는 방식으로 처리'],
    en: { program: '2026 Defense AI Competition (general track)', quote: 'General public (young Korean nationals aged 19–34)', notCovered: ['Nationality: handled by the issuer issuing credentials to Korean nationals only'] },
  },
  {
    id: 'youth-open-innovation-2026',
    program: '2026 청년 오픈이노베이션 챌린지 (대학(원)생 경로)',
    quote: '혁신적인 아이디어를 보유한 전국 소재의 만 34세 이하 대학(원)생 및 청년 예비창업자(팀)',
    sourceUrl: 'https://event-us.kr/brandinq/event/133594',
    retrieved: '2026-09-23',
    referenceDate: '2026-09-18',
    predicates: { maxAge: 34, student: true },
    notCovered: ['청년 예비창업자(팀) 경로: OR 조건이라 별도 프로그램으로 등록'],
    en: { program: '2026 Youth Open Innovation Challenge (university student path)', quote: 'University and graduate students anywhere in Korea, aged 34 or under, with an innovative idea, and young aspiring founders (or teams)', notCovered: ['Aspiring-founder path: an OR condition, registered as a separate programme'] },
  },
  {
    id: 'incheon-tourism-2026',
    program: '2026 인천관광 혁신아이디어 공모전 (인천시민 경로)',
    quote: '인천시민 및 인천 소재 학교 재학생·회사 임직원(유관기관 및 지역관광종사자 포함)',
    sourceUrl: 'https://www.campuspick.com/contest/view?id=35657',
    retrieved: '2026-09-20',
    referenceDate: '2026-09-27',
    predicates: { sido: SIDO.INCHEON },
    notCovered: ['인천 소재 학교 재학생·회사 임직원 경로: 학교·직장 소재지 발급기관이 필요'],
    en: { program: '2026 Incheon Tourism Innovation Idea Contest (Incheon resident path)', quote: 'Incheon residents, and students or employees of schools and companies in Incheon (including related agencies and local tourism workers)', notCovered: ['School or workplace path: needs an issuer for the school or workplace location'] },
  },
  {
    id: 'seocho-startup-station-2026-09',
    program: '서초창업스테이션 9월 1:1 전문분야 컨설팅 (서초구 거주자 우대 트랙)',
    quote: '신청대상: 컨설팅 참여를 희망하는 (예비)창업자 * 서초구 거주자, 서초구 소재 기업 우대',
    sourceUrl: 'https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179169',
    retrieved: '2026-09-12',
    referenceDate: '2026-09-17',
    predicates: { sigungu: 11650 },
    notCovered: ['(예비)창업자 여부: 사업자 정보 발급기관 연동 필요', '서초구 소재 기업 경로', '우대는 가점이므로 별도 트랙으로 등록'],
    en: { program: 'Seocho Startup Station, September 1:1 expert consulting (Seocho-gu resident preference track)', quote: 'Eligible: (aspiring) founders who want consulting * Seocho-gu residents and Seocho-gu companies preferred', notCovered: ['(Aspiring) founder status: needs a business-registry issuer', 'Seocho-gu company path', 'A preference is a bonus, so it is registered as a separate track'] },
  },
  {
    id: 'web3-ai-hackathon-2026',
    program: 'Web3 블록체인 AI융합 해커톤',
    quote: '국내 대학 학부 재·휴학생 2~4인 팀',
    sourceUrl: 'https://www.campuspick.com/contest/view?id=35868',
    retrieved: '2026-09-12',
    referenceDate: '2026-09-14',
    predicates: { student: true },
    notCovered: ['학부/대학원·휴학 구분: 학적 상태 필드 추가 시', '팀 인원 2~4인: 신청 단위 규칙'],
    en: { program: 'Web3 Blockchain x AI Hackathon', quote: 'Teams of 2–4 undergraduates at Korean universities, enrolled or on leave', notCovered: ['Undergraduate vs graduate, on leave: needs an enrolment-status field', 'Team size 2–4: a rule about the application unit'] },
  },
  {
    id: 'unification-ai-idea-2026',
    program: 'AI기반 통일 아이디어 공모전',
    quote: '국내 대학(원)생(충청남도/충청북도/세종특별자치시/대전광역시 소재)',
    sourceUrl: 'https://www.campuspick.com/contest/view?id=33887',
    retrieved: '2026-09-24',
    referenceDate: '2026-09-30',
    predicates: { student: true },
    notCovered: ['학교 소재지 4개 시도 중 하나: 집합 소속 조건(로드맵)'],
    en: { program: 'AI-based Unification Idea Contest', quote: 'University and graduate students at schools in Chungcheongnam-do, Chungcheongbuk-do, Sejong or Daejeon', notCovered: ['School in one of 4 provinces: a set-membership condition (roadmap)'] },
  },
  {
    id: 'green-remodeling-ai-film-2026',
    program: '그린리모델링 온라인 콘텐츠 공모전 (42초 AI 영화제)',
    quote: '[42초 AI 영화제]만 19세 이상 일반 국민 개인 또는 2인 이하 팀',
    sourceUrl: 'https://www.campuspick.com/contest/view?id=35709',
    retrieved: '2026-09-24',
    referenceDate: '2026-09-30',
    predicates: { minAge: 19 },
    notCovered: ['국민 여부: 발급 범위로 처리', '팀 인원 2인 이하: 신청 단위 규칙'],
    en: { program: 'Green Remodeling Online Content Contest (42-second AI film festival)', quote: '[42-second AI film festival] Members of the public aged 19 or over, individually or in teams of up to 2', notCovered: ['Nationality: handled by whom the issuer issues to', 'Team of up to 2: a rule about the application unit'] },
  },
];

/**
 * The flagship demo programme. SYNTHETIC — modelled on the clause shape common in Korean youth
 * allowances (age band + residence + not employed + income cap); not a real notice.
 */
export const DEMO_PROGRAM: NoticeClause = {
  id: 'demo-youth-job-seeker-allowance',
  program: '[가상 공고] 청년 구직 활동 지원금',
  quote: '공고일 기준 서울특별시에 거주하는 만 19~34세 미취업 청년으로 가구 소득이 기준 중위소득 150% 이하인 사람',
  sourceUrl: 'https://example.invalid/synthetic-demo-notice',
  retrieved: '2026-09-24',
  referenceDate: '2026-09-24',
  predicates: { minAge: 19, maxAge: 34, sido: SIDO.SEOUL, unemployed: true, maxIncomePct: 150 },
  notCovered: [],
  en: { program: '[Synthetic notice] Youth job-seeker allowance', quote: 'Unemployed young people aged 19–34 living in Seoul on the notice date, with household income at or below 150% of the median income', notCovered: [] },
};

/**
 * The 3rd-Web-Hack scenario (`?preset=grant`). SYNTHETIC — a Web3 community grant that must stop one
 * person from claiming twice without collecting ID documents: the nullifier gives one grant per person.
 */
export const GRANT_PROGRAM: NoticeClause = {
  id: 'demo-web3-community-grant',
  program: '[가상 공고] Web3 커뮤니티 빌더 그랜트',
  quote: '서울에 거주하는 만 19~34세 재학생 빌더, 1인 1회 지원',
  sourceUrl: 'https://example.invalid/synthetic-demo-notice',
  retrieved: '2026-09-24',
  referenceDate: '2026-09-24',
  predicates: { minAge: 19, maxAge: 34, sido: SIDO.SEOUL, student: true },
  notCovered: [],
  en: {
    program: '[Synthetic notice] Web3 community builder grant',
    quote: 'Builders aged 19–34 who live in Seoul and are enrolled students. One grant per person.',
    notCovered: [],
  },
};

export function policyFromClause(clause: NoticeClause): EligibilityPolicy {
  const p = clause.predicates;
  const hasAny = Object.values(p).some((v) => v !== undefined && v !== false);
  if (!hasAny) throw new Error(`Clause ${clause.id} has no predicate a circuit can check`);
  const referenceDate: YMD = parseYMD(clause.referenceDate);
  const sido = p.sido ?? (p.sigungu !== undefined ? sidoOfDistrict(p.sigungu) : 0);
  if (p.sigungu !== undefined && sidoOfDistrict(p.sigungu) !== sido) {
    throw new Error(`Clause ${clause.id}: district ${p.sigungu} is not in province ${sido}`);
  }
  return {
    ...birthRangeFor(referenceDate, { minAge: p.minAge, maxAge: p.maxAge }),
    sido,
    sigungu: p.sigungu ?? 0,
    requireStudent: p.student ?? false,
    requireUnemployed: p.unemployed ?? false,
    maxIncomePct: p.maxIncomePct ?? 0,
    referenceDate,
  };
}
