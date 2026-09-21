/**
 * ============================================================================
 * DESIGN TOKEN TO CSS VARIABLE CONVERTER
 * ============================================================================
 * 
 * @file convert-tokens-to-css.js
 * @description Translates design tokens from `design-tokens.tokens.json` into
 * standard CSS custom properties (CSS variables).
 * 
 * DESIGN SYSTEM ARCHITECTURE & COLOUR RULES:
 * ----------------------------------------------------------------------------
 * 1. Primitive Colours (--primitive-*):
 *    - Located in `json.primitives` (e.g. key colors, primary colors, etc.)
 *    - Represent raw color values (hex, rgba).
 *    - MUST NOT be applied directly to application UI component styles.
 *    - Serve solely as design tokens foundation.
 * 
 * 2. Semantic Colour Roles (--color-*):
 *    - Located in `json["color roles"]` (e.g. primary, on-primary, surface)
 *    - Map directly to UI component roles.
 *    - Reference primitive tokens via `var(--primitive-...)`.
 *    - MUST be used exclusively for UI styling in application components.
 * 
 * 3. Typography Tokens (--typography-*):
 *    - Located in `json.typography` (display, headline, title, body, label)
 *    - Generates compound `font` properties (e.g. `600 64px/96px 'Lora', serif`)
 *      and individual sub-properties for granular control.
 * 
 * 4. Spacing System (--spacing-*):
 *    - Located in `json["spacing system"]`
 *    - Generates pixel dimension variables for layout spacing.
 * 
 * 5. Effect & Shadow Tokens (--effect-*):
 *    - Located in `json.effect`
 *    - Converts shadow descriptors into standard CSS `box-shadow` values.
 * ----------------------------------------------------------------------------
 * 
 * USAGE:
 *   node convert-tokens-to-css.js [--input <path>] [--output <path>]
 * 
 * DEFAULT PATHS:
 *   Input:  ./design-tokens.tokens.json
 *   Output: ./tokens.css
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Converts any string into a clean, kebab-case CSS variable identifier token.
 * Example: "primary key color" -> "primary-key-color"
 *          "extra extra samll spacing" -> "extra-extra-samll-spacing"
 *
 * @param {string} str - The raw token name or object key.
 * @returns {string} Sluggified kebab-case string.
 */
function slugify(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalizes hex color values (e.g. #7e2cdeff -> #7e2cde).
 * Converts 8-character hex values with full opacity (FF) into standard 6-character hex.
 * Preserves translucency for non-FF alpha channels.
 *
 * @param {string} colorStr - Raw color value from design tokens.
 * @returns {string} Formatted CSS color string.
 */
function normalizeColor(colorStr) {
  if (typeof colorStr !== 'string') return colorStr;
  const trimmed = colorStr.trim();
  
  // Match 8-character hex (#RRGGBBAA)
  if (/^#([0-9a-fA-F]{8})$/.test(trimmed)) {
    const hex = trimmed.substring(1);
    const alpha = hex.substring(6, 8).toLowerCase();
    if (alpha === 'ff') {
      return `#${hex.substring(0, 6)}`;
    }
  }
  return trimmed;
}

/**
 * Parses dimension values and appends 'px' if numeric.
 *
 * @param {number|string} val - Value to format.
 * @returns {string} Formatted dimension string.
 */
function formatDimension(val) {
  if (typeof val === 'number') {
    return val === 0 ? '0' : `${val}px`;
  }
  if (typeof val === 'string') {
    if (/^\d+(\.\d+)?$/.test(val)) {
      return val === '0' ? '0' : `${val}px`;
    }
    return val;
  }
  return String(val);
}

// ----------------------------------------------------------------------------
// Token Parsers & CSS Generators
// ----------------------------------------------------------------------------

/**
 * Extracts and generates CSS custom properties for Primitive Colors.
 *
 * @param {Object} primitivesNode - The `primitives` object from tokens JSON.
 * @param {Map<string, { varName: string, cssValue: string }>} primitiveMap - Map to store resolved primitive references.
 * @returns {string[]} Array of CSS property declaration lines.
 */
function generatePrimitiveCss(primitivesNode, primitiveMap) {
  const lines = [];
  lines.push('  /* ======================================================================== */');
  lines.push('  /* 1. PRIMITIVE COLOURS (FOUNDATIONAL TOKENS)                               */');
  lines.push('  /* DO NOT use --primitive-* variables directly in component UI styling.      */');
  lines.push('  /* Use semantic --color-* roles defined in section 2 instead.               */');
  lines.push('  /* ======================================================================== */');

  if (!primitivesNode || typeof primitivesNode !== 'object') {
    return lines;
  }

  for (const [categoryName, categoryTokens] of Object.entries(primitivesNode)) {
    const categorySlug = slugify(categoryName);
    lines.push(`\n  /* Primitive Category: ${categoryName} */`);

    for (const [tokenName, tokenData] of Object.entries(categoryTokens)) {
      const tokenSlug = slugify(tokenName);
      const varName = `--primitive-${categorySlug}-${tokenSlug}`;
      const rawValue = tokenData.value;
      const cssValue = normalizeColor(rawValue);

      // Save mapping key (e.g. "primitives.key colors.primary key color")
      const pathKey = `primitives.${categoryName}.${tokenName}`;
      primitiveMap.set(pathKey, { varName, cssValue });

      lines.push(`  ${varName}: ${cssValue};`);
    }
  }

  return lines;
}

/**
 * Extracts and generates CSS custom properties for Semantic Color Roles.
 *
 * @param {Object} colorRolesNode - The `color roles` object from tokens JSON.
 * @param {Map<string, { varName: string, cssValue: string }>} primitiveMap - Resolved primitive mapping.
 * @returns {string[]} Array of CSS property declaration lines.
 */
function generateColorRoleCss(colorRolesNode, primitiveMap) {
  const lines = [];
  lines.push('\n  /* ======================================================================== */');
  lines.push('  /* 2. SEMANTIC COLOUR ROLES (UI COMPONENT COLOURS)                          */');
  lines.push('  /* Apply these --color-* tokens directly to application UI elements.         */');
  lines.push('  /* ======================================================================== */');

  if (!colorRolesNode || typeof colorRolesNode !== 'object') {
    return lines;
  }

  for (const [roleName, tokenData] of Object.entries(colorRolesNode)) {
    const roleSlug = slugify(roleName);
    const varName = `--color-${roleSlug}`;
    const rawVal = tokenData.value;

    let cssValue = rawVal;

    // Check if token references a primitive (e.g., "{primitives.key colors.primary key color}")
    if (typeof rawVal === 'string' && rawVal.startsWith('{') && rawVal.endsWith('}')) {
      const refPath = rawVal.slice(1, -1);
      const primitiveEntry = primitiveMap.get(refPath);

      if (primitiveEntry) {
        // Point semantic role to the primitive CSS variable
        cssValue = `var(${primitiveEntry.varName})`;
      } else {
        console.warn(`[WARNING] Unresolved reference in color role "${roleName}": ${refPath}`);
      }
    } else {
      cssValue = normalizeColor(rawVal);
    }

    lines.push(`  ${varName}: ${cssValue};`);
  }

  return lines;
}

/**
 * Extracts and generates CSS variables for Typography styles.
 *
 * @param {Object} typographyNode - The `typography` object from tokens JSON.
 * @returns {string[]} Array of CSS property declaration lines.
 */
function generateTypographyCss(typographyNode) {
  const lines = [];
  lines.push('\n  /* ======================================================================== */');
  lines.push('  /* 3. TYPOGRAPHY TOKENS                                                     */');
  lines.push('  /* Provides compound font shorthand properties and individual tokens.      */');
  lines.push('  /* ======================================================================== */');

  if (!typographyNode || typeof typographyNode !== 'object') {
    return lines;
  }

  for (const [groupName, groupTokens] of Object.entries(typographyNode)) {
    const groupSlug = slugify(groupName);
    lines.push(`\n  /* Typography Group: ${groupName} */`);

    for (const [sizeName, tokenData] of Object.entries(groupTokens)) {
      const sizeSlug = slugify(sizeName);
      const baseVar = `--typography-${groupSlug}-${sizeSlug}`;

      const fontFamily = tokenData.fontFamily?.value || 'sans-serif';
      const fontSize = formatDimension(tokenData.fontSize?.value || 16);
      const lineHeight = formatDimension(tokenData.lineHeight?.value || 'normal');
      const fontWeight = tokenData.fontWeight?.value || 400;
      const fontStyle = tokenData.fontStyle?.value || 'normal';
      const letterSpacing = formatDimension(tokenData.letterSpacing?.value || 0);

      // Format font family with quotes if it contains spaces
      const formattedFontFamily = fontFamily.includes(' ') && !fontFamily.startsWith("'")
        ? `'${fontFamily}'`
        : fontFamily;

      // Individual properties
      lines.push(`  ${baseVar}-font-family: ${formattedFontFamily};`);
      lines.push(`  ${baseVar}-font-size: ${fontSize};`);
      lines.push(`  ${baseVar}-font-weight: ${fontWeight};`);
      lines.push(`  ${baseVar}-line-height: ${lineHeight};`);
      lines.push(`  ${baseVar}-letter-spacing: ${letterSpacing};`);

      // Shorthand CSS font rule: [font-style] [font-weight] [font-size]/[line-height] [font-family]
      const shorthand = `${fontStyle !== 'normal' ? fontStyle + ' ' : ''}${fontWeight} ${fontSize}/${lineHeight} ${formattedFontFamily}`;
      lines.push(`  ${baseVar}: ${shorthand};`);
    }
  }

  return lines;
}

/**
 * Extracts and generates CSS custom properties for Spacing tokens.
 *
 * @param {Object} spacingNode - The `spacing system` object from tokens JSON.
 * @returns {string[]} Array of CSS property declaration lines.
 */
function generateSpacingCss(spacingNode) {
  const lines = [];
  lines.push('\n  /* ======================================================================== */');
  lines.push('  /* 4. SPACING SYSTEM TOKENS                                                 */');
  lines.push('  /* ======================================================================== */');

  if (!spacingNode || typeof spacingNode !== 'object') {
    return lines;
  }

  for (const [spacingName, tokenData] of Object.entries(spacingNode)) {
    const spacingSlug = slugify(spacingName);
    const varName = `--spacing-${spacingSlug}`;
    const rawVal = typeof tokenData === 'object' && tokenData !== null ? tokenData.value : tokenData;
    const cssValue = formatDimension(rawVal);

    lines.push(`  ${varName}: ${cssValue};`);
  }

  return lines;
}

/**
 * Extracts and generates CSS custom properties for Effect / Shadow tokens.
 *
 * @param {Object} effectNode - The `effect` object from tokens JSON.
 * @returns {string[]} Array of CSS property declaration lines.
 */
function generateEffectCss(effectNode) {
  const lines = [];
  lines.push('\n  /* ======================================================================== */');
  lines.push('  /* 5. EFFECT & SHADOW TOKENS                                                */');
  lines.push('  /* ======================================================================== */');

  if (!effectNode || typeof effectNode !== 'object') {
    return lines;
  }

  for (const [effectName, tokenData] of Object.entries(effectNode)) {
    const effectSlug = slugify(effectName);
    const varName = `--effect-${effectSlug}`;
    const val = tokenData.value;

    if (val && typeof val === 'object') {
      const offsetX = formatDimension(val.offsetX ?? 0);
      const offsetY = formatDimension(val.offsetY ?? 0);
      const radius = formatDimension(val.radius ?? 0);
      const spread = formatDimension(val.spread ?? 0);
      const color = normalizeColor(val.color ?? '#000000');

      const shadowCss = `${offsetX} ${offsetY} ${radius} ${spread} ${color}`;
      lines.push(`  ${varName}: ${shadowCss};`);
    }
  }

  return lines;
}

// ----------------------------------------------------------------------------
// Main Execution Workflow
// ----------------------------------------------------------------------------

/**
 * Main conversion function reading input tokens JSON and emitting output CSS.
 *
 * @param {string} inputPath - Path to design-tokens.tokens.json file.
 * @param {string} outputPath - Destination path for generated tokens.css file.
 */
function convertTokensToCss(inputPath, outputPath) {
  console.log(`\n Reading design tokens from: ${inputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(` Error: Source tokens file not found at ${inputPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(inputPath, 'utf8');
  let tokensJson;
  try {
    tokensJson = JSON.parse(rawData);
  } catch (err) {
    console.error(` Error parsing JSON in ${inputPath}:`, err.message);
    process.exit(1);
  }

  const primitiveMap = new Map();

  const cssHeader = [
    '/**',
    ' * AUTO-GENERATED DESIGN SYSTEM CSS TOKENS',
    ' * ----------------------------------------------------------------------------',
    ` * Source: ${path.basename(inputPath)}`,
    ` * Generated At: ${new Date().toISOString()}`,
    ' *',
    ' * RULES OF USE:',
    ' * 1. Do NOT manually edit this file. Edit design-tokens.tokens.json and regenerate.',
    ' * 2. Use semantic --color-* variables for application UI components.',
    ' * 3. DO NOT use foundational --primitive-* variables directly in component styles.',
    ' * ----------------------------------------------------------------------------',
    ' */',
    '',
    ':root {'
  ];

  const primitiveCssLines = generatePrimitiveCss(tokensJson.primitives, primitiveMap);
  const colorRoleCssLines = generateColorRoleCss(tokensJson['color roles'], primitiveMap);
  const typographyCssLines = generateTypographyCss(tokensJson.typography);
  const spacingCssLines = generateSpacingCss(tokensJson['spacing system']);
  const effectCssLines = generateEffectCss(tokensJson.effect);

  const cssFooter = ['}', ''];

  const fullCssContent = [
    ...cssHeader,
    ...primitiveCssLines,
    ...colorRoleCssLines,
    ...typographyCssLines,
    ...spacingCssLines,
    ...effectCssLines,
    ...cssFooter
  ].join('\n');

  // Ensure target directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, fullCssContent, 'utf8');

  console.log(` Successfully converted design tokens!`);
  console.log(` Output written to: ${outputPath}`);
  console.log(`   - Primitives mapped: ${primitiveMap.size}`);
  console.log(`   - Color roles mapped: ${Object.keys(tokensJson['color roles'] || {}).length}`);
  console.log(`   - Typography styles processed: ${Object.keys(tokensJson.typography || {}).length} categories`);
  console.log(`   - Spacing tokens: ${Object.keys(tokensJson['spacing system'] || {}).length}`);
  console.log(`   - Effects: ${Object.keys(tokensJson.effect || {}).length}\n`);
}

// ----------------------------------------------------------------------------
// CLI Arguments Handler
// ----------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  let inputPath = path.join(__dirname, 'design-tokens.tokens.json');
  let outputPath = path.join(__dirname, 'tokens.css');

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--input' || args[i] === '-i') && args[i + 1]) {
      inputPath = path.resolve(args[i + 1]);
      i++;
    } else if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
      outputPath = path.resolve(args[i + 1]);
      i++;
    }
  }

  convertTokensToCss(inputPath, outputPath);
}

module.exports = {
  convertTokensToCss,
  slugify,
  normalizeColor,
  formatDimension,
  generatePrimitiveCss,
  generateColorRoleCss,
  generateTypographyCss,
  generateSpacingCss,
  generateEffectCss
};
