// ============================================================================
// GameCycle: stage tabs of the gameplay loop
// The last stage closes the loop: "New run" goes back to stage 01 with a new waybill number.
// ============================================================================
class GameCycle
{
  static ORDER_NUMBER_MIN = 1000;   // Smallest random waybill number
  static ORDER_NUMBER_MAX = 9999;   // Largest random waybill number

  // flashlight: turned off whenever the stage changes
  constructor(root, { flashlight } = {})
  {
    this.tabs = Array.from(root.querySelectorAll('.cycle__tab'));
    this.stages = Array.from(root.querySelectorAll('.cycle__stage'));
    this.restartButtons = Array.from(root.querySelectorAll('.cycle__restart'));
    this.orderNumber = root.querySelector('.waybill__order-number');
    this.flashlight = flashlight;
  }

  start()
  {
    this.tabs.forEach((tab, index) =>
    {
      tab.addEventListener('click', () => this.show(index));
    });
    this.restartButtons.forEach(button =>
    {
      button.addEventListener('click', () => this.restart());
    });
  }

  show(index)
  {
    this.tabs.forEach((tab, i) => tab.classList.toggle('cycle__tab--active', i === index));
    this.stages.forEach((stage, i) => stage.classList.toggle('cycle__stage--active', i === index));
    if (this.flashlight)
    {
      this.flashlight.reset();
    }
  }

  restart()
  {
    if (this.orderNumber)
    {
      this.orderNumber.textContent = this.getNewOrderNumber(this.orderNumber.textContent);
    }
    this.show(0);
  }

  // Random waybill number, never the same as the current one
  getNewOrderNumber(current)
  {
    const { ORDER_NUMBER_MIN: min, ORDER_NUMBER_MAX: max } = GameCycle;
    let next;
    do
    {
      next = String(min + Math.floor(Math.random() * (max - min + 1)));
    }
    while (next === current);
    return next;
  }
}
