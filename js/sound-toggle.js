// ============================================================================
// SoundToggle: header button that mutes/unmutes the rain loop, plus a volume slider
// On by default. Browsers block autoplay, so if it fails the loop starts
// on the first click or key press anywhere on the page.
// ============================================================================
class SoundToggle
{
  // root: the .header__sound block with the button, the volume slider and the audio
  constructor(root)
  {
    this.button = root.querySelector('.header__sound-button');
    this.volume = root.querySelector('.header__sound-volume');
    this.audio = root.querySelector('audio');
    this.isOn = true;
  }

  start()
  {
    this.button.addEventListener('click', () => this.setOn(!this.isOn));
    this.volume.addEventListener('input', () => this.audio.volume = Number(this.volume.value));
    this.audio.volume = Number(this.volume.value);

    // The button's own click runs first, so muting with the first click never starts the loop
    const unlock = () =>
    {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
      this.setOn(this.isOn);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);

    this.setOn(true);
  }

  setOn(isOn)
  {
    this.isOn = isOn;
    if (isOn)
    {
      this.audio.play().catch(() => {});
    }
    else
    {
      this.audio.pause();
    }
    this.button.setAttribute('aria-pressed', String(isOn));
  }
}
