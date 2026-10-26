// ============================================================================
// CustomScrollbar: slim draggable thumb in place of the hidden native scrollbar
// ============================================================================
class CustomScrollbar
{
  static MIN_THUMB_HEIGHT = 48;     // Shortest thumb on very long pages, px

  constructor(root)
  {
    this.track = root;
    this.thumb = root.querySelector('.scrollbar__thumb');
    this.drag = null;
  }

  start()
  {
    window.addEventListener('scroll', () => this.update(), { passive: true });
    window.addEventListener('resize', () => this.update());

    this.thumb.addEventListener('mousedown', (event) => this.onDragStart(event));
    window.addEventListener('mousemove', (event) => this.onDragMove(event));
    window.addEventListener('mouseup', () => this.onDragEnd());
    // A click on the track jumps to the matching point of the page
    this.track.addEventListener('click', (event) =>
    {
      if (event.target === this.thumb)
      {
        return;
      }
      const { maxScroll } = this.getMetrics();
      window.scrollTo({ top: event.clientY / window.innerHeight * maxScroll, behavior: 'smooth' });
    });

    this.update();
  }

  getMetrics()
  {
    const viewHeight = window.innerHeight;
    const pageHeight = document.documentElement.scrollHeight;
    const thumbHeight = Math.max(CustomScrollbar.MIN_THUMB_HEIGHT, viewHeight * viewHeight / pageHeight);
    return {
      maxScroll: pageHeight - viewHeight,
      thumbHeight,
      trackSpace: viewHeight - thumbHeight,
    };
  }

  update()
  {
    const { maxScroll, thumbHeight, trackSpace } = this.getMetrics();
    if (maxScroll <= 0)
    {
      this.thumb.style.display = 'none';
      return;
    }
    this.thumb.style.display = 'block';
    this.thumb.style.height = `${thumbHeight}px`;
    this.thumb.style.transform = `translateY(${window.scrollY / maxScroll * trackSpace}px)`;
  }

  onDragStart(event)
  {
    event.preventDefault();
    this.drag = { startY: event.clientY, startScroll: window.scrollY };
    this.thumb.classList.add('scrollbar__thumb--dragging');
    document.body.style.userSelect = 'none';
  }

  onDragMove(event)
  {
    if (!this.drag)
    {
      return;
    }
    const { maxScroll, trackSpace } = this.getMetrics();
    window.scrollTo(0, this.drag.startScroll + (event.clientY - this.drag.startY) / trackSpace * maxScroll);
  }

  onDragEnd()
  {
    if (!this.drag)
    {
      return;
    }
    this.drag = null;
    this.thumb.classList.remove('scrollbar__thumb--dragging');
    document.body.style.userSelect = '';
  }
}
