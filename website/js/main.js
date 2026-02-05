/* ============================================
   Cosmic Survivors - Website JS
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollReveal();
  initAccordions();
  initTabs();
  initStars();
  highlightCurrentPage();
});

/* ---- Navbar ---- */
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  // Scroll effect
  window.addEventListener('scroll', () => {
    if (navbar) {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }
  });

  // Mobile toggle
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.textContent = links.classList.contains('open') ? '✕' : '☰';
    });

    // Close on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.textContent = '☰';
      });
    });
  }
}

/* ---- Highlight current page ---- */
function highlightCurrentPage() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/* ---- Scroll Reveal ---- */
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* ---- Accordions ---- */
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      const wasActive = item.classList.contains('active');

      // Close all in same group
      item.closest('.accordion-group')?.querySelectorAll('.accordion-item').forEach(i => {
        i.classList.remove('active');
      });

      if (!wasActive) {
        item.classList.add('active');
      }
    });
  });
}

/* ---- Tabs ---- */
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    const buttons = tabGroup.querySelectorAll('.tab-btn');
    const parent = tabGroup.closest('.tab-container') || tabGroup.parentElement;
    const contents = parent.querySelectorAll('.tab-content');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        buttons.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetContent = parent.querySelector(`[data-tab-content="${target}"]`);
        if (targetContent) targetContent.classList.add('active');
      });
    });
  });
}

/* ---- Stars Background ---- */
function initStars() {
  const container = document.querySelector('.stars-bg');
  if (!container) return;

  const count = 100;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--duration', (2 + Math.random() * 4) + 's');
    star.style.setProperty('--max-opacity', (0.3 + Math.random() * 0.7).toString());
    star.style.animationDelay = (Math.random() * 5) + 's';
    star.style.width = star.style.height = (1 + Math.random() * 2) + 'px';
    container.appendChild(star);
  }
}

/* ---- Helper: get nav HTML ---- */
function getNavHTML() {
  return `
  <nav class="navbar">
    <div class="container">
      <a href="index.html" class="nav-logo">
        <span class="logo-icon">✦</span>
        COSMIC SURVIVORS
      </a>
      <button class="nav-toggle" aria-label="Menu">☰</button>
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li>
        <li><a href="about.html">About</a></li>
        <li><a href="weapons.html">Weapons</a></li>
        <li><a href="enemies.html">Bestiary</a></li>
        <li><a href="mechanics.html">Mechanics</a></li>
        <li><a href="builds.html">Builds</a></li>
        <li><a href="media.html">Media</a></li>
        <li><a href="changelog.html">Changelog</a></li>
        <li><a href="faq.html">FAQ</a></li>
        <li><a href="play.html" class="nav-cta">Play Now</a></li>
      </ul>
    </div>
  </nav>`;
}

function getFooterHTML() {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="footer-logo text-gradient">✦ COSMIC SURVIVORS</div>
          <p>A Bullet Heaven roguelite set in deep space. Survive endless waves, collect weapons, and become the ultimate cosmic warrior.</p>
          <div class="footer-socials">
            <a href="#" aria-label="Discord">💬</a>
            <a href="#" aria-label="Twitter">🐦</a>
            <a href="#" aria-label="YouTube">📺</a>
            <a href="#" aria-label="Reddit">🔴</a>
          </div>
        </div>
        <div class="footer-col">
          <h4>Game</h4>
          <ul>
            <li><a href="about.html">About</a></li>
            <li><a href="weapons.html">Weapons</a></li>
            <li><a href="enemies.html">Bestiary</a></li>
            <li><a href="mechanics.html">Mechanics</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Community</h4>
          <ul>
            <li><a href="builds.html">Builds</a></li>
            <li><a href="faq.html">FAQ</a></li>
            <li><a href="changelog.html">Changelog</a></li>
            <li><a href="media.html">Media</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Play</h4>
          <ul>
            <li><a href="play.html">Play in Browser</a></li>
            <li><a href="#">System Requirements</a></li>
            <li><a href="#">Bug Report</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 Cosmic Survivors. Built with Phaser 4 + bitECS. All rights reserved.</p>
      </div>
    </div>
  </footer>`;
}
