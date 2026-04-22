/**
 * Lazy Image Loader — defers off-screen image loading until scroll.
 *
 * Usage:
 *   <img data-src="assets/hero.png" alt="Hero">
 *   <script src="lazy-load.js"></script>
 *
 * Automatically initializes on DOMContentLoaded.
 */

(function lazyLoad() {
  'use strict';

  const images = document.querySelectorAll('img[data-src]');
  if (!images.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
            }
            observer.unobserve(img);
          }
        });
      },
      { rootMargin: '200px 0px' }
    );
    images.forEach((img) => observer.observe(img));
  } else {
    // Fallback for browsers without IntersectionObserver
    images.forEach((img) => {
      const src = img.dataset.src;
      if (src) {
        img.src = src;
        img.removeAttribute('data-src');
      }
    });
  }
})();
