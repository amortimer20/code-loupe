import { getCollection, type CollectionEntry } from 'astro:content';
import { parseLesson } from 'code-loupe/lesson';
import { buildSnapshots } from 'code-loupe/state';

export interface Sample {
  entry: CollectionEntry<'samples'>;
  yaml: string;
  steps: number;
}

const sources = import.meta.glob<string>('../../../../lessons/*/*/lesson.yaml', {
  query: '?raw', import: 'default', eager: true,
});

// Run validation through the same model used by the browser player. Invalid
// corpus entries fail the site build instead of becoming broken published demos.
export async function getSamples(): Promise<Sample[]> {
  const entries = await getCollection('samples');
  if (entries.length !== Object.keys(sources).length) {
    throw new Error('Every lesson folder must contain both lesson.yaml and index.md.');
  }
  const samples = await Promise.all(entries.map(async (entry) => {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(entry.id)) {
      throw new Error(`Sample ID must be language/slug: ${entry.id}`);
    }
    const yaml = sources[`../../../../lessons/${entry.id}/lesson.yaml`];
    if (yaml === undefined) throw new Error(`Missing YAML for ${entry.id}`);
    try {
      const lesson = parseLesson(yaml);
      if (lesson.language !== entry.data.language) throw new Error('Metadata and lesson languages differ.');
      buildSnapshots(lesson);
      return { entry, yaml, steps: lesson.steps.length };
    } catch (error) {
      throw new Error(`Invalid sample ${entry.id}: ${(error as Error).message}`);
    }
  }));
  return samples.sort((a, b) => a.entry.data.order - b.entry.data.order || a.entry.id.localeCompare(b.entry.id));
}

export function sitePath(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
