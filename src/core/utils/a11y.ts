// ============================================================
// Accessibility Audit Prompt Additions
// WCAG 2.1 AA compliance checks injected into review phase
// ============================================================

export function getA11yPromptAdditions(): string {
  return `
ACCESSIBILITY AUDIT (WCAG 2.1 AA):
After reviewing the code, also check for these accessibility requirements:

1. PERCEIVABLE:
   - All images have meaningful alt text (not "image" or "photo")
   - Color is not the only means of conveying information
   - Text has sufficient color contrast (4.5:1 for normal text, 3:1 for large text)
   - Content is readable and functional at 200% zoom

2. OPERABLE:
   - All interactive elements are keyboard accessible (Tab, Enter, Space, Escape)
   - Focus order is logical and visible (no outline:none without replacement)
   - Skip navigation link for keyboard users
   - No keyboard traps (user can always Tab out)
   - Touch targets are at least 44x44px on mobile

3. UNDERSTANDABLE:
   - Form inputs have associated <label> elements
   - Error messages are clear and specific
   - Language attribute set on <html> tag
   - Consistent navigation patterns across pages

4. ROBUST:
   - Semantic HTML elements (nav, main, header, footer, article, section)
   - ARIA roles and labels where semantic HTML isn't sufficient
   - ARIA landmarks for page regions
   - Live regions (aria-live) for dynamic content updates

FIX directly if you find:
- Missing alt text on images
- Missing form labels
- Missing lang attribute
- Non-semantic containers that should be semantic elements
- Missing skip navigation

REPORT (do not fix) if you find:
- Color contrast issues (requires visual verification)
- Keyboard trap issues
- Complex ARIA patterns that need careful testing
`.trim();
}
