import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const samples = defineCollection({
  loader: glob({
    base: '../../lessons',
    pattern: '**/index.md',
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: z.object({
    title: z.string().min(1),
    language: z.string().min(1),
    languageLabel: z.string().min(1),
    summary: z.string().min(1),
    objective: z.string().min(1),
    prerequisites: z.array(z.string()),
    topics: z.array(z.string().min(1)).min(1),
    mode: z.literal('authored'),
    order: z.number().int().nonnegative(),
  }),
});

export const collections = { samples };
