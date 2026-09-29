import type { RecipeDraft } from '../schema/recipe';
import { autoLinkDraft, linkStepIngredients } from './link-ingredients';

const ings = (...items: string[]) =>
  items.map((item, i) => ({ id: `i${i}`, item }));

describe('linkStepIngredients', () => {
  const list = ings(
    'plain flour',
    'caster sugar',
    'light brown sugar',
    'unsalted butter',
    'large eggs',
    'chicken thighs',
    'Salt and pepper',
    'extra-virgin olive oil',
    'garlic',
    'onions',
  );

  it.each([
    ['Sift the flour into a bowl.', ['i0']],
    ['Cream the butter and caster sugar.', ['i1', 'i3']],
    ['Add the brown sugar.', ['i2']],
    ['Beat in the eggs one at a time.', ['i4']],
    ['Season the chicken with salt.', ['i5', 'i6']],
    ['Add pepper.', ['i6']],
    ['Heat the oil and fry the onion and garlic.', ['i7', 'i8', 'i9']],
    ['Preheat the oven.', []],
    ['Brown the onions well.', ['i9']],
  ])('%s', (text, expected) => {
    expect(linkStepIngredients(text, list)).toEqual(expected);
  });

  it('links all ingredients sharing an ambiguous head noun', () => {
    // "sugar" alone could be either sugar; the user can untick one in the editor.
    expect(
      linkStepIngredients(
        'Stir in the sugar.',
        ings('caster sugar', 'light brown sugar'),
      ),
    ).toEqual(['i0', 'i1']);
  });

  it('prefers an exact full-name match over head-noun matches', () => {
    expect(
      linkStepIngredients('Stir in the sugar.', ings('sugar', 'brown sugar')),
    ).toEqual(['i0']);
  });
});

describe('autoLinkDraft', () => {
  const ID = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const draft: RecipeDraft = {
    title: 'Test',
    sourceType: 'text',
    unitSystem: 'mixed',
    tags: [],
    ingredientSections: [
      {
        id: ID(1),
        ingredients: [
          { id: ID(2), item: 'butter', optional: false, rawText: 'butter' },
          { id: ID(3), item: 'flour', optional: false, rawText: 'flour' },
        ],
      },
    ],
    stepSections: [
      {
        id: ID(4),
        steps: [
          {
            id: ID(5),
            text: 'Melt the butter.',
            glossarySuppress: [],
            ingredientRefs: [],
          },
          {
            id: ID(6),
            text: 'Add the flour.',
            glossarySuppress: [],
            ingredientRefs: [{ ingredientId: ID(2), amountFraction: 0.5 }],
          },
        ],
      },
    ],
  };

  it('fills empty steps and leaves user-linked steps alone', () => {
    const steps = autoLinkDraft(draft).stepSections[0]?.steps ?? [];
    expect(steps[0]?.ingredientRefs).toEqual([
      { ingredientId: ID(2), amountFraction: 1 },
    ]);
    expect(steps[1]?.ingredientRefs).toEqual([
      { ingredientId: ID(2), amountFraction: 0.5 },
    ]);
  });
});
