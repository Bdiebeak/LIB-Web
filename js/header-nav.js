// ============================================================================
// HeaderNav: smooth scroll to sections and highlight of the current section's link
// ============================================================================
class HeaderNav
{
  // Where the page stops after a link click, relative to the section top, px:
  // < 0 = higher (shows a bit of the previous section), > 0 = lower, 0 = exactly at the section top
  static SCROLL_OFFSETS = Object.freeze({
    '#about': 0,
    '#cycle': 50,
    '#world': -10,
    '#feedback': -20,
  });

  // The active link belongs to the section that last crossed this line, as a share of the screen height
  static ACTIVE_LINE = 0.4;

  constructor(nav)
  {
    this.items = Array.from(nav.querySelectorAll('.header__link'))
      .map(link => ({ link, target: document.querySelector(link.getAttribute('href')) }))
      .filter(item => item.target);
    this.isUpdateQueued = false;
  }

  start()
  {
    this.items.forEach(({ link, target }) =>
    {
      link.addEventListener('click', (event) =>
      {
        event.preventDefault();
        this.scrollTo(link.getAttribute('href'), target);
      });
    });

    // Updated at most once per frame while scrolling
    window.addEventListener('scroll', () =>
    {
      if (!this.isUpdateQueued)
      {
        this.isUpdateQueued = true;
        requestAnimationFrame(() => this.updateActive());
      }
    }, { passive: true });
    window.addEventListener('resize', () => this.updateActive());
    this.updateActive();
  }

  scrollTo(hash, target)
  {
    const offset = HeaderNav.SCROLL_OFFSETS[hash] || 0;
    window.scrollTo({ top: target.offsetTop + offset, behavior: 'smooth' });
    history.pushState(null, '', hash);
  }

  updateActive()
  {
    this.isUpdateQueued = false;
    const line = window.innerHeight * HeaderNav.ACTIVE_LINE;
    let current = null;
    this.items.forEach(item =>
    {
      const top = item.target.getBoundingClientRect().top;
      if (top <= line && (!current || top > current.top))
      {
        current = { link: item.link, top };
      }
    });
    this.items.forEach(({ link }) => link.classList.toggle('header__link--active', !!current && link === current.link));
  }
}
