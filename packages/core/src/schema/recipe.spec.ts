import { RecipeDraftSchema, type RecipeDraftInput } from './recipe.ts';

const ID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const draft = (
  overrides: Partial<RecipeDraftInput> = {},
): RecipeDraftInput => ({
  id: ID(0),
  title: 'Pancakes',
  sourceType: 'manual',
  ingredientSections: [
    {
      id: ID(1),
      ingredients: [
        {
          id: ID(2),
          qtyMin: 1,
          unit: 'cup',
          item: 'flour',
          rawText: '1 cup flour',
        },
      ],
    },
  ],
  stepSections: [
    {
      id: ID(3),
      steps: [
        { id: ID(4), text: 'Mix.', ingredientRefs: [{ ingredientId: ID(2) }] },
      ],
    },
  ],
  ...overrides,
});

describe('RecipeDraftSchema', () => {
  it('accepts a valid draft and applies defaults', () => {
    const parsed = RecipeDraftSchema.parse(draft());
    expect(parsed.unitSystem).toBe('mixed');
    expect(parsed.tags).toEqual([]);
    expect(parsed.ingredientSections[0]?.ingredients[0]?.optional).toBe(false);
    expect(
      parsed.stepSections[0]?.steps[0]?.ingredientRefs[0]?.amountFraction,
    ).toBe(1);
  });

  it('rejects step references to unknown ingredients', () => {
    const result = RecipeDraftSchema.safeParse(
      draft({
        stepSections: [
          {
            id: ID(3),
            steps: [
              {
                id: ID(4),
                text: 'Mix.',
                ingredientRefs: [{ ingredientId: ID(99) }],
              },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([
      'stepSections',
      0,
      'steps',
      0,
      'ingredientRefs',
      0,
      'ingredientId',
    ]);
  });

  it('rejects an inverted quantity range', () => {
    const result = RecipeDraftSchema.safeParse(
      draft({
        ingredientSections: [
          {
            id: ID(1),
            ingredients: [
              { id: ID(2), qtyMin: 3, qtyMax: 2, item: 'eggs', rawText: '' },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('only accepts http(s) URLs', () => {
    expect(
      RecipeDraftSchema.safeParse(draft({ sourceUrl: 'javascript:alert(1)' }))
        .success,
    ).toBe(false);
    expect(
      RecipeDraftSchema.safeParse(draft({ heroImageUrl: 'data:text/html,x' }))
        .success,
    ).toBe(false);
    expect(
      RecipeDraftSchema.safeParse(
        draft({ sourceUrl: 'https://example.test/r' }),
      ).success,
    ).toBe(true);
  });

  it('enforces the database size limits', () => {
    expect(
      RecipeDraftSchema.safeParse(draft({ title: 'x'.repeat(201) })).success,
    ).toBe(false);
    expect(
      RecipeDraftSchema.safeParse(draft({ tags: ['x'.repeat(41)] })).success,
    ).toBe(false);
    expect(
      RecipeDraftSchema.safeParse(draft({ prepMinutes: 1e9 })).success,
    ).toBe(false);
  });

  it('rejects duplicate ids and duplicate step references', () => {
    const dupSection = draft();
    dupSection.stepSections[0]!.id = ID(1);
    expect(RecipeDraftSchema.safeParse(dupSection).success).toBe(false);

    const dupRef = draft();
    dupRef.stepSections[0]!.steps[0]!.ingredientRefs = [
      { ingredientId: ID(2) },
      { ingredientId: ID(2) },
    ];
    expect(RecipeDraftSchema.safeParse(dupRef).success).toBe(false);
  });

  it('requires a title and at least one section of each kind', () => {
    expect(RecipeDraftSchema.safeParse(draft({ title: ' ' })).success).toBe(
      false,
    );
    expect(
      RecipeDraftSchema.safeParse(draft({ stepSections: [] })).success,
    ).toBe(false);
  });
});
