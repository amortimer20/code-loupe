import type { APIRoute } from 'astro';
import { getSamples } from '../../lib/samples';

export async function getStaticPaths() {
  return (await getSamples()).map(sample => ({ params: { id: sample.entry.id }, props: { yaml: sample.yaml } }));
}

export const GET: APIRoute = ({ props }) => new Response(props.yaml, {
  headers: { 'Content-Type': 'application/yaml; charset=utf-8' },
});
