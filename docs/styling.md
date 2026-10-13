# Starter styling

Code Loupe has three coordinated presets selected with its `theme` attribute:

| Preset | Appearance |
| --- | --- |
| `paper` | Warm paper, dark text, teal accents |
| `midnight` | Deep navy, blue accents, colorful syntax |
| `terminal` | Charcoal green, green accents, warm numeric values |

Syntax highlighting and runtime literals use the same preset. Each also defines
panel, badge, console, variable-name, error, and control colors. The presets are
data in `packages/player/src/themes.ts`, used by the lesson player. They are
Code Loupe palettes, not ports of Phosphor's six themes or Omarchy theme files.

Square corners apply to all presets and regular Shiki themes. Code, console,
and runtime values use a monospace stack with ligatures off. JetBrains Mono is
preferred if the host has installed or loaded it; no web font is bundled yet.

## Theme selection

The demo site's **Appearance** picker offers Light and Dark, independently of
lesson colors. Light uses white panels on a slate page; Dark uses raised navy
panels on a darker page. Fields, selected cards, navigation, and tags have distinct
surfaces; square corners remain. The initial appearance follows the system color
preference and is remembered under `code-loupe:site-theme` before first paint.
Previous Paper preferences migrate to Light; Midnight/Terminal migrate to Dark.

The separate **Lesson theme** picker changes every player, including a playground
preview created later. It remembers the preset under `code-loupe:lesson-theme`,
with Midnight as the default. Previous site palette choices are preserved as
lesson preferences. The YAML editor follows site appearance (Paper highlighting
in Light, Midnight in Dark). Changing site appearance preserves form edits,
source-editor selection, and the player's current step and theme. Blocked storage
still allows changing both choices for the current page. Independent embeds
continue selecting their own theme.

```html
<code-loupe src="lesson.yaml" theme="paper"></code-loupe>
```

Regular Shiki theme names still work, and standalone players retain `dark-plus`
as their default. A theme change pauses playback, re-highlights code and values,
and preserves the current lesson and step. It does not fetch the lesson again
or discard a directly loaded YAML draft. Rapid choices finish with the latest
theme, including while a lesson is loading.

## Checks and limits

Automated checks cover the presets' text and syntax colors against their base,
panel, badge, and active-line surfaces at a minimum 4.5:1 contrast ratio, plus
accent-button text. Highlighting checks cover Python, JavaScript, and badge
literals. These checks do not constitute a full accessibility audit of the
rendered player, arbitrary Shiki themes, or real classroom projectors.

Browser tests also cover remembered selection, rapid theme/load changes, draft
preservation, regular Shiki themes, and blocked storage. Reviewed screenshot
references cover the three presets, nested frames and returns, plus a narrow
player and the gallery/Builder in both site appearances. See [Testing](testing.md) for the canonical
Docker environment and how to review intentional visual changes.

The site uses its own Light/Dark design with monospace headings/code and
sans-serif forms. Site tokens do not alter the embedded player palettes.

The sample page's four-corner **Enter fullscreen** icon sits at the top right of
the player card and opens the existing player in a viewport-sized modal.
Escape or the same icon (**Exit fullscreen**) restores the inline view and its
page position. The player stays connected, preserving its step, theme, and frames.
The internal title stays visible in both views. An optional `viewer-actions`
slot places host-provided controls at the card's top right; the sample site uses
it for this toggle and adds title padding through the `title` CSS part.
Fullscreen here fills the browser viewport; it does not hide browser chrome.
Code and data panes scroll internally, with captions, console, and controls below
them. The active code line is kept in view, with room above it for badges.
In bounded players, the data pane also reveals the selected cell or the shared
list involved in a binding, mutation, or read. This scrolls the pane, not the page;
other variables remain reachable within it.

Embeds can opt into the same bounded layout with `fit` and a definite host height:

```html
<code-loupe src="lesson.yaml" theme="midnight" fit style="height: 70dvh"></code-loupe>
```

The first focus-view iteration preserves code font size and row spacing. Compact
spacing and automatic density changes are still future design work; larger code
or stacks can require scrolling within their panes.

The player stacks its data panel below the code at narrow container widths;
the playground stacks its editor and preview. A future responsive design session
should consider long code lines, deeper stacks, collections, constrained embed
heights, resizable panes, and teacher-selected layouts. That work is backlogged,
along with a supported host-provided token API, typography controls, and stable
CSS parts for embedding into Phosphor.
