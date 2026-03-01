const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const DIST_INDEX_PATH = path.join(DIST_DIR, 'index.html');
const RECIPES_DIR = path.join(__dirname, '..', 'src', 'recipes');
const DIST_IMG_DIR = path.join(DIST_DIR, 'img');
const SITE_URL = 'https://opendrinks.io';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function stripIndent(value) {
  return value.replace(/\n\s+/g, '\n').trim();
}

function getRecipeFiles() {
  return fs
    .readdirSync(RECIPES_DIR)
    .filter(file => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
}

function getImageMap() {
  if (!fs.existsSync(DIST_IMG_DIR)) {
    return new Map();
  }

  const imageMap = new Map();
  fs.readdirSync(DIST_IMG_DIR).forEach(file => {
    const match = file.match(/^(.*)\.[a-f0-9]{8}\.(png|jpe?g|webp|gif|svg)$/i);
    if (!match) {
      return;
    }

    const [, baseName] = match;
    imageMap.set(`${baseName}${path.extname(file).replace(/^\.[a-f0-9]{8}/, '')}`, `/img/${file}`);
    imageMap.set(baseName, `/img/${file}`);
  });

  return imageMap;
}

function resolveImagePath(imageName, imageMap) {
  if (!imageName) {
    return '';
  }

  const parsed = path.parse(imageName);
  return imageMap.get(imageName) || imageMap.get(parsed.name) || '';
}

function buildDescription(recipe) {
  const description = (recipe.description || '').trim();
  if (description) {
    return description;
  }

  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .map(ingredient => ingredient.ingredient)
        .filter(Boolean)
        .slice(0, 4)
    : [];

  if (ingredients.length > 0) {
    return `Recipe for ${recipe.name} with ${ingredients.join(', ')}.`;
  }

  return `Recipe for ${recipe.name} on Open Drinks.`;
}

function buildRecipeIngredientList(recipe) {
  if (!Array.isArray(recipe.ingredients)) {
    return [];
  }

  return recipe.ingredients
    .map(ingredient => {
      const quantity = ingredient.quantity ? String(ingredient.quantity).trim() : '';
      const measure = ingredient.measure ? String(ingredient.measure).trim() : '';
      const name = ingredient.ingredient ? String(ingredient.ingredient).trim() : '';
      return [quantity, measure, name].filter(Boolean).join(' ');
    })
    .filter(Boolean);
}

function buildRecipeInstructions(recipe) {
  if (!Array.isArray(recipe.directions)) {
    return [];
  }

  return recipe.directions
    .map(direction => (direction ? String(direction).trim() : ''))
    .filter(Boolean)
    .map((text, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text,
    }));
}

function buildRecipeCategory(recipe) {
  const drinkKeywords = Array.isArray(recipe.keywords)
    ? recipe.keywords.map(keyword => String(keyword).toLowerCase())
    : [];

  if (drinkKeywords.includes('alcoholic')) return 'Cocktail';
  if (drinkKeywords.includes('smoothie')) return 'Smoothie';
  if (drinkKeywords.includes('coffee')) return 'Coffee Drink';
  if (drinkKeywords.includes('tea')) return 'Tea';
  if (drinkKeywords.includes('juice')) return 'Juice';
  return 'Drink';
}

function injectHead(html, headMarkup) {
  return html
    .replace(/<title>[^<]*<\/title>/gi, '')
    .replace('</head>', `${headMarkup}</head>`);
}

function injectBody(html, bodyMarkup) {
  return html
    .replace(/<noscript>[\s\S]*?<\/noscript>/i, '')
    .replace('<div id="app"></div>', `<div id="app">${bodyMarkup}</div>`);
}

function renderHead(recipe, slug, imagePath) {
  const url = `${SITE_URL}/recipe/${slug}/`;
  const pageTitle = `Open Drinks - ${recipe.name}`;
  const metaDescription = buildDescription(recipe);
  const recipeIngredient = buildRecipeIngredientList(recipe);
  const recipeInstructions = buildRecipeInstructions(recipe);
  const imageUrl = imagePath ? `${SITE_URL}${imagePath}` : '';
  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'Recipe',
    name: recipe.name,
    url,
    description: metaDescription,
    image: imageUrl ? [imageUrl] : undefined,
    recipeIngredient,
    recipeInstructions,
    recipeCategory: buildRecipeCategory(recipe),
    keywords: Array.isArray(recipe.keywords) ? recipe.keywords.join(', ') : undefined,
    author: recipe.github
      ? {
          '@type': 'Person',
          name: recipe.github,
          url: `https://github.com/${recipe.github}`,
        }
      : undefined,
  };

  return stripIndent(`
    <title>${escapeHtml(pageTitle)}</title>
    <link rel="canonical" href="${escapeAttribute(url)}">
    <meta name="description" content="${escapeAttribute(metaDescription)}">
    <meta property="og:title" content="${escapeAttribute(pageTitle)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeAttribute(url)}">
    <meta property="og:site_name" content="Open Drinks">
    <meta property="og:locale" content="en_US">
    <meta property="og:description" content="${escapeAttribute(metaDescription)}">
    ${imageUrl ? `<meta property="og:image" content="${escapeAttribute(imageUrl)}">` : ''}
    ${imageUrl ? `<meta property="og:image:alt" content="${escapeAttribute(recipe.name)}">` : ''}
    <meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${escapeAttribute(pageTitle)}">
    <meta name="twitter:description" content="${escapeAttribute(metaDescription)}">
    ${imageUrl ? `<meta name="twitter:image" content="${escapeAttribute(imageUrl)}">` : ''}
    ${imageUrl ? `<meta name="twitter:image:alt" content="${escapeAttribute(recipe.name)}">` : ''}
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  `);
}

function renderBody(recipe, slug, imagePath) {
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .map(ingredient => {
          const quantity = ingredient.quantity ? String(ingredient.quantity).trim() : '';
          const measure = ingredient.measure ? String(ingredient.measure).trim() : '';
          const name = ingredient.ingredient ? String(ingredient.ingredient).trim() : '';
          return `<li>${escapeHtml([quantity, measure, name].filter(Boolean).join(' '))}</li>`;
        })
        .join('')
    : '';
  const directions = Array.isArray(recipe.directions)
    ? recipe.directions.map(direction => `<li>${escapeHtml(direction)}</li>`).join('')
    : '';
  const keywords = Array.isArray(recipe.keywords)
    ? recipe.keywords.map(keyword => `<li>${escapeHtml(keyword)}</li>`).join('')
    : '';
  const imageMarkup = imagePath
    ? `<img src="${escapeAttribute(imagePath)}" alt="${escapeAttribute(recipe.name)}" width="640">`
    : '';
  const sourceMarkup = recipe.source
    ? `<p>View full recipe at <a href="${escapeAttribute(recipe.source)}">${escapeHtml(
        recipe.source,
      )}</a></p>`
    : '';

  return stripIndent(`
    <main class="prerendered-recipe">
      <header>
        <p><a href="/">Open Drinks</a></p>
        <h1>${escapeHtml(recipe.name)}</h1>
        <p>${escapeHtml(buildDescription(recipe))}</p>
        ${recipe.github ? `<p>Contributed By: ${escapeHtml(recipe.github)}</p>` : ''}
        ${imageMarkup}
      </header>
      ${keywords ? `<section><h2>Keywords</h2><ul>${keywords}</ul></section>` : ''}
      ${ingredients ? `<section><h2>Ingredients</h2><ul>${ingredients}</ul></section>` : ''}
      ${directions ? `<section><h2>Directions</h2><ol>${directions}</ol></section>` : ''}
      ${sourceMarkup}
      <p><a href="${escapeAttribute(`/recipe/${slug}/`)}">Open the interactive recipe page</a></p>
    </main>
  `);
}

function writeRecipePage(template, recipeFile, imageMap) {
  const slug = recipeFile.replace(/\.json$/, '');
  const recipePath = path.join(RECIPES_DIR, recipeFile);
  const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
  const imagePath = resolveImagePath(recipe.image, imageMap);
  const recipeDir = path.join(DIST_DIR, 'recipe', slug);
  const recipeHtml = injectBody(
    injectHead(template, renderHead(recipe, slug, imagePath)),
    renderBody(recipe, slug, imagePath),
  );

  fs.mkdirSync(recipeDir, { recursive: true });
  fs.writeFileSync(path.join(recipeDir, 'index.html'), recipeHtml);
}

function main() {
  if (!fs.existsSync(DIST_INDEX_PATH)) {
    throw new Error('dist/index.html was not found. Run the build before prerendering recipes.');
  }

  const template = fs.readFileSync(DIST_INDEX_PATH, 'utf8');
  const imageMap = getImageMap();

  getRecipeFiles().forEach(recipeFile => {
    writeRecipePage(template, recipeFile, imageMap);
  });

  console.log(`Prerendered ${getRecipeFiles().length} recipe pages.`);
}

main();
