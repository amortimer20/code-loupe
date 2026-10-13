export interface LanguageChoice { id: string; name: string; aliases?: readonly string[] }
const common = ['python', 'javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'html', 'css'];

/** Catalog metadata only: selecting a language never rewrites an imported alias. */
export function languageChoices(catalog: readonly LanguageChoice[], current: string): LanguageChoice[] {
  const choices = [...catalog].sort((a, b) => {
    const first = common.indexOf(a.id), second = common.indexOf(b.id);
    if (first >= 0 || second >= 0) return (first < 0 ? common.length : first) - (second < 0 ? common.length : second);
    return a.name.localeCompare(b.name, 'en');
  });
  if (!choices.some(choice => choice.id === current)) {
    const alias = catalog.find(choice => choice.aliases?.includes(current));
    choices.unshift({ id:current, name:alias ? `${alias.name} (${current})` : current ? `${current} (current language)` : 'Choose a language' });
  }
  return choices;
}
