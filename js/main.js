// ============================================================================
// Entry point: creates the page components and wires them together.
// Loaded last (all scripts are deferred), so the DOM is ready.
// ============================================================================
function initPage()
{
  new CustomScrollbar(document.querySelector('.scrollbar')).start();
  new HeaderNav(document.querySelector('.header__nav')).start();
  new SoundToggle(document.querySelector('.header__sound')).start();

  // Rain on the hero, the location cards and the outro
  if (!prefersReducedMotion())
  {
    document.querySelectorAll('[data-live-rain]').forEach(canvas => new RainStreaks(canvas).start());
  }

  new Windshield(document.querySelector('.about__visual')).start();

  // Gameplay loop: the flashlight on stage 02 turns off when the stage changes
  const flashlightRoom = document.querySelector('.flashlight');
  const flashlight = new Flashlight(flashlightRoom, flashlightRoom.closest('.cycle__stage'));
  flashlight.start();
  new GameCycle(document.querySelector('.cycle'), { flashlight }).start();

  // World: driving onto a location opens its card; picking a card drives the van there
  const locations = new LocationsSlider(document.querySelector('.locations'), {
    onSelect: (index) => worldMap.moveToLocation(index),
  });
  const worldMap = new WorldMap(document.querySelector('.navigator'), {
    onLocationReached: (index) => locations.show(index),
  });
  locations.start();
  worldMap.start();
}

initPage();
