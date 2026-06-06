(function () {
  const text = 'Hello, World!';
  const el = document.getElementById('typewriter');
  let i = 0;

  function type() {
    if (i < text.length) {
      el.textContent += text[i++];
      setTimeout(type, 90);
    }
  }

  setTimeout(type, 400);
})();
