import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RecipeDraftSchema, allIngredients, allSteps } from '../schema/recipe';
import { decodeEntities, htmlToText } from './html';
import { isoDurationToMinutes } from './iso-duration';
import { extractJsonLd, findRecipeNodes, importRecipeFromHtml } from './jsonld';
import { jsonLdParser } from './parser';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');
let n = 0;
const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

describe('JSON-LD import', () => {
  describe('WordPress-style @graph page', () => {
    const draft = importRecipeFromHtml(fixture('wprm-graph.html'), {
      sourceUrl: 'https://example.test/traybake',
      idFactory: ids,
    });

    it('finds the recipe and produces a valid draft', () => {
      expect(draft).toBeDefined();
      expect(RecipeDraftSchema.safeParse(draft).success).toBe(true);
    });

    it('maps metadata', () => {
      expect(draft).toMatchObject({
        title: 'Weeknight Chicken Traybake',
        description:
          'A one-tray dinner with crispy chicken, lemon & herbs. Ready in under an hour.',
        servings: 4,
        yieldText: '4 servings',
        prepMinutes: 15,
        cookMinutes: 40,
        totalMinutes: 55,
        sourceType: 'url',
        sourceUrl: 'https://example.test/traybake',
        sourceAttribution: 'Sam Cook',
        heroImageUrl: 'https://example.test/img/traybake-1200x1200.jpg',
        unitSystem: 'metric',
      });
      expect(draft?.tags).toEqual([
        'British',
        'Dinner',
        'Main Course',
        'traybake',
        'chicken',
        'easy dinner',
      ]);
    });

    it('splits ingredient sub-headings into sections and parses lines', () => {
      expect(
        draft?.ingredientSections.map((s) => [s.title, s.ingredients.length]),
      ).toEqual([
        [undefined, 6],
        ['For the dressing', 3],
      ]);
      const paprika = allIngredients(draft!).find(
        (i) => i.item === 'smoked paprika',
      );
      expect(paprika).toMatchObject({
        qtyMin: 0.5,
        unit: 'tsp',
        rawText: '½ tsp smoked paprika',
      });
    });

    it('keeps HowToSections as step sections and decodes entities', () => {
      expect(draft?.stepSections.map((s) => [s.title, s.steps.length])).toEqual(
        [
          ['Traybake', 3],
          ['Dressing', 1],
        ],
      );
      expect(allSteps(draft!)[2]?.text).toBe(
        'Roast for 35–40 minutes until the chicken is golden and cooked through.',
      );
    });

    it('auto-links steps to ingredients', () => {
      const byId = new Map(allIngredients(draft!).map((i) => [i.id, i.item]));
      const linked = allSteps(draft!).map((s) =>
        s.ingredientRefs.map((r) => byId.get(r.ingredientId)),
      );
      expect(linked[0]).toEqual(['baby potatoes', 'red onions', 'olive oil']);
      expect(linked[1]).toEqual([
        'chicken thighs',
        'lemon',
        'olive oil',
        'smoked paprika',
      ]);
      expect(linked[3]).toEqual(['lemon', 'Greek yoghurt', 'parsley']);
    });
  });

  describe('single multi-typed Recipe with a text blob', () => {
    const draft = importRecipeFromHtml(fixture('single-recipe.html'), {
      idFactory: ids,
    });

    it('maps metadata including ImageObject and multiple authors', () => {
      expect(draft).toMatchObject({
        title: 'Fluffy Pancakes',
        sourceUrl: 'https://example.test/fluffy-pancakes',
        heroImageUrl: 'https://example.test/pancakes.jpg',
        sourceAttribution: 'Alex, Jo',
        servings: 8,
        yieldText: 'Makes 8 pancakes',
        totalMinutes: 25,
        unitSystem: 'us',
      });
    });

    it('splits numbered instructions from one blob', () => {
      expect(allSteps(draft!).map((s) => s.text.slice(0, 20))).toEqual([
        'Whisk the flour, bak',
        'Make a well in the c',
        'Heat a lightly oiled',
      ]);
    });

    it('keeps alternative metric measures as notes', () => {
      expect(allIngredients(draft!)[0]).toMatchObject({
        qtyMin: 1.5,
        unit: 'cup',
        item: 'all-purpose flour',
        note: '190 g',
      });
    });
  });

  it('returns undefined when a page has no recipe', () => {
    expect(
      importRecipeFromHtml(
        '<html><script type="application/ld+json">{"@type":"WebPage"}</script></html>',
      ),
    ).toBeUndefined();
    expect(
      importRecipeFromHtml('<html><body>No structured data</body></html>'),
    ).toBeUndefined();
  });

  it('skips invalid JSON-LD blocks', () => {
    const html =
      '<script type="application/ld+json">{ not json</script><script type="application/ld+json">{"@type":"Recipe","name":"X"}</script>';
    expect(extractJsonLd(html)).toHaveLength(1);
    expect(findRecipeNodes(extractJsonLd(html))).toHaveLength(1);
  });

  it('is exposed through the RecipeParser interface', async () => {
    expect(jsonLdParser.canParse({ kind: 'text', text: '' })).toBe(false);
    const draft = await jsonLdParser.parse({
      kind: 'html',
      html: fixture('single-recipe.html'),
      url: 'https://example.test/p',
    });
    expect(draft?.sourceUrl).toBe('https://example.test/p');
  });
});

describe('helpers', () => {
  it('parses ISO durations', () => {
    expect(isoDurationToMinutes('PT1H30M')).toBe(90);
    expect(isoDurationToMinutes('P0DT0H20M')).toBe(20);
    expect(isoDurationToMinutes('PT90M')).toBe(90);
    expect(isoDurationToMinutes('PT0.5H')).toBe(30);
    expect(isoDurationToMinutes('P1D')).toBe(1440);
    expect(isoDurationToMinutes('PT0M')).toBeUndefined();
    expect(isoDurationToMinutes('20 minutes')).toBeUndefined();
    expect(isoDurationToMinutes(undefined)).toBeUndefined();
  });

  it('decodes entities and strips HTML', () => {
    expect(
      decodeEntities('Tom&#8217;s &frac12; cup &amp; more &#x2014; &bogus;'),
    ).toBe('Tom’s ½ cup & more — &bogus;');
    expect(
      htmlToText('<p>One</p><p>Two<br>Three</p><script>x()</script>'),
    ).toBe('One\nTwo\nThree');
  });
});
