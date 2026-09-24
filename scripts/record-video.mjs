// Demo video: TTS narration (macOS `say`: Yuna for Korean, Samantha for English) + screen recording of
// the deck and the live demo (Playwright, 1280x720) with captions burned in, muxed by ffmpeg. No human voice.
// Korean (Midnight Korea Hackathon):  FFMPEG=/path/to/ffmpeg node scripts/record-video.mjs
// English (3rd-Web-Hack, grant preset, 3:2 deck slides as PNGs):
//   FFMPEG=… node scripts/record-video.mjs --lang en --preset grant --scenes docs/video/scenes-en.json \
//     --deck docs/video/work-en/slides.html --name JustEnough-demo-en
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const LANG = opt('lang', 'ko');
const PRESET = opt('preset', 'youth');
const NAME = opt('name', 'JustEnough-demo');
const OUT = 'docs/video';
const WORK = join(OUT, LANG === 'ko' ? 'work' : `work-${LANG}`);
mkdirSync(WORK, { recursive: true });
const scenes = JSON.parse(readFileSync(opt('scenes', join(OUT, 'scenes.json')), 'utf8'));
const VOICE = LANG === 'ko' ? ['-v', 'Yuna', '-r', '188'] : ['-v', 'Samantha', '-r', '175'];
const READY = LANG === 'ko' ? '자격만 증명해요' : 'not who you are';

// 1) narration clips and their durations
for (const s of scenes) {
  const aiff = join(WORK, `${s.id}.aiff`);
  execFileSync('say', [...VOICE, '-o', aiff, LANG === 'ko' ? s.ko : s.en]);
  const wav = join(WORK, `${s.id}.wav`);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', aiff, '-ar', '48000', '-ac', '2', wav]);
}
function durationOf(wav) {
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', wav], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(String(e.stderr));
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  throw new Error(`no duration for ${wav}`);
}
for (const s of scenes) s.seconds = durationOf(join(WORK, `${s.id}.wav`));

// 2) recording
const server = await preview({ root: 'web', build: { outDir: '../dist' }, preview: { port: 4174 }, logLevel: 'error' });
const appUrl = `${server.resolvedUrls.local[0]}?lang=${LANG}${PRESET === 'youth' ? '' : `&preset=${PRESET}`}`;
const deckUrl = 'file://' + resolve(opt('deck', 'docs/deck/deck.html'));
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  locale: LANG === 'ko' ? 'ko-KR' : 'en-US',
  recordVideo: { dir: WORK, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
const t0 = Date.now();

const CAPTION_CSS = `
#je-cap{position:fixed;left:0;right:0;bottom:0;z-index:99999;background:rgba(10,14,20,.86);color:#fff;
padding:12px 40px 14px;font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;text-align:center}
#je-cap .ko{font-size:23px;font-weight:700;line-height:1.35}
#je-cap .en{font-size:17px;color:#cfd8e3;margin-top:4px;line-height:1.35}
footer.cta{position:static!important} body{padding-bottom:150px!important}
.je-click{outline:4px solid #ffb020!important;outline-offset:3px}`;

async function caption(s) {
  await page.evaluate(
    ({ css, ko, en }) => {
      if (!document.getElementById('je-cap-style')) {
        const st = document.createElement('style');
        st.id = 'je-cap-style';
        st.textContent = css;
        document.head.appendChild(st);
      }
      let el = document.getElementById('je-cap');
      if (!el) {
        el = document.createElement('div');
        el.id = 'je-cap';
        document.body.appendChild(el);
      }
      el.innerHTML = `<div class="ko"></div><div class="en"></div>`;
      el.querySelector('.ko').textContent = ko;
      el.querySelector('.en').textContent = en;
    },
    { css: CAPTION_CSS, ko: LANG === 'ko' ? s.ko : s.en, en: LANG === 'ko' ? s.en : '' },
  );
}

async function click(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((el) => el.classList.add('je-click'));
  await page.waitForTimeout(450);
  await locator.click();
}

let onApp = false;
const starts = [];
for (const s of scenes) {
  const start = (Date.now() - t0) / 1000;
  starts.push(start);
  if (s.target.startsWith('slide:')) {
    const n = Number(s.target.split(':')[1]);
    if (onApp || page.url() === 'about:blank') {
      await page.goto(deckUrl);
      onApp = false;
    }
    await page.evaluate((y) => window.scrollTo(0, y), (n - 1) * 720);
    await caption(s);
  } else {
    if (!onApp) {
      await page.goto(appUrl);
      await page.getByText(READY).first().waitFor();
      onApp = true;
    }
    await caption(s);
    for (const a of (s.action ?? '').split('+').filter(Boolean)) {
      if (a === 'open') continue;
      if (a === 'cta') await click(page.locator('footer.cta button.primary'));
      else if (a.startsWith('button:')) await click(page.getByRole('button', { name: a.slice(7) }));
      else if (a.startsWith('scroll:')) await page.locator(a.slice(7)).last().evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(700);
      // keep the circuit's answer on screen (above the caption bar)
      await page.evaluate(() => document.querySelector('.notice')?.scrollIntoView({ block: 'center' }));
      await caption(s);
    }
  }
  const elapsed = (Date.now() - t0) / 1000 - start;
  await page.waitForTimeout(Math.max(0, (s.seconds + 0.9 - elapsed) * 1000));
}
const total = (Date.now() - t0) / 1000;
const recorded = await page.video().path();
await ctx.close();
await browser.close();
server.httpServer.close();

renameSync(recorded, join(WORK, 'screen.webm')); // this run's recording, never a stale one

// 3) audio track: each clip at its scene start
const inputs = scenes.flatMap((s) => ['-i', join(WORK, `${s.id}.wav`)]);
const delays = scenes.map((s, i) => `[${i}:a]adelay=${Math.round(starts[i] * 1000)}|${Math.round(starts[i] * 1000)}[a${i}]`).join(';');
const mix = `${delays};${scenes.map((_, i) => `[a${i}]`).join('')}amix=inputs=${scenes.length}:normalize=0,apad,atrim=0:${total.toFixed(2)}[aout]`;
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', mix, '-map', '[aout]', join(WORK, 'narration.wav')]);

// 4) mux → mp4 (H.264 + AAC)
execFileSync(FFMPEG, [
  '-y', '-loglevel', 'error',
  '-i', join(WORK, 'screen.webm'), '-i', join(WORK, 'narration.wav'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'medium', '-r', '30',
  '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart',
  join(OUT, `${NAME}.mp4`),
]);

// 5) English subtitle file (also burned in) for platforms that take .srt
const ts = (x) => {
  const ms = Math.round(x * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, '0')}`;
};
writeFileSync(
  join(OUT, `${NAME}.en.srt`),
  scenes.map((s, i) => `${i + 1}\n${ts(starts[i])} --> ${ts(starts[i] + s.seconds)}\n${s.en}\n`).join('\n'),
);
console.log(JSON.stringify({ seconds: Math.round(total), scenes: scenes.length, out: join(OUT, `${NAME}.mp4`) }));
