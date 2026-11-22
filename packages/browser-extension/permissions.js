// Página de permisos (permissions.html). chrome.permissions.request solo funciona con un clic real
// en una página de la extensión: desde el service worker Chrome lo rechaza.
const ALL_SITES = { origins: ['<all_urls>'] };
const button = document.getElementById('allow');
const statusEl = document.getElementById('status');

function showGranted() {
  button.disabled = true;
  button.textContent = 'Permiso concedido';
  statusEl.className = 'ok';
  statusEl.textContent = 'Listo. Ya puedes cerrar esta pestaña y volver a enviar el componente.';
}

chrome.permissions.contains(ALL_SITES).then(granted => {
  if (granted) showGranted();
});

button.addEventListener('click', async () => {
  try {
    const granted = await chrome.permissions.request(ALL_SITES);
    if (granted) {
      showGranted();
      setTimeout(() => window.close(), 1500);
    } else {
      statusEl.className = '';
      statusEl.textContent = 'Sin el permiso, las imágenes de otros dominios llegarán vacías a Figma.';
    }
  } catch (err) {
    statusEl.className = '';
    statusEl.textContent = 'No se pudo pedir el permiso: ' + (err && err.message ? err.message : err);
  }
});
