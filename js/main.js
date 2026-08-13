const DESKTOP = '(min-width: 48rem)';
const MIN_THUMB_WIDTH = 40;
const DRAG_THRESHOLD = 4;
const DRAGGING_CLASSES = ['select-none', 'cursor-grabbing'];
const ENHANCED_CLASS = 'js-enhanced';

if (!customElements.get('product-slider')) {
  class ProductSlider extends HTMLElement {
    connectedCallback() {
      this.list = this.querySelector('[data-slider-track]');
      this.bar = this.querySelector('[data-scrollbar]');
      this.thumb = this.querySelector('[data-scrollbar-thumb]');
      if (!this.list || !this.bar || !this.thumb) return;

      document.documentElement.classList.add(ENHANCED_CLASS);

      this.thumbFrom = null;
      this.slideFrom = null;
      this.dragged = false;

      this.sync = this.sync.bind(this);
      this.onThumbDown = this.onThumbDown.bind(this);
      this.onThumbMove = this.onThumbMove.bind(this);
      this.onThumbUp = this.onThumbUp.bind(this);
      this.onTrackDown = this.onTrackDown.bind(this);
      this.onSlideDown = this.onSlideDown.bind(this);
      this.onSlideMove = this.onSlideMove.bind(this);
      this.onSlideUp = this.onSlideUp.bind(this);

      this.list.addEventListener('scroll', this.sync, { passive: true });
      window.addEventListener('resize', this.sync);

      this.thumb.addEventListener('pointerdown', this.onThumbDown);
      this.thumb.addEventListener('pointermove', this.onThumbMove);
      this.thumb.addEventListener('pointerup', this.onThumbUp);
      this.thumb.addEventListener('pointercancel', this.onThumbUp);

      this.bar.addEventListener('pointerdown', this.onTrackDown);

      this.list.addEventListener('pointerdown', this.onSlideDown);
      this.list.addEventListener('pointermove', this.onSlideMove);
      this.list.addEventListener('pointerup', this.onSlideUp);
      this.list.addEventListener('pointercancel', this.onSlideUp);
      this.list.addEventListener('dragstart', (event) => event.preventDefault());

      if (document.fonts) document.fonts.ready.then(this.sync);
      this.sync();
    }

    get maxScroll() {
      return this.list.scrollWidth - this.list.clientWidth;
    }

    get thumbWidth() {
      const ratio = this.list.clientWidth / this.list.scrollWidth;
      return Math.max(MIN_THUMB_WIDTH, Math.round(this.bar.clientWidth * ratio));
    }

    get travel() {
      return this.bar.clientWidth - this.thumbWidth;
    }

    sync() {
      const width = this.thumbWidth;
      const progress = this.maxScroll > 0 ? this.list.scrollLeft / this.maxScroll : 0;
      this.thumb.style.width = `${width}px`;
      this.thumb.style.left = `${Math.round(progress * this.travel)}px`;

      const scrollable = this.maxScroll > 0;
      this.bar.style.visibility = scrollable ? '' : 'hidden';
      if (scrollable) this.list.setAttribute('tabindex', '0');
      else this.list.removeAttribute('tabindex');
    }

    scrollToThumb(left) {
      if (this.travel <= 0) return;
      const clamped = Math.min(Math.max(left, 0), this.travel);
      this.list.scrollLeft = (clamped / this.travel) * this.maxScroll;
      this.sync();
    }

    onThumbDown(event) {
      event.preventDefault();
      this.thumbFrom = { x: event.clientX, left: parseFloat(this.thumb.style.left) || 0 };
      this.thumb.setPointerCapture(event.pointerId);
      document.body.classList.add(...DRAGGING_CLASSES);
    }

    onThumbMove(event) {
      if (!this.thumbFrom) return;
      this.scrollToThumb(this.thumbFrom.left + (event.clientX - this.thumbFrom.x));
    }

    onThumbUp(event) {
      if (!this.thumbFrom) return;
      this.thumbFrom = null;
      if (this.thumb.hasPointerCapture(event.pointerId)) this.thumb.releasePointerCapture(event.pointerId);
      document.body.classList.remove(...DRAGGING_CLASSES);
    }

    onTrackDown(event) {
      if (event.target === this.thumb) return;
      this.scrollToThumb(event.clientX - this.bar.getBoundingClientRect().left - this.thumbWidth / 2);
    }

    onSlideDown(event) {
      if (event.pointerType !== 'mouse' || event.button !== 0 || this.maxScroll <= 0) return;
      this.slideFrom = { x: event.clientX, scroll: this.list.scrollLeft };
      this.dragged = false;
    }

    onSlideMove(event) {
      if (!this.slideFrom) return;
      const dx = event.clientX - this.slideFrom.x;
      if (!this.dragged && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!this.dragged) {
        this.dragged = true;
        this.list.setPointerCapture(event.pointerId);
        document.body.classList.add(...DRAGGING_CLASSES);
      }
      this.list.scrollLeft = this.slideFrom.scroll - dx;
      this.sync();
    }

    onSlideUp(event) {
      if (!this.slideFrom) return;
      this.slideFrom = null;
      if (this.list.hasPointerCapture(event.pointerId)) this.list.releasePointerCapture(event.pointerId);
      document.body.classList.remove(...DRAGGING_CLASSES);

      if (this.dragged) {
        const swallow = (click) => {
          click.preventDefault();
          click.stopPropagation();
          this.list.removeEventListener('click', swallow, true);
        };
        this.list.addEventListener('click', swallow, true);
        setTimeout(() => { this.dragged = false; }, 0);
      }
    }
  }

  customElements.define('product-slider', ProductSlider);
}

if (!customElements.get('show-more')) {
  class ShowMore extends HTMLElement {
    connectedCallback() {
      this.button = this.querySelector('button');
      if (!this.button) return;

      this.list = document.getElementById(this.button.getAttribute('aria-controls'));
      if (!this.list) return;

      this.visible = Number(this.dataset.visible) || 0;
      this.moreLabel = this.dataset.moreLabel || this.button.textContent.trim();
      this.lessLabel = this.dataset.lessLabel || this.moreLabel;
      this.hidden_ = [...this.list.children].slice(this.visible);
      if (!this.hidden_.length) return;

      this.desktop = window.matchMedia(DESKTOP);
      this.onToggle = this.onToggle.bind(this);
      this.apply = this.apply.bind(this);

      this.button.addEventListener('click', this.onToggle);
      this.desktop.addEventListener('change', this.apply);
      window.addEventListener('resize', this.apply);

      this.expanded = false;
      this.apply();

      if (document.fonts) document.fonts.ready.then(this.apply);

      this.observer = new ResizeObserver(this.apply);
      this.observer.observe(this.list.children[this.visible - 1]);
    }

    disconnectedCallback() {
      if (this.observer) this.observer.disconnect();
    }

    get collapsedHeight() {
      const last = this.list.children[this.visible - 1];
      return Math.round(last.getBoundingClientRect().bottom - this.list.getBoundingClientRect().top);
    }

    apply() {
      if (this.desktop.matches) {
        this.list.removeAttribute('data-collapsed');
        this.list.style.removeProperty('--collapsed-height');
        this.list.style.removeProperty('--expanded-height');
        this.hidden_.forEach((item) => item.removeAttribute('inert'));
        return;
      }

      this.setHeight('--collapsed-height', this.collapsedHeight);
      this.setHeight('--expanded-height', this.list.scrollHeight);

      if (this.expanded) {
        this.list.removeAttribute('data-collapsed');
        this.hidden_.forEach((item) => item.removeAttribute('inert'));
      } else {
        this.list.setAttribute('data-collapsed', '');
        this.hidden_.forEach((item) => item.setAttribute('inert', ''));
      }

      this.button.setAttribute('aria-expanded', String(this.expanded));
      this.button.textContent = this.expanded ? this.lessLabel : this.moreLabel;
    }

    setHeight(name, value) {
      const next = `${value}px`;
      if (this.list.style.getPropertyValue(name) === next) return;
      this.list.style.setProperty(name, next);
    }

    onToggle() {
      this.list.setAttribute('data-animate', '');
      this.expanded = !this.expanded;
      this.apply();
    }
  }

  customElements.define('show-more', ShowMore);
}
