import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RecipeDraftSchema,
  allIngredients,
  allSteps,
} from '../schema/recipe.ts';
import { decodeEntities, htmlToText } from './html.ts';
import { isoDurationToMinutes } from './iso-duration.ts';
import { importRecipeFromHtml } from './jsonld.ts';
import { htmlParser } from './parser.ts';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');
let n = 0;
const page = (data: unknown) =>
  `<html><script type="application/ld+json">${JSON.stringify(data)}</script></html>`;
const recipePage = (fields: Record<string, unknown>) =>
  page({
    '@type': 'Recipe',
    name: 'Test',
    recipeIngredient: ['1 egg'],
    recipeInstructions: 'Cook it.',
    ...fields,
  });
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
    expect(importRecipeFromHtml(html)?.title).toBe('X');
  });

  it('keeps numbers that start a step', () => {
    const html = recipePage({
      recipeInstructions: [
        { '@type': 'HowToStep', text: '1.5 litres of water go in the pot.' },
        { '@type': 'HowToStep', text: '10-12 minutes is enough.' },
        { '@type': 'HowToStep', name: 'Serve hot.' },
      ],
    });
    expect(allSteps(importRecipeFromHtml(html)!).map((s) => s.text)).toEqual([
      '1.5 litres of water go in the pot.',
      '10-12 minutes is enough.',
      'Serve hot.',
    ]);
  });

  it('accepts instructions as an array of strings', () => {
    const html = recipePage({ recipeInstructions: ['Mix.', 'Bake.'] });
    expect(allSteps(importRecipeFromHtml(html)!).map((s) => s.text)).toEqual([
      'Mix.',
      'Bake.',
    ]);
  });

  it('resolves @id references and relative image URLs', () => {
    const html = page({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Person', '@id': '#author', name: 'Pat' },
        { '@type': 'ImageObject', '@id': '#img', url: '/img/dish.jpg' },
        {
          '@type': 'Recipe',
          name: 'R',
          author: { '@id': '#author' },
          image: { '@id': '#img' },
          recipeIngredient: ['1 egg'],
          recipeInstructions: 'Cook.',
        },
      ],
    });
    expect(
      importRecipeFromHtml(html, { sourceUrl: 'https://example.test/r/1' }),
    ).toMatchObject({
      sourceAttribution: 'Pat',
      heroImageUrl: 'https://example.test/img/dish.jpg',
    });
    expect(
      importRecipeFromHtml(recipePage({ image: '//cdn.example.test/a.jpg' }))
        ?.heroImageUrl,
    ).toBe('https://cdn.example.test/a.jpg');
  });

  it('drops non-http URLs from the page', () => {
    const draft = importRecipeFromHtml(
      recipePage({
        url: 'javascript:alert(1)',
        image: 'data:image/png;base64,xx',
      }),
    );
    expect(draft?.sourceUrl).toBeUndefined();
    expect(draft?.heroImageUrl).toBeUndefined();
  });

  it('clips hostile sizes so the draft always validates', () => {
    const html = recipePage({
      name: 'x'.repeat(5000),
      recipeYield: '9'.repeat(30),
      prepTime: 'P99999999D',
      keywords: 'k'.repeat(100),
      recipeIngredient: Array.from(
        { length: 2000 },
        (_, i) => `${i + 1} g thing${i}`,
      ),
      recipeInstructions: Array.from(
        { length: 2000 },
        (_, i) => `Step ${i} ${'y'.repeat(6000)}`,
      ),
    });
    const draft = importRecipeFromHtml(html)!;
    expect(RecipeDraftSchema.safeParse(draft).success).toBe(true);
    expect(allIngredients(draft)).toHaveLength(300);
    expect(allSteps(draft)).toHaveLength(200);
    expect(draft.servings).toBeUndefined();
    expect(draft.prepMinutes).toBeUndefined();
    expect(draft.tags).toEqual([]);
  });

  it('stays linear on hostile markup', () => {
    const started = performance.now();
    expect(
      importRecipeFromHtml(
        '<script type="application/ld+json">'.repeat(40_000),
      ),
    ).toBeUndefined();
    expect(htmlToText('<'.repeat(80_000) + '<a'.repeat(40_000))).toBeDefined();
    expect(htmlToText('<script>x</script>'.repeat(40_000))).toBe('');
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe('htmlParser', () => {
  it('uses JSON-LD when present', async () => {
    const draft = await htmlParser.parse({
      kind: 'html',
      html: fixture('single-recipe.html'),
      url: 'https://example.test/p',
    });
    expect(draft).toMatchObject({
      title: 'Fluffy Pancakes',
      sourceUrl: 'https://example.test/p',
    });
  });

  it('falls back to the page text when there is no JSON-LD', async () => {
    const html = `<html><head><title>x</title></head><body><nav>Home | Recipes</nav><article>
      <h1>Garlic Bread</h1><h2>Ingredients</h2><ul><li>1 baguette</li><li>50g butter</li><li>2 garlic cloves</li></ul>
      <h2>Method</h2><ol><li>Mix the butter and garlic.</li><li>Spread on the bread and bake for 10 minutes.</li></ol>
      </article><footer>© Site</footer></body></html>`;
    const draft = await htmlParser.parse({
      kind: 'html',
      html,
      url: 'https://example.test/gb',
    });
    expect(draft).toMatchObject({
      title: 'Garlic Bread',
      sourceType: 'url',
      sourceUrl: 'https://example.test/gb',
    });
    expect(allIngredients(draft!).map((i) => i.item)).toEqual([
      'baguette',
      'butter',
      'garlic cloves',
    ]);
    expect(allSteps(draft!)).toHaveLength(2);
  });

  it('does not handle text input', () => {
    expect(htmlParser.canParse({ kind: 'text', text: '' })).toBe(false);
  });

  it('finds no recipe on a page without ingredients and steps', async () => {
    const html = `<html><body><main><h1>Example Domain</h1>
      <p>This domain is for use in illustrative examples in documents.</p>
      <p><a href="https://example.test">More information...</a></p></main></body></html>`;
    expect(await htmlParser.parse({ kind: 'html', html })).toBeUndefined();
  });

  it('accepts a single unquantified ingredient under an Ingredients heading', async () => {
    const html = `<html><body><article><h1>Buttered Greens</h1><h2>Ingredients</h2>
      <ul><li>Salt and freshly ground black pepper to taste</li></ul><h2>Method</h2>
      <p>Steam the greens for four minutes.</p><p>Toss with butter and season well.</p></article></body></html>`;
    const draft = await htmlParser.parse({ kind: 'html', html });
    expect(allIngredients(draft!)).toHaveLength(1);
    expect(allSteps(draft!)).toHaveLength(2);
  });

  it('finds no recipe in a page of short lines and sentences without an Ingredients heading', async () => {
    const html = `<html><body><article><h1>Why I moved to Lisbon</h1><p>5 min read</p>
      <p>I had been thinking about leaving the city for years before I finally did it.</p>
      <p>The light here is different, and so is the food, which is why I started this blog.</p></article></body></html>`;
    expect(await htmlParser.parse({ kind: 'html', html })).toBeUndefined();
  });

  it.each([
    [
      'with steps but no ingredients',
      '<p>Mix everything together in a large bowl.</p>',
    ],
    [
      'with ingredients but no steps',
      '<h2>Ingredients</h2><ul><li>2 eggs</li><li>100g flour</li></ul>',
    ],
  ])('finds no recipe on a page %s', async (_, body) => {
    const html = `<html><body><article><h1>Snack</h1>${body}</article></body></html>`;
    expect(await htmlParser.parse({ kind: 'html', html })).toBeUndefined();
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

  it('never turns encoded or broken markup back into tags', () => {
    expect(htmlToText('Hi &lt;img src=x onerror=alert(1)&gt; there')).toBe(
      'Hi there',
    );
    expect(htmlToText('Hi <img src=x onerror=alert(1)')).toBe('Hi');
    expect(decodeEntities('&constructor; &toString;')).toBe(
      '&constructor; &toString;',
    );
  });
});
