// ============================================================================
// LocationsSlider: location cards with tabs
// Picking a tab by hand reports it (so the van can drive there on the map).
// Keeps the live rain cut off above the active card's text.
// ============================================================================
class LocationsSlider
{
  // onSelect(index) is called when a tab is picked by hand
  constructor(root, { onSelect } = {})
  {
    this.slides = Array.from(root.querySelectorAll('.locations__slide'));
    this.tabs = Array.from(root.querySelectorAll('.locations__tab'));
    this.rain = root.querySelector('.locations__rain');
    this.onSelect = onSelect;
  }

  start()
  {
    this.tabs.forEach((tab, index) =>
    {
      tab.addEventListener('click', () =>
      {
        this.show(index);
        if (this.onSelect)
        {
          this.onSelect(index);
        }
      });
    });

    // The cut-off follows the text: a shown card's text changes size, which triggers the observer too
    const bodies = this.slides.map(slide => slide.querySelector('.locations__body'));
    const observer = new ResizeObserver(() => this.updateRainCutoff());
    bodies.forEach(body => observer.observe(body));
  }

  show(index)
  {
    if (index < 0 || index >= this.slides.length)
    {
      return;
    }
    this.slides.forEach((slide, i) => slide.classList.toggle('locations__slide--active', i === index));
    this.tabs.forEach((tab, i) => tab.classList.toggle('locations__tab--active', i === index));
  }

  getActiveIndex()
  {
    return this.slides.findIndex(slide => slide.classList.contains('locations__slide--active'));
  }

  // The rain mask (see .locations__rain) ends above the text of the active card
  updateRainCutoff()
  {
    const body = this.slides[this.getActiveIndex()].querySelector('.locations__body');
    this.rain.style.setProperty('--rain-cutoff', `${body.offsetTop}px`);
  }
}
