import { createRequire } from 'node:module';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function exportPresentationPptx({ deck, output, width, height }) {
  const require = createRequire(import.meta.url);
  const module = require.resolve('@oai/artifact-tool', {
    paths: [process.env.PRESENTATION_RUNTIME_MODULES || process.cwd()]
  });
  const { Presentation, PresentationFile } = await import(pathToFileURL(module).href);
  const presentation = Presentation.create({ slideSize: { width, height } });

  // Image-backed slides preserve the React deck's layout across PowerPoint versions.
  for (const section of await deck.locator('.presentation-section').all()) {
    const content = await section.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        text: element.innerText,
        links: [...element.querySelectorAll('a[href]')].map(link => {
          const bounds = link.getBoundingClientRect();
          return {
            uri: new URL(link.getAttribute('href'), 'https://adrifttw.com').href,
            left: bounds.left - rect.left, top: bounds.top - rect.top,
            width: bounds.width, height: bounds.height
          };
        }).filter(link => link.width && link.height)
      };
    });
    const image = await section.screenshot({ animations: 'disabled' });
    const slide = presentation.slides.add();
    slide.images.add({
      blob: image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength),
      contentType: 'image/png',
      alt: content.text,
      fit: 'contain',
      position: { left: 0, top: 0, width, height }
    });
    for (const { uri, ...position } of content.links) {
      slide.shapes.add({
        geometry: 'rect', position, fill: '#FFFFFF00',
        line: { fill: 'none', width: 0 },
        hyperlink: { uri, isExternal: true }
      });
    }
    slide.speakerNotes.text = content.text + '\n\n' + content.links.map(link => link.uri).join('\n');
  }
  const staging = await mkdtemp(join(tmpdir(), 'adrift-pptx-'));
  try {
    const candidate = join(staging, 'presentation.pptx');
    await (await PresentationFile.exportPptx(presentation)).save(candidate);
    await copyFile(candidate, output);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  console.log('Exported ' + presentation.slides.items.length + ' slides to ' + fileURLToPath(output));
}
