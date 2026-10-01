import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';

if (!process.env.GITHUB_TOKEN) {
  throw new Error('GITHUB_TOKEN is required to generate real profile statistics.');
}

function render(source, output, assets) {
  const build = spawnSync('npx', [
    '--yes', 'readme-aura@1.0.20', 'build',
    '--source', source, '--output', output, '--assets', assets,
    '--github-user', 'enzostana',
  ], { encoding: 'utf8' });
  process.stdout.write(build.stdout || '');
  process.stderr.write(build.stderr || '');
  if (build.error || build.status !== 0 || /mock (?:repo )?data/i.test((build.stdout || '') + (build.stderr || ''))) {
    throw new Error('README generation failed or returned sample statistics; generated files will not be published.');
  }
  for (const file of readdirSync(assets).filter(name => name.endsWith('.svg'))) {
    const path = `${assets}/${file}`;
    writeFileSync(path, readFileSync(path, 'utf8').replace(/[ \t]+$/gm, ''));
  }
}

render('README.source.md', 'README.md', '.github/assets');

// Derive compact cards from the same source so content stays consistent.
const source = readFileSync('README.source.md', 'utf8');
const blocks = [...source.matchAll(/```aura width=860[^\n]*\n([\s\S]*?)```/g)].map(match => match[0]);
if (blocks.length !== 3) throw new Error('Expected a header, statistics card and tech stack card.');
const mobile = blocks.map((block, index) => {
  block = block.replaceAll('width=860', 'width=430').replaceAll('width="860"', 'width="430"');
  if (index === 0) {
    block = block.replace('left: 48, top: 52, width: 96, height: 96', 'left: 24, top: 52, width: 72, height: 72')
      .replace('borderRadius: 48', 'borderRadius: 36')
      .replace('width={88} height={88}', 'width={64} height={64}')
      .replace('borderRadius: 44', 'borderRadius: 32')
      .replace('marginLeft:168', 'marginLeft:112, marginRight:24')
      .replace('fontSize:38', 'fontSize:28')
      .replace('fontSize:15', 'fontSize:14');
  } else if (index === 2) {
    block = block.replaceAll('height=210', 'height=220').replaceAll('height="210"', 'height="220"')
      .replace("padding: '18px 32px'", "padding: '20px 24px'")
      .replaceAll('fontSize:10', 'fontSize:12').replaceAll('fontSize:12, fontWeight:600', 'fontSize:14, fontWeight:600')
      .replace('gap:16', 'gap:12').replace('width:90', 'width:96');
  }
  return block;
}).join('\n\n');
writeFileSync('.readme-mobile.source.md', mobile);
try {
  render('.readme-mobile.source.md', '.readme-mobile.md', '.github/assets/mobile');
  const mobileImages = [...readFileSync('.readme-mobile.md', 'utf8').matchAll(/!\[[^\]]+\]\(([^ ]+) "[^"]+"\)/g)].map(match => match[1]);
  const descriptions = [
    'Enzo Sá — Data Engineer at @Prefeitura do Rio. Python, SQL, dbt e GCP.',
    'Estatísticas do GitHub: repositórios públicos, estrelas recebidas e commits no histórico dos repositórios.',
    'Tecnologias: Python, SQL, dbt, Git, Linux e GCP. Estudando Docker e Self Hosted.',
  ];
  let readme = readFileSync('README.md', 'utf8');
  let index = 0;
  readme = readme.replace(/!\[[^\]]+\]\(([^ ]+) "[^"]+"\)/g, (_, desktop) => {
    const i = index++;
    return `<p>\n<picture>\n  <source media="(max-width: 600px)" srcset="${mobileImages[i]}">\n  <img src="${desktop}" width="860" alt="${descriptions[i]}">\n</picture>\n</p>`;
  });
  for (const [offset, label] of ['LinkedIn', 'Instagram', 'E-mail'].entries()) {
    readme = readme.replaceAll(`<img src="./.github/assets/readme-aura-component-${offset + 3}-`, `<img alt="${label}" src="./.github/assets/readme-aura-component-${offset + 3}-`);
  }
  writeFileSync('README.md', readme);
} finally {
  for (const temporary of ['.readme-mobile.source.md', '.readme-mobile.md']) {
    try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
