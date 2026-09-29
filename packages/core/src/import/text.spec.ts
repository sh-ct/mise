import { RecipeDraftSchema, allIngredients, allSteps } from '../schema/recipe';
import { plainTextParser } from './parser';
import { parseRecipeText } from './text';

let n = 0;
const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

describe('parseRecipeText', () => {
  describe('with headings, sub-sections and numbered steps', () => {
    const draft = parseRecipeText(
      `Lemon Drizzle Cake
A reliable bake for any occasion.
Serves 8
Prep time: 20 mins
Cook time: 45 minutes

Ingredients
225g unsalted butter, softened
225g caster sugar
4 eggs
225g self-raising flour
Zest of 1 lemon

For the drizzle:
Juice of 1½ lemons
85g caster sugar

Method
1. Heat the oven to 180C. Beat together the butter and sugar
until pale and creamy.
2. Add the eggs one at a time, then fold in the flour and zest.
3. Bake for 45-50 minutes.

For the drizzle:
4. Mix the lemon juice and sugar and pour over the warm cake.

Notes
Keeps for 3 days in a tin.`,
      { idFactory: ids },
    );

    it('produces a valid draft', () => {
      expect(RecipeDraftSchema.safeParse(draft).success).toBe(true);
    });

    it('reads title, description and metadata', () => {
      expect(draft).toMatchObject({
        title: 'Lemon Drizzle Cake',
        description:
          'A reliable bake for any occasion.\nKeeps for 3 days in a tin.',
        servings: 8,
        prepMinutes: 20,
        cookMinutes: 45,
        sourceType: 'text',
        unitSystem: 'metric',
      });
    });

    it('splits ingredient sub-sections', () => {
      expect(
        draft.ingredientSections.map((s) => [
          s.title,
          s.ingredients.map((i) => i.item),
        ]),
      ).toEqual([
        [
          undefined,
          [
            'unsalted butter',
            'caster sugar',
            'eggs',
            'self-raising flour',
            'Zest of 1 lemon',
          ],
        ],
        ['For the drizzle', ['Juice of 1½ lemons', 'caster sugar']],
      ]);
    });

    it('re-joins wrapped numbered steps and keeps step sub-sections', () => {
      expect(
        draft.stepSections.map((s) => [s.title, s.steps.map((t) => t.text)]),
      ).toEqual([
        [
          undefined,
          [
            'Heat the oven to 180C. Beat together the butter and sugar until pale and creamy.',
            'Add the eggs one at a time, then fold in the flour and zest.',
            'Bake for 45-50 minutes.',
          ],
        ],
        [
          'For the drizzle',
          ['Mix the lemon juice and sugar and pour over the warm cake.'],
        ],
      ]);
    });
  });

  describe('without headings', () => {
    const draft = parseRecipeText(
      `Quick Tomato Pasta

200g spaghetti
2 tbsp olive oil
2 garlic cloves, sliced
400g tin chopped tomatoes
Basil, to serve

Cook the spaghetti in salted water.
Meanwhile, fry the garlic in the oil for 1 minute, add the tomatoes and simmer for 10 minutes.
Toss with the pasta and scatter over the basil.`,
      { idFactory: ids },
    );

    it('infers ingredients then steps', () => {
      expect(draft.title).toBe('Quick Tomato Pasta');
      expect(allIngredients(draft).map((i) => i.item)).toEqual([
        'spaghetti',
        'olive oil',
        'garlic cloves',
        'tin chopped tomatoes',
        'Basil',
      ]);
      expect(allSteps(draft)).toHaveLength(3);
    });

    it('links steps to ingredients', () => {
      const byId = new Map(allIngredients(draft).map((i) => [i.id, i.item]));
      expect(
        allSteps(draft)[1]?.ingredientRefs.map((r) => byId.get(r.ingredientId)),
      ).toEqual(['olive oil', 'garlic cloves', 'tin chopped tomatoes']);
    });
  });

  describe('OCR-style hard-wrapped paragraphs', () => {
    const draft = parseRecipeText(
      `SHORTBREAD
Makes 16 fingers

INGREDIENTS
• 250g plain flour
• 75g caster sugar
• 175g butter, cubed

METHOD
Rub the butter into the flour and sugar until the
mixture resembles breadcrumbs, then knead to a
smooth dough.

Press into a tin and bake for 25-30
minutes until pale golden.`,
      { sourceType: 'scan', idFactory: ids },
    );

    it('joins wrapped lines into paragraphs as steps', () => {
      expect(allSteps(draft).map((s) => s.text)).toEqual([
        'Rub the butter into the flour and sugar until the mixture resembles breadcrumbs, then knead to a smooth dough.',
        'Press into a tin and bake for 25-30 minutes until pale golden.',
      ]);
    });

    it('reads yield, bullets and scan source', () => {
      expect(draft).toMatchObject({
        title: 'SHORTBREAD',
        servings: 16,
        yieldText: '16 fingers',
        sourceType: 'scan',
      });
      expect(allIngredients(draft).map((i) => i.item)).toEqual([
        'plain flour',
        'caster sugar',
        'butter',
      ]);
    });
  });

  it('never loses a recipe with no structure at all', () => {
    const draft = parseRecipeText('Just mix everything and bake it.');
    expect(draft.title).toBe('Just mix everything and bake it');
    expect(RecipeDraftSchema.safeParse(draft).success).toBe(true);
  });

  it('is exposed through the RecipeParser interface', async () => {
    expect(plainTextParser.canParse({ kind: 'html', html: '' })).toBe(false);
    const draft = await plainTextParser.parse({
      kind: 'ocr',
      text: 'Toast\n1 slice bread\nToast the bread.',
    });
    expect(draft?.sourceType).toBe('scan');
  });
});
