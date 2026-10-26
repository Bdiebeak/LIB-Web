// ============================================================================
// Shared helpers
// ============================================================================

// True when the visitor asked the OS to reduce motion: animations stay off
function prefersReducedMotion()
{
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
