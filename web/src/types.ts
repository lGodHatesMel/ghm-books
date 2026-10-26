export type TextStyle = 'body' | 'heading' | 'quote';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextBlock {
  id: string;
  type: 'text';
  text: string;
  style: TextStyle;
  align: TextAlign;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  src: string;
  caption: string;
}

export type Block = TextBlock | ImageBlock;

export interface Page {
  id: string;
  blocks: Block[];
}

export type CoverId = 'oxblood' | 'forest' | 'navy' | 'slate' | 'ochre' | 'black';

export type PaperId = 'blank' | 'lined' | 'grid' | 'dotted' | 'old' | 'black';
export type PageFont = 'serif' | 'hand' | 'old' | 'mono';
export type CoverFont = 'serif' | 'display' | 'sans' | 'mono' | 'hand' | 'old';
export type CoverTexture = 'plain' | 'cloth' | 'leather' | 'linen';
export type CoverFrame = 'none' | 'line' | 'double' | 'corners';

export interface CoverText {
  id: string;
  type: 'text';
  text: string;
  font: CoverFont;
  /** Font size as a percentage of the cover width. */
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  /** Centre of the element, as a percentage of the cover. */
  x: number;
  y: number;
}

export interface CoverImage {
  id: string;
  type: 'image';
  src: string;
  /** Width as a percentage of the cover width. */
  w: number;
  x: number;
  y: number;
}

export type CoverElement = CoverText | CoverImage;

export interface CoverDesign {
  bg: string;
  frameColor: string;
  texture: CoverTexture;
  frame: CoverFrame;
  elements: CoverElement[];
}

export interface Limits {
  maxTitle: number;
  maxDescription: number;
  maxPages: number;
  maxBlocksPerPage: number;
  maxTextLength: number;
  maxCaption: number;
  maxImages: number;
  maxImageBytes: number;
  maxUrlLength: number;
  maxBookBytes: number;
  maxCoverElements: number;
  maxCoverImages: number;
  maxCoverText: number;
  maxDedication: number;
  maxInscription: number;
  maxEdition: number;
  maxBooksPerAuthor: number;
  /** Pictures are uploaded to a picture host when the book is saved and stored as links. */
  uploads?: boolean;
  /** Sites a picture link may come from; empty or absent = any. */
  imageHosts?: string[];
}

export interface Book {
  id?: number;
  title: string;
  description: string;
  cover: CoverId;
  paper?: PaperId;
  font?: PageFont;
  /** Shown on the inside cover of every copy. */
  dedication?: string;
  /** Maximum copies that may ever be printed; 0 or absent = unlimited. */
  printLimit?: number;
  /** Copies printed so far. */
  copies?: number;
  /** Anyone holding a copy may edit it (false = only the author). */
  shared?: boolean;
  /** Final: nobody can edit a published book again, the author included. */
  published?: boolean;
  /** The author's name is hidden from everyone but the author (items carry no author either). */
  anonymous?: boolean;
  /** Is the viewer the author? A non-author editing a shared book cannot change author-only settings. */
  isAuthor?: boolean;
  /** Sent back on save: a changed revision means someone else saved first. */
  revision?: number;
  lastEditor?: string;
  hasBackup?: boolean;
  /** What belongs to the copy being read: its number in the run, and whether and how it was signed. */
  copy?: number;
  edition?: number;
  signed?: boolean;
  inscription?: string;
  /** Custom cover; absent means the automatic cover (title, description, author on the cover colour). */
  coverDesign?: CoverDesign | null;
  authorName: string;
  pages: Page[];
  canEdit?: boolean;
}

export interface PrintResult {
  success: boolean;
  copy?: number;
  /** The copy was sent to a printer and has to be collected there. */
  queued?: boolean;
  printer?: string;
  seconds?: number;
  error?: string;
}

export interface PrinterChoice {
  id: number;
  label: string;
  distance: number;
}

export interface SaveResult {
  ok: boolean;
  bookId?: number;
  error?: string;
}

/** Row shown in the admin menu list; mirrors ghm-books server `summary()`. */
export interface BookSummary {
  id: number;
  title: string;
  description: string;
  authorName: string;
  authorCitizenId: string;
  cover: CoverId;
  paper?: PaperId;
  font?: PageFont;
  copies?: number;
  printLimit?: number;
  shared?: boolean;
  published?: boolean;
  anonymous?: boolean;
  lastEditor?: string;
  hasBackup?: boolean;
  pageCount: number;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

export type BookBlock =
  | { type: 'text'; text: string; style: TextStyle; align: TextAlign }
  | { type: 'image'; src: string; caption: string };

/** Admin preview payload: summary plus the raw pages (no client-side ids). */
export interface AdminBookDetail extends BookSummary {
  pages: { blocks: BookBlock[] }[];
}
