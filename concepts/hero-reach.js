// hero-reach: a human hand and the model's point-cloud hand reach for a tiny black hole below the hero buttons
const hero = document.querySelector('section#home.hero');
if (hero) {
  hero.insertAdjacentHTML('beforeend', `
    <div class="hr-stage" aria-hidden="true">
      <img class="hr-hand hr-human" src="/concepts/assets/hand-human.webp" alt="" decoding="async">
      <img class="hr-hand hr-model" src="/concepts/assets/hand-model.webp" alt="" decoding="async">
      <span class="hr-signal"></span>
    </div>`);
}
