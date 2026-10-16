import { evaluationPairs, type MathSnapshot } from './expression';
import { renderMath } from './mathml';
import { morph, type MathMorph } from './morph';

/**
 * Draws snapshots into a host and animates between neighbors. The host contains a
 * focus layer (emphasis boxes, drawn behind the math) and the expression itself.
 */
export class MathStage {
  private index = 0;
  private active?: MathMorph;
  private readonly layer: HTMLElement;
  private readonly expression: HTMLElement;

  constructor(private readonly host: HTMLElement, private readonly snapshots: MathSnapshot[]) {
    this.layer = Object.assign(document.createElement('div'), { className: 'ml-focus-layer' });
    this.expression = Object.assign(document.createElement('div'), { className: 'ml-expression' });
    this.layer.setAttribute('aria-hidden', 'true');
    host.replaceChildren(this.layer, this.expression);
    this.relayout();
  }

  get animating() { return !!this.active; }

  /** Show a snapshot. Only a single forward step animates; anything else is immediate. */
  show(index: number, animate: boolean, rate = 1): Promise<void> {
    this.settle();
    const previous = this.snapshots[this.index], target = this.snapshots[index];
    const forward = index === this.index + 1;
    this.index = index;
    if (!animate || !forward) { this.paint(target); return Promise.resolve(); }
    const pairs = evaluationPairs(previous.expression, target.expression, target.changes);
    const active = morph(this.host, pairs, target.changes.length > 0, () => this.paint(target), rate);
    this.active = active;
    return active.finished.then(() => { if (this.active === active) this.active = undefined; });
  }

  setRate(rate: number) { this.active?.setRate(rate); }

  /** Jump any running transition to its end state. */
  settle() { this.active?.cancel(); this.active = undefined; }

  /**
   * Keep an anchor fixed for the whole lesson so unchanged parts stay still. An
   * expression keeps its left edge: size it to the widest snapshot. An equation keeps
   * its equals sign at the stage's center (see `paint`). Call again after resizes or font loads.
   */
  relayout() {
    this.settle();
    this.expression.style.width = '';
    if (this.snapshots[0].expression.kind !== 'equation') {
      const probe = Object.assign(document.createElement('div'), { className: 'ml-expression ml-probe' });
      this.host.append(probe);
      const widths = this.snapshots.map(snapshot => { probe.replaceChildren(renderMath(snapshot.expression)); return probe.firstElementChild!.getBoundingClientRect().width; });
      probe.remove();
      this.expression.style.width = `${Math.ceil(Math.max(...widths))}px`;
    }
    this.paint(this.snapshots[this.index]);
  }

  private paint(snapshot: MathSnapshot) {
    const root = snapshot.expression;
    this.expression.replaceChildren(renderMath(root, snapshot.focus));
    const origin = this.host.getBoundingClientRect();
    if (root.kind === 'equation') {
      // Balance on the equals sign: each side grows or shrinks away from it.
      this.expression.style.left = '0px';
      const equals = this.expression.querySelector(`[data-token="${CSS.escape(`${root.id}/=`)}"]`)!.getBoundingClientRect();
      this.expression.style.left = `${origin.left + origin.width / 2 - (equals.left + equals.width / 2)}px`;
    }
    // MathML rows hug their glyphs; pad so the underline clears operators such as +.
    const em = parseFloat(getComputedStyle(this.expression).fontSize), padX = em * .12, padY = em * .1;
    this.layer.replaceChildren(...snapshot.focus.map(id => {
      const bounds = this.expression.querySelector(`[data-node="${CSS.escape(id)}"]`)!.getBoundingClientRect();
      const box = Object.assign(document.createElement('div'), { className: 'ml-focus-box' });
      Object.assign(box.style, { left: `${bounds.left - origin.left - padX}px`, top: `${bounds.top - origin.top - padY}px`,
        width: `${bounds.width + 2 * padX}px`, height: `${bounds.height + 2 * padY}px` });
      return box;
    }));
  }
}
