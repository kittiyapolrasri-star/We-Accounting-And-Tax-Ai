/**
 * Design System - WE Accounting AI
 * ระบบออกแบบมาตรฐานสำหรับความสม่ำเสมอของ UI ทั้งระบบ
 */

// ==========================================
// TYPOGRAPHY - มาตรฐานขนาดและน้ำหนักตัวอักษร
// ==========================================

export const typography = {
  // Page Headers
  pageTitle: 'text-2xl font-bold text-slate-900',
  pageSubtitle: 'text-sm text-slate-500',

  // Section Headers
  sectionTitle: 'text-lg font-semibold text-slate-800',
  sectionSubtitle: 'text-sm text-slate-500',

  // Card Headers
  cardTitle: 'text-base font-semibold text-slate-800',
  cardSubtitle: 'text-sm text-slate-500',

  // Body Text
  body: 'text-sm text-slate-600',
  bodySmall: 'text-xs text-slate-500',

  // Labels & Captions
  label: 'text-sm font-medium text-slate-700',
  labelSmall: 'text-xs font-medium text-slate-600',
  caption: 'text-xs text-slate-400',

  // Stats/Numbers
  statLarge: 'text-3xl font-bold text-slate-900',
  statMedium: 'text-2xl font-bold text-slate-800',
  statSmall: 'text-lg font-semibold text-slate-800',
};

// ==========================================
// SPACING - มาตรฐาน Padding และ Margin
// ==========================================

export const spacing = {
  // Page Container
  page: 'p-6',
  pageX: 'px-6',
  pageY: 'py-6',

  // Section
  section: 'mb-8',
  sectionGap: 'gap-6',

  // Cards
  card: 'p-5',
  cardCompact: 'p-4',
  cardLarge: 'p-6',

  // Content Gaps
  gapTight: 'gap-2',
  gapBase: 'gap-4',
  gapLoose: 'gap-6',
  gapSection: 'gap-8',
};

// ==========================================
// CARDS & CONTAINERS - มาตรฐานกล่องและ containers
// ==========================================

export const cards = {
  // Base Card
  base: 'bg-white rounded-xl border border-slate-200 shadow-sm',

  // Card Variants
  elevated: 'bg-white rounded-xl border border-slate-200 shadow-md',
  flat: 'bg-white rounded-xl border border-slate-200',
  subtle: 'bg-slate-50 rounded-xl border border-slate-100',

  // Interactive Card
  interactive: 'bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer',

  // Selected Card
  selected: 'bg-white rounded-xl border-2 border-blue-500 shadow-md ring-2 ring-blue-100',
};

// ==========================================
// BUTTONS - มาตรฐานปุ่ม
// ==========================================

export const buttons = {
  // Primary
  primary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm',
  primaryLarge: 'bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-colors shadow-sm',

  // Secondary
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-lg border border-slate-200 transition-colors',

  // Ghost
  ghost: 'hover:bg-slate-100 text-slate-600 font-medium px-4 py-2 rounded-lg transition-colors',

  // Danger
  danger: 'bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors',
};

// ==========================================
// BADGES & TAGS - มาตรฐาน badges
// ==========================================

export const badges = {
  // Base
  base: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',

  // Colors
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-amber-100 text-amber-700',
  purple: 'bg-purple-100 text-purple-700',
  gray: 'bg-slate-100 text-slate-600',

  // Status
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-slate-100 text-slate-600',
};

// ==========================================
// TABLES - มาตรฐานตาราง
// ==========================================

export const tables = {
  wrapper: 'bg-white rounded-xl border border-slate-200 overflow-hidden',
  header: 'bg-slate-50 border-b border-slate-200',
  headerCell: 'px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider',
  row: 'border-b border-slate-100 hover:bg-slate-50 transition-colors',
  cell: 'px-4 py-3 text-sm text-slate-700',
};

// ==========================================
// INPUTS - มาตรฐาน form inputs
// ==========================================

export const inputs = {
  base: 'w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors',
  select: 'w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white',
  search: 'w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
};

// ==========================================
// LAYOUT - มาตรฐาน layout patterns
// ==========================================

export const layout = {
  // Page Header
  pageHeader: 'flex items-center justify-between mb-6',
  pageHeaderLeft: 'flex items-center gap-4',
  pageHeaderIcon: 'p-3 rounded-xl',

  // Grid
  grid2: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  grid3: 'grid grid-cols-1 md:grid-cols-3 gap-6',
  grid4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4',

  // Flex
  flexBetween: 'flex items-center justify-between',
  flexCenter: 'flex items-center justify-center',
  flexStart: 'flex items-center gap-3',
};

// ==========================================
// COLORS - มาตรฐานสี
// ==========================================

export const colors = {
  // Primary Brand
  primary: {
    bg: 'bg-blue-600',
    bgHover: 'hover:bg-blue-700',
    bgLight: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-500',
  },

  // Status Colors
  success: {
    bg: 'bg-emerald-600',
    bgLight: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  warning: {
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    text: 'text-amber-600',
  },
  error: {
    bg: 'bg-red-600',
    bgLight: 'bg-red-50',
    text: 'text-red-600',
  },

  // Neutral (Always use slate, not gray!)
  neutral: {
    bg: 'bg-slate-50',
    bgWhite: 'bg-white',
    text: 'text-slate-600',
    textMuted: 'text-slate-500',
    textDark: 'text-slate-900',
    border: 'border-slate-200',
    borderLight: 'border-slate-100',
  },
};

// ==========================================
// ICON SIZES - มาตรฐานขนาด icons
// ==========================================

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
  '3xl': 40,
};

// ==========================================
// PAGE HEADER COMPONENT TEMPLATE
// ==========================================

/**
 * Standard Page Header Template
 * Use this pattern for all main page headers:
 *
 * <div className="flex items-center justify-between mb-6">
 *   <div className="flex items-center gap-4">
 *     <div className="p-3 bg-blue-100 rounded-xl">
 *       <IconComponent size={28} className="text-blue-600" />
 *     </div>
 *     <div>
 *       <h1 className="text-2xl font-bold text-slate-900">Page Title</h1>
 *       <p className="text-sm text-slate-500">Page description</p>
 *     </div>
 *   </div>
 *   <div className="flex items-center gap-3">
 *     {action buttons}
 *   </div>
 * </div>
 */

export default {
  typography,
  spacing,
  cards,
  buttons,
  badges,
  tables,
  inputs,
  layout,
  colors,
  iconSizes,
};
