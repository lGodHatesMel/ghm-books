import type { AdminBookDetail, Book, BookSummary, Limits, SaveResult } from './types';

const svg = (bg: string, fg: string, label: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${bg}"/>` +
      `<path d="M0 300 L160 180 L260 250 L400 110 L640 290 V360 H0Z" fill="${fg}" opacity=".35"/>` +
      `<text x="320" y="190" fill="${fg}" font-family="monospace" font-size="22" text-anchor="middle">${label}</text></svg>`,
  );

export const mockLimits: Limits = {
  maxTitle: 60,
  maxDescription: 140,
  maxPages: 40,
  maxBlocksPerPage: 8,
  maxTextLength: 2500,
  maxCaption: 120,
  maxImages: 10,
  maxImageBytes: 140 * 1024,
  maxUrlLength: 500,
  maxBookBytes: 1536 * 1024,
  maxCoverElements: 12,
  maxCoverImages: 3,
  maxCoverText: 80,
  maxDedication: 200,
  maxInscription: 120,
  maxEdition: 500,
  maxBooksPerAuthor: 50,
  imageHosts: ['imgur.com', 'ibb.co', 'postimg.cc', 'discordapp.net', 'fivemanage.com', 'giphy.com'],
};

export const mockCovers = ['oxblood', 'forest', 'navy', 'slate', 'ochre', 'black'];

const t = (text: string, style: 'body' | 'heading' | 'quote' = 'body', align: 'left' | 'center' | 'right' = 'left') => ({
  id: '', type: 'text' as const, text, style, align,
});
const im = (src: string, caption = '') => ({ id: '', type: 'image' as const, src, caption });

export const mockBooks: Book[] = [
  {
    id: 1, title: 'Los Santos Field Guide', description: 'Notes on neighbourhoods, shortcuts and who to avoid.',
    cover: 'forest', authorName: 'Marcus Reed', canEdit: true, isAuthor: true, shared: true, lastEditor: 'Jamie Cole', hasBackup: true, revision: 4, paper: 'old', font: 'old',
    dedication: 'For everyone who has ever asked me for directions.', printLimit: 50, copies: 12,
    copy: 7, edition: 50, signed: true, inscription: 'To Sam, who found the shortcut first.',
    coverDesign: {
      bg: '#24473a', frameColor: '#d8c58a', texture: 'cloth', frame: 'double',
      elements: [
        { id: '', type: 'text', text: 'LOS SANTOS', font: 'display', size: 11, color: '#e7d9a8', bold: true, italic: false, x: 50, y: 30 },
        { id: '', type: 'text', text: 'Field Guide', font: 'old', size: 8, color: '#f1e9d6', bold: false, italic: true, x: 50, y: 42 },
        { id: '', type: 'text', text: 'Marcus Reed', font: 'sans', size: 4, color: '#d8c58a', bold: false, italic: false, x: 50, y: 86 },
      ],
    },
    pages: [
      { id: '', blocks: [t('Los Santos Field Guide', 'heading', 'center'), t('Compiled over three years of walking, driving and getting lost.', 'quote', 'center')] },
      { id: '', blocks: [t('Vinewood', 'heading'), t('Parking is a nightmare after 9pm. Use the garage off Vine Street and walk. The tourists tip well; the promoters do not.')] },
      { id: '', blocks: [t('Docks', 'heading'), t('Shift change is at six. After that the yard is empty except for the cats.'), im(svg('#1c2b33', '#88c3d8', 'GATE 4'), 'Gate 4, looking east')] },
    ],
  },
  {
    id: 2, title: 'Letters I Never Sent', description: 'Short, private, mostly unfinished.',
    cover: 'oxblood', authorName: 'Elena Voss', canEdit: false, anonymous: true, paper: 'lined', font: 'hand',
    dedication: 'For M., wherever you are.', copies: 3,
    pages: [
      { id: '', blocks: [t('To whoever finds this,', 'heading'), t('I kept writing these and never found the nerve to post them.')] },
      { id: '', blocks: [t('The second one was about the summer we spent on the pier. I still smell salt when it rains.')] },
    ],
  },
  {
    id: 3, title: 'Mechanic Handbook Vol. 1', description: 'Torque specs, bolt patterns, and bad habits to avoid.',
    cover: 'slate', authorName: 'Danny Okafor', canEdit: true, isAuthor: false, shared: true, revision: 2, paper: 'grid', font: 'mono', copies: 6,
    coverDesign: {
      bg: '#3b4250', frameColor: '#e5a33b', texture: 'leather', frame: 'corners',
      elements: [
        { id: '', type: 'text', text: 'MECHANIC', font: 'mono', size: 9, color: '#e5a33b', bold: true, italic: false, x: 50, y: 38 },
        { id: '', type: 'text', text: 'HANDBOOK', font: 'mono', size: 9, color: '#f1e9d6', bold: true, italic: false, x: 50, y: 48 },
        { id: '', type: 'text', text: 'VOL. 1', font: 'hand', size: 9, color: '#e5a33b', bold: false, italic: false, x: 50, y: 66 },
      ],
    },
    pages: [
      { id: '', blocks: [t('Mechanic Handbook', 'heading', 'center'), t('Volume 1: Brakes and Suspension', 'quote', 'center')] },
      { id: '', blocks: [t('Always bleed from the wheel furthest from the master cylinder. Check pad thickness before blaming the rotor.')] },
      { id: '', blocks: [t('Torque wheel nuts in a star pattern, twice. Re-check after the first fifty miles.'), im(svg('#2a2d33', '#e5a33b', 'BOLT PATTERN 5x114.3'), 'Bolt pattern chart')] },
    ],
  },
  {
    id: 4, title: 'The Long Way Home', description: 'A short story in four pages.',
    cover: 'navy', authorName: 'Priya Nair', canEdit: false, published: true, paper: 'black', copies: 1, printLimit: 100,
    pages: [
      { id: '', blocks: [t('The Long Way Home', 'heading', 'center')] },
      { id: '', blocks: [t('The bus had been gone for twenty minutes before Tom admitted he was not going to catch it.')] },
      { id: '', blocks: [t('He took the long way, past the closed laundromat and the shop with the broken sign that only ever said OPEN.')] },
      { id: '', blocks: [t('When he got home the porch light was on. It had never once been on before.'), t('The End', 'quote', 'center')] },
    ],
  },
];

const imageCount = (b: Book) => b.pages.reduce((n, p) => n + p.blocks.filter((x) => x.type === 'image').length, 0);

const adminStore: Book[] = [
  ...mockBooks,
  {
    id: 5, title: 'Something Inappropriate', description: 'Flag me, admin.', cover: 'black', authorName: 'Test Griefer', canEdit: false,
    pages: [{ id: '', blocks: [t('This book exists so there is something to delete in the mock admin menu.')] }],
  },
];
/** Books the mock character wrote: the first two sample books. */
const mineStore: Book[] = [adminStore[0], adminStore[1], adminStore[2], adminStore[3]];
let mineBlank = 2;
const citizenIds = ['ABC12345', 'XYZ98765', 'MNO55555', 'QRS24680', 'TUV13579'];

const summaryOf = (b: Book, i: number): BookSummary => ({
  id: b.id!, title: b.title, description: b.description, authorName: b.authorName, authorCitizenId: citizenIds[i] ?? 'MOCK0000',
  cover: b.cover, paper: b.paper, font: b.font, copies: b.copies ?? 0, printLimit: b.printLimit ?? 0,
  shared: b.shared ?? false, published: b.published ?? false, anonymous: b.anonymous ?? false, lastEditor: b.lastEditor ?? '', hasBackup: b.hasBackup ?? false,
  pageCount: b.pages.length, imageCount: imageCount(b),
  createdAt: `2026-10-0${i + 1} 14:2${i}:00`, updatedAt: `2026-10-1${i} 09:1${i}:00`,
});

export const mockNuiHandlers: Record<string, (data?: any) => unknown> = {
  save: (data: { bookId?: number; title?: string; pages?: { blocks: Omit<Book['pages'][number]['blocks'][number], 'id'>[] }[] }): SaveResult => {
    if (data?.bookId) return { ok: true, bookId: data.bookId };
    // A new book at a computer lands in the library with no copies printed.
    const id = Math.max(...adminStore.map((b) => b.id ?? 0)) + 1;
    const book: Book = {
      id, title: data?.title ?? 'Untitled', description: '', cover: 'oxblood', authorName: 'You', canEdit: true, copies: 0,
      pages: (data?.pages ?? []).map((p) => ({ id: '', blocks: p.blocks.map((b) => ({ id: '', ...b })) as Book['pages'][number]['blocks'] })),
    };
    adminStore.push(book);
    mineStore.push(book);
    return { ok: true, bookId: id };
  },
  printers: () => ({
    direct: false,
    printers: [
      { id: 7, label: 'Office printer', distance: 5 },
      { id: 8, label: 'Reception printer', distance: 18 },
    ],
  }),
  close: () => 'ok',
  limits: () => ({ limits: mockLimits, covers: mockCovers, papers: ['blank', 'lined', 'grid', 'dotted', 'old', 'black'], computersOnly: false }),
  mineList: () => ({
    success: true,
    freePrint: false,
    blankBooks: mineBlank,
    books: mineStore.map((b) => ({ ...summaryOf(b, adminStore.indexOf(b)), updatedAt: '2026-10-18 21:40:00' })),
  }),
  mineGet: (data: { id: number }) => {
    const b = mineStore.find((x) => x.id === data?.id);
    return b ? { success: true, book: { ...b, canEdit: true, isAuthor: true }, limits: mockLimits, covers: mockCovers } : { success: false, error: 'Book not found' };
  },
  minePrint: (data: { id: number; inscription?: string; signed?: boolean; printer?: number }) => {
    const book = mineStore.find((x) => x.id === data?.id);
    if (!book) return { success: false, error: 'Book not found' };
    if (mineBlank < 1) return { success: false, error: 'You need a blank book to print a copy' };
    if (book.printLimit && (book.copies ?? 0) >= book.printLimit) return { success: false, error: 'This edition is sold out' };
    mineBlank -= 1;
    book.copies = (book.copies ?? 0) + 1;
    return data?.printer
      ? { success: true, copy: book.copies, queued: true, printer: data.printer === 7 ? 'Office printer' : 'Reception printer', seconds: 8 }
      : { success: true, copy: book.copies };
  },
  mineRestore: (data: { id: number }) => {
    const book = mineStore.find((x) => x.id === data?.id);
    if (!book?.hasBackup) return { success: false, error: 'There is no earlier version to restore' };
    // The two versions swap, so a restore can be undone: keep the backup and swap who made the current one.
    book.lastEditor = book.lastEditor === book.authorName ? 'Jamie Cole' : book.authorName;
    return { success: true };
  },
  mineDelete: (data: { id: number }) => {
    const i = mineStore.findIndex((x) => x.id === data?.id);
    if (i < 0) return { success: false, error: 'Book not found' };
    mineStore.splice(i, 1);
    return { success: true };
  },
  adminList: () => ({ success: true, books: adminStore.map(summaryOf) }),
  adminGet: (data: { id: number }) => {
    const i = adminStore.findIndex((b) => b.id === data?.id);
    if (i < 0) return { success: false, error: 'Book not found' };
    const detail: AdminBookDetail = { ...summaryOf(adminStore[i], i), pages: adminStore[i].pages.map((p) => ({ blocks: p.blocks.map(({ id: _id, ...rest }) => rest) })) };
    return { success: true, book: detail };
  },
  adminDelete: (data: { id: number }) => {
    const i = adminStore.findIndex((b) => b.id === data?.id);
    if (i < 0) return { success: false, error: 'Book not found' };
    adminStore.splice(i, 1);
    return { success: true };
  },
};
