const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const form = document.getElementById('contactForm');
const formMessage = document.getElementById('formMessage');
const year = document.getElementById('year');

if (year) {
  year.textContent = new Date().getFullYear();
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    formMessage.textContent = 'Thank you! Your message has been received.';
    form.reset();
  });
}
