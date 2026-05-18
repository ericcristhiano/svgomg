const previewCss = [
  '.ca-icon__colored-fill { fill: #E91E63 !important; }',
  '.ca-icon__colored-stroke { stroke: #2196F3 !important; }',
].join(' ');

/**
 * Add styleguide classes to SVG elements with fill/stroke attributes.
 * @param {string} svgText - The SVG markup string.
 * @param {object} [options] - Options object.
 * @param {boolean} [options.includePreviewStyles=true] - Whether to inject
 *   preview CSS into the SVG. Set to false for a "clean" version that has
 *   classes but no visual override styles.
 * @returns {string} The modified SVG markup.
 */
export function addStyleguideClasses(
  svgText,
  { includePreviewStyles = true } = {},
) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.documentElement;

  const elements = doc.querySelectorAll('[fill], [stroke]');

  for (const el of elements) {
    const fill = el.getAttribute('fill');
    const stroke = el.getAttribute('stroke');

    if (fill && fill !== 'none') {
      el.classList.add('ca-icon__colored-fill');
    }

    if (stroke && stroke !== 'none') {
      el.classList.add('ca-icon__colored-stroke');
    }
  }

  if (includePreviewStyles) {
    const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = previewCss;
    svgEl.insertBefore(styleEl, svgEl.firstChild);
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svgEl);
}
