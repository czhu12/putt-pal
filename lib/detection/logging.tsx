export function log(message: string) {
  console.log(message);
  const el = document.getElementById('debug-log');
  if (el) {
    el.innerHTML += `<span class="text-blue-500">${message}</span><br>`;
  }
}

export function error(message: string) {
  console.error(message);
  const el = document.getElementById('debug-log');
  if (el) {
    el.innerHTML += `<span class="text-red-500">${message}</span><br>`;
  }
}