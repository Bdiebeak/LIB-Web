// ============================================================================
// Flashlight: a beam that lights the dark room under the pointer (cycle stage 02)
// The beam follows the pointer anywhere over the stage, including the area under the text.
// ============================================================================
class Flashlight
{
  // element: the .flashlight room; hoverArea: where the pointer drives the beam
  constructor(element, hoverArea)
  {
    this.element = element;
    this.hoverArea = hoverArea;
  }

  start()
  {
    const follow = (event) => this.moveTo(event.clientX, event.clientY);
    this.hoverArea.addEventListener('pointerenter', follow);
    this.hoverArea.addEventListener('pointermove', follow);
    this.hoverArea.addEventListener('pointerleave', () => this.reset());
  }

  moveTo(clientX, clientY)
  {
    const rect = this.element.getBoundingClientRect();
    this.element.style.setProperty('--beam-x', `${Math.round(clientX - rect.left)}px`);
    this.element.style.setProperty('--beam-y', `${Math.round(clientY - rect.top)}px`);
    this.element.classList.add('flashlight--on');
  }

  // Turns the beam off
  reset()
  {
    this.element.classList.remove('flashlight--on');
    this.element.style.removeProperty('--beam-x');
    this.element.style.removeProperty('--beam-y');
  }
}
