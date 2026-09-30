import { describe, expect, it } from 'vitest';
import { checkText } from './check-tokens.mjs';

const flags = (text) => checkText(text).length > 0;

describe('check-tokens', () => {
  it.each([
    ['hex in CSS', '.a { color: #fafafa; }'],
    ['named colour in CSS', '.a { background: red; }'],
    ['named colour without semicolon', '.a { color: red }'],
    ['colour function', '<div style="--x: rgb(1 2 3)">'],
    ['literal shadow', '.a { box-shadow: 0 1px 2px black; }'],
    ['literal font family', '.a { font-family: Arial; }'],
    ['arbitrary colour', '<div class="bg-[#fff]">'],
    ['arbitrary colour in shadow', '<div class="shadow-[0_2px_4px_#000]">'],
    ['arbitrary named colour', '<div class="shadow-[0_0_0_2px_red]">'],
    ['arbitrary logical border colour', '<div class="border-s-[red]">'],
    ['arbitrary property', '<div class="[color:red]">'],
    ['arbitrary radius', '<div class="rounded-[3px]">'],
    ['arbitrary font', `<div class="font-['Inter']">`],
    ['default palette colour', '<div class="bg-white text-gray-500">'],
    ['default radius', '<div class="rounded-lg">'],
    ['default pill radius', '<span class="rounded-full">'],
    ['default shadow', '<div class="shadow-md">'],
    ['default font', '<code class="font-mono">'],
    ['style binding', `<div [style.color]="'red'">`],
    ['inline style', '<div style="color: #333">'],
  ])('flags %s', (_name, text) => {
    expect(flags(text)).toBe(true);
  });

  it.each([
    [
      'token utilities',
      '<div class="bg-canvas text-ink rounded-card shadow-card font-display heading">',
    ],
    ['token opacity modifier', '<a class="hover:bg-chip/50">'],
    [
      'var() references',
      '<div class="z-(--ds-z-bar) grid-cols-[var(--ds-sidebar-width)_minmax(0,1fr)] shadow-[var(--x)]">',
    ],
    [
      'safe-area padding',
      '<nav class="pb-[env(safe-area-inset-bottom)] pl-[max(1rem,env(safe-area-inset-left))]">',
    ],
    ['template reference', '<input #search #face #add>'],
    ['in-page link', '<a href="#add">Skip</a>'],
    [
      'CSS keywords',
      '.a { color: currentColor; background: transparent; color: inherit; }',
    ],
    ['url() values', '<div class="bg-[url(/img/dish.jpg)]">'],
    [
      'words that contain colour names',
      '<p>Redirect to the reddit thread about greenery</p>',
    ],
    ['opt-out comment', '.a { color: #fff; } /* tokens-ok: brand logo */'],
  ])('allows %s', (_name, text) => {
    expect(checkText(text)).toEqual([]);
  });
});
