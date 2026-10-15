/** Prototype display fixtures, not a public format or symbolic math engine. */
export interface MathPart { text: string; parts?: MathPart[]; emphasis?: boolean; id?: string }
export interface MathVariable { name: string; value: number | 'unknown' }
export type MathTransition =
  | { kind: 'introduce'; parts: string[] }
  | { kind: 'evaluate'; evaluations: { source: string; result: string }[]; cancellation?: { group: string; terms: string[]; intermediate: string } };
export interface MathStep {
  left: MathPart[]; right?: MathPart[]; spoken: string; caption: string;
  variables?: MathVariable[]; anchorTo?: number; transition?: MathTransition;
}
export interface MathExample { id: string; title: string; objective: string; variables?: MathVariable[]; steps: MathStep[] }
const part = (text: string, emphasis = false, id?: string): MathPart => ({ text, emphasis, id });
const group = (parts: MathPart[], id: string): MathPart => ({ text:'', parts, id });
export const mathExamples: MathExample[] = [
  {
    id:'order', title:'Multiplication before addition',
    objective:'Follow the order of operations, one calculation at a time.',
    steps:[
      { anchorTo:0, left:[part('3 + ', false, 'prefix'), part('2 × 4', true, 'product')], spoken:'3 plus 2 times 4', caption:'Multiply before adding. First focus on two times four.' },
      { anchorTo:0, transition:{ kind:'evaluate', evaluations:[{ source:'product', result:'product-result' }] }, left:[group([part('3 + ', false, 'prefix'), part('8', true, 'product-result')], 'sum')], spoken:'3 plus 8', caption:'Two groups of four give eight. The addition remains.' },
      { anchorTo:0, transition:{ kind:'evaluate', evaluations:[{ source:'sum', result:'sum-result' }] }, left:[part('11', true, 'sum-result')], spoken:'11', caption:'Now add three and eight to get eleven.' },
    ],
  },
  {
    id:'grouping', title:'Parentheses change the grouping',
    objective:'Compare this grouping with the first example: the same numbers give a different result.',
    steps:[
      { anchorTo:0, left:[group([part('('), part('3 + 2', true, 'addition'), part(')')], 'grouped-sum'), part(' × 4', false, 'factor')], spoken:'Open parenthesis 3 plus 2 close parenthesis, times 4', caption:'Evaluate the sum inside the parentheses first.' },
      { anchorTo:0, transition:{ kind:'evaluate', evaluations:[{ source:'grouped-sum', result:'sum-result' }] }, left:[group([part('5', true, 'sum-result'), part(' × 4', false, 'factor')], 'product')], spoken:'5 times 4', caption:'The grouped sum is five. Now multiply that result by four.' },
      { anchorTo:0, transition:{ kind:'evaluate', evaluations:[{ source:'product', result:'product-result' }] }, left:[part('20', true, 'product-result')], spoken:'20', caption:'Five groups of four give twenty. Grouping changed the order and the result.' },
    ],
  },
  {
    id:'equation', title:'Keep both sides equal', variables:[{ name:'x', value:'unknown' }],
    objective:'Solve a linear equation by applying the same operation to both sides.',
    steps:[
      { left:[part('2x', false, 'left-x'), part(' '), part('+ 3', true, 'left-constant')], right:[part('11', false, 'right-base')], spoken:'2 times x plus 3 equals 11', caption:'First undo the addition of three. We will subtract three from both sides.' },
      { transition:{ kind:'introduce', parts:['left-operation', 'right-operation'] }, left:[part('2x', false, 'left-x'), part(' '), group([part('+ 3', false, 'left-constant'), part(' '), part('− 3', true, 'left-operation')], 'left-cancel')], right:[group([part('11', false, 'right-base'), part(' '), part('− 3', true, 'right-operation')], 'right-subtraction')], spoken:'2 times x plus 3 minus 3 equals 11 minus 3', caption:'Subtract three from each side to preserve equality.' },
      { transition:{ kind:'evaluate', evaluations:[{ source:'right-subtraction', result:'right-result' }], cancellation:{ group:'left-cancel', terms:['left-constant', 'left-operation'], intermediate:'+ 0' } }, left:[part('2x', true, 'left-x')], right:[part('8', true, 'right-result')], spoken:'2 times x equals 8', caption:'The opposite terms +3 and −3 sum to zero. Remove +0 to leave 2x; eleven minus three becomes eight.' },
      { transition:{ kind:'introduce', parts:['left-divisor', 'right-divisor'] }, left:[group([part('2x', false, 'left-x'), part(' '), part('÷ 2', true, 'left-divisor')], 'left-division')], right:[group([part('8', false, 'right-result'), part(' '), part('÷ 2', true, 'right-divisor')], 'right-division')], spoken:'2 times x divided by 2 equals 8 divided by 2', caption:'Divide each side by two to isolate x. Applying the same division preserves equality.' },
      { variables:[{ name:'x', value:4 }], transition:{ kind:'evaluate', evaluations:[{ source:'left-division', result:'left-result' }, { source:'right-division', result:'right-result-final' }] }, left:[part('x', true, 'left-result')], right:[part('4', true, 'right-result-final')], spoken:'x equals 4', caption:'Simplify: two times x divided by two is x, and eight divided by two is four.' },
    ],
  },
];
